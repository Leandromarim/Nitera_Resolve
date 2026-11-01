'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Lê só os contatos do suporte (vêm da identidade visual pública). */
export function usePortalSettingsLite() {
  const [s, setS] = useState<{ ticketsWhatsappNumber?: string; ticketsWhatsappQr?: boolean; ticketsEmail?: string } | null>(null);
  useEffect(() => {
    api('/branding').then((d: any) => setS(d)).catch(() => undefined);
  }, []);
  return s;
}
