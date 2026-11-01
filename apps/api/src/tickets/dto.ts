import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TicketChannel, TicketPriority, TicketSector, TicketStatus } from '@prisma/client';

export class CreateTicketDto {
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsString() @MinLength(3) @MaxLength(20000) description: string;
  /** Fila que vai atender. Sem setor = TI. */
  @IsOptional() @IsEnum(TicketSector, { message: 'Setor inválido.' }) sector?: TicketSector;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsString() @MaxLength(20) @Matches(/^[\d\s/-]*$/, { message: 'Ramal: só números' }) extension?: string;
  @IsOptional() @IsUUID() fileId?: string;
  // abertura pela equipe de atendimento em nome de alguém (ex.: ligação telefônica)
  @IsOptional() @IsEnum(TicketChannel) channel?: TicketChannel;
  @IsOptional() @IsUUID() requesterId?: string;
  @IsOptional() @IsString() @MaxLength(120) requesterName?: string;
  @IsOptional() @IsString() @MaxLength(30) requesterPhone?: string;
}

/**
 * Abertura pela tela de chamados: setor, local, ramal e prioridade são obrigatórios (WhatsApp e e-mail seguem sem eles).
 * Classe própria (sem herdar de CreateTicketDto): o @IsOptional herdado anularia a obrigatoriedade.
 */
export class PortalTicketDto {
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsString() @MinLength(3) @MaxLength(20000) description: string;
  @IsOptional() @IsEnum(TicketSector, { message: 'Setor inválido.' }) sector?: TicketSector;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsEnum(TicketPriority, { message: 'Escolha a prioridade.' }) priority: TicketPriority;
  @IsUUID('all', { message: 'Escolha o setor.' }) departmentId: string;
  @IsString({ message: 'Informe o local (sala, posto, andar).' }) @MinLength(2, { message: 'Informe o local (sala, posto, andar).' }) @MaxLength(120) location: string;
  @IsString({ message: 'Informe o ramal (só números).' }) @Matches(/^\s*\d[\d\s/-]*$/, { message: 'Informe o ramal (só números).' }) @MaxLength(20) extension: string;
  @IsOptional() @IsUUID() fileId?: string;
  @IsOptional() @IsEnum(TicketChannel) channel?: TicketChannel;
  @IsOptional() @IsUUID() requesterId?: string;
  @IsOptional() @IsString() @MaxLength(120) requesterName?: string;
  @IsOptional() @IsString() @MaxLength(30) requesterPhone?: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsUUID() assigneeId?: string | null;
  @IsOptional() @IsUUID() departmentId?: string | null;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  /** Transferência para outra fila: volta a NOVO, sem responsável. */
  @IsOptional() @IsEnum(TicketSector, { message: 'Setor inválido.' }) sector?: TicketSector;
}

export class CommentDto {
  @IsString() @MinLength(1) @MaxLength(20000) body: string;
  @IsOptional() @IsBoolean() internal?: boolean;
  @IsOptional() @IsUUID() fileId?: string;
}

/** Prorrogação do prazo pela equipe: até 1 semana por vez, com justificativa e evidências opcionais. */
export class ProrrogarDto {
  @IsInt() @Min(1) @Max(168, { message: 'Cada prorrogação pode somar até 1 semana (168 horas).' }) horas: number;
  @IsString() @MinLength(10, { message: 'Explique o motivo da prorrogação (mínimo 10 caracteres).' }) @MaxLength(2000) justificativa: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10, { message: 'Envie até 10 evidências.' }) @IsUUID('all', { each: true }) fileIds?: string[];
  /** avisa o solicitante do novo prazo (sem a justificativa) */
  @IsOptional() @IsBoolean() avisar?: boolean;
}

export class RateDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class CategoryDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsInt() @Min(1) @Max(720) slaHours: number;
  @IsOptional() @IsBoolean() active?: boolean;
  /** Setor da categoria (na criação; sem setor = TI). */
  @IsOptional() @IsEnum(TicketSector, { message: 'Setor inválido.' }) sector?: TicketSector;
  // ícone e dicas: guardados no Setting `chamadosCategorias` (validados em config.ts)
  @IsOptional() @IsString() @MaxLength(40) icon?: string | null;
  @IsOptional() @IsString() @MaxLength(40) imageId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tips?: string[];
}
