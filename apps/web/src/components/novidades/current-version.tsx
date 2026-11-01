'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * "Versão 4.2.0" com link para as novidades. Não mostra nada se não houver versão publicada.
 * A consulta é pública e vai sem login (aparece também na tela de entrar).
 */
export function CurrentVersionLink({
  className,
  href = '/novidades',
  sistema = 'resolve',
  children,
}: {
  className?: string;
  href?: string;
  /** mantido por compatibilidade: há um sistema só */
  sistema?: 'resolve';
  children?: (version: string) => React.ReactNode;
}) {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/novidades/atual', { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => alive && setVersion(r && typeof r === 'object' ? r.version : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sistema]);
  if (!version) return null;
  return (
    <Link href={href} className={className} title="Ver o que mudou em cada versão">
      {children ? children(version) : `Versão ${version}`}
    </Link>
  );
}
