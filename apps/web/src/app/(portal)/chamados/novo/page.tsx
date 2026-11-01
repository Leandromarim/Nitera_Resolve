'use client';

import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import { NewTicket } from '@/components/tickets/new-ticket';

export default function NovoChamadoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewTicket />
    </Suspense>
  );
}
