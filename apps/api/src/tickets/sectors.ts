import { BadRequestException } from '@nestjs/common';
import type { Role, TicketSector } from '@prisma/client';

/** Filas de chamados. Cada setor é atendido por um perfil próprio; ADMIN atende todos. */
export const SECTORS: TicketSector[] = ['TI', 'INFRAESTRUTURA', 'MANUTENCAO', 'COMUNICACAO'];

export const SECTOR_ROLE: Record<TicketSector, Role> = { TI: 'TI', INFRAESTRUTURA: 'INFRAESTRUTURA', MANUTENCAO: 'MANUTENCAO', COMUNICACAO: 'COMUNICACAO' };

/** Perfis que atendem alguma fila (para os @Roles das rotas de atendimento). */
export const TICKET_STAFF_ROLES: Role[] = SECTORS.map((s) => SECTOR_ROLE[s]);

export const SECTOR_LABEL: Record<TicketSector, string> = {
  TI: 'Tecnologia da Informação',
  INFRAESTRUTURA: 'Infraestrutura de TI',
  MANUTENCAO: 'Manutenção',
  COMUNICACAO: 'Comunicação',
};

/** Nome curto da equipe, usado em textos para o solicitante ("a equipe de Manutenção"). */
export const SECTOR_TEAM: Record<TicketSector, string> = {
  TI: 'equipe de TI',
  INFRAESTRUTURA: 'equipe de Infraestrutura de TI',
  MANUTENCAO: 'equipe de Manutenção',
  COMUNICACAO: 'equipe de Comunicação',
};

interface WithRoles {
  roles: Role[] | string[];
}

const has = (u: WithRoles, r: string) => (u.roles as string[]).includes(r);

/** Setores que o usuário atende (ADMIN: todos). */
export function staffSectors(u?: WithRoles | null): TicketSector[] {
  if (!u) return [];
  if (has(u, 'ADMIN')) return [...SECTORS];
  return SECTORS.filter((s) => has(u, SECTOR_ROLE[s]));
}

/** O usuário atende chamados deste setor? */
export function isStaffOf(u: WithRoles | null | undefined, sector: TicketSector): boolean {
  return staffSectors(u).includes(sector);
}

/** O usuário atende pelo menos um setor? */
export const isStaff = (u?: WithRoles | null) => staffSectors(u).length > 0;

/** Lê o setor vindo da URL ou do corpo ("ti", "infraestrutura", "manutencao", "COMUNICACAO"...). Vazio = undefined. */
export function parseSector(v: unknown): TicketSector | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim().toUpperCase();
  if (!(SECTORS as string[]).includes(s)) throw new BadRequestException('Setor inválido. Use TI, INFRAESTRUTURA, MANUTENCAO ou COMUNICACAO.');
  return s as TicketSector;
}

/**
 * Setores que entram numa consulta de atendimento (lista, relatórios, painel):
 * com `setor` informado, só ele (se o usuário o atende); sem setor, todos os setores do usuário.
 * Devolve null quando o usuário pediu um setor que não atende.
 */
export function scopeSectors(u: WithRoles | null | undefined, setor?: TicketSector): TicketSector[] | null {
  const mine = staffSectors(u);
  if (!setor) return mine;
  return mine.includes(setor) ? [setor] : null;
}
