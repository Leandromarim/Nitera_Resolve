export const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDate = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function fmtRelative(d: string | Date) {
  const date = new Date(d);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `há ${Math.floor(diff / 86400)} d`;
  return fmtDate(date);
}

/** Rótulo de dia no estilo WhatsApp: Hoje, Ontem, dia da semana ou data. */
export function dayLabel(d: string | Date) {
  const date = new Date(d);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(today) - start(date)) / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return date.toLocaleDateString('pt-BR', { weekday: 'long' });
  return fmtDate(date);
}

export const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const TICKET_STATUS: Record<string, { label: string; color: string }> = {
  NOVO: { label: 'Novo', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200' },
  EM_ATENDIMENTO: { label: 'Em atendimento', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  AGUARDANDO_USUARIO: { label: 'Aguardando usuário', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  RESOLVIDO: { label: 'Resolvido', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  FECHADO: { label: 'Fechado', color: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  CANCELADO: { label: 'Cancelado', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
};
export const TICKET_PRIORITY: Record<string, { label: string; color: string }> = {
  BAIXA: { label: 'Baixa', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  MEDIA: { label: 'Média', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' },
  ALTA: { label: 'Alta', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' },
  CRITICA: { label: 'Crítica', color: 'bg-red-600 text-white' },
};
export const TICKET_CHANNEL: Record<string, string> = { PORTAL: 'Portal', WHATSAPP: 'WhatsApp', EMAIL: 'E-mail', TELEFONE: 'Telefone' };
/**
 * Ouvidoria: cores fixas e rótulos/emoji PADRÃO. Os rótulos que valem são os de Painel › Ouvidoria › Formulário;
 * use feedbackType()/feedbackStatus() de lib/ouvidoria.ts, que caem nestes valores se a configuração não carregar.
 */
export const FEEDBACK_TYPE: Record<string, { label: string; color: string; emoji: string }> = {
  ELOGIO: { label: 'Elogio', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', emoji: '💚' },
  SUGESTAO: { label: 'Sugestão', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200', emoji: '💡' },
  RECLAMACAO: { label: 'Reclamação', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200', emoji: '⚠️' },
  SOLICITACAO: { label: 'Solicitação', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200', emoji: '📝' },
  DENUNCIA: { label: 'Denúncia', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200', emoji: '🚨' },
};
export const FEEDBACK_STATUS: Record<string, { label: string; color: string }> = {
  NOVA: { label: 'Nova', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  EM_ANALISE: { label: 'Em análise', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  RESPONDIDA: { label: 'Respondida', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  ENCERRADA: { label: 'Encerrada', color: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  TI: 'Equipe de TI',
  COMUNICACAO: 'Comunicação',
  COLABORADOR: 'Colaborador',
  MANUTENCAO: 'Manutenção',
  INFRAESTRUTURA: 'Infraestrutura de TI',
  GESTOR_AREA: 'Gestor da área',
};
