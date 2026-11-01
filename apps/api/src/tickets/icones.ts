/**
 * Atalhos coloridos da página inicial e ícones rápidos do cabeçalho do portal.
 * Ficam na tabela Setting (chaves `homeShortcuts` e `headerLinks`), editáveis em Painel › Atalhos e ícones.
 */

export const HOME_SHORTCUTS_KEY = 'homeShortcuts';
export const HEADER_LINKS_KEY = 'headerLinks';
export const SHORTCUT_KEYS = [HOME_SHORTCUTS_KEY, HEADER_LINKS_KEY] as const;
export type ShortcutKey = (typeof SHORTCUT_KEYS)[number];

export const MAX_HOME_SHORTCUTS = 12;
export const MAX_HEADER_LINKS = 8;

/**
 * Nomes de ícones aceitos (cópia de apps/web/src/components/icons/catalog.ts).
 * Ao incluir um ícone no catálogo do portal, inclua o nome aqui também.
 */
export const ICON_NAMES = [
  // saúde
  'heart-pulse', 'stethoscope', 'activity', 'pill', 'pill-bottle', 'tablets', 'syringe', 'ambulance', 'hospital', 'cross', 'heart-plus', 'scan-heart',
  'thermometer', 'microscope', 'test-tube', 'test-tubes', 'flask-conical', 'pipette', 'dna', 'radiation', 'biohazard', 'bone', 'brain', 'ear', 'glasses',
  'baby', 'venus', 'mars', 'person-standing', 'accessibility', 'weight', 'droplet', 'briefcase-medical', 'clipboard-plus', 'bandage', 'bed-double', 'bed',
  'ribbon', 'hand-heart', 'heart-handshake', 'heart',
  // pessoas
  'users', 'users-round', 'user', 'user-round', 'user-plus', 'user-check', 'user-cog', 'user-search', 'user-pen', 'contact', 'book-user', 'id-card',
  'id-card-lanyard', 'award', 'handshake', 'hand-helping', 'smile', 'laugh', 'meh', 'frown',
  // comunicação
  'message-circle', 'messages-square', 'message-square', 'message-square-text', 'message-circle-question-mark', 'mail', 'mail-open', 'inbox', 'at-sign',
  'phone', 'phone-call', 'headset', 'headphones', 'smartphone', 'megaphone', 'bell', 'bell-ring', 'newspaper', 'rss', 'radio', 'tv', 'mic', 'volume-2', 'video',
  'send', 'share-2', 'languages', 'speech',
  // documentos
  'file-text', 'file-plus', 'file-check', 'file-search', 'file-pen-line', 'file-heart', 'file-badge', 'file-clock', 'file-lock', 'files', 'folder',
  'folder-open', 'folders', 'folder-kanban', 'clipboard', 'clipboard-list', 'clipboard-check', 'book-open', 'scroll-text', 'notebook', 'notepad-text',
  'sticky-note', 'paperclip', 'stamp', 'archive', 'printer', 'file-spreadsheet', 'signature', 'pen-line',
  // tecnologia
  'laptop', 'monitor', 'monitor-smartphone', 'tablet', 'keyboard', 'mouse', 'server', 'hard-drive', 'database', 'cloud', 'cloud-upload', 'wifi', 'router',
  'network', 'cpu', 'usb', 'bluetooth', 'webcam', 'projector', 'key-round', 'fingerprint-pattern', 'scan-face', 'life-buoy', 'bug', 'code', 'terminal', 'bot',
  'brain-circuit', 'globe', 'link', 'qr-code', 'barcode', 'scan-barcode', 'battery-charging',
  // manutenção
  'wrench', 'hammer', 'tool-case', 'drill', 'paintbrush', 'paint-roller', 'settings', 'sliders-horizontal', 'lightbulb', 'lamp', 'plug', 'zap', 'cable',
  'battery', 'air-vent', 'fan', 'snowflake', 'droplets', 'gauge', 'spray-can', 'trash', 'washing-machine', 'construction', 'truck', 'package', 'package-check',
  'boxes',
  // agenda
  'calendar', 'calendar-days', 'calendar-check', 'calendar-plus', 'calendar-clock', 'calendar-range', 'calendar-heart', 'clock', 'history', 'watch',
  'alarm-clock', 'timer', 'hourglass',
  // segurança
  'shield', 'shield-check', 'shield-plus', 'shield-alert', 'shield-user', 'lock', 'lock-keyhole', 'key', 'cctv', 'siren', 'triangle-alert', 'badge-alert',
  'flame', 'fire-extinguisher', 'alarm-smoke', 'hard-hat', 'traffic-cone', 'eye',
  // gestão
  'chart-column', 'chart-line', 'chart-pie', 'trending-up', 'target', 'flag', 'rocket', 'briefcase', 'briefcase-business', 'badge-check', 'circle-check',
  'trophy', 'medal', 'crown', 'star', 'thumbs-up', 'puzzle', 'scale', 'gavel', 'vote', 'shopping-cart',
  // financeiro
  'wallet', 'banknote', 'coins', 'hand-coins', 'piggy-bank', 'credit-card', 'receipt', 'badge-dollar-sign', 'calculator', 'landmark',
  // educação
  'graduation-cap', 'school', 'presentation', 'lectern', 'book', 'book-copy', 'book-open-check', 'library', 'notebook-pen', 'pencil', 'ruler', 'backpack',
  'atom',
  // alimentação
  'utensils', 'utensils-crossed', 'cooking-pot', 'hand-platter', 'coffee', 'croissant', 'sandwich', 'soup', 'salad', 'apple', 'vegan', 'pizza', 'cookie',
  'ice-cream-cone', 'milk', 'glass-water', 'cup-soda', 'refrigerator', 'microwave',
  // transporte
  'car', 'car-front', 'bus', 'train-front', 'bike', 'motorbike', 'plane', 'helicopter', 'forklift', 'fuel', 'square-parking', 'route', 'navigation', 'signpost',
  // lugares e serviços
  'house', 'building-2', 'building', 'map-pin', 'map', 'compass', 'door-open', 'door-closed', 'armchair', 'sofa', 'toilet', 'shower-head', 'store', 'hotel',
  'church', 'factory', 'warehouse', 'shirt',
  // natureza e clima
  'leaf', 'recycle', 'sprout', 'tree-pine', 'trees', 'flower', 'sun', 'moon', 'cloud-sun', 'cloud-rain', 'umbrella', 'wind', 'thermometer-snowflake', 'rainbow',
  // diversos
  'gift', 'cake', 'party-popper', 'ticket', 'music', 'palette', 'clapperboard', 'gamepad-2', 'dumbbell', 'volleyball', 'gem', 'camera', 'image', 'images',
  'shopping-bag', 'tag', 'bookmark', 'box', 'scissors', 'shapes', 'search', 'circle-help', 'info', 'layout-grid', 'external-link', 'download', 'sparkles',
] as const;

/** Paleta de gradientes (cópia das chaves de COLORS em apps/web/src/components/icons/catalog.ts). */
export const COLOR_KEYS = [
  'verde', 'coral', 'azul', 'roxo', 'laranja', 'ceu', 'cinza', 'rosa', 'vermelho', 'turquesa', 'marinho', 'oliva',
  'indigo', 'petroleo', 'esmeralda', 'oceano', 'noite', 'lavanda', 'magenta', 'framboesa', 'vinho', 'tangerina', 'por-do-sol', 'dourado', 'marrom', 'grafite', 'aurora',
] as const;

/** Formatos dos atalhos da página inicial (cópia das chaves de SHAPES em apps/web/src/components/icons/catalog.ts). */
export const SHAPE_KEYS = ['quadrado', 'circulo', 'gota', 'folha', 'hexagono', 'losango', 'contorno', 'pilula', 'claro'] as const;
/** Formato de quem foi salvo antes de existir a escolha: o visual original. */
export const DEFAULT_SHAPE = 'quadrado';

export interface HomeShortcut {
  id: string;
  title: string;
  text: string;
  href: string;
  openInNewTab: boolean;
  requiresAuth: boolean;
  active: boolean;
  icon: string;
  imageId: string | null;
  color: string;
  shape: string;
}

export interface HeaderLink {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
  requiresAuth: boolean;
  active: boolean;
  icon: string;
  imageId: string | null;
}

/** Padrão igual ao que existia fixo no código antes de ficar editável. */
export const DEFAULT_HOME_SHORTCUTS: HomeShortcut[] = [
  { id: 'chat', title: 'Chat interno', text: 'Converse com os colegas', href: '/chat', openInNewTab: false, requiresAuth: false, active: true, icon: 'message-circle', imageId: null, color: 'verde', shape: DEFAULT_SHAPE },
  { id: 'chamado', title: 'Abrir chamado', text: 'TI, Manutenção e Comunicação', href: '/chamados/novo', openInNewTab: false, requiresAuth: false, active: true, icon: 'life-buoy', imageId: null, color: 'coral', shape: DEFAULT_SHAPE },
  { id: 'ramais', title: 'Ramais', text: 'Encontre um contato', href: '/ramais', openInNewTab: false, requiresAuth: false, active: true, icon: 'phone', imageId: null, color: 'azul', shape: DEFAULT_SHAPE },
  { id: 'ouvidoria', title: 'Ouvidoria', text: 'Avaliações dos pacientes', href: '/ouvidoria', openInNewTab: false, requiresAuth: false, active: true, icon: 'heart-handshake', imageId: null, color: 'roxo', shape: DEFAULT_SHAPE },
];

export const DEFAULT_HEADER_LINKS: HeaderLink[] = [
  { id: 'chat', label: 'Chat', href: '/chat', openInNewTab: false, requiresAuth: false, active: true, icon: 'message-circle', imageId: null },
  { id: 'chamados', label: 'Chamados', href: '/chamados', openInNewTab: false, requiresAuth: false, active: true, icon: 'life-buoy', imageId: null },
  { id: 'ouvidoria', label: 'Ouvidoria', href: '/ouvidoria', openInNewTab: false, requiresAuth: false, active: true, icon: 'heart-handshake', imageId: null },
];

/** Link interno (começa com uma única barra) ou http(s). Sem espaços nem barras invertidas. */
export const SHORTCUT_HREF = /^(\/(?!\/)[^\s\\]*|https?:\/\/[^\s\\]+)$/i;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Lê o valor salvo de forma tolerante (o que estiver malformado é descartado).
 * Sem nada salvo, devolve o padrão.
 */
export function readHomeShortcuts(raw: unknown): HomeShortcut[] {
  if (!Array.isArray(raw)) return DEFAULT_HOME_SHORTCUTS;
  return raw.filter(isObj).slice(0, MAX_HOME_SHORTCUTS).flatMap((r) => {
    const href = str(r.href, 500);
    const title = str(r.title, 40);
    if (!title || !SHORTCUT_HREF.test(href)) return [];
    return [{
      id: str(r.id, 40) || title,
      title,
      text: str(r.text, 80),
      href,
      openInNewTab: r.openInNewTab === true,
      requiresAuth: r.requiresAuth === true,
      active: r.active !== false,
      icon: (ICON_NAMES as readonly string[]).includes(r.icon as string) ? (r.icon as string) : 'link',
      imageId: typeof r.imageId === 'string' ? r.imageId : null,
      color: (COLOR_KEYS as readonly string[]).includes(r.color as string) ? (r.color as string) : 'azul',
      shape: (SHAPE_KEYS as readonly string[]).includes(r.shape as string) ? (r.shape as string) : DEFAULT_SHAPE,
    }];
  });
}

export function readHeaderLinks(raw: unknown): HeaderLink[] {
  if (!Array.isArray(raw)) return DEFAULT_HEADER_LINKS;
  return raw.filter(isObj).slice(0, MAX_HEADER_LINKS).flatMap((r) => {
    const href = str(r.href, 500);
    const label = str(r.label, 30);
    if (!label || !SHORTCUT_HREF.test(href)) return [];
    return [{
      id: str(r.id, 40) || label,
      label,
      href,
      openInNewTab: r.openInNewTab === true,
      requiresAuth: r.requiresAuth === true,
      active: r.active !== false,
      icon: (ICON_NAMES as readonly string[]).includes(r.icon as string) ? (r.icon as string) : 'link',
      imageId: typeof r.imageId === 'string' ? r.imageId : null,
    }];
  });
}
