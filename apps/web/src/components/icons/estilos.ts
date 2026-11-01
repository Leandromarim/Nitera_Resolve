/** Cores e formatos dos atalhos da página inicial: separados do catálogo de ícones para não pesar o portal. */

/** Paleta de gradientes dos atalhos da página inicial (chaves espelhadas em COLOR_KEYS na API). */
export const COLORS: { key: string; label: string; cls: string }[] = [
  { key: 'verde', label: 'Verde', cls: 'from-emerald-500 to-teal-600' },
  { key: 'coral', label: 'Coral', cls: 'from-coral-500 to-rose-600' },
  { key: 'azul', label: 'Azul da marca', cls: 'from-brand-500 to-brand-700' },
  { key: 'roxo', label: 'Roxo', cls: 'from-violet-500 to-fuchsia-600' },
  { key: 'laranja', label: 'Laranja', cls: 'from-amber-500 to-orange-600' },
  { key: 'ceu', label: 'Azul-céu', cls: 'from-sky-500 to-blue-600' },
  { key: 'cinza', label: 'Cinza', cls: 'from-slate-500 to-slate-700' },
  { key: 'rosa', label: 'Rosa', cls: 'from-pink-500 to-rose-600' },
  { key: 'vermelho', label: 'Vermelho', cls: 'from-red-500 to-red-700' },
  { key: 'turquesa', label: 'Turquesa', cls: 'from-cyan-500 to-teal-600' },
  { key: 'marinho', label: 'Azul-marinho', cls: 'from-brand-700 to-brand-950' },
  { key: 'oliva', label: 'Verde-oliva', cls: 'from-lime-600 to-green-700' },
  // tons escuros o bastante para o texto branco continuar legível
  { key: 'indigo', label: 'Índigo', cls: 'from-indigo-500 to-indigo-700' },
  { key: 'petroleo', label: 'Azul-petróleo', cls: 'from-teal-600 to-cyan-800' },
  { key: 'esmeralda', label: 'Esmeralda', cls: 'from-emerald-600 to-green-800' },
  { key: 'oceano', label: 'Oceano', cls: 'from-cyan-600 to-blue-800' },
  { key: 'noite', label: 'Noite', cls: 'from-indigo-800 to-slate-900' },
  { key: 'lavanda', label: 'Lavanda', cls: 'from-purple-500 to-indigo-600' },
  { key: 'magenta', label: 'Magenta', cls: 'from-fuchsia-600 to-purple-700' },
  { key: 'framboesa', label: 'Framboesa', cls: 'from-rose-500 to-fuchsia-700' },
  { key: 'vinho', label: 'Vinho', cls: 'from-rose-700 to-red-900' },
  { key: 'tangerina', label: 'Tangerina', cls: 'from-orange-600 to-red-700' },
  { key: 'por-do-sol', label: 'Pôr do sol', cls: 'from-orange-600 to-pink-700' },
  { key: 'dourado', label: 'Dourado', cls: 'from-amber-600 to-yellow-800' },
  { key: 'marrom', label: 'Marrom', cls: 'from-amber-700 to-stone-800' },
  { key: 'grafite', label: 'Grafite', cls: 'from-zinc-600 to-neutral-900' },
  { key: 'aurora', label: 'Aurora', cls: 'from-emerald-600 to-blue-700' },
];
export const colorClass = (key: string) => (COLORS.find((c) => c.key === key) ?? COLORS[2]!).cls;

/**
 * Formatos dos atalhos da página inicial (chaves espelhadas em SHAPE_KEYS na API).
 * `badge` é a forma do quadradinho do ícone; `fill`, o fundo dele sobre o atalho colorido;
 * `tile`, o contorno do próprio atalho. Em `light` o atalho fica claro e só o ícone leva a cor.
 * Classes escritas por extenso: o Tailwind só gera o que aparece literalmente no código.
 */
export interface ShapeEntry {
  key: string;
  label: string;
  tile: string;
  badge: string;
  fill: string;
  /** Formas recortadas (clip-path) perdem área: o quadradinho cresce para o ícone caber. */
  grow?: 'hex' | 'diamond';
  light?: boolean;
}

export const SHAPES: ShapeEntry[] = [
  { key: 'quadrado', label: 'Quadrado', tile: 'rounded-2xl', badge: 'rounded-xl', fill: 'bg-white/20' },
  { key: 'circulo', label: 'Círculo', tile: 'rounded-2xl', badge: 'rounded-full', fill: 'bg-white/20' },
  { key: 'gota', label: 'Gota', tile: 'rounded-2xl', badge: 'rounded-[50%_0.5rem_50%_50%]', fill: 'bg-white/20' },
  { key: 'folha', label: 'Folha', tile: 'rounded-2xl', badge: 'rounded-[1.25rem_0.375rem]', fill: 'bg-white/20' },
  { key: 'hexagono', label: 'Hexágono', tile: 'rounded-2xl', badge: '[clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0%_50%)]', fill: 'bg-white/25', grow: 'hex' },
  { key: 'losango', label: 'Losango', tile: 'rounded-2xl', badge: '[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]', fill: 'bg-white/25', grow: 'diamond' },
  { key: 'contorno', label: 'Contorno', tile: 'rounded-2xl', badge: 'rounded-xl ring-2 ring-inset ring-white/75', fill: '' },
  { key: 'pilula', label: 'Pílula', tile: 'rounded-full pr-6', badge: 'rounded-full', fill: 'bg-white/20' },
  { key: 'claro', label: 'Claro', tile: 'rounded-2xl', badge: 'rounded-xl', fill: '', light: true },
];
export const DEFAULT_SHAPE = 'quadrado';
export const shapeOf = (key?: string | null) => SHAPES.find((s) => s.key === key) ?? SHAPES[0]!;
