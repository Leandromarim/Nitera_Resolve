'use client';

import { Cpu, Search } from 'lucide-react';
import { IconePonto } from '@/lib/icones';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Button, Card, EmptyState, Input, Loading, PageHeader } from '@/components/ui';
import { TechSection } from '@/components/novidades/tech-section';
import { Release } from '@/components/novidades/types';
import { VersoesTimeline } from '@/components/novidades/versoes-timeline';
import { combina } from '@/lib/busca';
import { useApi } from '@/lib/use-api';
import { useTextos } from '@/lib/textos-context';

const semHtml = (s: string) => s.replace(/<[^>]+>/g, ' ');

function Novidades() {
  const { t: texto } = useTextos();
  const { data, loading, error, reload } = useApi<Release[]>('/novidades');
  const params = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  // versão que combina aparece inteira; senão, só os itens que combinam
  const versoes = useMemo(() => {
    const t = q.trim();
    if (!t) return data ?? [];
    return (data ?? [])
      .map((r) => (combina([r.version, r.title, r.summary], t) ? r : { ...r, items: r.items.filter((i) => combina([i.title, semHtml(i.description), i.reason], t)) }))
      .filter((r) => r.items.length || combina([r.version, r.title, r.summary], t));
  }, [data, q]);

  return (
    <div className="mx-auto max-w-[var(--largura-pagina)] w-full px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        icon={<IconePonto ponto="pagina.novidades" className="size-5" />}
        title={texto('novidades.titulo')}
        description={texto('novidades.descricao') || undefined}
        actions={
          <a href="#tecnologias" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700">
            <Cpu className="size-4" aria-hidden /> Tecnologias do sistema
          </a>
        }
      />

      {loading && !data ? (
        <Loading label="Carregando as versões…" />
      ) : error ? (
        <Card>
          <EmptyState title="Não foi possível carregar as versões" description={error} action={<Button onClick={reload}>Tentar novamente</Button>} />
        </Card>
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<IconePonto ponto="vazio.novidades" className="size-7" />} title={texto('novidades.vazio-titulo')} description={texto('novidades.vazio-texto') || undefined} />
        </Card>
      ) : (
        <>
          <div className="relative mb-6" role="search">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar novidade, ex.: chamados" aria-label="Buscar nas versões" className="pl-10" />
          </div>
          {!versoes.length ? (
            <Card>
              <EmptyState icon={<Search className="size-7" />} title={`Nada encontrado para “${q.trim()}”.`} description="Tente outro termo." />
            </Card>
          ) : (
            <VersoesTimeline data={versoes} base="/novidades" />
          )}
        </>
      )}

      <div className="mt-14 border-t border-slate-200 pt-10 dark:border-slate-800">
        <TechSection />
      </div>
    </div>
  );
}

export default function NovidadesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Novidades />
    </Suspense>
  );
}
