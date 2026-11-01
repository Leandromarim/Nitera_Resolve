'use client';

import { Cpu } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DESENVOLVIDO_POR, IGNORAR, OUTRAS, TECNOLOGIAS, type Tech } from './tecnologias';

interface Servidor {
  dependencies: Record<string, string>;
  node: string;
  postgres: string | null;
}

/** Versões das bibliotecas do portal, gravadas no build (next.config.ts). */
function bibliotecasDoPortal(): Record<string, string> {
  try {
    return JSON.parse(process.env.NEXT_PUBLIC_BIBLIOTECAS ?? '{}');
  } catch {
    return {};
  }
}

/** Versões do servidor: só para quem entrou. Sem sessão, a seção mostra só as do site. */
function useServidor() {
  const [servidor, setServidor] = useState<Servidor | undefined>();
  useEffect(() => {
    let vivo = true;
    api<Servidor>('/novidades/tecnologias').then((s) => vivo && setServidor(s)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return servidor;
}

/** "15.5.4" → "15.5"; versões de banco como "16.4" ficam como estão. */
const curta = (v?: string | null) => (v ? v.split('.').slice(0, 2).join('.') : null);

/** Seção "Tecnologias da Intranet" (âncora #tecnologias), com as versões lidas do próprio sistema. */
export function TechSection({ headingLevel = 2, sistema = 'NITERA Resolve' }: { headingLevel?: 2 | 3; sistema?: string }) {
  const servidor = useServidor();
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const Sub = headingLevel === 2 ? 'h3' : 'h4';

  const { versaoDe, outras } = useMemo(() => {
    const portal = bibliotecasDoPortal();
    const api = servidor?.dependencies ?? {};
    const todas: Record<string, { versao: string; onde: string }> = {};
    for (const [n, v] of Object.entries(api)) todas[n] = { versao: v, onde: 'servidor' };
    for (const [n, v] of Object.entries(portal)) todas[n] = { versao: v, onde: todas[n] ? 'portal e servidor' : 'portal' };
    const usados = new Set(TECNOLOGIAS.flatMap((g) => g.items.flatMap((t) => [t.pkg, ...(t.also ?? [])])).filter(Boolean) as string[]);
    const versaoDe = (t: Tech) => (t.runtime === 'node' ? curta(servidor?.node) : t.runtime === 'postgres' ? curta(servidor?.postgres) : t.pkg ? curta(todas[t.pkg]?.versao) : null);
    const outras = Object.entries(todas)
      .filter(([n]) => !usados.has(n) && !IGNORAR.has(n) && !n.startsWith('@types/'))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([n, x]) => ({ name: n, versao: curta(x.versao), onde: x.onde }));
    return { versaoDe, outras };
  }, [servidor]);

  const intranet = sistema === 'Intranet';
  // no NITERA Qualis: sem os recursos só da intranet e com o nome do sistema nos textos
  const texto = (t: string) => (intranet ? t : t.replace(/\b(d|n)?a intranet\b/gi, (_m, p: string | undefined) => `${p ? p.toLowerCase() : ''}o ${sistema}`));
  const grupos = TECNOLOGIAS.map((g) => ({ ...g, items: g.items.filter((t) => intranet || !t.soIntranet) })).filter((g) => g.items.length);

  return (
    <section id="tecnologias" aria-labelledby="tecnologias-titulo" className="scroll-mt-28">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral-500 text-white shadow-sm">
          <Cpu className="size-5" aria-hidden />
        </div>
        <div>
          <H id="tecnologias-titulo" className="text-2xl font-bold tracking-tight">
            Tecnologias {sistema === 'Intranet' ? 'da Intranet' : `do ${sistema}`}
          </H>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">O que foi usado para construir {sistema === 'Intranet' ? 'a intranet' : `o ${sistema}`}, para que serve e por que é importante. As versões são lidas do próprio sistema a cada atualização.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map((g) => {
          const Icon = g.icon;
          return (
            <section key={g.id} aria-labelledby={`tec-${g.id}`} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <Sub id={`tec-${g.id}`} className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                  <Icon className="size-4" aria-hidden />
                </span>
                {g.title}
              </Sub>
              <dl className="space-y-3">
                {g.items.map((t) => {
                  const v = versaoDe(t);
                  return (
                    <div key={t.name}>
                      <dt className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {t.name}
                        {v && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{v}</span>}
                      </dt>
                      <dd className="text-sm text-slate-600 dark:text-slate-400">{texto(t.description)}</dd>
                      <dd className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Importância: </span>
                        {texto(t.importance)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          );
        })}
        {outras.length > 0 && (
          <section aria-labelledby="tec-outras" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 md:col-span-2 dark:bg-slate-900 dark:ring-slate-800">
            <Sub id="tec-outras" className="mb-1 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
              <span className="grid size-8 place-items-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                <OUTRAS.icon className="size-4" aria-hidden />
              </span>
              {OUTRAS.title}
            </Sub>
            <p className="mb-3 text-sm text-slate-500">Bibliotecas de apoio que entraram nas atualizações e ainda não têm descrição.</p>
            <ul className="flex flex-wrap gap-2">
              {outras.map((o) => (
                <li key={o.name} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <b>{o.name}</b> {o.versao} <span className="text-slate-500">({o.onde})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-center text-sm text-slate-600 ring-1 ring-slate-200 sm:flex-row sm:text-left dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={DESENVOLVIDO_POR.logo} alt={DESENVOLVIDO_POR.empresa} className="h-9 w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={DESENVOLVIDO_POR.logoClaro} alt={DESENVOLVIDO_POR.empresa} className="hidden h-7 w-auto dark:block" />
        <span>{intranet ? 'Intranet desenvolvida' : `${sistema} desenvolvido`} pela {DESENVOLVIDO_POR.empresa}.</span>
      </p>
    </section>
  );
}
