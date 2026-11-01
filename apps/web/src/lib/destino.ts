/**
 * Endereço para onde voltar depois do login (?next=). Só vale caminho da própria intranet: "/\site.com" e "//site.com"
 * o navegador leria como outro site, então a conferência é pela origem que o navegador calcula, não pelo texto.
 */
export function destinoSeguro(raw: string | null | undefined, padrao: string): string {
  if (!raw || !raw.startsWith('/') || /[\\\u0000-\u001f]/.test(raw) || typeof window === 'undefined') return padrao;
  try {
    const u = new URL(raw, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : padrao;
  } catch {
    return padrao;
  }
}
