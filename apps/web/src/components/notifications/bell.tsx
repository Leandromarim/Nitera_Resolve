'use client';

import { Bell, BellOff, CheckCheck, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner, clsx, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtRelative } from '@/lib/format';
import { LEVEL, NOTIFICATIONS_CHANGED, NotificationItem, NotificationPage, isExternal, markAllRead, markRead } from './types';

const POLL_MS = 60_000;

/** Sino de avisos do cabeçalho. Só aparece para quem está logado. */
export function NotificationBell() {
  const { user } = useAuth();
  if (!user) return null;
  return <BellInner key={user.id} />;
}

function BellInner() {
  const router = useRouter();
  const toast = useToast();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const r = await api<{ count: number }>('/notificacoes/nao-lidas');
      setCount(r.count);
    } catch {
      /* mantém o último valor; tenta de novo no próximo ciclo */
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<NotificationPage>('/notificacoes?limite=8');
      setItems(r.items);
      setCount(r.unread);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // contagem: ao montar, a cada 60s com a aba visível, ao voltar para a aba e quando algo for lido
  useEffect(() => {
    refreshCount();
    const t = setInterval(() => document.visibilityState === 'visible' && refreshCount(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refreshCount();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    loadItems();
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, loadItems]);

  const openItem = async (n: NotificationItem) => {
    if (!n.read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      setCount((c) => Math.max(0, c - 1));
      markRead(n.id).catch(() => refreshCount());
    }
    if (n.link) {
      setOpen(false);
      if (isExternal(n.link)) window.open(n.link, '_blank', 'noopener,noreferrer');
      else router.push(n.link);
    }
  };

  const readAll = async () => {
    setMarking(true);
    try {
      await markAllRead();
      setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
      setCount(0);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setMarking(false);
    }
  };

  const total = count;
  const label = total ? `${count} ${count === 1 ? 'aviso não lido' : 'avisos não lidos'}` : 'Avisos';

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Bell className="size-5" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white dark:ring-slate-900" aria-hidden>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Avisos recentes"
          className="fixed inset-x-2 top-16 z-50 overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200 animate-fade-in sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="font-semibold">Avisos</p>
            <button
              type="button"
              onClick={readAll}
              disabled={marking || count === 0}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-900/40"
            >
              {marking ? <Spinner className="size-3.5" /> : <CheckCheck className="size-3.5" />} Marcar todas como lidas
            </button>
          </div>

          <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
            {loading && !items ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : error && !items ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                <p>{error}</p>
                <button type="button" onClick={loadItems} className="mt-2 font-medium text-brand-700 hover:underline dark:text-brand-300">
                  Tentar novamente
                </button>
              </div>
            ) : !items?.length ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-slate-500">
                <BellOff className="size-8 text-slate-300 dark:text-slate-600" aria-hidden />
                Nenhum aviso por enquanto.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={clsx(
                        'flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60',
                        !n.read && 'bg-brand-50/60 dark:bg-brand-900/20',
                      )}
                    >
                      <span className={clsx('mt-1.5 size-2.5 shrink-0 rounded-full', n.read ? 'bg-transparent ring-1 ring-slate-300 dark:ring-slate-600' : LEVEL[n.level].dot)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={clsx('line-clamp-2 text-sm', n.read ? 'text-slate-600 dark:text-slate-400' : 'font-semibold')}>{n.title}</span>
                          {n.level !== 'INFO' && <span className={clsx('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase', LEVEL[n.level].badge)}>{LEVEL[n.level].label}</span>}
                        </span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">{n.body}</span>}
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                          {fmtRelative(n.startsAt)}
                          {n.link && isExternal(n.link) && <ExternalLink className="size-3" aria-label="abre em nova aba" />}
                          {!n.read && <span className="sr-only">· não lido</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
