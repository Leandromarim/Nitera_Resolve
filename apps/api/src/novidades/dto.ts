import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { ReleaseKind } from '@prisma/client';

/** Versão semântica: MAIOR.MENOR.CORREÇÃO (ex.: 4.2.0). */
export const SEMVER = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

export class ReleaseDto {
  @IsString() @Matches(SEMVER, { message: 'Informe a versão no formato 4.2.0 (números separados por ponto)' }) version: string;
  @IsString() @MinLength(3, { message: 'O título precisa ter ao menos 3 caracteres' }) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(600) summary?: string | null;
  @IsOptional() @IsBoolean() announce?: boolean;
  /** ignorado: o NITERA Resolve tem um sistema só */
  @IsOptional() @IsIn(['resolve']) sistema?: 'resolve';
}

export class ReleaseItemDto {
  @IsEnum(ReleaseKind, { message: 'Tipo de melhoria inválido' }) kind: ReleaseKind;
  @IsString() @MinLength(3, { message: 'O título do item precisa ter ao menos 3 caracteres' }) @MaxLength(160) title: string;
  @IsString() @MaxLength(20000) description: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string | null;
  @IsOptional() @IsUUID() imageId?: string | null;
}

export class ReorderItemsDto {
  @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) ids: string[];
}

export class PublishDto {
  @IsBoolean() published: boolean;
}
