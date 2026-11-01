import { RequireAuth } from '@/components/require-auth';

export default function ChamadosLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
