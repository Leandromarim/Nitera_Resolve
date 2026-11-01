'use client';

import { Maximize2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clsx } from '@/components/ui';
import { ZoomImagem } from '@/components/ui/zoom';
import { KIND_META, ReleaseItem, ReleaseKind, groupItems } from './types';

export function KindBadge({ kind, className }: { kind: ReleaseKind; className?: string }) {
  const m = KIND_META[kind];
  const Icon = m.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', m.badge, className)}>
      <Icon className="size-3.5" aria-hidden />
      {m.label}
    </span>
  );
}

/** Imagem ampliada em tela cheia, com zoom e lupa. Esc ou clique fora fecha. */
export function ImageZoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Imagem ampliada: ${alt}`}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-slate-950/90 p-3 animate-fade-in sm:p-8"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Fechar imagem"
        className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        <X className="size-6" />
      </button>
      <ZoomImagem src={src} alt={alt} className="mt-12 flex-1" imgClassName="rounded-xl shadow-2xl" onClickFora={onClose} />
      <p className="mt-3 max-w-3xl text-center text-sm text-white/80">{alt}</p>
    </div>
  );
}

/** Miniatura clicável que abre a imagem ampliada. */
export function ZoomableImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ampliar imagem: ${alt}`}
        className={clsx(
          'group relative block w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:bg-slate-800 dark:ring-slate-700',
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" className="aspect-video w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]" />
        <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-lg bg-slate-950/70 px-2 py-1 text-xs font-medium text-white opacity-90 transition group-hover:opacity-100">
          <Maximize2 className="size-3.5" aria-hidden /> Ampliar
        </span>
      </button>
      {open && <ImageZoom src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ItemCard({ item }: { item: ReleaseItem }) {
  return (
    <li className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5 md:grid-cols-[minmax(0,18rem)_1fr] dark:bg-slate-900 dark:ring-slate-800">
      {item.image ? <ZoomableImage src={item.image} alt={item.title} className="self-start" /> : null}
      <div className={clsx('min-w-0', !item.image && 'md:col-span-2')}>
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={item.kind} />
        </div>
        <h4 className="mt-2 text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-50">{item.title}</h4>
        <div className="prose-ha mt-1 text-sm text-slate-600 [&_p]:my-2 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: item.description }} />
        {item.reason && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm whitespace-pre-line text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <span className="font-semibold">Por que mudou: </span>
            {item.reason}
          </p>
        )}
      </div>
    </li>
  );
}

/** Itens de uma versão agrupados por tipo, cada grupo com cor e ícone próprios. */
export function ReleaseBody({ items, headingLevel = 3 }: { items: ReleaseItem[]; headingLevel?: 2 | 3 }) {
  const groups = groupItems(items);
  if (!groups.length) return <p className="text-sm text-slate-500">Nenhum item descrito nesta versão.</p>;
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const m = KIND_META[g.kind];
        const Icon = m.icon;
        return (
          <section key={g.kind} aria-label={m.plural}>
            <H className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-slate-700 uppercase dark:text-slate-200">
              <span className={clsx('grid size-7 place-items-center rounded-lg', m.dot)}>
                <Icon className="size-4" aria-hidden />
              </span>
              {m.plural}
              <span className="font-normal text-slate-400 normal-case">({g.items.length})</span>
            </H>
            <ul className="space-y-3">
              {g.items.map((i) => (
                <ItemCard key={i.id} item={i} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Contagem de itens por tipo, em chips (ex.: Novidades: 3). */
export function KindSummary({ items }: { items: ReleaseItem[] }) {
  const groups = groupItems(items);
  return (
    <div className="flex flex-wrap gap-1.5">
      {groups.map((g) => {
        const m = KIND_META[g.kind];
        const Icon = m.icon;
        return (
          <span key={g.kind} className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', m.badge)}>
            <Icon className="size-3" aria-hidden />
            {m.plural}: <b>{g.items.length}</b>
          </span>
        );
      })}
    </div>
  );
}
