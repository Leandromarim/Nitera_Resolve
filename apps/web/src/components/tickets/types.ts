export type TicketStatus = 'NOVO' | 'EM_ATENDIMENTO' | 'AGUARDANDO_USUARIO' | 'RESOLVIDO' | 'FECHADO' | 'CANCELADO';
export type TicketPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type TicketChannel = 'PORTAL' | 'WHATSAPP' | 'EMAIL' | 'TELEFONE';
export type TicketSector = 'TI' | 'INFRAESTRUTURA' | 'MANUTENCAO' | 'COMUNICACAO';

export interface TicketCategory {
  id: string;
  name: string;
  sector: TicketSector;
  description?: string | null;
  slaHours: number;
}

export interface Department {
  id: string;
  name: string;
  /** local do setor, já sugerido no chamado */
  location?: string | null;
}

export interface Technician {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** setores que a pessoa atende */
  sectors?: TicketSector[];
}

export interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string;
  sector: TicketSector;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  categoryId: string | null;
  departmentId: string | null;
  location: string | null;
  requesterId: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requesterExtension?: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  /** horas somadas ao prazo pelas prorrogações */
  prorrogadoHoras?: number;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slaHours: number; sector?: TicketSector } | null;
  department: Department | null;
  requester: { id: string; name: string; email: string; phone: string | null; extension: string | null } | null;
  assignee: { id: string; name: string } | null;
}

export interface TicketComment {
  id: string;
  authorId: string | null;
  authorName: string | null;
  author: { id: string; name: string; roles: string[] } | null;
  body: string;
  internal: boolean;
  channel: TicketChannel;
  fileId: string | null;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
}

export interface TicketEvent {
  id: string;
  actorId: string | null;
  type: string;
  from: string | null;
  to: string | null;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  /** quem está vendo atende o setor deste chamado */
  canManage: boolean;
  /** equipe que acompanha o setor do chamado: vê sem atender */
  acompanhando?: boolean;
  comments: TicketComment[];
  events: TicketEvent[];
  /** só para a equipe (e quem acompanha) */
  prorrogacoes?: TicketProrrogacao[];
}

export interface TicketProrrogacao {
  id: string;
  authorName: string;
  horas: number;
  prazoAnterior: string | null;
  prazoNovo: string;
  justificativa: string;
  arquivos: { id: string; name: string; url: string }[];
  createdAt: string;
}

export interface TicketList {
  items: Ticket[];
  total: number;
}

export interface ReportSummary {
  total: number;
  open: number;
  resolved: number;
  overdue: number;
  avgResolutionHours: number | null;
  avgFirstResponseHours: number | null;
  slaPercent: number | null;
  satisfaction: number | null;
  ratingsCount: number;
  byStatus: { label: string; value: number }[];
  byCategory: { label: string; value: number }[];
  bySector?: { label: string; value: number }[];
  byChannel: { label: string; value: number }[];
  byPriority: { label: string; value: number }[];
  byDepartment: { label: string; value: number }[];
  byAssignee: { label: string; total: number; resolvidos: number; mediaHoras: number | null }[];
  byDay: { date: string; abertos: number; resolvidos: number }[];
}

export const OPEN_STATUSES: TicketStatus[] = ['NOVO', 'EM_ATENDIMENTO', 'AGUARDANDO_USUARIO'];
export const isOpen = (s: TicketStatus) => OPEN_STATUSES.includes(s);

/** Ramal de quem pediu: o informado na abertura ou, nos chamados sem ele, o do cadastro. */
export const ramalDo = (t: Pick<Ticket, 'requesterExtension' | 'requester'>) => t.requesterExtension || t.requester?.extension || null;

/** Local sem o "· Ramal 2210" que os chamados antigos traziam junto (o ramal agora tem campo próprio). */
export const localSemRamal = (location: string | null) => location?.replace(/\s*·?\s*Ramal\s+[\d\s/-]+$/i, '').trim() || null;
