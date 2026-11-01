'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, clsx } from '@/components/ui';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { ChannelIcon, PriorityBadge, SlaIndicator, StatusBadge } from './meta';
import { SectorBadge } from './sectors';
import { ramalDo, type Ticket } from './types';

type SortKey = 'number' | 'title' | 'status' | 'priority' | 'category' | 'assignee' | 'due' | 'createdAt' | 'updatedAt';
const PRIORITY_RANK = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 } as const;
const STATUS_RANK = { NOVO: 0, EM_ATENDIMENTO: 1, AGUARDANDO_USUARIO: 2, RESOLVIDO: 3, FECHADO: 4, CANCELADO: 5 } as const;
const PAGE = 25;

const value = (t: Ticket, k: SortKey): string | number => {
  switch (k) {
    case 'number':
      return t.number;
    case 'title':
      return t.title.toLowerCase();
    case 'status':
      return STATUS_RANK[t.status];
    case 'priority':
      return PRIORITY_RANK[t.priority];
    case 'category':
      return (t.category?.name ?? '~').toLowerCase();
    case 'assignee':
      return (t.assignee?.name ?? '~').toLowerCase();
    case 'due':
      return t.dueAt ? +new Date(t.dueAt) : Number.MAX_SAFE_INTEGER;
    case 'createdAt':
      return +new Date(t.createdAt);
    case 'updatedAt':
      return +new Date(t.updatedAt);
  }
};

export function TicketTable({ tickets, now, showSector }: { tickets: Ticket[]; now: number; showSector?: boolean }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'createdAt', dir: -1 });
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const xs = [...tickets];
    xs.sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir || b.number - a.number;
    });
    return xs;
  }, [tickets, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  useEffect(() => {
    if (page >= pages) setPage(pages - 1);
  }, [page, pages]);
  const rows = sorted.slice(page * PAGE, page * PAGE + PAGE);

  const th = (k: SortKey, children: React.ReactNode, className?: string) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th key={k} className={clsx('px-3 py-3 font-semibold whitespace-nowrap', className)} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : k === 'createdAt' || k === 'updatedAt' || k === 'number' ? -1 : 1 }))}
          className={clsx('inline-flex items-center gap-1 rounded uppercase hover:text-slate-800 dark:hover:text-slate-200', active && 'text-brand-700 dark:text-brand-300')}
        >
          {children}
          <Icon className={clsx('size-3.5', !active && 'opacity-40')} aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 dark:border-slate-800">
              {th('number', '#', 'pl-4')}
              {th('title', 'Chamado')}
              <th className="px-3 py-3 font-semibold whitespace-nowrap uppercase">Ramal</th>
              {th('status', 'Status')}
              {th('priority', 'Prioridade')}
              {th('category', showSector ? 'Equipe / categoria' : 'Categoria')}
              {th('assignee', 'Responsável')}
              {th('due', 'SLA')}
              {th('createdAt', 'Abertura')}
              {th('updatedAt', 'Atualização', 'pr-4')}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => router.push(`/chamados/${t.id}`)}
                className="cursor-pointer transition hover:bg-brand-50/60 dark:hover:bg-slate-800/50"
              >
                <td className="py-3 pr-3 pl-4 font-mono text-xs font-semibold text-slate-500">#{t.number}</td>
                <td className="max-w-xs px-3 py-3">
                  <a
                    href={`/chamados/${t.id}`}
                    onClick={(e) => (e.preventDefault(), e.stopPropagation(), router.push(`/chamados/${t.id}`))}
                    className="flex items-center gap-2 font-medium text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                  >
                    <ChannelIcon channel={t.channel} />
                    <span className="truncate">{t.title}</span>
                  </a>
                  <p className="mt-0.5 truncate pl-8 text-xs text-slate-500">
                    {t.requesterName ?? '—'}
                    {t.department ? ` · ${t.department.name}` : ''}
                  </p>
                </td>
                <td className="px-3 py-3 font-mono text-sm whitespace-nowrap text-slate-700 dark:text-slate-200">{ramalDo(t) ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-3">
                  <PriorityBadge priority={t.priority} />
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                  {showSector && <SectorBadge sector={t.sector} className="mb-1" />}
                  <span className="block">{t.category?.name ?? <span className="text-slate-400">—</span>}</span>
                </td>
                <td className="px-3 py-3">
                  {t.assignee ? (
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Avatar name={t.assignee.name} size={24} />
                      {t.assignee.name.split(' ')[0]}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <UserRound className="size-3.5" aria-hidden /> Sem responsável
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <SlaIndicator ticket={t} now={now} compact />
                </td>
                <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">{fmtDateTime(t.createdAt)}</td>
                <td className="py-3 pr-4 pl-3 text-xs whitespace-nowrap text-slate-500" title={fmtDateTime(t.updatedAt)}>
                  {fmtRelative(t.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row dark:border-slate-800">
        <span>
          {sorted.length ? `${page * PAGE + 1}–${Math.min(sorted.length, (page + 1) * PAGE)} de ${sorted.length}` : '0 chamados'}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="tabular-nums">
            Página {page + 1} de {pages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
