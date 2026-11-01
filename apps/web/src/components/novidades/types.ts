import { ShieldCheck, Sparkles, TrendingUp, Wrench, type LucideIcon } from 'lucide-react';

export type ReleaseKind = 'NOVIDADE' | 'MELHORIA' | 'CORRECAO' | 'SEGURANCA';

export interface ReleaseItem {
  id: string;
  kind: ReleaseKind;
  title: string;
  /** HTML já sanitizado pelo servidor */
  description: string;
  /** por que mudou (texto simples) */
  reason?: string | null;
  imageId: string | null;
  image: string | null;
  order: number;
}

export interface Release {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  publishedAt: string | null;
  items: ReleaseItem[];
}

export interface AdminRelease extends Release {
  published: boolean;
  announce: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export const KINDS: ReleaseKind[] = ['NOVIDADE', 'MELHORIA', 'CORRECAO', 'SEGURANCA'];

export const KIND_META: Record<ReleaseKind, { label: string; plural: string; icon: LucideIcon; badge: string; dot: string; ring: string }> = {
  NOVIDADE: {
    label: 'Novidade',
    plural: 'Novidades',
    icon: Sparkles,
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    dot: 'bg-emerald-500 text-white',
    ring: 'ring-emerald-200 dark:ring-emerald-900',
  },
  MELHORIA: {
    label: 'Melhoria',
    plural: 'Melhorias',
    icon: TrendingUp,
    badge: 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200',
    dot: 'bg-brand-600 text-white',
    ring: 'ring-brand-200 dark:ring-brand-900',
  },
  CORRECAO: {
    label: 'Correção',
    plural: 'Correções',
    icon: Wrench,
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500 text-white',
    ring: 'ring-amber-200 dark:ring-amber-900',
  },
  SEGURANCA: {
    label: 'Segurança',
    plural: 'Segurança',
    icon: ShieldCheck,
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    dot: 'bg-violet-600 text-white',
    ring: 'ring-violet-200 dark:ring-violet-900',
  },
};

export const SEMVER = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

export const fmtReleaseDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Não publicada';

/** Itens agrupados por tipo, na ordem Novidade → Melhoria → Correção → Segurança. */
export function groupItems(items: ReleaseItem[]) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  return KINDS.map((kind) => ({ kind, items: sorted.filter((i) => i.kind === kind) })).filter((g) => g.items.length);
}
