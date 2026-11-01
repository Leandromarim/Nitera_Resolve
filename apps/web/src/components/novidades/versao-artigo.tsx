'use client';

import { KindSummary, ReleaseBody } from './release-view';
import { Release, fmtReleaseDate } from './types';

/** Página de uma versão (intranet e NITERA Qualis). */
export function VersaoArtigo({ data }: { data: Release }) {
  return (
    <article>
      <header className="mb-6 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-sm sm:p-8 dark:from-brand-800 dark:to-brand-950">
        <p className="text-sm font-medium text-white/80 first-letter:uppercase">
          <time dateTime={data.publishedAt ?? undefined}>{fmtReleaseDate(data.publishedAt)}</time>
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Versão {data.version}</h1>
        <p className="mt-2 text-lg font-semibold">{data.title}</p>
        {data.summary && <p className="mt-2 max-w-2xl text-white/85">{data.summary}</p>}
      </header>
      <div className="mb-6">
        <KindSummary items={data.items} />
      </div>
      <ReleaseBody items={data.items} headingLevel={2} />
    </article>  );
}
