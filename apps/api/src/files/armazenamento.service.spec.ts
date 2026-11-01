import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { prismaEmMemoria } from './test-utils';

const temQpdf = spawnSync('qpdf', ['--version']).status === 0;
const itQpdf = temQpdf ? it : it.skip;
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** PDF de várias páginas com texto e sem compressão (como muitos PDFs gerados por sistemas antigos). */
function pdfSemCompressao(paginas = 25): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ compress: false, size: 'A4' });
    const partes: Buffer[] = [];
    doc.on('data', (c) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    for (let p = 1; p <= paginas; p++) {
      if (p > 1) doc.addPage();
      doc.fontSize(16).text(`Procedimento operacional padrão · página ${p}`);
      for (let l = 0; l < 40; l++) doc.fontSize(10).text(`Linha ${l + 1}: higienização das mãos, uso de EPI e descarte correto de perfurocortantes.`);
    }
    doc.end();
  });
}

describe('ArmazenamentoService', () => {
  let dir: string;
  let files: any;
  let svc: any;
  let prisma: ReturnType<typeof prismaEmMemoria>;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'armaz-'));
    process.env.UPLOAD_DIR = dir;
    const { FilesService } = await import('./files.service');
    const { ArmazenamentoService } = await import('./armazenamento.service');
    prisma = prismaEmMemoria();
    files = new FilesService(prisma as any);
    svc = new ArmazenamentoService(prisma as any, files);
  });

  afterAll(() => fs.rm(dir, { recursive: true, force: true }));

  const guardar = async (buf: Buffer, nome: string, publico: boolean, origem: string) => {
    const r = await files.store(buf, nome, publico, undefined, false, origem);
    const a = prisma.assets.find((x) => x.id === r.id);
    return { a, arquivo: path.join(dir, a.storedName) };
  };

  itQpdf('PDF público do portal é reduzido sem perdas, conferido e o original fica guardado', async () => {
    const pdf = await pdfSemCompressao();
    const { a, arquivo } = await guardar(pdf, 'pop.pdf', true, 'PORTAL');
    expect(a.optStatus).toBe('PENDENTE');
    await svc.processar(a);
    expect(a.optStatus).toBe('OTIMIZADO');
    const novo = await fs.readFile(arquivo);
    expect(novo.length).toBeLessThan(pdf.length * 0.7);
    expect(a.size).toBe(novo.length);
    expect(a.sha256).toBe(sha(novo));
    // o original continua guardado, byte a byte
    expect((await fs.readFile(path.join(dir, 'originais', a.storedName))).equals(pdf)).toBe(true);
    // texto e páginas iguais
    const txt = (f: string) => spawnSync('pdftotext', ['-q', f, '-']).stdout.toString();
    const tmpOrig = path.join(dir, 'orig-conferencia.pdf');
    await fs.writeFile(tmpOrig, pdf);
    expect(txt(arquivo)).toBe(txt(tmpOrig));
    expect(a.logs.at(-1)).toMatchObject({ action: 'pdf', ok: true, bytesBefore: pdf.length, bytesAfter: novo.length });

    // rollback pelo painel: volta exatamente o arquivo enviado
    await svc.restaurarOriginal(a.id);
    expect((await fs.readFile(arquivo)).equals(pdf)).toBe(true);
    expect(a.sha256).toBe(sha(pdf));
    expect(a.optStatus).toBe('MANTIDO');
  });

  itQpdf('PDF assinado digitalmente nunca é alterado', async () => {
    const base = (await pdfSemCompressao(5)).toString('latin1');
    // dicionário de assinatura típico (ByteRange + SubFilter)
    const assinado = Buffer.from(base.replace('%%EOF', '%%EOF\n9 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [0 100 200 300] /Contents <00> >>\nendobj\n'), 'latin1');
    const { a, arquivo } = await guardar(assinado, 'assinado.pdf', true, 'PORTAL');
    await svc.processar(a);
    expect(a.optStatus).toBe('PROTEGIDO');
    expect(a.optNote).toMatch(/assinatura/);
    expect((await fs.readFile(arquivo)).equals(assinado)).toBe(true);
  });

  it('PDF da gestão de documentos (GED) e anexos privados ficam intactos', async () => {
    const pdf = await pdfSemCompressao(10);
    for (const origem of ['GED', 'FORMULARIO', 'CHAMADO', 'UPLOAD']) {
      const { a, arquivo } = await guardar(Buffer.concat([pdf, Buffer.from(`\n%${origem}\n`)]), `${origem}.pdf`, false, origem);
      const antes = await fs.readFile(arquivo);
      await svc.processar(a);
      expect(a.optStatus).toBe('PROTEGIDO');
      expect((await fs.readFile(arquivo)).equals(antes)).toBe(true);
    }
  });

  it('foto ganha miniaturas WebP na fila; arquivo sumido do disco vira erro registrado', async () => {
    const sharp = (await import('sharp')).default;
    const foto = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#2a9d8f' } }).png().toBuffer();
    const { a } = await guardar(foto, 'foto.png', true, 'PORTAL');
    await svc.processar(a);
    for (const w of [320, 640]) expect(await fs.stat(path.join(dir, 'variantes', `${a.id}-${w}.webp`)).then(() => true, () => false)).toBe(true);
    expect(['OTIMIZADO', 'MANTIDO']).toContain(a.optStatus);

    const { a: b, arquivo } = await guardar(Buffer.from('a;b\n1;2\n'), 'x.csv', false, 'UPLOAD');
    await fs.rm(arquivo);
    b.optStatus = 'PENDENTE';
    await svc.processar(b);
    expect(b.optStatus).toBe('ERRO');
    expect(b.logs.at(-1)).toMatchObject({ ok: false });
  });

  it('limpeza diária apaga temporários velhos e páginas sem acesso, e nunca os arquivos guardados', async () => {
    const velho = new Date(Date.now() - 40 * 86_400_000);
    const tmp = path.join(dir, 'variantes', 'x.webp.123.tmp');
    const pagina = path.join(dir, '.doc-cache', '11111111-1111-1111-1111-111111111111', 'p1.png');
    const recente = path.join(dir, '.doc-cache', '22222222-2222-2222-2222-222222222222', 'p1.png');
    for (const f of [tmp, pagina, recente]) {
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, 'x');
    }
    await fs.utimes(tmp, velho, velho);
    await fs.utimes(pagina, velho, velho);
    const guardados = (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
    const r = await svc.limpezaDiaria();
    expect(r.temporarios).toBeGreaterThanOrEqual(1);
    expect(r.paginas).toBe(1);
    expect(await fs.stat(recente).then(() => true, () => false)).toBe(true);
    for (const n of guardados) expect(await fs.stat(path.join(dir, n)).then(() => true, () => false)).toBe(true);
  });
});
