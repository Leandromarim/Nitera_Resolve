import { redirect } from 'next/navigation';

/** A tela inicial do NITERA Resolve é a central de chamados. */
export default function Home() {
  redirect('/chamados');
}
