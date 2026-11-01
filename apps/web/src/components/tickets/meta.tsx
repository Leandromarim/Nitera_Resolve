'use client';

import {
  AirVent,
  Cable,
  DatabaseBackup,
  Server,
  AlarmClock,
  AppWindow,
  Armchair,
  Camera,
  Cctv,
  DoorOpen,
  Droplets,
  Megaphone,
  Newspaper,
  Palette,
  Share2,
  Stethoscope,
  Zap,
  CircleHelp,
  Globe,
  Hospital,
  KeyRound,
  Mail,
  MessageCircle,
  Monitor,
  Phone,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, clsx } from '@/components/ui';
import { TICKET_CHANNEL, TICKET_PRIORITY, TICKET_STATUS } from '@/lib/format';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import { getTicketsConfig, subscribeTicketsConfig, useTicketsConfig } from './config';
import type { Ticket, TicketChannel, TicketPriority, TicketStatus } from './types';
import { isOpen } from './types';

// ───────── Status ─────────

export const STATUS_DOT: Record<TicketStatus, string> = {
  NOVO: 'bg-sky-500',
  EM_ATENDIMENTO: 'bg-amber-500',
  AGUARDANDO_USUARIO: 'bg-violet-500',
  RESOLVIDO: 'bg-emerald-500',
  FECHADO: 'bg-slate-400',
  CANCELADO: 'bg-rose-500',
};

/** Rótulo do status; para o solicitante, "Aguardando usuário" vira "Aguardando você". */
export const statusLabel = (s: TicketStatus, forRequester = false) =>
  forRequester && s === 'AGUARDANDO_USUARIO' ? 'Aguardando você' : TICKET_STATUS[s]?.label ?? s;

export function StatusBadge({ status, forRequester, className }: { status: TicketStatus; forRequester?: boolean; className?: string }) {
  return (
    <Badge className={clsx(TICKET_STATUS[status]?.color, className)}>
      <span className={clsx('size-1.5 rounded-full', STATUS_DOT[status])} aria-hidden />
      {statusLabel(status, forRequester)}
    </Badge>
  );
}

// ───────── Prioridade ─────────

export const PRIORITY_ICON: Record<TicketPriority, LucideIcon> = { BAIXA: SignalLow, MEDIA: SignalMedium, ALTA: SignalHigh, CRITICA: Signal };

export const PRIORITY_HELP: Record<TicketPriority, string> = {
  BAIXA: 'Dúvida, melhoria ou algo que não atrapalha o trabalho agora.',
  MEDIA: 'Atrapalha o trabalho, mas existe uma alternativa por enquanto.',
  ALTA: 'Impede o trabalho de uma pessoa ou de um setor.',
  CRITICA: 'Afeta o atendimento a pacientes ou vários setores ao mesmo tempo.',
};
// a explicação configurada no painel (Categorias e SLA › Prioridades e SLA) substitui o padrão
subscribeTicketsConfig(() => {
  const p = getTicketsConfig().priorities;
  for (const k of Object.keys(PRIORITY_HELP) as TicketPriority[]) if (p[k]?.help) PRIORITY_HELP[k] = p[k].help;
});

/** Rótulo da prioridade (configurado no painel; padrão de lib/format). */
export function usePriorityLabel() {
  const p = useTicketsConfig().priorities;
  return (k: TicketPriority) => p[k]?.label || TICKET_PRIORITY[k]?.label || k;
}

export function PriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  const Icon = PRIORITY_ICON[priority];
  const label = usePriorityLabel();
  return (
    <Badge className={clsx(TICKET_PRIORITY[priority]?.color, className)}>
      <Icon className="size-3" aria-hidden />
      {label(priority)}
    </Badge>
  );
}

// ───────── Canal ─────────

export const CHANNEL_ICON: Record<TicketChannel, LucideIcon> = { PORTAL: Globe, WHATSAPP: MessageCircle, EMAIL: Mail, TELEFONE: Phone };
const CHANNEL_COLOR: Record<TicketChannel, string> = {
  PORTAL: 'text-brand-600 bg-brand-50 dark:text-brand-300 dark:bg-brand-900/40',
  WHATSAPP: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30',
  EMAIL: 'text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-900/30',
  TELEFONE: 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/30',
};

export function ChannelIcon({ channel, withLabel, className }: { channel: TicketChannel; withLabel?: boolean; className?: string }) {
  const Icon = CHANNEL_ICON[channel] ?? Globe;
  const label = TICKET_CHANNEL[channel] ?? channel;
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-md text-xs font-medium', withLabel ? 'px-1.5 py-0.5' : 'p-1', CHANNEL_COLOR[channel], className)}
      title={`Aberto via ${label}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {withLabel ? label : <span className="sr-only">{label}</span>}
    </span>
  );
}

// ───────── Categoria ─────────

/**
 * Ícone da categoria: o escolhido no painel (Categorias e SLA › editar categoria);
 * sem escolha, o ícone sugerido pelo nome (categoryIcon).
 */
export function CategoryIcon({ category, className }: { category?: { id?: string | null; name?: string | null } | null; className?: string }) {
  const extra = useTicketsConfig().categories[category?.id ?? ''];
  if (extra?.image || extra?.icon) return <DynamicIcon name={extra.icon} image={extra.image} className={className} />;
  const Icon = categoryIcon(category?.name);
  return <Icon className={className} aria-hidden />;
}

/** Ícone sugerido pelo nome da categoria (padrão quando nenhum ícone foi escolhido no painel). */
export function categoryIcon(name?: string | null): LucideIcon {
  const n = (name ?? '').toLowerCase();
  // Manutenção
  if (/el[eé]tric|tomada|l[aâ]mpada|ilumina/.test(n)) return Zap;
  if (/hidr[aá]ulic|vazamento|torneira|esgoto/.test(n)) return Droplets;
  if (/ar-?condicionado|climatiza/.test(n)) return AirVent;
  if (/predial|porta|pintura|forro/.test(n)) return DoorOpen;
  if (/mobili[aá]rio|cadeira|mesa/.test(n)) return Armchair;
  if (/equipamentos? hospitalar/.test(n)) return Stethoscope;
  // Comunicação
  if (/arte|divulga/.test(n)) return Palette;
  if (/publica[cç][aã]o|intranet/.test(n)) return Newspaper;
  if (/evento|foto/.test(n)) return Camera;
  if (/comunicado/.test(n)) return Megaphone;
  if (/redes sociais|instagram/.test(n)) return Share2;
  // Infraestrutura de TI
  if (/vpn|acesso remoto/.test(n)) return Globe;
  if (/servidor/.test(n)) return Server;
  if (/backup|restaura/.test(n)) return DatabaseBackup;
  if (/cabeamento|pontos? de rede/.test(n)) return Cable;
  if (/cftv|c[aâ]mera/.test(n)) return Cctv;
  // TI
  if (/senha|acesso|login/.test(n)) return KeyRound;
  if (/computador|notebook|pc|monitor/.test(n)) return Monitor;
  if (/e-?mail|microsoft|365|outlook/.test(n)) return Mail;
  if (/impressora|scanner/.test(n)) return Printer;
  if (/software|instala|programa/.test(n)) return AppWindow;
  if (/rede|internet|wi-?fi/.test(n)) return Wifi;
  if (/sistema|orbis|prontu/.test(n)) return Hospital;
  if (/telefon|ramal/.test(n)) return Phone;
  return CircleHelp;
}

const CATEGORY_TONES = [
  'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
];
export const categoryTone = (name?: string | null) => CATEGORY_TONES[[...(name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % CATEGORY_TONES.length];

// ───────── Tempo / SLA ─────────

/** Relógio que atualiza a cada `ms` (para o SLA "andar" sozinho). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Duração curta em pt-BR: 45 min, 3 h 20 min, 2 d 4 h. */
export function fmtDuration(ms: number) {
  const m = Math.max(0, Math.round(Math.abs(ms) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

export const fmtHours = (h: number | null | undefined) => (h == null ? '—' : fmtDuration(h * 3_600_000));

export type SlaState = 'ok' | 'warn' | 'late' | 'met' | 'missed';
export function slaInfo(t: Pick<Ticket, 'dueAt' | 'status' | 'resolvedAt' | 'createdAt'>, now: number): { state: SlaState; text: string } | null {
  if (!t.dueAt) return null;
  const due = new Date(t.dueAt).getTime();
  if (!isOpen(t.status)) {
    if (!t.resolvedAt) return null;
    return new Date(t.resolvedAt).getTime() <= due ? { state: 'met', text: 'Resolvido no prazo' } : { state: 'missed', text: 'Resolvido fora do prazo' };
  }
  const left = due - now;
  if (left < 0) return { state: 'late', text: `Atrasado ${fmtDuration(left)}` };
  const total = due - new Date(t.createdAt).getTime();
  const warn = left < 60 * 60_000 || (total > 0 && left / total < 0.25);
  return { state: warn ? 'warn' : 'ok', text: `${fmtDuration(left)} restantes` };
}

export const isOverdue = (t: Ticket, now: number) => isOpen(t.status) && !!t.dueAt && new Date(t.dueAt).getTime() < now;

const SLA_CLS: Record<SlaState, string> = {
  ok: 'text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:ring-emerald-800',
  warn: 'text-amber-800 bg-amber-50 ring-amber-200 dark:text-amber-200 dark:bg-amber-900/20 dark:ring-amber-800',
  late: 'text-white bg-rose-600 ring-rose-600',
  met: 'text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:ring-emerald-800',
  missed: 'text-rose-700 bg-rose-50 ring-rose-200 dark:text-rose-300 dark:bg-rose-900/20 dark:ring-rose-800',
};

export function SlaIndicator({ ticket, now, compact }: { ticket: Pick<Ticket, 'dueAt' | 'status' | 'resolvedAt' | 'createdAt'>; now: number; compact?: boolean }) {
  const s = slaInfo(ticket, now);
  if (!s) return compact ? <span className="text-xs text-slate-400">—</span> : null;
  const Icon = s.state === 'late' || s.state === 'missed' ? ShieldAlert : s.state === 'met' ? ShieldCheck : AlarmClock;
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', SLA_CLS[s.state], s.state === 'late' && 'animate-pulse')}
      title={ticket.dueAt ? `Prazo (SLA): ${new Date(ticket.dueAt).toLocaleString('pt-BR')}` : undefined}
    >
      <Icon className="size-3.5" aria-hidden />
      {s.text}
    </span>
  );
}

export const isImage = (name?: string | null) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(name ?? '');
