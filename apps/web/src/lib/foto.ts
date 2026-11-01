/**
 * Pede ao servidor a foto já na largura em que ela aparece (320, 640, 1280 ou 1920 px).
 * Só vale para arquivos da própria intranet; links externos e imagens embutidas ficam como estão.
 */
export function foto(url: string | null | undefined, largura: 320 | 640 | 1280 | 1920): string | undefined {
  if (!url) return url ?? undefined;
  if (!url.startsWith('/api/files/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}w=${largura}`;
}
