'use client';

import { ArrowLeft } from 'lucide-react';
import { IconePonto } from '@/lib/icones';
import Link from 'next/link';
import { use } from 'react';
import { Button, Card, EmptyState, Loading } from '@/components/ui';
import { Release } from '@/components/novidades/types';
import { VersaoArtigo } from '@/components/novidades/versao-artigo';
import { useApi } from '@/lib/use-api';

export default function VersaoPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = use(params);
  const { data, loading, error, reload } = useApi<Release>(`/novidades/${encodeURIComponent(version)}`);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/novidades" className="mb-4 inline-flex items-center gap-1 rounded-lg text-sm font-medium text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-brand-300">
        <ArrowLeft className="size-4" /> Todas as versões
      </Link>

      {loading && !data ? (
        <Loading label="Carregando a versão…" />
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconePonto ponto="vazio.versao" className="size-7" />}
            title={/não encontrada/i.test(error) ? `Versão ${version} não encontrada` : 'Não foi possível carregar a versão'}
            description={/não encontrada/i.test(error) ? 'Ela pode ainda não ter sido publicada.' : error}
            action={
              /não encontrada/i.test(error) ? (
                <Link href="/novidades">
                  <Button variant="secondary">Ver todas as versões</Button>
                </Link>
              ) : (
                <Button onClick={reload}>Tentar novamente</Button>
              )
            }
          />
        </Card>
      ) : data ? (
        <VersaoArtigo data={data} />
      ) : null}
    </div>
  );
}
