import { Injectable, Logger, NotFoundException, OnApplicationShutdown } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { FileAsset, FileOptStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from './files.service';
import { Categoria, REDUZ, categoriaDe, otimizarPdf, pdfProtegido, qpdfDisponivel, sha256File } from './otimizacao';

/** Configuração editável em Painel › Armazenamento e otimização (Setting "armazenamento"). */
export interface ConfigArmazenamento {
  /** Reescrever sem perdas os PDFs públicos do portal (nunca GED, formulários, chamados ou envios privados). */
  pdfSemPerdas: boolean;
  /** Dias que o PDF original fica guardado depois de otimizado (0 = para sempre). */
  manterOriginalDias: number;
  /** Dias sem acesso para apagar as páginas já convertidas da visualização protegida (refeitas quando alguém abrir). */
  cachePaginasDias: number;
}

export const CONFIG_PADRAO: ConfigArmazenamento = { pdfSemPerdas: true, manterOriginalDias: 30, cachePaginasDias: 30 };
const CHAVE_CONFIG = 'armazenamento';
const CHAVE_LIMPEZA = 'armazenamento.ultimaLimpeza';
/** PDFs acima disto aparecem como "grandes" no painel. */
export const PDF_GRANDE = 10 * 1024 * 1024;
/** Larguras das miniaturas geradas na fila (listas, cards e galeria). */
const MINIATURAS = [320, 640] as const;
const DIA = 86_400_000;

/**
 * Fila de otimização em segundo plano, guardada no próprio banco (coluna optStatus): sobrevive a reinícios, não
 * precisa de Redis e processa um arquivo por vez para não disputar CPU com quem está navegando.
 * Também analisa os arquivos antigos (hash e conferência no disco), faz a limpeza diária e monta os números do painel.
 */
@Injectable()
export class ArmazenamentoService implements OnApplicationShutdown {
  private readonly log = new Logger('Armazenamento');
  private ocupado = false;
  private parando = false;
  private qpdf: boolean | null = null;
  private resumoCache: { em: number; dados: unknown } | null = null;

  constructor(
    private prisma: PrismaService,
    private files: FilesService,
  ) {}

  onApplicationShutdown() {
    this.parando = true;
  }

  private get dir() {
    return this.files.uploadDir;
  }

  async config(): Promise<ConfigArmazenamento> {
    const s = await this.prisma.setting.findUnique({ where: { key: CHAVE_CONFIG } });
    return { ...CONFIG_PADRAO, ...((s?.value as object | null) ?? {}) };
  }

  async salvarConfig(c: ConfigArmazenamento) {
    await this.prisma.setting.upsert({ where: { key: CHAVE_CONFIG }, create: { key: CHAVE_CONFIG, value: c as any }, update: { value: c as any } });
    return this.config();
  }

  // ───────── fila ─────────

  /** A cada 5 s: arquivos pendentes por até 2 s; sem pendentes, analisa um lote de arquivos antigos. Nunca roda em paralelo. */
  @Interval(5000)
  async tick() {
    if (this.ocupado || this.parando || process.env.ARMAZENAMENTO_FILA === 'off') return;
    this.ocupado = true;
    try {
      // trabalha no máximo ~2 s por rodada e descansa: a navegação nunca disputa CPU por muito tempo
      const inicio = Date.now();
      while (Date.now() - inicio < 2000 && !this.parando) {
        if (!(await this.processarProximo())) {
          await this.analisarAntigos();
          break;
        }
      }
    } catch (e: any) {
      this.log.warn(`fila: ${e?.message ?? e}`);
    } finally {
      this.ocupado = false;
    }
  }

  /** Processa o próximo arquivo pendente. Retorna false quando a fila está vazia. */
  async processarProximo(): Promise<boolean> {
    const asset = await this.prisma.fileAsset.findFirst({ where: { optStatus: 'PENDENTE' }, orderBy: { createdAt: 'asc' } });
    if (!asset) return false;
    await this.processar(asset);
    return true;
  }

  async processar(asset: FileAsset) {
    const inicio = Date.now();
    const arquivo = path.join(this.dir, asset.storedName);
    try {
      await fs.access(arquivo);
    } catch {
      return this.concluir(asset, 'ERRO', 'arquivo não encontrado no disco', { action: 'conferencia', ok: false, inicio });
    }
    try {
      if (REDUZ.has(asset.mimeType)) return await this.miniaturas(asset, arquivo, inicio);
      if (asset.mimeType === 'application/pdf') return await this.pdf(asset, arquivo, inicio);
      return this.concluir(asset, 'IGNORADO', asset.optNote ?? 'formato sem otimização: guardado como veio', { action: 'analise', inicio });
    } catch (e: any) {
      return this.concluir(asset, 'ERRO', `falha ao processar: ${String(e?.message ?? e).slice(0, 200)}`, { action: 'processamento', ok: false, inicio });
    }
  }

  private async miniaturas(asset: FileAsset, arquivo: string, inicio: number) {
    let bytes = 0;
    for (const w of MINIATURAS) bytes += (await this.files.gerarVariante(asset, arquivo, w, 'webp')).bytes;
    const reduziu = asset.originalSize !== null && asset.originalSize > asset.size;
    const nota = [asset.optNote, `miniaturas WebP de ${MINIATURAS.join(' e ')} px prontas`].filter(Boolean).join('; ');
    return this.concluir(asset, reduziu ? 'OTIMIZADO' : 'MANTIDO', nota, { action: 'miniaturas', bytesAfter: bytes, inicio });
  }

  private async pdf(asset: FileAsset, arquivo: string, inicio: number) {
    const cfg = await this.config();
    if (asset.origin !== 'PORTAL') {
      const motivo = asset.origin === 'GED' ? 'documento oficial da gestão de documentos' : asset.origin === 'FORMULARIO' || asset.origin === 'CHAMADO' ? 'anexo enviado por usuário' : 'arquivo privado';
      return this.concluir(asset, 'PROTEGIDO', `${motivo}: guardado sem nenhuma alteração`, { action: 'analise', inicio });
    }
    if (!cfg.pdfSemPerdas) return this.concluir(asset, 'IGNORADO', 'otimização de PDF desligada no painel', { action: 'analise', inicio });
    this.qpdf ??= await qpdfDisponivel();
    if (!this.qpdf) return this.concluir(asset, 'IGNORADO', 'qpdf não instalado no servidor: PDF guardado como veio', { action: 'analise', inicio });
    const protegido = await pdfProtegido(arquivo);
    if (protegido) return this.concluir(asset, 'PROTEGIDO', `${protegido}: nunca é alterado`, { action: 'analise', inicio });

    const r = await otimizarPdf(arquivo);
    if (!r.ok) return this.concluir(asset, 'MANTIDO', `original mantido: ${r.nota}`, { action: 'pdf', ok: false, bytesBefore: r.antes, bytesAfter: r.depois, inicio });
    if (!r.arquivo) return this.concluir(asset, 'MANTIDO', r.nota, { action: 'pdf', bytesBefore: r.antes, bytesAfter: r.depois, inicio });

    // troca segura: o original vai para originais/ (link físico, sem copiar), o otimizado entra no lugar com rename atômico
    const pastaOriginais = path.join(this.dir, 'originais');
    await fs.mkdir(pastaOriginais, { recursive: true });
    const guardado = path.join(pastaOriginais, asset.storedName);
    const tmp = `${arquivo}.${randomUUID()}.tmp`;
    try {
      await fs.copyFile(r.arquivo, tmp);
      await fs.chmod(tmp, 0o640);
      await fs.link(arquivo, guardado).catch(async (e) => {
        if (e?.code === 'EEXIST') return;
        await fs.copyFile(arquivo, guardado);
      });
      const sha256 = await sha256File(tmp);
      await fs.rename(tmp, arquivo);
      const depois = (await fs.stat(arquivo)).size;
      await this.prisma.fileAsset.update({ where: { id: asset.id }, data: { size: depois, sha256 } });
      const prazo = cfg.manterOriginalDias ? `por ${cfg.manterOriginalDias} dias` : 'sem prazo';
      return this.concluir(asset, 'OTIMIZADO', `${r.nota}; original guardado ${prazo}`, {
        action: 'pdf',
        bytesBefore: r.antes,
        bytesAfter: depois,
        inicio,
      });
    } finally {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      await fs.rm(path.dirname(r.arquivo), { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async concluir(
    asset: Pick<FileAsset, 'id'>,
    status: FileOptStatus,
    nota: string,
    log: { action: string; ok?: boolean; bytesBefore?: number; bytesAfter?: number; inicio: number },
  ) {
    const ok = log.ok ?? status !== 'ERRO';
    await this.prisma.fileAsset.update({
      where: { id: asset.id },
      data: {
        optStatus: status,
        optNote: nota.slice(0, 500),
        optAt: new Date(),
        optLogs: { create: { action: log.action, ok, bytesBefore: log.bytesBefore, bytesAfter: log.bytesAfter, detail: nota.slice(0, 500), ms: Date.now() - log.inicio } },
      },
    });
    if (status === 'ERRO') this.log.warn(`${asset.id}: ${nota}`);
  }

  /**
   * Arquivos guardados antes da 4.8.0 (status nulo): calcula o SHA-256, confere se o arquivo existe no disco e
   * agenda as miniaturas das fotos. Não altera o conteúdo de nenhum arquivo antigo.
   */
  async analisarAntigos(lote = 10) {
    const antigos = await this.prisma.fileAsset.findMany({ where: { optStatus: null }, orderBy: { createdAt: 'asc' }, take: lote });
    for (const a of antigos) {
      if (this.parando) return;
      const arquivo = path.join(this.dir, a.storedName);
      const inicio = Date.now();
      const sha256 = await sha256File(arquivo).catch(() => null);
      if (!sha256) {
        await this.concluir(a, 'ERRO', 'arquivo não encontrado no disco', { action: 'conferencia', ok: false, inicio });
        continue;
      }
      const foto = REDUZ.has(a.mimeType);
      const nota =
        a.mimeType === 'application/pdf' && a.size > PDF_GRANDE
          ? 'PDF grande, guardado antes da 4.8.0: não alterado (pode ser otimizado pelo painel se for público)'
          : 'guardado antes da 4.8.0: conteúdo não alterado';
      await this.prisma.fileAsset.update({
        where: { id: a.id },
        data: {
          sha256,
          originalSize: a.originalSize ?? a.size,
          optStatus: foto ? 'PENDENTE' : a.mimeType === 'application/pdf' && !a.public ? 'PROTEGIDO' : 'IGNORADO',
          optNote: foto ? 'guardada antes da 4.8.0: o original não é alterado; a tela usa cópias reduzidas' : nota,
          optAt: foto ? null : new Date(),
          optLogs: { create: { action: 'analise', detail: 'hash SHA-256 calculado e arquivo conferido no disco', ms: Date.now() - inicio } },
        },
      });
    }
  }

  /** Coloca na fila os PDFs públicos antigos (anteriores à 4.8.0) para a otimização sem perdas. Pedido explícito do administrador. */
  async otimizarPdfsAntigos() {
    const r = await this.prisma.fileAsset.updateMany({
      where: { mimeType: 'application/pdf', public: true, origin: null, optStatus: { in: ['IGNORADO', 'MANTIDO'] } },
      data: { origin: 'PORTAL', optStatus: 'PENDENTE' },
    });
    this.resumoCache = null;
    return { agendados: r.count };
  }

  /** Volta para a fila os arquivos que deram erro (exceto os que não existem mais no disco). */
  async reprocessarErros() {
    const r = await this.prisma.fileAsset.updateMany({ where: { optStatus: 'ERRO', NOT: { optNote: { startsWith: 'arquivo não encontrado' } } }, data: { optStatus: 'PENDENTE' } });
    this.resumoCache = null;
    return { agendados: r.count };
  }

  /** Devolve o PDF original guardado em originais/ (enquanto estiver no prazo). */
  async restaurarOriginal(id: string) {
    const a = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Arquivo não encontrado');
    const guardado = path.join(this.dir, 'originais', a.storedName);
    const st = await fs.stat(guardado).catch(() => null);
    if (!st) throw new NotFoundException('O original deste arquivo não está mais guardado');
    const arquivo = path.join(this.dir, a.storedName);
    const tmp = `${arquivo}.${randomUUID()}.tmp`;
    await fs.copyFile(guardado, tmp);
    const sha256 = await sha256File(tmp);
    await fs.rename(tmp, arquivo);
    await fs.rm(guardado, { force: true });
    await this.prisma.fileAsset.update({
      where: { id },
      data: {
        size: st.size,
        sha256,
        optStatus: 'MANTIDO',
        optNote: 'original restaurado pelo painel',
        optAt: new Date(),
        optLogs: { create: { action: 'restaurado', bytesBefore: a.size, bytesAfter: st.size, detail: 'original restaurado pelo painel' } },
      },
    });
    this.resumoCache = null;
    return { ok: true, size: st.size };
  }

  // ───────── duplicados ─────────

  /** Grupos de arquivos idênticos (mesmo SHA-256 e tamanho). */
  private async gruposDuplicados() {
    return this.prisma.$queryRaw<{ sha256: string; size: number; n: number }[]>(Prisma.sql`
      SELECT "sha256", "size", COUNT(*)::int AS n FROM "FileAsset" WHERE "sha256" IS NOT NULL GROUP BY "sha256", "size" HAVING COUNT(*) > 1`);
  }

  /**
   * Faz os arquivos idênticos dividirem o mesmo espaço em disco (link físico). O conteúdo não muda e cada registro
   * mantém as próprias permissões (público, privado, GED). Confere byte a byte antes de ligar.
   */
  async unificarDuplicados() {
    let unificados = 0;
    let liberados = 0;
    for (const g of await this.gruposDuplicados()) {
      const itens = await this.prisma.fileAsset.findMany({ where: { sha256: g.sha256, size: g.size }, orderBy: { createdAt: 'asc' } });
      const base = itens[0]!;
      const basePath = path.join(this.dir, base.storedName);
      const baseSt = await fs.stat(basePath).catch(() => null);
      if (!baseSt) continue;
      const baseBuf = g.size <= 64 * 1024 * 1024 ? await fs.readFile(basePath) : null;
      for (const outro of itens.slice(1)) {
        const p = path.join(this.dir, outro.storedName);
        const st = await fs.stat(p).catch(() => null);
        if (!st || st.ino === baseSt.ino) continue;
        if (!baseBuf || !(await fs.readFile(p)).equals(baseBuf)) continue;
        const tmp = `${p}.${randomUUID()}.tmp`;
        try {
          await fs.link(basePath, tmp);
          await fs.rename(tmp, p);
          await this.prisma.fileAsset.update({
            where: { id: outro.id },
            data: { dedupOfId: base.id, optLogs: { create: { action: 'duplicado', bytesBefore: st.size, bytesAfter: 0, detail: 'arquivo idêntico: espaço dividido com o primeiro envio' } } },
          });
          unificados++;
          liberados += st.size;
        } catch {
          await fs.rm(tmp, { force: true }).catch(() => undefined);
        }
      }
    }
    this.resumoCache = null;
    return { unificados, liberados };
  }

  // ───────── limpeza diária ─────────

  /** Todo dia às 3h30: temporários esquecidos, páginas convertidas sem acesso e originais de PDF fora do prazo. */
  @Cron('30 3 * * *')
  async limpezaDiaria() {
    const cfg = await this.config();
    const agora = Date.now();
    const r = { temporarios: 0, paginas: 0, originais: 0, bytes: 0 };
    const apagar = async (f: string, campo: 'temporarios' | 'paginas' | 'originais') => {
      const st = await fs.stat(f).catch(() => null);
      if (!st) return;
      await fs.rm(f, { recursive: true, force: true }).catch(() => undefined);
      r[campo]++;
      r.bytes += st.isFile() ? st.size : 0;
    };
    // temporários com mais de 1 dia: cópias interrompidas, envios de vídeo cancelados, PDFs em análise
    const velho = (st: { mtimeMs: number }) => agora - st.mtimeMs > DIA;
    for (const { pasta, filtro } of [
      { pasta: path.join(this.dir, 'variantes'), filtro: (n: string) => n.endsWith('.tmp') },
      { pasta: this.dir, filtro: (n: string) => n.endsWith('.tmp') },
      { pasta: path.join(this.dir, '.tmp-videos'), filtro: () => true },
      { pasta: os.tmpdir(), filtro: (n: string) => /^(doc-.*\.pdf|pdfopt-)/.test(n) },
    ]) {
      for (const n of await fs.readdir(pasta).catch(() => [] as string[])) {
        if (!filtro(n)) continue;
        const f = path.join(pasta, n);
        const st = await fs.stat(f).catch(() => null);
        if (st && velho(st)) await apagar(f, 'temporarios');
      }
    }
    for (const f of await listarArquivos(path.join(this.dir, '.doc-cache'))) {
      if (path.basename(f.path).startsWith('.tmp-') && velho(f.st)) await apagar(f.path, 'temporarios');
      else if (cfg.cachePaginasDias > 0 && agora - f.st.mtimeMs > cfg.cachePaginasDias * DIA) await apagar(f.path, 'paginas');
    }
    if (cfg.manterOriginalDias > 0) {
      for (const f of await listarArquivos(path.join(this.dir, 'originais'))) if (agora - f.st.mtimeMs > cfg.manterOriginalDias * DIA) await apagar(f.path, 'originais');
    }
    const resultado = { ...r, em: new Date().toISOString() };
    await this.prisma.setting.upsert({ where: { key: CHAVE_LIMPEZA }, create: { key: CHAVE_LIMPEZA, value: resultado }, update: { value: resultado } });
    this.resumoCache = null;
    this.log.log(`limpeza: ${r.temporarios} temporários, ${r.paginas} páginas em cache, ${r.originais} originais (${Math.round(r.bytes / 1024)} KB)`);
    return resultado;
  }

  // ───────── números do painel ─────────

  async resumo(forcar = false) {
    if (!forcar && this.resumoCache && Date.now() - this.resumoCache.em < 60_000) return this.resumoCache.dados;
    const [porMime, porStatus, economiaRow, duplicados, pdfsGrandes, erros, limpeza, meses, cfg, qpdf] = await Promise.all([
      this.prisma.fileAsset.groupBy({ by: ['mimeType'], _count: true, _sum: { size: true, originalSize: true } }),
      this.prisma.fileAsset.groupBy({ by: ['optStatus'], _count: true }),
      this.prisma.$queryRaw<{ otimizacao: bigint | null; dedup: bigint | null }[]>(Prisma.sql`
        SELECT SUM(GREATEST(COALESCE("originalSize", "size") - "size", 0))::bigint AS otimizacao,
               SUM(CASE WHEN "dedupOfId" IS NOT NULL THEN "size" ELSE 0 END)::bigint AS dedup FROM "FileAsset"`),
      this.prisma.$queryRaw<{ grupos: number; arquivos: number; bytes: bigint | null }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS grupos, COALESCE(SUM(n), 0)::int AS arquivos, SUM((n - ligados - 1) * size)::bigint AS bytes FROM (
          SELECT "size", COUNT(*) AS n, COUNT("dedupOfId") AS ligados FROM "FileAsset" WHERE "sha256" IS NOT NULL GROUP BY "sha256", "size" HAVING COUNT(*) > 1) g`),
      this.prisma.fileAsset.findMany({
        where: { mimeType: 'application/pdf', size: { gt: PDF_GRANDE } },
        orderBy: { size: 'desc' },
        take: 20,
        select: { id: true, originalName: true, size: true, originalSize: true, public: true, origin: true, optStatus: true, optNote: true, createdAt: true },
      }),
      this.prisma.fileAsset.findMany({ where: { optStatus: 'ERRO' }, orderBy: { optAt: 'desc' }, take: 50, select: { id: true, originalName: true, mimeType: true, optNote: true, optAt: true } }),
      this.prisma.setting.findUnique({ where: { key: CHAVE_LIMPEZA } }),
      this.prisma.$queryRaw<{ mes: string; arquivos: number; recebido: bigint; guardado: bigint }[]>(Prisma.sql`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mes, COUNT(*)::int AS arquivos,
               SUM(COALESCE("originalSize", "size"))::bigint AS recebido, SUM(CASE WHEN "dedupOfId" IS NULL THEN "size" ELSE 0 END)::bigint AS guardado
        FROM "FileAsset" WHERE "createdAt" >= date_trunc('month', now()) - interval '11 months' GROUP BY 1 ORDER BY 1`),
      this.config(),
      qpdfDisponivel(),
    ]);
    const categorias = new Map<Categoria, { categoria: Categoria; arquivos: number; bytes: number; recebido: number }>();
    for (const g of porMime) {
      const c = categoriaDe(g.mimeType);
      const atual = categorias.get(c) ?? { categoria: c, arquivos: 0, bytes: 0, recebido: 0 };
      atual.arquivos += g._count;
      atual.bytes += g._sum.size ?? 0;
      atual.recebido += Math.max(g._sum.originalSize ?? 0, 0);
      categorias.set(c, atual);
    }
    // recebido: arquivos antigos não têm originalSize; conta o tamanho atual
    const antigos = await this.prisma.fileAsset.groupBy({ by: ['mimeType'], where: { originalSize: null }, _sum: { size: true } });
    for (const g of antigos) categorias.get(categoriaDe(g.mimeType))!.recebido += g._sum.size ?? 0;

    const [disco, pastas] = await Promise.all([
      fs.statfs(this.dir).then((s) => ({ total: s.blocks * s.bsize, livre: s.bavail * s.bsize })).catch(() => null),
      Promise.all(['variantes', 'originais', '.doc-cache', '.tmp-videos'].map(async (p) => [p, await tamanhoPasta(path.join(this.dir, p))] as const)),
    ]);
    const arquivosNoDisco = await tamanhoRaiz(this.dir);
    const econ = economiaRow[0] ?? { otimizacao: 0n, dedup: 0n };
    const totalRecebido = [...categorias.values()].reduce((s, c) => s + c.recebido, 0);
    const totalGuardado = [...categorias.values()].reduce((s, c) => s + c.bytes, 0) - Number(econ.dedup ?? 0);
    const dados = {
      geradoEm: new Date().toISOString(),
      disco,
      uploads: { arquivos: arquivosNoDisco.arquivos, bytes: arquivosNoDisco.bytes, pastas: Object.fromEntries(pastas) },
      totais: {
        arquivos: [...categorias.values()].reduce((s, c) => s + c.arquivos, 0),
        recebido: totalRecebido,
        guardado: totalGuardado,
        economiaOtimizacao: Number(econ.otimizacao ?? 0),
        economiaDuplicados: Number(econ.dedup ?? 0),
        reducao: totalRecebido ? 1 - totalGuardado / totalRecebido : 0,
      },
      categorias: [...categorias.values()].sort((a, b) => b.bytes - a.bytes),
      status: Object.fromEntries(porStatus.map((s) => [s.optStatus ?? 'NAO_ANALISADO', s._count])),
      duplicados: { grupos: duplicados[0]?.grupos ?? 0, arquivos: duplicados[0]?.arquivos ?? 0, bytesLiberaveis: Number(duplicados[0]?.bytes ?? 0) },
      pdfsGrandes,
      erros,
      meses: meses.map((m) => ({ mes: m.mes, arquivos: m.arquivos, recebido: Number(m.recebido), guardado: Number(m.guardado) })),
      ultimaLimpeza: limpeza?.value ?? null,
      config: cfg,
      ferramentas: { qpdf },
    };
    this.resumoCache = { em: Date.now(), dados };
    return dados;
  }

  async historico(take = 100, status?: 'erros') {
    return this.prisma.fileOptLog.findMany({
      where: status === 'erros' ? { ok: false } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 500),
      include: { file: { select: { id: true, originalName: true, mimeType: true, optStatus: true, origin: true, public: true } } },
    });
  }
}

async function listarArquivos(dir: string): Promise<{ path: string; st: import('fs').Stats }[]> {
  const out: { path: string; st: import('fs').Stats }[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listarArquivos(p)));
    else {
      const st = await fs.stat(p).catch(() => null);
      if (st) out.push({ path: p, st });
    }
  }
  return out;
}

async function tamanhoPasta(dir: string) {
  const fs_ = await listarArquivos(dir);
  return { arquivos: fs_.length, bytes: fs_.reduce((s, f) => s + f.st.size, 0) };
}

/** Arquivos guardados (raiz da pasta de uploads), contando cada link físico uma vez só: é o espaço real em disco. */
async function tamanhoRaiz(dir: string) {
  const vistos = new Set<number>();
  let bytes = 0;
  let arquivos = 0;
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (!e.isFile()) continue;
    const st = await fs.stat(path.join(dir, e.name)).catch(() => null);
    if (!st) continue;
    arquivos++;
    if (vistos.has(st.ino)) continue;
    vistos.add(st.ino);
    bytes += st.size;
  }
  return { arquivos, bytes };
}
