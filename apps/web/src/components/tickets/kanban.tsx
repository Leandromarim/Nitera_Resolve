'use client';

import { GripVertical, MapPin, PhoneCall, MoreHorizontal, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar, clsx } from '@/components/ui';
import { fmtRelative } from '@/lib/format';
import { CategoryIcon, ChannelIcon, isOverdue, PriorityBadge, SlaIndicator, STATUS_DOT, statusLabel } from './meta';
import { SectorBadge } from './sectors';
import { localSemRamal, ramalDo, type Ticket, type TicketStatus } from './types';

export const KANBAN_COLUMNS: TicketStatus[] = ['NOVO', 'EM_ATENDIMENTO', 'AGUARDANDO_USUARIO', 'RESOLVIDO'];
const PRIORITY_RANK = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 } as const;

const COLUMN_HINT: Record<string, string> = {
  NOVO: 'Aguardando triagem',
  EM_ATENDIMENTO: 'Sendo resolvidos',
  AGUARDANDO_USUARIO: 'Esperando retorno do solicitante',
  RESOLVIDO: 'Aguardando avaliação',
};

/**
 * Sem `onMove`, o quadro é só leitura (equipe acompanhada): não arrasta nem mostra o menu de mover.
 * `podeMover` deixa só leitura um cartão de cada vez (painel misto: os chamados da equipe acompanhada).
 */
export function Kanban({ tickets, now, onMove, podeMover, showSector }: { tickets: Ticket[]; now: number; onMove?: (t: Ticket, status: TicketStatus) => void; podeMover?: (t: Ticket) => boolean; showSector?: boolean }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TicketStatus | null>(null);

  const columns = KANBAN_COLUMNS.map((status) => {
    const items = tickets.filter((t) => t.status === status);
    items.sort((a, b) =>
      status === 'RESOLVIDO'
        ? +new Date(b.resolvedAt ?? b.updatedAt) - +new Date(a.resolvedAt ?? a.updatedAt)
        : Number(isOverdue(b, now)) - Number(isOverdue(a, now)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || +new Date(a.dueAt ?? a.createdAt) - +new Date(b.dueAt ?? b.createdAt),
    );
    return { status, items };
  });

  const drop = (status: TicketStatus) => {
    const t = tickets.find((x) => x.id === dragId && (!podeMover || podeMover(x)));
    setDragId(null);
    setOver(null);
    if (t && t.status !== status) onMove?.(t, status);
  };

  return (
    <div className="pb-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map(({ status, items }) => (
          <section
            key={status}
            aria-label={`${statusLabel(status)}: ${items.length} chamados`}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOver(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === status ? null : o));
            }}
            onDrop={(e) => (e.preventDefault(), drop(status))}
            className={clsx(
              'flex min-h-40 flex-col xl:min-h-[60vh] rounded-2xl bg-slate-200/50 p-2 ring-2 ring-transparent transition dark:bg-slate-900/60',
              over === status && 'bg-brand-50 ring-brand-400 dark:bg-brand-900/30',
            )}
          >
            <header className="flex items-center gap-2 px-2 pt-1.5 pb-3">
              <span className={clsx('size-2.5 rounded-full', STATUS_DOT[status])} aria-hidden />
              <h3 className="text-sm font-semibold">{statusLabel(status)}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{items.length}</span>
              <span className="ml-auto truncate text-[11px] text-slate-500">{COLUMN_HINT[status]}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2">
              {items.map((t) => (
                <KanbanCard key={t.id} t={t} now={now} showSector={showSector} dragging={dragId === t.id} onDragStart={() => setDragId(t.id)} onDragEnd={() => (setDragId(null), setOver(null))} onMove={!podeMover || podeMover(t) ? onMove : undefined} />
              ))}
              {!items.length && (
                <div className="grid flex-1 place-items-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-xs text-slate-400 dark:border-slate-700">
                  {dragId ? 'Solte aqui' : 'Nenhum chamado'}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ t, now, showSector, dragging, onDragStart, onDragEnd, onMove }: { t: Ticket; now: number; showSector?: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onMove?: (t: Ticket, s: TicketStatus) => void }) {
  const late = isOverdue(t, now);
  return (
    <article
      draggable={!!onMove}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={clsx(
        'group relative rounded-xl bg-white p-3 shadow-sm ring-1 transition hover:shadow-md dark:bg-slate-900',
        onMove && 'cursor-grab active:cursor-grabbing',
        late ? 'ring-rose-300 dark:ring-rose-800' : 'ring-slate-200 dark:ring-slate-800',
        t.priority === 'CRITICA' && 'border-l-4 border-l-red-600',
        dragging && 'rotate-1 opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5">
        {onMove && <GripVertical className="size-3.5 text-slate-300 dark:text-slate-600" aria-hidden />}
        <span className="font-mono text-xs font-semibold text-slate-500">#{t.number}</span>
        <ChannelIcon channel={t.channel} />
        <PriorityBadge priority={t.priority} className="ml-auto" />
        {onMove && <MoveMenu t={t} onMove={onMove} />}
      </div>
      <Link href={`/chamados/${t.id}`} className="mt-2 line-clamp-2 block text-sm font-semibold text-slate-900 after:absolute after:inset-0 hover:text-brand-700 dark:text-white dark:hover:text-brand-300" draggable={false}>
        {t.title}
      </Link>
      <p className="mt-1 truncate text-xs text-slate-500">
        {t.requesterName ?? 'Solicitante não identificado'}
        {t.department ? ` · ${t.department.name}` : ''}
      </p>
      {t.category && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500" title={`Categoria: ${t.category.name}`}>
          <CategoryIcon category={t.category} className="size-3 shrink-0" /> {t.category.name}
        </p>
      )}
      {(localSemRamal(t.location) || ramalDo(t)) && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
          {localSemRamal(t.location) && (
            <>
              <MapPin className="size-3 shrink-0" aria-hidden /> <span className="truncate">{localSemRamal(t.location)}</span>
            </>
          )}
          {ramalDo(t) && (
            <span className={clsx('flex shrink-0 items-center gap-1 font-medium text-slate-700 dark:text-slate-200', localSemRamal(t.location) && 'ml-1.5')} title="Ramal">
              <PhoneCall className="size-3" aria-hidden /> Ramal {ramalDo(t)}
            </span>
          )}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {showSector && <SectorBadge sector={t.sector} />}
        <SlaIndicator ticket={t} now={now} />
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400" title={t.assignee ? `Responsável: ${t.assignee.name}` : 'Sem responsável'}>
          {fmtRelative(t.updatedAt)}
          {t.assignee ? (
            <Avatar name={t.assignee.name} size={22} />
          ) : (
            <span className="grid size-[22px] place-items-center rounded-full border border-dashed border-slate-300 text-slate-400 dark:border-slate-600">
              <UserRound className="size-3" aria-hidden />
            </span>
          )}
        </span>
      </div>
    </article>
  );
}

/** Alternativa acessível ao arrastar: menu "Mover para". */
function MoveMenu({ t, onMove }: { t: Ticket; onMove: (t: Ticket, s: TicketStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative z-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Mover chamado #${t.number}`}
        className="rounded-md p-0.5 text-slate-400 opacity-60 hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200 animate-fade-in dark:bg-slate-800 dark:ring-slate-700">
          <p className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Mover para</p>
          {KANBAN_COLUMNS.filter((s) => s !== t.status).map((s) => (
            <button
              key={s}
              role="menuitem"
              onClick={() => (setOpen(false), onMove(t, s))}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <span className={clsx('size-2 rounded-full', STATUS_DOT[s])} aria-hidden /> {statusLabel(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
