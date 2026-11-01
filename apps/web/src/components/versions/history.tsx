'use client';

import clsx from 'clsx';
import { History, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { Badge, Button, EmptyState, Loading, Modal, useConfirm, useToast } from '../ui';

export interface Revision {
  id: string;
  entity: string;
  entityId: string;
  version: number;
  action: string;
  label: string;
  userName?: string | null;
  createdAt: string;
}

export const ENTITY_LABEL: Record<string, string> = {
  Setting: 'Configurações',
  TicketCategory: 'Categoria de chamado',
};
export const ACTION_STYLE: Record<string, string> = {
  criar: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  editar: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  excluir: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  restaurar: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  reordenar: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
};

const HIDDEN = new Set(['id', 'descendants', 'imageId', 'fileId', 'parentId']);
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Diferença campo a campo entre duas versões. */
export function Diff({ before, after }: { before: any; after: any }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => !HIDDEN.has(k));
  const changed = keys.filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (!before) return <p className="text-sm text-slate-500">Primeira versão deste item.</p>;
  if (!changed.length) return <p className="text-sm text-slate-500">Nenhum campo mudou nesta versão (só a posição ou itens relacionados).</p>;
  return (
    <div className="space-y-2 text-sm">
      {changed.map((k) => (
        <div key={k} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="mb-1 font-mono text-xs text-slate-500">{k}</p>
          {k === 'content' ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">Conteúdo da página alterado ({show(before?.[k]).length} → {show(after?.[k]).length} caracteres)</p>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              <p className="break-words rounded-lg bg-rose-50 px-2 py-1 text-rose-800 line-through decoration-rose-400 dark:bg-rose-950/40 dark:text-rose-200">{show(before?.[k])}</p>
              <p className="break-words rounded-lg bg-emerald-50 px-2 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{show(after?.[k])}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Lista de versões de um item (ou de tudo), com comparação e restauração. */
export function RevisionList({ entity, entityId, onRestored, compact }: { entity?: string; entityId?: string; onRestored?: () => void; compact?: boolean }) {
  const qs = new URLSearchParams({ take: '200', ...(entity ? { entity } : {}), ...(entityId ? { entityId } : {}) }).toString();
  const { data, loading, reload } = useApi<Revision[]>(`/admin/versions/revisions?${qs}`);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useApi<any>(open ? `/admin/versions/revisions/${open}` : null);
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const [restoring, setRestoring] = useState(false);

  const restore = async (r: Revision) => {
    if (!(await confirm(`Voltar "${r.label}" para a versão ${r.version} (${fmtDateTime(r.createdAt)})? O estado atual continua guardado no histórico.`))) return;
    setRestoring(true);
    try {
      await api(`/admin/versions/revisions/${r.id}/restore`, { method: 'POST' });
      toast('Versão restaurada');
      setOpen(null);
      reload();
      onRestored?.();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setRestoring(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (!data?.length) return <EmptyState icon={<History className="size-7" />} title="Sem alterações registradas" description="Cada mudança feita pelo painel aparece aqui." />;
  return (
    <>
      <ol className="relative space-y-1 border-l-2 border-slate-200 pl-4 dark:border-slate-800">
        {data.map((r) => (
          <li key={r.id} className="relative">
            <span className="absolute top-4 -left-[23px] size-3 rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-900" />
            <button
              onClick={() => setOpen(open === r.id ? null : r.id)}
              className={clsx('flex w-full flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/60', open === r.id && 'bg-slate-50 dark:bg-slate-800/60')}
            >
              <Badge className={ACTION_STYLE[r.action] ?? ''}>{r.action}</Badge>
              {!compact && <span className="text-xs text-slate-500">{ENTITY_LABEL[r.entity] ?? r.entity}</span>}
              <span className="font-medium">{r.label}</span>
              <span className="text-xs text-slate-500">v{r.version}</span>
              <span className="ml-auto text-xs text-slate-500">
                {r.userName ?? 'Sistema'} · {fmtDateTime(r.createdAt)}
              </span>
            </button>
            {open === r.id && (
              <div className="mt-1 mb-3 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                {detail.loading || !detail.data ? <Loading /> : <Diff before={detail.data.previous} after={detail.data.snapshot} />}
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" loading={restoring} onClick={() => restore(r)}>
                    <RotateCcw className="size-4" /> {r.action === 'excluir' ? 'Recuperar item excluído' : 'Restaurar esta versão'}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {dialog}
    </>
  );
}

/** Botão "Histórico" para colocar ao lado de qualquer item editável do painel. */
export function HistoryButton({ entity, entityId, label, onRestored, size = 'sm' }: { entity: string; entityId?: string; label?: string; onRestored?: () => void; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size={size} onClick={() => setOpen(true)} title="Histórico de versões">
        <History className="size-4" /> {size === 'md' && 'Histórico'}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={`Histórico de versões${label ? ` · ${label}` : ''}`}>
        {open && (
          <RevisionList
            compact
            entity={entity}
            entityId={entityId}
            onRestored={() => {
              setOpen(false);
              onRestored?.();
            }}
          />
        )}
      </Modal>
    </>
  );
}
