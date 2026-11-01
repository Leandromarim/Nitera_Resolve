import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { FileOptStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EXT_DO_FORMATO, FormatoSaida, LADO_MAX, formatoDe, MIME_DO_FORMATO, REDUZ, ehOoxml, formatoAceito, inspecionarZip, prepararFoto, reduzirFoto, sha256Buffer } from './otimizacao';

// file-type identifica o arquivo pelo conteúdo (magic bytes), não pela extensão. É ESM: o Node 22 carrega com require.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fileTypeFromBuffer, fileTypeFromFile } = require('file-type');
// a versão nova devolve parâmetros no tipo ("audio/ogg; codecs=opus"): fica só o tipo, como antes
const semParametros = (r?: { ext: string; mime: string }) => r && { ...r, mime: r.mime.split(';')[0].trim() };
const FileType = {
  fromBuffer: async (b: Buffer) => semParametros(await fileTypeFromBuffer(b)),
  fromFile: async (p: string) => semParametros(await fileTypeFromFile(p)),
};

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  // áudios gravados no chat (Chrome/Edge: webm, Firefox: ogg/opus, iPhone/Safari: m4a)
  'audio/opus': 'opus',
  'audio/webm': 'weba',
  'video/webm': 'webm',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/vnd.wave': 'wav',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/x-cfb': 'doc', // .doc/.xls/.ppt antigos
};
const TEXT_EXT: Record<string, string> = { txt: 'text/plain', csv: 'text/csv' };

/** Larguras pedidas pelas telas (?w=); qualquer outro valor é recusado para não lotar o disco de variações. */
export const LARGURAS = [320, 640, 1280, 1920] as const;
/** Fotos antigas acima disto são entregues numa cópia reduzida (o original fica guardado). */
const REDUZIR_ACIMA = 500 * 1024;

/** De onde veio o arquivo. Só o conteúdo público do portal pode ter o PDF reescrito (sem perdas). */
export type Origem = 'PORTAL' | 'UPLOAD' | 'GED' | 'FORMULARIO' | 'CHAMADO' | 'TREINAMENTO' | 'PLANEJAMENTO' | 'SISTEMA';

export interface StoredFile {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class FilesService {
  private readonly dir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
  private readonly maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024;

  constructor(private prisma: PrismaService) {}

  /**
   * Guarda um arquivo enviado. Valida o tipo pelo conteúdo, recusa Office com ZIP suspeito, prepara as fotos
   * (redução e remoção de metadados), calcula o SHA-256 e, quando um arquivo idêntico já existe, divide o espaço
   * em disco com ele (link físico: cada registro continua com as próprias permissões). O resto da otimização
   * (miniaturas, PDF sem perdas) fica para a fila em segundo plano.
   */
  async store(buffer: Buffer, originalName: string, isPublic: boolean, userId?: string, onlyImages = false, origin?: Origem): Promise<StoredFile> {
    if (buffer.length > this.maxBytes) throw new PayloadTooLargeException('Arquivo maior que o permitido');
    const detected = await FileType.fromBuffer(buffer);
    // "audio/opus" não é reconhecido por todos os navegadores; o arquivo é um Ogg comum
    let mime: string | undefined = detected?.mime === 'audio/opus' ? 'audio/ogg' : detected?.mime;
    let ext: string | undefined = mime ? ALLOWED[mime] : undefined;

    if (!detected) {
      // Arquivos de texto não têm assinatura; aceita só se for UTF-8 válido sem bytes nulos.
      const e = path.extname(originalName).slice(1).toLowerCase();
      if (TEXT_EXT[e] && !buffer.includes(0)) {
        mime = TEXT_EXT[e];
        ext = e;
      }
    }
    if (!mime || !ext) throw new BadRequestException('Tipo de arquivo não permitido');
    if (onlyImages && !mime.startsWith('image/')) throw new BadRequestException('Envie uma imagem (JPG, PNG, WEBP, AVIF ou GIF)');

    const originalSize = buffer.length;
    let optStatus: FileOptStatus = 'IGNORADO';
    let optNote: string | null = null;
    if (REDUZ.has(mime)) {
      try {
        const foto = await prepararFoto(buffer, mime);
        buffer = foto.buffer;
        optNote = foto.nota;
      } catch {
        throw new BadRequestException('Não foi possível ler a imagem. Envie um JPG, PNG, WEBP ou AVIF válido.');
      }
      optStatus = 'PENDENTE'; // a fila gera as miniaturas
    } else if (ehOoxml(mime)) {
      const zip = inspecionarZip(buffer);
      if ('erro' in zip) throw new BadRequestException(zip.erro);
      optNote = `Office já é compactado internamente: guardado como veio${zip.macros ? ' (contém macros, preservadas)' : ''}`;
    } else if (mime === 'application/pdf') {
      optStatus = 'PENDENTE';
    } else {
      optNote = NOTA_SEM_OTIMIZACAO[mime.split('/')[0]] ?? 'formato sem otimização: guardado como veio';
    }

    await fs.mkdir(this.dir, { recursive: true });
    const storedName = `${uuid()}.${ext}`;
    const destino = path.join(this.dir, storedName);
    const sha256 = sha256Buffer(buffer);
    const dedupOfId = await this.gravarOuLigar(destino, buffer, sha256);
    const safeName = originalName.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150) || storedName;
    const asset = await this.prisma.fileAsset.create({
      data: {
        originalName: safeName,
        storedName,
        mimeType: mime,
        size: buffer.length,
        public: isPublic,
        uploadedById: userId,
        sha256,
        originalSize,
        origin: origin ?? 'SISTEMA',
        optStatus,
        optNote,
        optAt: optStatus === 'PENDENTE' ? null : new Date(),
        dedupOfId,
        optLogs: {
          create: [
            { action: 'recebido', bytesBefore: originalSize, bytesAfter: buffer.length, detail: optNote ?? undefined },
            ...(dedupOfId ? [{ action: 'duplicado', bytesBefore: buffer.length, bytesAfter: 0, detail: 'arquivo idêntico já guardado: espaço dividido' }] : []),
          ],
        },
      },
    });
    return { id: asset.id, url: this.urlFor(asset.id, isPublic), originalName: safeName, mimeType: mime, size: buffer.length };
  }

  /**
   * Grava o arquivo ou, se já existir um idêntico (mesmo SHA-256 e mesmos bytes), cria um link físico para ele.
   * Retorna o id do arquivo com que divide o espaço. Qualquer falha no link cai na gravação normal.
   */
  /**
   * Anexo do chat (até CHAT_MAX_MB, padrão 200 MB, gravado em disco pelo multer, nunca em memória).
   * Os tipos conhecidos e pequenos seguem o caminho normal (fotos reduzidas, Office inspecionado).
   * O resto, de qualquer tipo, é guardado como veio e só sai como download (application/octet-stream,
   * nunca aberto no navegador), com o nome original.
   */
  async storeChatFile(tmpPath: string, originalName: string, size: number, userId: string, voz = false): Promise<StoredFile> {
    try {
      const detected = await FileType.fromFile(tmpPath);
      // gravação de voz do Chrome vem em WebM, que o detector chama de vídeo: marca como áudio para tocar no player
      // e a do iPhone/Safari vem em MP4, que o detector também pode chamar de vídeo
      const vozComoVideo: Record<string, string> = { 'video/webm': 'audio/webm', 'video/mp4': 'audio/mp4' };
      if (voz && detected && vozComoVideo[detected.mime]) {
        const audio = vozComoVideo[detected.mime];
        const r = await this.storeChatFile(tmpPath, originalName, size, userId);
        if (r.mimeType !== detected.mime) return r;
        await this.prisma.fileAsset.update({ where: { id: r.id }, data: { mimeType: audio } });
        return { ...r, mimeType: audio };
      }
      const e = path.extname(originalName).slice(1).toLowerCase();
      const conhecido = (detected && ALLOWED[detected.mime]) || (!detected && TEXT_EXT[e]);
      if (conhecido && size <= this.maxBytes) {
        try {
          return await this.store(await fs.readFile(tmpPath), originalName, false, userId, false, 'UPLOAD');
        } catch (err) {
          // texto com byte nulo, imagem que não abre, Office estranho: guarda como arquivo comum para download
          if (!(err instanceof BadRequestException)) throw err;
        }
      }
      const mime = detected && ALLOWED[detected.mime] && !REDUZ.has(detected.mime) ? (detected.mime === 'audio/opus' ? 'audio/ogg' : detected.mime) : 'application/octet-stream';
      const storedName = `${uuid()}.${mime === 'application/octet-stream' ? 'bin' : ALLOWED[mime]}`;
      await fs.mkdir(this.dir, { recursive: true });
      const destino = path.join(this.dir, storedName);
      await fs.rename(tmpPath, destino);
      await fs.chmod(destino, 0o640).catch(() => undefined);
      const safeName = originalName.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150) || storedName;
      const nota = mime === 'application/octet-stream' ? 'anexo do chat: guardado como veio, só para download' : 'anexo grande do chat: guardado como veio';
      const asset = await this.prisma.fileAsset.create({
        data: {
          originalName: safeName,
          storedName,
          mimeType: mime,
          size,
          public: false,
          uploadedById: userId,
          originalSize: size,
          origin: 'UPLOAD',
          optStatus: 'IGNORADO',
          optNote: nota,
          optAt: new Date(),
          optLogs: { create: [{ action: 'recebido', bytesBefore: size, bytesAfter: size, detail: nota }] },
        },
      });
      return { id: asset.id, url: this.urlFor(asset.id, false), originalName: safeName, mimeType: mime, size };
    } finally {
      await fs.unlink(tmpPath).catch(() => undefined);
    }
  }

  private async gravarOuLigar(destino: string, buffer: Buffer, sha256: string): Promise<string | null> {
    const iguais = await this.prisma.fileAsset.findMany({ where: { sha256, size: buffer.length }, select: { id: true, storedName: true }, take: 3 });
    for (const igual of iguais) {
      const existente = path.join(this.dir, igual.storedName);
      try {
        if (!(await fs.readFile(existente)).equals(buffer)) continue;
        await fs.link(existente, destino);
        return igual.id;
      } catch {
        // arquivo ausente, outro disco ou sistema sem links: grava normalmente
      }
    }
    await fs.writeFile(destino, buffer, { mode: 0o640 });
    return null;
  }

  /** Pasta dos arquivos enviados. */
  get pasta() {
    return this.dir;
  }

  /** URL pública direta ou URL assinada (válida por 2h) para arquivos privados. */
  urlFor(id: string, isPublic: boolean) {
    if (isPublic) return `/api/files/${id}`;
    const exp = Math.floor(Date.now() / 1000) + 2 * 3600;
    return `/api/files/${id}?exp=${exp}&sig=${this.sign(id, exp)}`;
  }

  private sign(id: string, exp: number) {
    return createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? '').update(`${id}.${exp}`).digest('base64url');
  }

  /**
   * Endereço /api/files/<id> com assinatura temporária, para telas sem login que mostram arquivos do portal
   * (painel da TV). A validade é arredondada à hora para o navegador poder guardar a imagem. Outros endereços voltam iguais.
   */
  assinarUrl(url: string | null): string | null {
    const m = url ? /^\/api\/files\/([0-9a-f-]{36})(?:\?.*)?$/i.exec(url) : null;
    if (!m) return url;
    const exp = Math.ceil(Date.now() / 3_600_000) * 3600 + 3 * 3600;
    return `/api/files/${m[1]}?exp=${exp}&sig=${this.sign(m[1], exp)}`;
  }

  assinaturaValida(id: string, exp?: string, sig?: string) {
    const e = Number(exp);
    if (!sig || !e || e < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(id, e));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  /**
   * Apaga de vez um arquivo que nenhum registro usa mais (quem chama confere isso): o registro, o arquivo e as cópias reduzidas.
   * Duplicados são links físicos, então apagar este nome não afeta os outros registros com o mesmo conteúdo.
   */
  async descartar(id: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id }, select: { id: true, storedName: true } });
    if (!asset) return;
    await this.prisma.fileAsset.delete({ where: { id } }).catch(() => undefined);
    await fs.rm(path.join(this.dir, asset.storedName), { force: true }).catch(() => undefined);
    const variantes = await fs.readdir(path.join(this.dir, 'variantes')).catch(() => [] as string[]);
    for (const v of variantes) if (v.startsWith(`${id}-`)) await fs.rm(path.join(this.dir, 'variantes', v), { force: true }).catch(() => undefined);
  }

  async open(id: string, exp?: string, sig?: string, loggedIn = false) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException();
    if (!asset.public && !loggedIn && !this.assinaturaValida(id, exp, sig)) throw new NotFoundException();
    return { asset, path: path.join(this.dir, asset.storedName) };
  }

  /**
   * Foto para exibir: na largura pedida (`w`) ou, sem largura, uma cópia reduzida quando o original é grande, no formato
   * moderno que o navegador aceita (WebP/AVIF). As cópias ficam em `variantes/` e são feitas uma vez só. Outros tipos de
   * arquivo, ou erro ao converter, devolvem o original. `mime` é o tipo do que foi entregue.
   */
  async variante(
    asset: { id: string; mimeType: string; storedName: string; size: number },
    original: string,
    w?: number,
    accept?: string,
  ): Promise<{ path: string; mime: string; negociado: boolean }> {
    const igual = { path: original, mime: asset.mimeType, negociado: false };
    if (!REDUZ.has(asset.mimeType)) return igual;
    if (!w && asset.size <= REDUZIR_ACIMA) return igual;
    let formato = formatoAceito(accept, asset.mimeType);
    const existe = (p: string) => fs.stat(p).then(() => true).catch(() => false);
    // a foto já mostrou que em WebP ficaria maior: entrega no formato original
    if (formato === 'webp' && (await existe(`${this.caminhoVariante(asset.id, w, 'webp')}.maior`))) formato = formatoDe(asset.mimeType);
    if (await existe(this.caminhoVariante(asset.id, w, formato))) return { path: this.caminhoVariante(asset.id, w, formato), mime: MIME_DO_FORMATO[formato], negociado: true };
    try {
      const r = await this.gerarVariante(asset, original, w, formato);
      return { path: r.destino, mime: MIME_DO_FORMATO[r.formato], negociado: true };
    } catch {
      return igual;
    }
  }

  caminhoVariante(id: string, w: number | undefined, formato: FormatoSaida) {
    return path.join(this.dir, 'variantes', `${id}-${w ?? 'tela'}${EXT_DO_FORMATO[formato]}`);
  }

  /**
   * Gera (ou regenera) uma cópia da foto. Gravação atômica: nome temporário e depois renomeia.
   * Em WebP, compara com o formato original e fica com o menor (fotos muito granuladas às vezes crescem em WebP);
   * nesse caso deixa um marcador `.maior` para não refazer a comparação.
   */
  async gerarVariante(asset: { id: string; mimeType: string }, original: string, w: number | undefined, formato: FormatoSaida): Promise<{ destino: string; bytes: number; formato: FormatoSaida }> {
    const fonte = await fs.readFile(original);
    const out = await reduzirFoto(fonte, formato, w ?? LADO_MAX, asset.mimeType === 'image/png');
    let final = { formato, out };
    if (formato === 'webp' && asset.mimeType !== 'image/webp') {
      const nativo = formatoDe(asset.mimeType);
      const alt = await reduzirFoto(fonte, nativo, w ?? LADO_MAX);
      if (alt.length < out.length) {
        final = { formato: nativo, out: alt };
        await this.gravarAtomico(`${this.caminhoVariante(asset.id, w, 'webp')}.maior`, Buffer.alloc(0));
      }
    }
    const destino = this.caminhoVariante(asset.id, w, final.formato);
    await this.gravarAtomico(destino, final.out);
    return { destino, bytes: final.out.length, formato: final.formato };
  }

  private async gravarAtomico(destino: string, dados: Buffer) {
    await fs.mkdir(path.dirname(destino), { recursive: true });
    const tmp = `${destino}.${uuid()}.tmp`;
    await fs.writeFile(tmp, dados, { mode: 0o640 });
    await fs.rename(tmp, destino);
  }

  get uploadDir() {
    return this.dir;
  }
}

const NOTA_SEM_OTIMIZACAO: Record<string, string> = {
  video: 'vídeo: guardado como veio (recompressão custaria muita CPU e qualidade)',
  audio: 'áudio: já é compactado',
  text: 'texto: guardado como veio e compactado na transferência (gzip/zstd)',
  image: 'GIF: guardado como veio para preservar a animação',
};
