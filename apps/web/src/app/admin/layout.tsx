import type { Metadata } from 'next';
import { RequireAuth } from '@/components/require-auth';
import { AdminShell } from '@/components/admin/shell';

export const metadata: Metadata = { title: 'Painel' };

/** Cada tela confere o próprio perfil, e a API confere de novo em cada pedido. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
