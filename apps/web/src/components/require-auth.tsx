'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Role } from '@/lib/api';
import { EmptyState, Loading, Button } from './ui';
import Link from 'next/link';

/** Protege uma área: exige login e, opcionalmente, um dos perfis informados. */
export function RequireAuth({ children, roles, loginPath = '/login' }: { children: React.ReactNode; roles?: Role[]; loginPath?: string }) {
  const { user, ready, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname, loginPath]);

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== '/perfil') router.replace(`/perfil?trocar=1&next=${encodeURIComponent(pathname)}`);
  }, [user, pathname, router]);

  if (!ready || !user) return <Loading label="Verificando acesso…" />;
  if (roles && !hasRole(...roles)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-7" />}
        title="Acesso restrito"
        description="Seu perfil não tem permissão para acessar esta área. Fale com a equipe de TI se precisar de acesso."
        action={
          <Link href="/">
            <Button variant="secondary">Voltar ao início</Button>
          </Link>
        }
      />
    );
  }
  return <>{children}</>;
}
