'use client';

import { useEffect } from 'react';
import { emManutencao } from '@/lib/manutencao';

const INTERVALO_MS = 5_000;

/**
 * Páginas já abertas mudam para a tela "Intranet em manutenção" assim que a atualização começa.
 * Pergunta ao Caddy (/manutencao-status: 204 normalmente, 503 com o cabeçalho X-Resolve-Manutencao durante a
 * manutenção) a cada 5 s com a aba visível e na hora em que a pessoa volta para a aba. Ao ver a manutenção,
 * recarrega: o Caddy entrega a tela, que volta sozinha para a mesma página quando a intranet estiver pronta.
 */
export function ManutencaoWatcher() {
  useEffect(() => {
    let parado = false;
    const verificar = () => {
      if (parado || document.visibilityState !== 'visible') return;
      fetch('/manutencao-status', { cache: 'no-store', credentials: 'omit' })
        .then(emManutencao)
        .catch(() => undefined);
    };
    const t = setInterval(verificar, INTERVALO_MS);
    document.addEventListener('visibilitychange', verificar);
    window.addEventListener('focus', verificar);
    window.addEventListener('online', verificar);
    return () => {
      parado = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', verificar);
      window.removeEventListener('focus', verificar);
      window.removeEventListener('online', verificar);
    };
  }, []);
  return null;
}
