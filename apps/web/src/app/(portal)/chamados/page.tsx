'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import { Desk } from '@/components/tickets/desk';
import { MyTickets } from '@/components/tickets/my-tickets';
import { useStaffSectors } from '@/components/tickets/sectors';

function Chamados() {
  const params = useSearchParams();
  // quem atende alguma fila (TI, Manutenção ou Comunicação) vê a central de atendimento
  const staff = useStaffSectors().length > 0;
  if (staff && params.get('meus') !== '1') return <Desk />;
  return <MyTickets staff={staff} />;
}

export default function ChamadosPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Chamados />
    </Suspense>
  );
}
