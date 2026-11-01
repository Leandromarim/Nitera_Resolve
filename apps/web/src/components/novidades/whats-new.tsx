'use client';

import { ChevronLeft, ChevronRight, Rocket, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, clsx } from '@/components/ui';
import { KindBadge, ZoomableImage } from './release-view';
import { KINDS, Release } from './types';

/** Telas em que a janela nunca aparece: TV, login e o painel administrativo. */
const HIDDEN = [/^\/painel-tv/, /^\/login/, /^\/chamados\/login/, /^\/admin/, /^\/avaliar/];

/**
 * Janela "O que há de novo na versão X": aparece uma vez para cada pessoa logada
 * quando há uma versão publicada com aviso que ela ainda não viu.
 */
export function WhatsNew() {
  const { user, ready } = useAuth();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const allowed = !HIDDEN.some((r) => r.test(pathname));
  const [release, setRelease] = useState<Release | null>(null);
  const [step, setStep] = useState(0);
  const checked = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready || !user || user.mustChangePassword || !allowed || checked.current === user.id) return;
    checked.current = user.id;
    let alive = true;
    api<Release | null>('/novidades/pendente')
      .then((r) => {
        if (!alive || !r) return;
        // mesma ordem da página de novidades: agrupado por tipo
        const items = [...r.items].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.order - b.order);
        setRelease({ ...r, items });
        setStep(0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ready, user, allowed]);

  // sessão encerrada: esconde e permite checar de novo no próximo login
  useEffect(() => {
    if (ready && !user) {
      setRelease(null);
      checked.current = null;
    }
  }, [ready, user]);

  const close = useCallback(
    (goTo?: string) => {
      if (!release) return;
      const id = release.id;
      setRelease(null);
      api(`/novidades/${id}/vista`, { method: 'POST' }).catch(() => undefined);
      if (goTo) router.push(goTo);
    },
    [release, router],
  );

  const open = !!release && allowed;
  const total = release?.items.length ?? 0;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, Math.max(total - 1, 0)));
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, close, total]);

  if (!open || !release) return null;
  const item = release.items[step];
  const last = step >= total - 1;
  const fullLink = `/novidades/${release.version}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        aria-describedby="whats-new-summary"
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none animate-slide-up sm:max-w-2xl sm:rounded-3xl dark:bg-slate-900"
      >
        <div className="relative bg-gradient-to-br from-brand-700 to-brand-900 px-6 pt-5 pb-5 text-white dark:from-brand-800 dark:to-brand-950">
          <button
            type="button"
            onClick={() => close()}
            aria-label="Fechar"
            className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <X className="size-5" />
          </button>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-coral-400 uppercase">
            <Rocket className="size-4" aria-hidden /> Sistema atualizado
          </p>
          <h2 id="whats-new-title" className="mt-1 pr-8 text-xl font-bold sm:text-2xl">
            O que há de novo na versão {release.version}
          </h2>
          <p id="whats-new-summary" className="mt-1 text-sm text-white/85">
            {release.summary || release.title}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {item ? (
            <div key={item.id} className="animate-fade-in" aria-live="polite">
              {item.image && <ZoomableImage src={item.image} alt={item.title} className="mb-4" />}
              <KindBadge kind={item.kind} />
              <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">{item.title}</h3>
              <div className="prose-ha mt-1 text-sm text-slate-600 [&_p]:my-2 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: item.description }} />
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-300">{release.title}</p>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-3 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0} aria-label="Novidade anterior">
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            {total <= 12 ? (
              <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Novidades">
                {release.items.map((it, i) => (
                  <button
                    key={it.id}
                    type="button"
                    role="tab"
                    aria-selected={i === step}
                    aria-label={`${i + 1} de ${total}: ${it.title}`}
                    onClick={() => setStep(i)}
                    className={clsx('h-2 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none', i === step ? 'w-6 bg-brand-600 dark:bg-brand-400' : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700')}
                  />
                ))}
              </div>
            ) : (
              <span className="text-sm text-slate-500" aria-live="polite">
                {step + 1} de {total}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.min(s + 1, total - 1))} disabled={last} aria-label="Próxima novidade">
              Próxima <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <Button variant="secondary" onClick={() => close(fullLink)}>
            Ver todas as novidades
          </Button>
          {last ? (
            <Button onClick={() => close()}>Entendi</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => close()}>
                Entendi
              </Button>
              <Button onClick={() => setStep((s) => s + 1)}>
                Próxima novidade <ChevronRight className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
