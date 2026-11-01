import { execFile } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';

/**
 * Regras de otimização por tipo de arquivo (Armazenamento e otimização, 4.8.0).
 *
 * Princípios: nada com perdas em documentos; PDF assinado, criptografado ou de origem oficial (GED, formulários,
 * chamados) nunca é reescrito; um resultado só substitui o arquivo se passar nas conferências de integridade.
 */

// Menos threads e cache menor no libvips: as fotos são processadas uma de cada vez, sem picos de CPU e RAM.
sharp.concurrency(Math.max(1, Number(process.env.IMAGE_THREADS ?? 2) || 2));
sharp.cache({ memory: 64, files: 0, items: 50 });

export const sha256Buffer = (b: Buffer) => createHash('sha256').update(b).digest('hex');

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

export type Categoria = 'imagem' | 'pdf' | 'office' | 'video' | 'audio' | 'texto' | 'outro';

export function categoriaDe(mime: string): Categoria {
  if (mime.startsWith('image/')) return 'imagem';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/')) return 'texto';
  if (mime.includes('officedocument') || mime === 'application/x-cfb') return 'office';
  return 'outro';
}

// ───────── Office (DOCX, XLSX, PPTX): conferência do ZIP interno, sem recompressão ─────────

export interface ZipInfo {
  entradas: number;
  compactado: number;
  descompactado: number;
  macros: boolean;
}

const ZIP_MAX_ENTRADAS = 20_000;
const ZIP_MAX_DESCOMPACTADO = Number(process.env.MAX_DESCOMPACTADO_MB ?? 512) * 1024 * 1024;
const ZIP_MAX_TAXA = 200;

/**
 * Lê o diretório central do ZIP (sem descompactar nada) e recusa "bombas de ZIP": tamanho descompactado
 * exagerado, taxa de compressão absurda, entradas demais, ZIP64 ou nomes com caminho (../, /, C:).
 * Retorna o erro em português ou as informações do arquivo.
 */
export function inspecionarZip(buf: Buffer): ZipInfo | { erro: string } {
  const min = Math.max(0, buf.length - 65_557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return { erro: 'Arquivo do Office corrompido (estrutura ZIP não encontrada).' };
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return { erro: 'Arquivo do Office com formato ZIP64 não é aceito.' };
  if (total > ZIP_MAX_ENTRADAS) return { erro: 'Arquivo do Office com partes internas demais.' };
  if (cdOffset + cdSize > buf.length) return { erro: 'Arquivo do Office corrompido.' };
  let p = cdOffset;
  let compactado = 0;
  let descompactado = 0;
  let macros = false;
  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return { erro: 'Arquivo do Office corrompido.' };
    const comp = buf.readUInt32LE(p + 20);
    const desc = buf.readUInt32LE(p + 24);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comLen = buf.readUInt16LE(p + 32);
    if (comp === 0xffffffff || desc === 0xffffffff) return { erro: 'Arquivo do Office com formato ZIP64 não é aceito.' };
    const nome = buf.subarray(p + 46, p + 46 + nomeLen).toString('utf8');
    if (nome.includes('..') || nome.startsWith('/') || nome.includes('\\') || /^[a-z]:/i.test(nome)) return { erro: 'Arquivo do Office com caminho interno inválido.' };
    if (/vbaProject\.bin$/i.test(nome)) macros = true;
    if (desc > 1024 * 1024 && desc / Math.max(comp, 1) > ZIP_MAX_TAXA) return { erro: 'Arquivo do Office recusado: compressão suspeita (possível bomba de ZIP).' };
    compactado += comp;
    descompactado += desc;
    if (descompactado > ZIP_MAX_DESCOMPACTADO) return { erro: 'Arquivo do Office recusado: conteúdo descompactado grande demais.' };
    p += 46 + nomeLen + extraLen + comLen;
  }
  return { entradas: total, compactado, descompactado, macros };
}

export const ehOoxml = (mime: string) => mime.includes('officedocument');

// ───────── Imagens ─────────

/** Lado maior de uma foto guardada: sobra para tela cheia e corta as fotos de celular de 4000 px ou mais. */
export const LADO_MAX = 2560;
/** Formatos que o servidor reduz e converte (GIF fica como veio, por causa da animação). */
export const REDUZ = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
/** Ganho mínimo para regravar uma foto que já veio pequena e sem metadados (evita perda de qualidade à toa). */
const GANHO_MINIMO = 0.1;

export type FormatoSaida = 'jpeg' | 'png' | 'webp' | 'avif';

export const formatoDe = (mime: string): FormatoSaida => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/avif' ? 'avif' : 'jpeg');

/** Reduz, gira conforme a câmera e regrava a foto sem os metadados (EXIF com localização GPS, modelo do aparelho). */
export async function reduzirFoto(buffer: Buffer, formato: FormatoSaida, largura = LADO_MAX, alfaDePng = false): Promise<Buffer> {
  const img = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: largura, height: largura === LADO_MAX ? LADO_MAX : undefined, fit: 'inside', withoutEnlargement: true });
  if (formato === 'png') return img.png({ compressionLevel: 9, effort: 7 }).toBuffer();
  // PNG (logos, prints de tela) vira WebP "quase sem perdas" para não borrar bordas e textos
  if (formato === 'webp') return (alfaDePng ? img.webp({ nearLossless: true, quality: 80, effort: 4 }) : img.webp({ quality: 80, effort: 4 })).toBuffer();
  if (formato === 'avif') return img.avif({ quality: 55, effort: 2 }).toBuffer();
  return img.jpeg({ quality: 80, mozjpeg: true, progressive: true }).toBuffer();
}

export interface FotoPreparada {
  buffer: Buffer;
  nota: string;
  regravada: boolean;
}

/**
 * Decide o que fazer com a foto recebida: reduz quando passa de 2560 px, regrava quando tem metadados (privacidade)
 * e, quando já veio otimizada, mantém o arquivo como veio se a recompressão não ganhar pelo menos 10%.
 * Lança erro se a imagem não puder ser lida.
 */
export async function prepararFoto(buffer: Buffer, mime: string): Promise<FotoPreparada> {
  const meta = await sharp(buffer, { failOn: 'error' }).metadata();
  const grande = (meta.width ?? 0) > LADO_MAX || (meta.height ?? 0) > LADO_MAX;
  const metadados = !!(meta.exif || meta.iptc || meta.xmp) || (meta.orientation !== undefined && meta.orientation !== 1);
  const out = await reduzirFoto(buffer, formatoDe(mime));
  if (grande) return { buffer: out, nota: `reduzida de ${meta.width}×${meta.height} px`, regravada: true };
  if (metadados) return { buffer: out, nota: 'metadados (EXIF/GPS) removidos', regravada: true };
  if (out.length <= buffer.length * (1 - GANHO_MINIMO)) return { buffer: out, nota: 'recomprimida', regravada: true };
  return { buffer, nota: 'já otimizada: mantida como veio', regravada: false };
}

/** Formato moderno que o navegador aceita (cabeçalho Accept), para entregar a foto convertida. */
export function formatoAceito(accept: string | undefined, mime: string): FormatoSaida {
  const a = accept ?? '';
  if (mime === 'image/avif') return a.includes('image/avif') ? 'avif' : a.includes('image/webp') ? 'webp' : 'jpeg';
  if (a.includes('image/webp')) return 'webp';
  return formatoDe(mime);
}

export const MIME_DO_FORMATO: Record<FormatoSaida, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };
export const EXT_DO_FORMATO: Record<FormatoSaida, string> = { jpeg: '.jpg', png: '.png', webp: '.webp', avif: '.avif' };

// ───────── PDF: otimização sem perdas, só quando é seguro ─────────

const QPDF = process.env.QPDF_BIN || 'qpdf';
const PDFTOTEXT = process.env.PDFTOTEXT_BIN || 'pdftotext';
const PDFTOPPM = process.env.PDFTOPPM_BIN || 'pdftoppm';
const PDFINFO = process.env.PDFINFO_BIN || 'pdfinfo';

function run(bin: string, args: string[], timeout = 120_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'latin1' }, (err: any, stdout, stderr) => {
      if (err && (err.code === 'ENOENT' || err.killed)) return reject(err);
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** Marcas de assinatura digital, certificação ou criptografia no texto bruto do PDF. */
const MARCAS_PROTEGIDO = [/\/ByteRange\s*\[/, /\/Type\s*\/Sig\b/, /\/SubFilter\s*\/(adbe|ETSI)/i, /\/DocMDP\b/, /\/Perms\b/, /\/Encrypt\b/, /\/DSS\b/];

/**
 * O PDF tem assinatura digital, certificação, carimbo de tempo ou senha? Confere o texto bruto e, com o qpdf,
 * os campos do formulário (assinaturas podem estar dentro de fluxos compactados). Na dúvida, responde que sim.
 */
export async function pdfProtegido(file: string): Promise<string | null> {
  const bruto = (await fs.readFile(file)).toString('latin1');
  const marca = MARCAS_PROTEGIDO.find((r) => r.test(bruto));
  if (marca) return /Encrypt/.test(marca.source) ? 'PDF protegido por senha ou criptografia' : 'PDF com assinatura digital ou certificação';
  const enc = await run(QPDF, ['--is-encrypted', file]);
  if (enc.code === 0) return 'PDF protegido por senha ou criptografia';
  const json = await run(QPDF, ['--json=2', '--json-key=acroform', '--json-key=qpdf', file]);
  if (json.code !== 0 && json.code !== 3) return 'PDF que o verificador não conseguiu ler por inteiro';
  if (/"fieldtype"\s*:\s*"\/Sig"/.test(json.stdout) || /\/ByteRange|\/Type"\s*:\s*"\/Sig"/.test(json.stdout)) return 'PDF com campo de assinatura digital';
  return null;
}

async function paginas(file: string) {
  const r = await run(PDFINFO, [file], 30_000);
  const m = /^Pages:\s+(\d+)/m.exec(r.stdout);
  return r.code === 0 && m ? Number(m[1]) : 0;
}

async function texto(file: string) {
  const r = await run(PDFTOTEXT, ['-q', '-enc', 'UTF-8', file, '-'], 120_000);
  if (r.code !== 0) throw new Error('pdftotext falhou');
  return r.stdout;
}

/** Imagem da página em pixels crus (baixa resolução), para comparar o visual antes e depois. */
async function pixels(file: string, pagina: number, dir: string) {
  const prefix = path.join(dir, `p${pagina}-${randomUUID()}`);
  const r = await run(PDFTOPPM, ['-r', '40', '-gray', '-f', String(pagina), '-l', String(pagina), '-singlefile', '-png', file, prefix], 60_000);
  if (r.code !== 0) throw new Error('pdftoppm falhou');
  const raw = await sharp(`${prefix}.png`).raw().toBuffer();
  await fs.rm(`${prefix}.png`, { force: true });
  return raw;
}

export interface ResultadoPdf {
  ok: boolean;
  /** caminho do PDF otimizado (temporário) quando vale a pena trocar */
  arquivo?: string;
  antes: number;
  depois?: number;
  nota: string;
}

/** Ganho mínimo para trocar o PDF: 5% e 20 KB. Abaixo disso o original fica como está. */
const PDF_GANHO_MIN = 0.05;
const PDF_GANHO_MIN_BYTES = 20 * 1024;

/**
 * Reescreve o PDF sem perdas com o qpdf (fluxos de objetos, recompressão Flate nível 9, linearizado para abrir rápido
 * no navegador). Imagens e fontes não são reamostradas. O resultado só é aceito se: o qpdf não acusar erro, o número
 * de páginas for igual, o texto extraído for idêntico e a primeira e a última página ficarem iguais pixel a pixel.
 */
export async function otimizarPdf(file: string): Promise<ResultadoPdf> {
  const antes = (await fs.stat(file)).size;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfopt-'));
  const saida = path.join(dir, 'otimizado.pdf');
  let manter = false;
  try {
    const r = await run(QPDF, ['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9', '--linearize', '--', file, saida], 300_000);
    if (r.code !== 0) return { ok: false, antes, nota: `qpdf não conseguiu reescrever (código ${r.code})` };
    const depois = (await fs.stat(saida)).size;
    if (antes - depois < Math.max(antes * PDF_GANHO_MIN, PDF_GANHO_MIN_BYTES)) return { ok: true, antes, depois, nota: 'sem ganho relevante: original mantido' };
    const check = await run(QPDF, ['--check', saida]);
    if (check.code !== 0) return { ok: false, antes, depois, nota: 'resultado reprovado na conferência do qpdf' };
    const [pa, pd] = await Promise.all([paginas(file), paginas(saida)]);
    if (!pa || pa !== pd) return { ok: false, antes, depois, nota: `páginas não conferem (${pa} → ${pd})` };
    if ((await texto(file)) !== (await texto(saida))) return { ok: false, antes, depois, nota: 'texto extraído não confere' };
    for (const p of new Set([1, pa])) {
      if (!(await pixels(file, p, dir)).equals(await pixels(saida, p, dir))) return { ok: false, antes, depois, nota: `página ${p} ficou diferente` };
    }
    manter = true;
    return { ok: true, arquivo: saida, antes, depois, nota: `reduzido sem perdas (${pa} página${pa > 1 ? 's conferidas' : ' conferida'})` };
  } finally {
    // quem chamou move o arquivo otimizado; o resto da pasta temporária sai daqui
    if (!manter) await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** O qpdf está instalado? (sem ele os PDFs ficam como vieram) */
export async function qpdfDisponivel() {
  return run(QPDF, ['--version'], 10_000).then((r) => r.code === 0).catch(() => false);
}
