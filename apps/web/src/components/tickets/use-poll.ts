'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Busca `path` e repete a cada `interval` ms (só com a aba visível), sem piscar a tela:
 * `loading` só é verdadeiro na primeira carga ou quando o caminho muda.
 */
export function usePoll<T>(path: string | null, interval = 30_000) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const seq = useRef(0);
  const lastPath = useRef<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      const id = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const r = await api<T>(path);
        if (id === seq.current) {
          setData(r);
          setError(null);
          setUpdatedAt(Date.now());
        }
      } catch (e: any) {
        if (id === seq.current) setError(e.message);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    const changed = lastPath.current !== path;
    lastPath.current = path;
    load(!changed);
    if (!path) return;
    const t = setInterval(() => document.visibilityState === 'visible' && load(true), interval);
    const onVis = () => document.visibilityState === 'visible' && load(true);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, path, interval]);

  return { data, error, loading, updatedAt, reload: () => load(true), setData };
}
