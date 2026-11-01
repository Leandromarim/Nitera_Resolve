'use client';

import { useEffect, useState } from 'react';

/** Painel › Configurações › Acesso: se o portal exige login e quais telas continuam abertas a quem não entrou. */
export interface Acesso {
  exigirLogin: boolean;
  abertas: string[];
}

// sem resposta da API, vale o mais seguro: exige login
const SEGURO: Acesso = { exigirLogin: true, abertas: [] };
let pedido: Promise<Acesso> | null = null;

function carregar(): Promise<Acesso> {
  if (!pedido)
    pedido = fetch('/api/acesso', { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : SEGURO))
      .then((v) => ({ exigirLogin: v?.exigirLogin !== false, abertas: Array.isArray(v?.abertas) ? v.abertas.filter((a: unknown) => typeof a === 'string') : [] }))
      .catch(() => SEGURO);
  return pedido;
}

export function useAcesso(): Acesso | null {
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  useEffect(() => {
    let vivo = true;
    carregar().then((a) => vivo && setAcesso(a));
    return () => {
      vivo = false;
    };
  }, []);
  return acesso;
}
