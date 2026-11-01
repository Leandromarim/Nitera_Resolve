'use client';

import { EsqueciSenha } from '@/components/recuperar-senha';
import { api } from '@/lib/api';

const status = () => api<{ disponivel: boolean }>('/auth/recuperar-senha');
const pedir = (login: string) => api('/auth/recuperar-senha', { method: 'POST', json: { login } });

export default function EsqueciSenhaPage() {
  return <EsqueciSenha sistema="NITERA Resolve" login="/login" campo="Usuário ou e-mail" status={status} pedir={pedir} />;
}
