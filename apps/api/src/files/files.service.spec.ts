import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import { inspecionarZip } from './otimizacao';
import { docx, prismaEmMemoria, zip } from './test-utils';

describe('FilesService', () => {
  let dir: string;
  let svc: any;
  let prisma: ReturnType<typeof prismaEmMemoria>;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fotos-'));
    process.env.UPLOAD_DIR = dir;
    const { FilesService } = await import('./files.service');
    prisma = prismaEmMemoria();
    svc = new FilesService(prisma as any);
  });

  afterAll(() => fs.rm(dir, { recursive: true, force: true }));

  const ultimo = () => prisma.assets[prisma.assets.length - 1];

  // foto de "celular": 4000 x 3000, com GPS e orientação no EXIF
  const fotoGrande = () =>
    sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 40 } } })
      .withMetadata({ orientation: 6, exif: { IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '22/1 54/1 0/1' } } })
      .jpeg({ quality: 95 })
      .toBuffer();

  describe('fotos', () => {
    it('reduz no envio, gira conforme a câmera, tira os metadados e registra o tamanho original', async () => {
      const original = await fotoGrande();
      const r = await svc.store(original, 'celular.jpg', true, undefined, false, 'PORTAL');
      const a = ultimo();
      const guardado = await fs.readFile(path.join(dir, a.storedName));
      const meta = await sharp(guardado).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(2560);
      expect(meta.width).toBeLessThan(meta.height!); // orientação 6 = retrato depois de girar
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(r.size).toBe(guardado.length);
      expect(a.originalSize).toBe(original.length);
      expect(a.optStatus).toBe('PENDENTE'); // miniaturas na fila
      expect(a.origin).toBe('PORTAL');
      expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('não recomprime foto que já veio otimizada (mantém os mesmos bytes)', async () => {
      const leve = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#3c4b78' } }).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
      await svc.store(leve, 'leve.jpg', true);
      const a = ultimo();
      expect((await fs.readFile(path.join(dir, a.storedName))).equals(leve)).toBe(true);
      expect(a.optNote).toMatch(/já otimizada/);
    });

    it('entrega na largura pedida em WebP quando o navegador aceita, e em JPEG quando não', async () => {
      // foto "normal" (degradê e formas): WebP fica menor que JPEG
      const foto = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#4a6fa5' } })
        .composite([{ input: Buffer.from('<svg width="2000" height="1500"><defs><linearGradient id="g"><stop offset="0" stop-color="#f4d35e"/><stop offset="1" stop-color="#0d3b66"/></linearGradient></defs><rect width="2000" height="1500" fill="url(#g)"/><circle cx="700" cy="600" r="380" fill="#ee964b"/><text x="200" y="1300" font-size="160" fill="#fff">Hospital</text></svg>') }])
        .jpeg({ quality: 92 })
        .toBuffer();
      await svc.store(foto, 'foto.jpg', true);
      const a = ultimo();
      const orig = path.join(dir, a.storedName);
      const webp = await svc.variante(a, orig, 640, 'image/avif,image/webp,*/*');
      expect(webp.mime).toBe('image/webp');
      const mw = await sharp(webp.path).metadata();
      expect(mw.format).toBe('webp');
      expect(mw.width).toBe(640);
      const jpg = await svc.variante(a, orig, 640, 'image/*');
      expect(jpg.mime).toBe('image/jpeg');
      expect((await sharp(jpg.path).metadata()).format).toBe('jpeg');
      expect((await fs.stat(webp.path)).size).toBeLessThan((await fs.stat(jpg.path)).size);
      // reaproveita a cópia já feita
      const t = (await fs.stat(webp.path)).mtimeMs;
      expect((await svc.variante(a, orig, 640, 'image/webp')).path).toBe(webp.path);
      expect((await fs.stat(webp.path)).mtimeMs).toBe(t);
    });

    it('quando o WebP ficaria maior, entrega o JPEG mesmo para quem aceita WebP', async () => {
      const a = prisma.assets[0]; // foto granulada do primeiro teste
      const r = await svc.variante(a, path.join(dir, a.storedName), 640, 'image/webp');
      expect(r.mime).toBe('image/jpeg');
      expect((await svc.variante(a, path.join(dir, a.storedName), 640, 'image/webp')).path).toBe(r.path);
    });

    it('foto antiga grande sai reduzida; pequena e outros tipos saem como estão', async () => {
      const antiga = await fotoGrande();
      await fs.writeFile(path.join(dir, 'antiga.jpg'), antiga);
      const asset = { id: 'antiga', mimeType: 'image/jpeg', storedName: 'antiga.jpg', size: antiga.length };
      const p = await svc.variante(asset, path.join(dir, 'antiga.jpg'));
      const m = await sharp(p.path).metadata();
      expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(2560);
      expect((await svc.variante({ ...asset, size: 1000 }, '/x/pequena.jpg')).path).toBe('/x/pequena.jpg');
      expect((await svc.variante({ id: 'p', mimeType: 'application/pdf', storedName: 'a.pdf', size: 9e6 }, '/x/a.pdf', 640)).path).toBe('/x/a.pdf');
    });

    it('aceita AVIF e entrega em WebP para quem não aceita AVIF', async () => {
      const avif = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#a03050' } }).avif({ quality: 50 }).toBuffer();
      const r = await svc.store(avif, 'foto.avif', true);
      expect(r.mimeType).toBe('image/avif');
      const a = ultimo();
      const p = await svc.variante(a, path.join(dir, a.storedName), 320, 'image/webp,*/*');
      expect(p.mime).toBe('image/webp');
      expect((await svc.variante(a, path.join(dir, a.storedName), 320, 'image/avif,image/webp')).mime).toBe('image/avif');
    });

    it('recusa imagem corrompida', async () => {
      const falsa = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
      await expect(svc.store(falsa, 'x.jpg', true)).rejects.toThrow('Não foi possível ler a imagem');
    });
  });

  describe('duplicados', () => {
    it('arquivo idêntico divide o espaço em disco (link físico) e mantém registro e permissão próprios', async () => {
      const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n' + 'x'.repeat(5000));
      await svc.store(pdf, 'a.pdf', true, undefined, false, 'PORTAL');
      const a = ultimo();
      await svc.store(pdf, 'b.pdf', false, undefined, false, 'GED');
      const b = ultimo();
      expect(b.storedName).not.toBe(a.storedName);
      expect(b.public).toBe(false);
      expect(b.dedupOfId).toBe(a.id);
      const [sa, sb] = await Promise.all([fs.stat(path.join(dir, a.storedName)), fs.stat(path.join(dir, b.storedName))]);
      expect(sb.ino).toBe(sa.ino);
      expect(sa.nlink).toBe(2);
      // apagar um não afeta o outro
      await fs.rm(path.join(dir, a.storedName));
      expect((await fs.readFile(path.join(dir, b.storedName))).equals(pdf)).toBe(true);
    });
  });

  describe('Office e texto', () => {
    it('guarda DOCX exatamente como veio (sem recompressão) e marca macros preservadas', async () => {
      const arq = docx([['word/vbaProject.bin', Buffer.alloc(100, 1)]]);
      const r = await svc.store(arq, 'relatorio.docx', false);
      expect(r.mimeType).toContain('wordprocessingml');
      const a = ultimo();
      expect((await fs.readFile(path.join(dir, a.storedName))).equals(arq)).toBe(true);
      expect(a.optStatus).toBe('IGNORADO');
      expect(a.optNote).toMatch(/macros, preservadas/);
    });

    it('recusa bomba de ZIP disfarçada de DOCX', async () => {
      const bomba = docx([['word/media/x.bin', Buffer.alloc(40 * 1024 * 1024)]]);
      expect(bomba.length).toBeLessThan(200 * 1024);
      await expect(svc.store(bomba, 'bomba.docx', false)).rejects.toThrow(/bomba de ZIP/);
    });

    it('recusa caminho interno com ../ (path traversal)', () => {
      expect(inspecionarZip(zip([['../../etc/passwd', Buffer.from('x')]]))).toEqual({ erro: expect.stringMatching(/caminho interno/) });
    });

    it('CSV é aceito e guardado como veio; executável é recusado', async () => {
      const csv = Buffer.from('nome;setor\nAna;TI\n');
      const r = await svc.store(csv, 'lista.csv', false);
      expect(r.mimeType).toBe('text/csv');
      expect((await fs.readFile(path.join(dir, ultimo().storedName))).equals(csv)).toBe(true);
      const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(300, 0x90)]);
      await expect(svc.store(exe, 'programa.exe', false)).rejects.toThrow('Tipo de arquivo não permitido');
      await expect(svc.store(exe, 'lista.csv', false)).rejects.toThrow('Tipo de arquivo não permitido');
    });
  });

  it('aguenta envios simultâneos sem misturar arquivos', async () => {
    const lote = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        sharp({ create: { width: 1200 + i, height: 900, channels: 3, background: { r: i * 20, g: 80, b: 120 } } })
          .png()
          .toBuffer()
          .then((b) => svc.store(b, `foto-${i}.png`, true)),
      ),
    );
    expect(new Set(lote.map((r: any) => r.id)).size).toBe(12);
    for (const [i, r] of lote.entries()) {
      const a = prisma.assets.find((x) => x.id === r.id);
      expect((await sharp(path.join(dir, a.storedName)).metadata()).width).toBe(1200 + i);
    }
  });
});
