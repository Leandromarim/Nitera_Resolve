import { api } from '@/lib/api';

export type Level = 'INFO' | 'IMPORTANTE' | 'URGENTE';

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  level: Level;
  system: boolean;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationPage {
  items: NotificationItem[];
  total: number;
  unread: number;
  page: number;
  pages: number;
}

export const LEVEL: Record<Level, { label: string; badge: string; dot: string; bar: string }> = {
  INFO: {
    label: 'Informativo',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
    dot: 'bg-sky-500',
    bar: 'border-sky-500',
  },
  IMPORTANTE: {
    label: 'Importante',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
    bar: 'border-amber-500',
  },
  URGENTE: {
    label: 'Urgente',
    badge: 'bg-red-600 text-white',
    dot: 'bg-red-600',
    bar: 'border-red-600',
  },
};

/** Evento disparado quando avisos são lidos, para o sino e a faixa se atualizarem juntos. */
export const NOTIFICATIONS_CHANGED = 'resolve:notificacoes';
export const emitChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export async function markRead(id: string) {
  await api(`/notificacoes/${id}/lida`, { method: 'POST' });
  emitChanged();
}

export async function markAllRead() {
  await api('/notificacoes/lidas', { method: 'POST' });
  emitChanged();
}

/** Links internos navegam no app; externos abrem em nova aba. */
export const isExternal = (link: string) => /^https?:\/\//i.test(link);
