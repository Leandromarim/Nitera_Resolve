'use client';

import { RedefinirSenha } from '@/components/recuperar-senha';
import { api } from '@/lib/api';

/** Mesma regra da API (PASSWORD_RULE). */
const regras = (p: string) => [
  { ok: p.length >= 6, label: 'Pelo menos 6 caracteres' },
  { ok: /[A-Z]/.test(p), label: 'Uma letra maiúscula' },
  { ok: /[a-z]/.test(p), label: 'Uma letra minúscula' },
  { ok: /\d/.test(p), label: 'Um número' },
  { ok: /[^A-Za-z0-9]/.test(p), label: 'Um símbolo (!@#$…)' },
];
const validar = (token: string) => api<{ valido: boolean; nome?: string }>('/auth/recuperar-senha/validar', { method: 'POST', json: { token } });
const salvar = (token: string, senha: string) => api('/auth/recuperar-senha/nova', { method: 'POST', json: { token, senha } });

export default function RedefinirSenhaPage() {
  return <RedefinirSenha sistema="NITERA Resolve" login="/login" esqueci="/esqueci-senha" regras={regras} validar={validar} salvar={salvar} />;
}
