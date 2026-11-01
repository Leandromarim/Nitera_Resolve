/**
 * Paleta dos gráficos (Recharts), ligada aos tokens --chart-* de globals.css:
 * acompanha a marca e troca sozinha entre o tema claro e o escuro.
 */
export const CORES_GRAFICO = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const;

/** Realce da área sob o ponteiro no Tooltip: `<Tooltip cursor={TOOLTIP_CURSOR} />`. */
export const TOOLTIP_CURSOR = { fill: 'var(--chart-cursor)' };

/** Classes do NPS nos gráficos (promotor = bom, neutro, detrator = ruim). */
export const COR_CLASSE_NPS: Record<string, string> = { PROMOTOR: 'var(--chart-bom)', NEUTRO: 'var(--chart-neutro)', DETRATOR: 'var(--chart-ruim)' };

/** Linha-guia sob o ponteiro no Tooltip de gráficos de linha: `<Tooltip cursor={TOOLTIP_CURSOR_LINHA} />`. */
export const TOOLTIP_CURSOR_LINHA = { stroke: 'var(--chart-ref)' };
