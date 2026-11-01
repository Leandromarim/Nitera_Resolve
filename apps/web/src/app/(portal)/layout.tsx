import { AdminShell } from '@/components/admin/shell';
import { RequireAuth } from '@/components/require-auth';

/** Telas de quem abre e acompanha chamados: o mesmo menu lateral do painel, sempre com login. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
