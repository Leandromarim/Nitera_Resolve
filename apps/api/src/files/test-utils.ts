import { deflateRawSync } from 'zlib';

/** Banco em memória com o mínimo que o FilesService e o ArmazenamentoService usam nos testes. */
export function prismaEmMemoria() {
  const assets: any[] = [];
  const settings = new Map<string, unknown>();
  const prisma = {
    assets,
    fileAsset: {
      create: jest.fn(async ({ data }) => {
        const { optLogs, ...resto } = data;
        const a = { id: `id-${assets.length}`, createdAt: new Date(), dedupOfId: null, ...resto, logs: optLogs?.create ?? [] };
        assets.push(a);
        return a;
      }),
      findMany: jest.fn(async ({ where }) => assets.filter((a) => a.sha256 === where.sha256 && a.size === where.size)),
      findUnique: jest.fn(async ({ where }) => assets.find((a) => a.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }) => {
        const a = assets.find((x) => x.id === where.id);
        const { optLogs, ...resto } = data;
        Object.assign(a, resto);
        if (optLogs?.create) a.logs.push(optLogs.create);
        return a;
      }),
    },
    setting: {
      findUnique: jest.fn(async ({ where }) => (settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null)),
      upsert: jest.fn(async ({ where, create }) => settings.set(where.key, create.value)),
    },
  };
  return prisma;
}

/** ZIP mínimo (método deflate) com as entradas dadas: [nome, conteúdo]. */
export function zip(entradas: [string, Buffer][]) {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [nome, dados] of entradas) {
    const comp = deflateRawSync(dados);
    const n = Buffer.from(nome);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(dados.length, 22);
    lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(dados.length, 24);
    ch.writeUInt16LE(n.length, 28);
    ch.writeUInt32LE(offset, 42);
    locais.push(lh, n, comp);
    central.push(ch, n);
    offset += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entradas.length, 8);
  eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, cd, eocd]);
}

/** DOCX mínimo (o file-type reconhece pelo tipo do documento principal declarado no [Content_Types].xml, como o Word grava). */
export const docx = (extra: [string, Buffer][] = []) =>
  zip([
    [
      '[Content_Types].xml',
      Buffer.from(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
    ],
    ['word/document.xml', Buffer.from('<w:document/>')],
    ...extra,
  ]);
