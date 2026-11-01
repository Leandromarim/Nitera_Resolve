import type { Role } from '@/lib/api';

export type LinkType = 'NONE' | 'URL' | 'PAGE' | 'FILE';

export interface LinkValue {
  linkType: LinkType;
  url: string | null;
  pageSlug: string | null;
  fileId: string | null;
}

export interface AdminSlide extends LinkValue {
  id: string;
  title: string;
  subtitle: string | null;
  imageId: string | null;
  imageUrl: string | null;
  image: string | null;
  order: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface AdminCard extends LinkValue {
  id: string;
  title: string;
  imageId: string | null;
  imageUrl: string | null;
  image: string | null;
  openInNewTab: boolean;
  requiresAuth: boolean;
  order: number;
  active: boolean;
}

export interface AdminMenuItem extends LinkValue {
  id: string;
  label: string;
  parentId: string | null;
  order: number;
  openInNewTab: boolean;
  highlight: string | null;
  requiresAuth: boolean;
  active: boolean;
  children: AdminMenuItem[];
}

export interface PageAttachment {
  id?: string;
  fileId: string;
  label: string;
  order?: number;
}

export interface AdminPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  published: boolean;
  requiresAuth: boolean;
  /** construtor de páginas: true = desenhada pelos blocos */
  builder?: boolean;
  blocks?: unknown[];
  options?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attachments: PageAttachment[];
  _count?: { submissions: number };
}

export interface Department {
  id: string;
  name: string;
  location?: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  extension: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  roles: Role[];
  active: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  departmentId: string | null;
  department: Department | null;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  validUntil: string | null;
  profileId: string | null;
  categoryId: string | null;
  ticketEmail: string | null;
  ticketEmailOn: boolean;
  profile: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  groups: { id: string; name: string }[];
}

/** Perfil de uso do sistema: cada um com as suas permissões. */
export interface AccessProfile {
  id: string;
  name: string;
  description: string | null;
  roles: Role[];
  isDefault: boolean;
  _count?: { users: number };
}

export interface UserCategory {
  id: string;
  name: string;
  description: string | null;
  _count?: { users: number };
}

export interface OrgGroup {
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  _count?: { users: number };
}

export interface TicketCategory {
  id: string;
  name: string;
  description: string | null;
  slaHours: number;
  active: boolean;
  /** fila de chamados a que a categoria pertence */
  sector: 'TI' | 'INFRAESTRUTURA' | 'MANUTENCAO' | 'COMUNICACAO';
  _count?: { tickets: number };
}

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  data: unknown;
  ip: string | null;
  createdAt: string;
  user: { name: string } | null;
}

export interface Overview {
  users: number;
  openTickets: number;
  overdue: number;
  pendingFeedback: number;
  feedbackAvg30: number | null;
  feedbackCount30: number;
  slides: number;
  cards: number;
  menus: number;
  pages: number;
}

/** Converte os campos de link para o formato aceito pela API (limpa os campos que não se aplicam ao tipo). */
export function linkPayload(v: LinkValue): LinkValue {
  return {
    linkType: v.linkType,
    url: v.linkType === 'URL' ? (v.url ?? '').trim() : null,
    pageSlug: v.linkType === 'PAGE' ? v.pageSlug : null,
    fileId: v.linkType === 'FILE' ? v.fileId : null,
  };
}

/** Endereço resultante de um link (para prévia). */
export function linkHref(v: LinkValue): string | null {
  switch (v.linkType) {
    case 'URL':
      return v.url || null;
    case 'PAGE':
      return v.pageSlug ? `/p/${v.pageSlug}` : null;
    case 'FILE':
      return v.fileId ? `/api/files/${v.fileId}` : null;
    default:
      return null;
  }
}

/** Valida campos de link; devolve mensagem de erro ou null. */
export function linkError(v: LinkValue): string | null {
  if (v.linkType === 'URL' && !/^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test((v.url ?? '').trim()))
    return 'O link precisa começar com https://, http://, mailto:, tel: ou /';
  if (v.linkType === 'PAGE' && !v.pageSlug) return 'Escolha a página interna do link';
  if (v.linkType === 'FILE' && !v.fileId) return 'Envie o arquivo do link';
  return null;
}

export const EMPTY_LINK: LinkValue = { linkType: 'NONE', url: null, pageSlug: null, fileId: null };

export const pickLink = (v: LinkValue): LinkValue => ({ linkType: v.linkType, url: v.url, pageSlug: v.pageSlug, fileId: v.fileId });
