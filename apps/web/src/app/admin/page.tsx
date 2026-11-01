import { redirect } from 'next/navigation';

/** O início do painel é a lista de chamados. */
export default function AdminHome() {
  redirect('/chamados');
}
