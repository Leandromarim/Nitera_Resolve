/**
 * Volta todos os PDFs otimizados para o arquivo original enviado (rollback da otimização sem perdas).
 * Usa as cópias guardadas em UPLOAD_DIR/originais (prazo em Painel › Armazenamento e otimização).
 * A otimização automática fica desligada no fim, para não reduzir de novo.
 *
 * Uso (no servidor):
 *   docker compose exec api node dist/files/scripts/restaurar-pdfs.js            (só mostra o que faria)
 *   docker compose exec api node dist/files/scripts/restaurar-pdfs.js --confirmar
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';

const DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
const confirmar = process.argv.includes('--confirmar');

const sha256 = (f: string) =>
  new Promise<string>((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(f)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });

async function main() {
  const prisma = new PrismaClient();
  try {
    const otimizados = await prisma.fileAsset.findMany({ where: { mimeType: 'application/pdf', optStatus: 'OTIMIZADO' } });
    let restaurados = 0;
    let semOriginal = 0;
    for (const a of otimizados) {
      const guardado = path.join(DIR, 'originais', a.storedName);
      const st = await fs.stat(guardado).catch(() => null);
      if (!st) {
        semOriginal++;
        continue;
      }
      if (!confirmar) {
        console.log(`restauraria: ${a.originalName} (${a.size} → ${st.size} bytes)`);
        continue;
      }
      const arquivo = path.join(DIR, a.storedName);
      const tmp = `${arquivo}.${randomUUID()}.tmp`;
      await fs.copyFile(guardado, tmp);
      const hash = await sha256(tmp);
      await fs.rename(tmp, arquivo);
      await fs.rm(guardado, { force: true });
      await prisma.fileAsset.update({
        where: { id: a.id },
        data: {
          size: st.size,
          sha256: hash,
          optStatus: 'MANTIDO',
          optNote: 'original restaurado pela linha de comando',
          optAt: new Date(),
          optLogs: { create: { action: 'restaurado', bytesBefore: a.size, bytesAfter: st.size, detail: 'original restaurado pela linha de comando' } },
        },
      });
      restaurados++;
    }
    if (confirmar) {
      const s = await prisma.setting.findUnique({ where: { key: 'armazenamento' } });
      const valor = { ...((s?.value as object | null) ?? {}), pdfSemPerdas: false };
      await prisma.setting.upsert({ where: { key: 'armazenamento' }, create: { key: 'armazenamento', value: valor }, update: { value: valor } });
      await prisma.auditLog.create({ data: { action: 'restaurar_pdfs', entity: 'Armazenamento', data: { restaurados, semOriginal, origem: 'linha de comando no servidor' } } });
    }
    console.log('');
    console.log(confirmar ? `${restaurados} PDF(s) restaurados. Otimização de PDF desligada no painel.` : `Nada foi alterado. Rode de novo com --confirmar para restaurar.`);
    if (semOriginal) console.log(`${semOriginal} PDF(s) otimizados já não têm o original guardado (prazo vencido).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
