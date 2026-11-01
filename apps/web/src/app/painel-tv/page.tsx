'use client';

import { Suspense } from 'react';
import { TvBoard } from '@/components/tickets/tv-board';

export default function PainelTvPage() {
  return (
    <Suspense fallback={null}>
      <TvBoard />
    </Suspense>
  );
}
