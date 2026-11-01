'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { TicketPriority, TicketSector } from './types';

/**
 * Configuração dos chamados editada em Painel › Categorias e SLA (setores, prioridades, dicas, canais, regras).
 * Carregada uma vez por sessão de GET /tickets/config; até chegar, vale o padrão abaixo (igual ao da API).
 */
export interface SectorConfig {
  label: string;
  short: string;
  team: string;
  help: string;
  icon: string;
  imageId: string | null;
  image?: string | null;
  color: string;
  tips: string[];
  titleExample: string;
  descriptionPlaceholder: string;
  /** outras equipes cujos chamados e planejamento esta equipe acompanha, só para leitura */
  acompanha: TicketSector[];
  /** quem acompanha: só quem tem a permissão "Gestor da área" ou a equipe toda */
  acompanhaQuem?: 'gestor' | 'equipe';
}

export interface KeywordTip {
  id: string;
  sectors: TicketSector[];
  words: string[];
  tips: string[];
}

export interface TicketsConfig {
  sectors: Record<TicketSector, SectorConfig>;
  priorities: Record<TicketPriority, { label: string; help: string }>;
  keywordTips: KeywordTip[];
  noSectorTip: string;
  alwaysTip: string;
  rules: {
    slaFactor: Record<TicketPriority, number>;
    defaultSlaHours: number;
    whatsappSector: TicketSector;
    emailSector: TicketSector;
    whatsappWindowDays: number;
    whatsappAskSector: boolean;
    whatsappAskCategory: boolean;
    whatsappSectors: TicketSector[];
    redirects: { id: string; from: TicketSector; to: TicketSector; words: string[] }[];
  };
  channels: { title: string; text: string; mailSubject: string };
  success: { title: string; subtitle: string; numberLabel: string; note: string };
}

export interface CategoryExtra {
  icon: string | null;
  imageId?: string | null;
  image: string | null;
  tips: string[];
}

export interface PublicTicketsConfig extends TicketsConfig {
  categories: Record<string, CategoryExtra>;
}

/** Cores dos setores (chaves espelhadas em SECTOR_COLORS da API). */
export const SECTOR_COLORS: { key: string; label: string; tone: string; solid: string }[] = [
  { key: 'ceu', label: 'Azul-céu', tone: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', solid: 'bg-sky-500' },
  { key: 'ambar', label: 'Âmbar', tone: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', solid: 'bg-amber-500' },
  { key: 'fucsia', label: 'Fúcsia', tone: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300', solid: 'bg-fuchsia-500' },
  { key: 'verde', label: 'Verde', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', solid: 'bg-emerald-500' },
  { key: 'roxo', label: 'Roxo', tone: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', solid: 'bg-violet-500' },
  { key: 'coral', label: 'Coral', tone: 'bg-orange-50 text-coral-600 dark:bg-coral-500/20 dark:text-coral-400', solid: 'bg-coral-500' },
  { key: 'azul', label: 'Azul da marca', tone: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300', solid: 'bg-brand-600' },
  { key: 'cinza', label: 'Cinza', tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', solid: 'bg-slate-500' },
  { key: 'vermelho', label: 'Vermelho', tone: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', solid: 'bg-rose-500' },
  { key: 'turquesa', label: 'Turquesa', tone: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', solid: 'bg-teal-500' },
  { key: 'laranja', label: 'Laranja', tone: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', solid: 'bg-orange-500' },
  { key: 'rosa', label: 'Rosa', tone: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300', solid: 'bg-pink-500' },
];
const colorOf = (key: string) => SECTOR_COLORS.find((c) => c.key === key) ?? SECTOR_COLORS[0]!;
export const sectorTone = (key: string) => colorOf(key).tone;
export const sectorSolid = (key: string) => colorOf(key).solid;

export const DEFAULT_TICKETS_CONFIG: PublicTicketsConfig = {
  sectors: {
    TI: {
      label: 'Tecnologia da Informação',
      short: 'TI',
      team: 'equipe de TI',
      help: 'Computador, sistemas, impressora, internet, e-mail, senhas e acessos.',
      icon: 'monitor',
      imageId: null,
      color: 'ceu',
      tips: ['Descreva o que você estava fazendo quando o problema aconteceu.', 'Se possível, anexe um print da tela.'],
      titleExample: 'Impressora do posto 2 não imprime',
      descriptionPlaceholder: 'Conte com detalhes: o que aconteceu, desde quando, se aparece alguma mensagem de erro…',
      acompanha: ['INFRAESTRUTURA'],
      acompanhaQuem: 'equipe',
    },
    INFRAESTRUTURA: {
      label: 'Infraestrutura de TI',
      short: 'Infraestrutura',
      team: 'equipe de Infraestrutura de TI',
      help: 'Pontos de rede e cabeamento, telefonia (ramais e linhas) e sistemas de CFTV (câmeras de segurança).',
      icon: 'server',
      imageId: null,
      color: 'turquesa',
      tips: ['Informe o setor e, se souber, o número do ponto de rede, do ramal ou da câmera.', 'Diga se o problema é em um ponto só ou no setor todo.'],
      titleExample: 'Sem internet nos computadores do 2º andar',
      descriptionPlaceholder: 'Conte com detalhes: o que parou, desde quando, quantos computadores ou setores foram afetados…',
      acompanha: ['MANUTENCAO'],
      acompanhaQuem: 'gestor',
    },
    MANUTENCAO: {
      label: 'Manutenção',
      short: 'Manutenção',
      team: 'equipe de Manutenção',
      help: 'Elétrica, hidráulica, ar-condicionado, portas, mobiliário e equipamentos.',
      icon: 'wrench',
      imageId: null,
      color: 'ambar',
      tips: [
        'Informe o local exato: andar, ala, sala ou leito.',
        'Se houver risco (fio exposto, vazamento, cheiro de queimado), isole a área e marque a prioridade Crítica.',
        'Se possível, anexe uma foto do problema.',
      ],
      titleExample: 'Ar-condicionado da sala 3 não liga',
      descriptionPlaceholder: 'Conte com detalhes: o que está com defeito, desde quando, se há risco para pacientes ou colaboradores…',
      acompanha: ['INFRAESTRUTURA'],
      acompanhaQuem: 'equipe',
    },
    COMUNICACAO: {
      label: 'Comunicação',
      short: 'Comunicação',
      team: 'equipe de Comunicação',
      help: 'Artes, divulgação, publicações, eventos e comunicados.',
      icon: 'megaphone',
      imageId: null,
      color: 'fucsia',
      tips: [
        'Informe a data em que o material precisa estar pronto ou publicado.',
        'Anexe os textos, logotipos e fotos que devem ser usados.',
        'Diga onde será divulgado: site, murais, redes sociais, e-mail…',
      ],
      titleExample: 'Arte para a campanha de vacinação',
      descriptionPlaceholder: 'Conte com detalhes: o que precisa ser feito, para quem é, prazo e onde será divulgado…',
      acompanha: [],
      acompanhaQuem: 'gestor',
    },
  },
  priorities: {
    BAIXA: { label: 'Baixa', help: 'Dúvida, melhoria ou algo que não atrapalha o trabalho agora.' },
    MEDIA: { label: 'Média', help: 'Atrapalha o trabalho, mas existe uma alternativa por enquanto.' },
    ALTA: { label: 'Alta', help: 'Impede o trabalho de uma pessoa ou de um setor.' },
    CRITICA: { label: 'Crítica', help: 'Afeta o atendimento a pacientes ou vários setores ao mesmo tempo.' },
  },
  keywordTips: [
    { id: 'senha', sectors: ['TI'], words: ['senha', 'acesso'], tips: ['Informe o usuário/login afetado (nunca envie sua senha).', 'Diga em qual sistema o acesso falha.'] },
    { id: 'impressora', sectors: ['TI'], words: ['impressora'], tips: ['Informe o nome ou a etiqueta da impressora.', 'Diga se aparece alguma mensagem no visor.'] },
    { id: 'sistema', sectors: ['TI'], words: ['sistema', 'orbis'], tips: ['Diga em qual tela ou módulo ocorre o erro.', 'Anexe um print da mensagem de erro.'] },
    { id: 'rede', sectors: ['TI'], words: ['rede', 'internet'], tips: ['Diga se o problema é só no seu computador ou no setor todo.', 'Informe se é rede cabeada ou Wi-Fi.'] },
  ],
  noSectorTip: 'Escolha a equipe que cuida do assunto: TI, Manutenção ou Comunicação.',
  alwaysTip: 'Um chamado por problema facilita o acompanhamento.',
  rules: { slaFactor: { CRITICA: 0.25, ALTA: 0.5, MEDIA: 1, BAIXA: 2 }, defaultSlaHours: 24, whatsappSector: 'TI',
    emailSector: 'TI',
    whatsappWindowDays: 30,
    whatsappAskSector: true,
    whatsappAskCategory: true,
    whatsappSectors: ['TI', 'INFRAESTRUTURA', 'MANUTENCAO', 'COMUNICACAO'],
    redirects: [],
  },
  channels: {
    title: 'Outras formas de falar com a TI',
    text: 'Sem acesso ao computador? Fale com a TI por aqui — o chamado de TI é criado automaticamente.',
    mailSubject: 'Chamado de TI',
  },
  success: {
    title: 'Chamado aberto com sucesso!',
    subtitle: 'A {equipe} já foi avisada.',
    numberLabel: 'Número do chamado',
    note: 'Guarde este número. Você receberá as atualizações por e-mail e pode acompanhar tudo por aqui.',
  },
  categories: {},
};

// ───────── store global (uma busca por sessão) ─────────

let current: PublicTicketsConfig = DEFAULT_TICKETS_CONFIG;
let state: 'idle' | 'loading' | 'done' = 'idle';
const listeners = new Set<() => void>();

function set(c: PublicTicketsConfig) {
  current = c;
  listeners.forEach((l) => l());
}

/** Aplica uma configuração recebida de fora (ex.: painel da TV, que não tem login). */
export function applyTicketsConfig(partial: Partial<PublicTicketsConfig>) {
  set({ ...current, ...partial });
}

/** Busca de novo (o painel chama depois de salvar). */
export async function reloadTicketsConfig() {
  state = 'loading';
  try {
    const c = await api<PublicTicketsConfig>('/tickets/config');
    set({ ...DEFAULT_TICKETS_CONFIG, ...c, categories: c.categories ?? {} });
    state = 'done';
  } catch {
    // sem login ou API fora do ar: continua com o padrão e tenta de novo na próxima montagem
    state = 'idle';
  }
}

export function subscribeTicketsConfig(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getTicketsConfig = () => current;

/** Configuração atual dos chamados (re-renderiza quando ela chega ou muda). */
export function useTicketsConfig(): PublicTicketsConfig {
  const { user } = useAuth();
  useEffect(() => {
    if (user && state === 'idle') void reloadTicketsConfig();
  }, [user]);
  return useSyncExternalStore(subscribeTicketsConfig, getTicketsConfig, () => DEFAULT_TICKETS_CONFIG);
}

/** Troca {equipe} pelo nome da equipe. */
export const fillTeam = (text: string, team: string) => text.replace(/\{equipe\}/g, team);

/**
 * Dicas do formulário de abertura, nesta ordem: dicas da categoria; dicas por palavra-chave
 * (palavra no nome da categoria, no setor da regra); dicas do setor; antes de escolher a equipe, a dica geral.
 */
export function tipsFor(cfg: PublicTicketsConfig, sector: TicketSector | '', category?: { id: string; name: string } | null): string[] {
  if (!sector) return cfg.noSectorTip ? [cfg.noSectorTip] : [];
  const own = category ? cfg.categories[category.id]?.tips : undefined;
  if (own?.length) return own;
  const n = (category?.name ?? '').toLowerCase();
  if (n) {
    const hit = cfg.keywordTips.find((k) => (!k.sectors.length || k.sectors.includes(sector)) && k.words.some((w) => w && n.includes(w.toLowerCase())));
    if (hit) return hit.tips;
  }
  return cfg.sectors[sector]?.tips ?? [];
}
