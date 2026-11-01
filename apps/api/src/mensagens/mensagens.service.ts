import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_SETTINGS } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { MENSAGENS_KEY, lerPersonalizadas, normalizar, renderizar, type Vars } from './registry';

type Db = PrismaService | Prisma.TransactionClient;

interface Estado {
  at: number;
  personalizadas: Record<string, string>;
  site: string;
}

/** Cache curto (por processo): as mensagens são lidas a cada aviso enviado. Salvar pelo painel limpa na hora. */
const TTL_MS = 30_000;
let cache: Estado | null = null;

export function limparCacheMensagens() {
  cache = null;
}

async function carregar(db: Db): Promise<Estado> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const rows = await db.setting.findMany({ where: { key: { in: [MENSAGENS_KEY, 'siteName'] } } });
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const site = typeof raw.siteName === 'string' && raw.siteName.trim() ? raw.siteName.trim() : String(DEFAULT_SETTINGS.siteName);
  cache = { at: Date.now(), personalizadas: lerPersonalizadas(raw[MENSAGENS_KEY]), site };
  return cache;
}

/** Nome da instituição configurado em Instituição e aparência (siteName). */
export async function nomeDoSite(db: Db): Promise<string> {
  return (await carregar(db)).site;
}

/** Autor das planilhas exportadas ("NITERA Resolve <nome da instituição>"). */
export async function autorPlanilha(db: Db): Promise<string> {
  return `NITERA Resolve ${await nomeDoSite(db)}`;
}

/**
 * Texto de uma mensagem automática já com as variáveis aplicadas.
 * {site} (nome da instituição) é preenchida sempre; as demais vêm em `vars`.
 */
export async function renderMensagem(db: Db, chave: string, vars: Vars = {}): Promise<string> {
  const e = await carregar(db);
  return renderizar(e.personalizadas, chave, { site: e.site, ...vars });
}

/** Palavras-chave do WhatsApp (já normalizadas: minúsculas e sem acento). */
export async function palavrasWhatsapp(db: Db) {
  const e = await carregar(db);
  const status = renderizar(e.personalizadas, 'chamados.whatsapp.palavraStatus');
  const novo = renderizar(e.personalizadas, 'chamados.whatsapp.palavraNovo');
  const saudacoes = renderizar(e.personalizadas, 'chamados.whatsapp.saudacoes').split(',').map(normalizar).filter(Boolean);
  return { status: normalizar(status), novo: normalizar(novo), statusExibir: status, novoExibir: novo.toLocaleUpperCase('pt-BR'), saudacoes };
}

/** Versão injetável, para quem preferir receber pelo construtor. */
@Injectable()
export class MensagensService {
  constructor(private prisma: PrismaService) {}

  render(chave: string, vars: Vars = {}) {
    return renderMensagem(this.prisma, chave, vars);
  }

  siteName() {
    return nomeDoSite(this.prisma);
  }

  async personalizadas() {
    return { ...(await carregar(this.prisma)).personalizadas };
  }

  limparCache() {
    limparCacheMensagens();
  }
}
