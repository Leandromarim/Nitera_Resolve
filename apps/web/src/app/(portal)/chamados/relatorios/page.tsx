'use client';

import { Suspense } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { Loading } from '@/components/ui';
import dynamic from 'next/dynamic';
import { TICKET_STAFF_ROLES } from '@/components/tickets/sectors';

// relatório com gráficos sob demanda: o recharts baixa à parte, depois do resto da tela
const Reports = dynamic(() => import('@/components/tickets/reports').then((m) => m.Reports), { ssr: false, loading: () => <Loading /> });

export default function RelatoriosPage() {
  return (
    <RequireAuth roles={TICKET_STAFF_ROLES}>
      <Suspense fallback={<Loading />}>
        <Reports />
      </Suspense>
    </RequireAuth>
  );
}
