'use client';

import { use } from 'react';
import { TicketDetailView } from '@/components/tickets/detail';

export default function ChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TicketDetailView key={id} id={id} />;
}
