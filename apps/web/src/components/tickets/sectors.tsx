'use client';

import { Megaphone, MonitorSmartphone, Server, Wrench, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { clsx } from '@/components/ui';
import type { Role } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import { getTicketsConfig, sectorTone, subscribeTicketsConfig, useTicketsConfig } from './config';
import type { TicketSector } from './types';

/** Filas de chamados. Cada setor é atendido por um perfil próprio; ADMIN atende todos. */
export const SECTORS: TicketSector[] = ['TI', 'INFRAESTRUTURA', 'MANUTENCAO', 'COMUNICACAO'];

export const SECTOR_ROLE: Record<TicketSector, Role> = { TI: 'TI', INFRAESTRUTURA: 'INFRAESTRUTURA', MANUTENCAO: 'MANUTENCAO', COMUNICACAO: 'COMUNICACAO' };

/** Perfis que atendem alguma fila. */
export const TICKET_STAFF_ROLES: Role[] = SECTORS.map((s) => SECTOR_ROLE[s]);

/*
 * Os textos abaixo são o padrão; quando a configuração do painel (Categorias e SLA › Setores) chega,
 * os objetos são atualizados no lugar (applySectorConfig), para que todas as telas usem o nome configurado.
 * Componentes que precisam re-renderizar na hora usam useTicketsConfig().
 */
export const SECTOR_LABEL: Record<TicketSector, string> = {
  TI: 'Tecnologia da Informação',
  INFRAESTRUTURA: 'Infraestrutura de TI',
  MANUTENCAO: 'Manutenção',
  COMUNICACAO: 'Comunicação',
};

/** Nome curto (selos, abas). */
export const SECTOR_SHORT: Record<TicketSector, string> = { TI: 'TI', INFRAESTRUTURA: 'Infraestrutura', MANUTENCAO: 'Manutenção', COMUNICACAO: 'Comunicação' };

/** "a equipe de …", para textos corridos. */
export const SECTOR_TEAM: Record<TicketSector, string> = {
  TI: 'equipe de TI',
  INFRAESTRUTURA: 'equipe de Infraestrutura de TI',
  MANUTENCAO: 'equipe de Manutenção',
  COMUNICACAO: 'equipe de Comunicação',
};

export const SECTOR_HELP: Record<TicketSector, string> = {
  TI: 'Computador, sistemas, impressora, internet, e-mail, senhas e acessos.',
  INFRAESTRUTURA: 'Pontos de rede e cabeamento, telefonia (ramais e linhas) e sistemas de CFTV (câmeras de segurança).',
  MANUTENCAO: 'Elétrica, hidráulica, ar-condicionado, portas, mobiliário e equipamentos.',
  COMUNICACAO: 'Artes, divulgação, publicações, eventos e comunicados.',
};

export const SECTOR_ICON: Record<TicketSector, LucideIcon> = { TI: MonitorSmartphone, INFRAESTRUTURA: Server, MANUTENCAO: Wrench, COMUNICACAO: Megaphone };

export const SECTOR_TONE: Record<TicketSector, string> = {
  TI: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  INFRAESTRUTURA: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  MANUTENCAO: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  COMUNICACAO: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
};

function applySectorConfig() {
  const cfg = getTicketsConfig();
  for (const s of SECTORS) {
    const c = cfg.sectors[s];
    if (!c) continue;
    SECTOR_LABEL[s] = c.label;
    SECTOR_SHORT[s] = c.short;
    SECTOR_TEAM[s] = c.team;
    SECTOR_HELP[s] = c.help;
    SECTOR_TONE[s] = sectorTone(c.color);
  }
}
subscribeTicketsConfig(applySectorConfig);

/** Ícone configurado do setor (catálogo ou imagem própria). */
export function SectorIcon({ sector, className }: { sector: TicketSector; className?: string }) {
  const c = useTicketsConfig().sectors[sector];
  return <DynamicIcon name={c?.icon} image={c?.image} className={className} />;
}

/** Lê "ti", "manutencao", "COMUNICACAO"… da URL. Valor desconhecido = null. */
/**
 * Lê a equipe do endereço (?setor=). Aceita o código (INFRAESTRUTURA), o nome com ou sem acento e espaços
 * ("Infraestrutura de TI", infraestruturadeti) e pequenos erros de digitação em links feitos no painel.
 */
export function parseSector(v?: string | null): TicketSector | null {
  const s = (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return null;
  const exato = SECTORS.find((x) => x.toLowerCase() === s);
  if (exato) return exato;
  if (s.includes('estrutura') || s.startsWith('infra')) return 'INFRAESTRUTURA';
  if (s.startsWith('manut')) return 'MANUTENCAO';
  if (s.startsWith('comunic')) return 'COMUNICACAO';
  if (s === 'tecnologiadainformacao' || s === 'suporteti') return 'TI';
  return null;
}

/** Setores que o usuário logado atende (ADMIN: todos). */
export function useStaffSectors(): TicketSector[] {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return [];
    if (user.roles.includes('ADMIN')) return [...SECTORS];
    return SECTORS.filter((s) => user.roles.includes(SECTOR_ROLE[s]));
  }, [user]);
}

/**
 * Equipes que a pessoa acompanha só para leitura (Categorias e SLA › Setores), sem as que ela já atende.
 * Cada equipe diz quem acompanha: a equipe toda ou só quem tem a permissão "Gestor da área". A API confere de novo.
 */
export function useWatchedSectors(): TicketSector[] {
  const { user } = useAuth();
  const mine = useStaffSectors();
  const cfg = useTicketsConfig();
  const gestor = !!user?.roles.includes('GESTOR_AREA');
  const admin = !!user?.roles.includes('ADMIN');
  return useMemo(() => {
    if (admin) return [];
    const out = new Set<TicketSector>();
    for (const s of mine) {
      if (!gestor && cfg.sectors[s]?.acompanhaQuem !== 'equipe') continue;
      for (const o of cfg.sectors[s]?.acompanha ?? []) if (!mine.includes(o)) out.add(o);
    }
    return SECTORS.filter((s) => out.has(s));
  }, [mine, cfg, gestor, admin]);
}

export function SectorBadge({ sector, className, short = true }: { sector: TicketSector; className?: string; short?: boolean }) {
  const c = useTicketsConfig().sectors[sector];
  const label = c?.label ?? SECTOR_LABEL[sector];
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', c ? sectorTone(c.color) : SECTOR_TONE[sector], className)}
      title={`Equipe: ${label}`}
    >
      <DynamicIcon name={c?.icon} image={c?.image} className="size-3" />
      <span className="sr-only">Equipe: </span>
      {short ? c?.short ?? SECTOR_SHORT[sector] : label}
    </span>
  );
}

/**
 * Abas de setor para quem atende mais de um. `value` vazio = "Todos os meus setores" (quando `allowAll`).
 * Com um setor só, não mostra nada.
 */
export function SectorTabs({
  sectors,
  value,
  onChange,
  allowAll = true,
  label = 'Setor',
  className,
}: {
  sectors: TicketSector[];
  value: TicketSector | '';
  onChange: (v: TicketSector | '') => void;
  allowAll?: boolean;
  label?: string;
  className?: string;
}) {
  const cfg = useTicketsConfig();
  if (sectors.length < 2) return null;
  const options: [TicketSector | '', string][] = [
    ...(allowAll ? ([['', 'Todos os meus setores']] as [TicketSector | '', string][]) : []),
    ...sectors.map((s) => [s, cfg.sectors[s]?.short ?? SECTOR_SHORT[s]] as [TicketSector, string]),
  ];
  return (
    <div className={clsx('flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800', className)} role="tablist" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v || 'todos'}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-500',
            value === v ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {v && <DynamicIcon name={cfg.sectors[v]?.icon} image={cfg.sectors[v]?.image} className="size-4" />}
          {text}
        </button>
      ))}
    </div>
  );
}
