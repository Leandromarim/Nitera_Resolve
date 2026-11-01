'use client';

import { AlertTriangle, ArrowRight, Info, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { clsx, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { NOTIFICATIONS_CHANGED, NotificationItem, NotificationPage, isExternal, markRead } from './types';

/** Faixa da página inicial com avisos URGENTES e IMPORTANTES ainda não lidos. Só para quem está logado. */
export function NoticeStrip({ className }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return <StripInner key={user.id} className={className} />;
}

function StripInner({ className }: { className?: string }) {
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api<NotificationPage>('/notificacoes?status=nao-lidas&nivel=URGENTE,IMPORTANTE&limite=5');
      // urgentes primeiro
      setItems([...r.items].sort((a, b) => (a.level === b.level ? 0 : a.level === 'URGENTE' ? -1 : 1)));
    } catch {
      /* a faixa é opcional: sem dados, não aparece */
    }
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
    };
  }, [load]);

  const dismiss = async (n: NotificationItem) => {
    setItems((l) => l.filter((x) => x.id !== n.id));
    try {
      await markRead(n.id);
    } catch (e: any) {
      toast(e.message, 'error');
      load();
    }
  };

  if (!items.length) return null;

  return (
    <section aria-label="Avisos importantes" className={clsx('space-y-2', className)}>
      {items.map((n) => {
        const urgent = n.level === 'URGENTE';
        const Icon = urgent ? AlertTriangle : Info;
        const linkCls = clsx('inline-flex items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline', urgent ? 'text-white' : 'text-amber-900 dark:text-amber-100');
        return (
          <div
            key={n.id}
            role={urgent ? 'alert' : 'status'}
            className={clsx(
              'flex items-start gap-3 rounded-2xl px-4 py-3 shadow-sm ring-1',
              urgent ? 'bg-red-600 text-white ring-red-700' : 'bg-amber-50 text-amber-950 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-50 dark:ring-amber-800',
            )}
          >
            <Icon className={clsx('mt-0.5 size-5 shrink-0', urgent ? 'text-white' : 'text-amber-600 dark:text-amber-300')} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                <span className="sr-only">{urgent ? 'Urgente: ' : 'Importante: '}</span>
                {n.title}
              </p>
              {n.body && <p className={clsx('mt-0.5 text-sm', urgent ? 'text-white/90' : 'text-amber-900/90 dark:text-amber-100/90')}>{n.body}</p>}
              {n.link &&
                (isExternal(n.link) ? (
                  <a href={n.link} target="_blank" rel="noopener noreferrer" onClick={() => markRead(n.id).catch(() => undefined)} className={clsx('mt-1', linkCls)}>
                    Saiba mais <ArrowRight className="size-3.5" />
                  </a>
                ) : (
                  <Link href={n.link} onClick={() => markRead(n.id).catch(() => undefined)} className={clsx('mt-1', linkCls)}>
                    Saiba mais <ArrowRight className="size-3.5" />
                  </Link>
                ))}
            </div>
            <button
              type="button"
              onClick={() => dismiss(n)}
              aria-label={`Dispensar aviso "${n.title}"`}
              title="Dispensar (marcar como lido)"
              className={clsx(
                'grid size-8 shrink-0 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none',
                urgent ? 'text-white/85 hover:bg-white/15 hover:text-white focus-visible:ring-white' : 'text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-500 dark:text-amber-200 dark:hover:bg-amber-900/50',
              )}
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </section>
  );
}
