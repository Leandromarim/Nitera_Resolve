'use client';

import clsx from 'clsx';
import { GitBranch, History } from 'lucide-react';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { ENTITY_LABEL, RevisionList } from '@/components/versions/history';
import { Card, PageHeader } from '@/components/ui';

function VersionsPage() {
  const [entity, setEntity] = useState('');
  return (
    <div>
      <PageHeader icon={<GitBranch className="size-5" />} title="Controle de versão" description="Tudo o que é alterado pelo painel fica registrado: quem mudou, quando e o quê. Qualquer versão pode ser restaurada." />
      <div>
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <History className="size-5 text-brand-600" /> Histórico de alterações
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {['', ...Object.keys(ENTITY_LABEL)].map((k) => (
                <button key={k || 'all'} onClick={() => setEntity(k)} className={clsx('rounded-full px-3 py-1 text-xs ring-1 transition', entity === k ? 'bg-brand-700 text-white ring-brand-700' : 'ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800')}>
                  {k ? ENTITY_LABEL[k] : 'Tudo'}
                </button>
              ))}
            </div>
          </div>
          <RevisionList key={entity} entity={entity || undefined} />
        </Card>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth roles={['TI', 'MANUTENCAO', 'INFRAESTRUTURA', 'COMUNICACAO']}>
      <VersionsPage />
    </RequireAuth>
  );
}
