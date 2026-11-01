'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Busca dados da API com estados de carregamento/erro e função para recarregar. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const r = await api<T>(path);
      if (id === seq.current) {
        setData(r);
        setError(null);
      }
    } catch (e: any) {
      if (id === seq.current) setError(e.message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
