'use client';

import { ArrowRight, Cpu } from 'lucide-react';
import Link from 'next/link';
import { clsx } from '@/components/ui';
import { KindSummary, ReleaseBody } from './release-view';
import { KIND_META, KINDS, Release, fmtReleaseDate } from './types';

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Tipos de atualização">
      {KINDS.map((k) => {
        const m = KIND_META[k];
        const Icon = m.icon;
        return (
          <li key={k} className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', m.badge)}>
            <Icon className="size-3.5" aria-hidden /> {m.label}
          </li>
        );
      })}
    </ul>
  );
}

/** Linha do tempo das versões (intranet e NITERA Qualis). `base` = onde fica a página de cada versão. */
export function VersoesTimeline({ data, base }: { data: Release[]; base: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <nav aria-label="Versões" className="sticky top-28 space-y-1">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Versões</p>
          {data.map((r, i) => (
            <a
              key={r.id}
              href={`#v${r.version}`}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:hover:bg-slate-800"
            >
              <span className="font-semibold">{r.version}</span>
              {i === 0 ? (
                <span className="rounded-full bg-coral-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Atual</span>
              ) : (
                <span className="text-xs text-slate-500">{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString('pt-BR') : ''}</span>
              )}
            </a>
          ))}
          <a
            href="#tecnologias"
            className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-brand-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-brand-300 dark:hover:bg-slate-800"
          >
            <Cpu className="size-4" aria-hidden /> Tecnologias
          </a>
          <div className="pt-4">
            <Legend />
          </div>
        </nav>
      </aside>

      <ol className="relative space-y-10 border-l-2 border-slate-200 pl-6 sm:pl-8 dark:border-slate-800">
        {data.map((r, i) => (
          <li key={r.id} id={`v${r.version}`} className="relative scroll-mt-28">
            <span
              aria-hidden
              className={clsx(
                'absolute top-1 -left-[calc(1.5rem+11px)] grid size-5 place-items-center rounded-full ring-4 ring-[var(--ha-page)] sm:-left-[calc(2rem+11px)] dark:ring-slate-950',
                i === 0 ? 'bg-coral-500' : 'bg-brand-600',
              )}
            />
            <header className="mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`${base}/${r.version}`}
                  className="rounded-lg text-2xl font-black tracking-tight text-brand-800 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-brand-200"
                >
                  Versão {r.version}
                </Link>
                {i === 0 && <span className="rounded-full bg-coral-500 px-2.5 py-0.5 text-xs font-bold text-white">Versão atual</span>}
              </div>
              <p className="mt-0.5 text-sm text-slate-500 first-letter:uppercase">
                <time dateTime={r.publishedAt ?? undefined}>{fmtReleaseDate(r.publishedAt)}</time>
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">{r.title}</h2>
              {r.summary && <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-300">{r.summary}</p>}
              <div className="mt-3">
                <KindSummary items={r.items} />
              </div>
            </header>
            <ReleaseBody items={r.items} />
            <Link href={`${base}/${r.version}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              Página da versão {r.version} <ArrowRight className="size-4" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
