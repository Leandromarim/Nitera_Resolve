/** Painel › Armazenamento e otimização: formato da resposta de GET /admin/armazenamento. */
export type Categoria = 'imagem' | 'pdf' | 'office' | 'video' | 'audio' | 'texto' | 'outro';
export type OptStatus = 'PENDENTE' | 'OTIMIZADO' | 'MANTIDO' | 'IGNORADO' | 'PROTEGIDO' | 'ERRO' | 'NAO_ANALISADO';

export interface ConfigArmazenamento {
  pdfSemPerdas: boolean;
  manterOriginalDias: number;
  cachePaginasDias: number;
}

export interface Resumo {
  geradoEm: string;
  disco: { total: number; livre: number } | null;
  uploads: { arquivos: number; bytes: number; pastas: Record<'variantes' | 'originais' | '.doc-cache' | '.tmp-videos', { arquivos: number; bytes: number }> };
  totais: { arquivos: number; recebido: number; guardado: number; economiaOtimizacao: number; economiaDuplicados: number; reducao: number };
  categorias: { categoria: Categoria; arquivos: number; bytes: number; recebido: number }[];
  status: Partial<Record<OptStatus, number>>;
  duplicados: { grupos: number; arquivos: number; bytesLiberaveis: number };
  pdfsGrandes: { id: string; originalName: string; size: number; originalSize: number | null; public: boolean; origin: string | null; optStatus: OptStatus | null; optNote: string | null; createdAt: string }[];
  erros: { id: string; originalName: string; mimeType: string; optNote: string | null; optAt: string | null }[];
  meses: { mes: string; arquivos: number; recebido: number; guardado: number }[];
  ultimaLimpeza: { temporarios: number; paginas: number; originais: number; bytes: number; em: string } | null;
  config: ConfigArmazenamento;
  ferramentas: { qpdf: boolean };
}

export interface LogItem {
  id: string;
  action: string;
  ok: boolean;
  bytesBefore: number | null;
  bytesAfter: number | null;
  detail: string | null;
  ms: number | null;
  createdAt: string;
  file: { id: string; originalName: string; mimeType: string; optStatus: OptStatus | null; origin: string | null; public: boolean };
}

export const CATEGORIAS: Record<Categoria, { nome: string; cor: string }> = {
  imagem: { nome: 'Imagens', cor: '#0e7490' },
  pdf: { nome: 'PDFs', cor: '#be123c' },
  office: { nome: 'Office', cor: '#3c4b78' },
  video: { nome: 'Vídeos', cor: '#7c3aed' },
  audio: { nome: 'Áudio', cor: '#b45309' },
  texto: { nome: 'Texto e CSV', cor: '#15803d' },
  outro: { nome: 'Outros', cor: '#94a3b8' },
};

export const STATUS: Record<OptStatus, { nome: string; descricao: string; cls: string }> = {
  OTIMIZADO: { nome: 'Otimizados', descricao: 'Ficaram menores sem perder qualidade', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  MANTIDO: { nome: 'Mantidos', descricao: 'Já estavam otimizados ou não havia ganho', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  PROTEGIDO: { nome: 'Protegidos', descricao: 'Assinados, oficiais ou privados: nunca alterados', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  IGNORADO: { nome: 'Sem otimização', descricao: 'Formato que já é compactado (Office, vídeo, áudio)', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  PENDENTE: { nome: 'Na fila', descricao: 'Aguardando o processamento em segundo plano', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  ERRO: { nome: 'Com erro', descricao: 'Falharam na conferência; o arquivo não foi alterado', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
  NAO_ANALISADO: { nome: 'Não analisados', descricao: 'Arquivos antigos ainda sem hash calculado', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

export const ACOES: Record<string, string> = {
  recebido: 'Recebido',
  duplicado: 'Duplicado unificado',
  miniaturas: 'Miniaturas geradas',
  pdf: 'PDF sem perdas',
  analise: 'Analisado',
  conferencia: 'Conferência no disco',
  processamento: 'Processamento',
  restaurado: 'Original restaurado',
};

export function fmtBytes(n: number) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1024) return `${n} B`;
  if (abs < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (abs < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
  return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB`;
}

export const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;
