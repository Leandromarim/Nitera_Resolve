'use client';

import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Badge, clsx } from '@/components/ui';

/** Executa `fn` uma vez se a URL tiver `?novo=1` (atalhos da visão geral) e limpa o parâmetro. */
export function useOpenOnNew(fn: () => void, ready = true) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    if (new URLSearchParams(window.location.search).get('novo')) {
      fn();
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [ready, fn]);
}

/** ISO → valor de <input type="datetime-local"> no fuso local. */
export function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function StatusBadge({ active, labels = ['Ativo', 'Inativo'] }: { active: boolean; labels?: [string, string] }) {
  return (
    <Badge className={active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}>
      <span className={clsx('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} />
      {active ? labels[0] : labels[1]}
    </Badge>
  );
}

/** Alça de arrastar + botões mover para cima/baixo (acessível por teclado e no celular). */
export function MoveControls({ onUp, onDown, first, last, label, vertical = true }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean; label: string; vertical?: boolean }) {
  return (
    <div className={clsx('flex items-center', vertical ? 'flex-col' : 'gap-0.5')}>
      <button type="button" onClick={onUp} disabled={first} aria-label={`Mover "${label}" para cima`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200">
        <ArrowUp className="size-3.5" />
      </button>
      <button type="button" onClick={onDown} disabled={last} aria-label={`Mover "${label}" para baixo`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200">
        <ArrowDown className="size-3.5" />
      </button>
    </div>
  );
}

export function DragHandle() {
  return (
    <span className="cursor-grab text-slate-400 active:cursor-grabbing" aria-hidden title="Arraste para reordenar">
      <GripVertical className="size-5" />
    </span>
  );
}

export function IconButton({ label, onClick, children, tone = 'default', disabled }: { label: string; onClick: () => void; children: React.ReactNode; tone?: 'default' | 'danger'; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        'grid size-9 shrink-0 place-items-center rounded-lg transition disabled:opacity-40 [&_svg]:size-4',
        tone === 'danger' ? 'text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100',
      )}
    >
      {children}
    </button>
  );
}

/** Grupo de campos com título dentro de formulários longos. */
export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}
