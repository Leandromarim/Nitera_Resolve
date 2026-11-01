/**
 * Textos das telas.
 * O registro com rótulos e textos padrão fica no front (apps/web/src/lib/textos.ts); aqui só guardamos
 * as substituições feitas pelo painel, em um único Setting `textos` (chave do texto → texto).
 */
export const TEXTOS_KEY = 'textos';
/** Chave: minúsculas, números, pontos e hifens (ex.: "login.titulo", "ramais.vazio-titulo"). */
export const TEXTO_CHAVE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export const MAX_TEXTO_CHAVE = 80;
export const MAX_TEXTO = 2000;
export const MAX_TEXTOS = 400;
export const MAX_TEXTOS_TOTAL = 100_000;

/** Remove caracteres de controle (mantém quebras de linha e tabulação) e padroniza as quebras. */
export const limparTexto = (v: string) => v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

/** Lê o valor salvo descartando o que não for válido (chaves desconhecidas, tipos errados, excesso). */
export function readTextos(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  let total = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_TEXTOS) break;
    if (typeof v !== 'string' || k.length > MAX_TEXTO_CHAVE || !TEXTO_CHAVE.test(k)) continue;
    const text = limparTexto(v).slice(0, MAX_TEXTO);
    total += text.length;
    if (total > MAX_TEXTOS_TOTAL) break;
    out[k] = text;
  }
  return out;
}
