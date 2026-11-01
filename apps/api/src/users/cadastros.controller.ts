import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class PerfilDto {
  @IsString() @MinLength(2, { message: 'Informe o nome do perfil' }) @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
  @IsArray() @ArrayNotEmpty({ message: 'Escolha ao menos uma permissão' }) @IsEnum(Role, { each: true }) roles: Role[];
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

class CategoriaDto {
  @IsString() @MinLength(2, { message: 'Informe o nome da categoria' }) @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
}

class GrupoDto {
  @IsString() @MinLength(2, { message: 'Informe o nome do grupo' }) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
  @IsOptional() @IsEmail({}, { message: 'E-mail do grupo inválido' }) email?: string | null;
}

/** Impede que a mudança deixe o sistema sem nenhum administrador ativo. */
export async function garantirOutroAdmin(prisma: PrismaService | Prisma.TransactionClient, exceto: string[]) {
  const outros = await prisma.user.count({
    where: { id: { notIn: exceto }, active: true, roles: { has: 'ADMIN' }, OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] },
  });
  if (!outros) throw new BadRequestException('O sistema precisa de pelo menos um administrador ativo.');
}

const texto = (v?: string | null) => v?.trim() || null;
const ordenar = (roles: Role[]) => [...new Set(roles)].sort();

function emUso(e: unknown, msg: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Já existe um cadastro com esse nome');
  if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2003' || e.code === 'P2014')) throw new ConflictException(msg);
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new NotFoundException();
  throw e;
}

/** Painel › Usuários: perfis de uso (com permissões), categorias e grupos da organização. Só administrador. */
@Controller('admin')
@Roles('ADMIN')
export class CadastrosController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ---------- perfis ----------
  @Get('perfis')
  perfis() {
    return this.prisma.accessProfile.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } } } });
  }

  @Post('perfis')
  async criarPerfil(@Body() dto: PerfilDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const p = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.accessProfile.updateMany({ data: { isDefault: false } });
      return tx.accessProfile.create({ data: { name: dto.name.trim(), description: texto(dto.description), roles: ordenar(dto.roles), isDefault: !!dto.isDefault } });
    }).catch((e) => emUso(e, ''));
    await this.audit.log(u.id, 'criar', 'AccessProfile', p.id, { nome: p.name, permissoes: p.roles }, ip);
    return p;
  }

  /** Mudar as permissões do perfil muda as de todos os usuários dele. */
  @Patch('perfis/:id')
  async editarPerfil(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PerfilDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const roles = ordenar(dto.roles);
    const { perfil, antes, usuarios } = await this.prisma.$transaction(async (tx) => {
      const antes = await tx.accessProfile.findUnique({ where: { id } });
      if (!antes) throw new NotFoundException();
      if (antes.roles.includes('ADMIN') && !roles.includes('ADMIN')) {
        const membros = await tx.user.findMany({ where: { profileId: id }, select: { id: true } });
        if (membros.some((m) => m.id === u.id)) throw new BadRequestException('Você não pode tirar a permissão de administrador do seu próprio perfil');
        await garantirOutroAdmin(tx, membros.map((m) => m.id));
      }
      if (dto.isDefault) await tx.accessProfile.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      const perfil = await tx.accessProfile.update({ where: { id }, data: { name: dto.name.trim(), description: texto(dto.description), roles, isDefault: !!dto.isDefault } });
      const { count } = await tx.user.updateMany({ where: { profileId: id }, data: { roles } });
      return { perfil, antes, usuarios: count };
    }).catch((e) => emUso(e, ''));
    await this.audit.log(u.id, 'editar', 'AccessProfile', id, { nome: perfil.name, permissoesAntes: antes.roles, permissoes: roles, usuariosAtualizados: usuarios }, ip);
    return { ...perfil, usuariosAtualizados: usuarios };
  }

  @Delete('perfis/:id')
  @HttpCode(204)
  async excluirPerfil(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const p = await this.prisma.accessProfile.delete({ where: { id } }).catch((e) => emUso(e, 'Há usuários com este perfil. Troque o perfil deles antes de excluir.'));
    await this.audit.log(u.id, 'excluir', 'AccessProfile', id, { nome: p.name, permissoes: p.roles }, ip);
  }

  // ---------- categorias ----------
  @Get('categorias-usuario')
  categorias() {
    return this.prisma.userCategory.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } } } });
  }

  @Post('categorias-usuario')
  async criarCategoria(@Body() dto: CategoriaDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const c = await this.prisma.userCategory.create({ data: { name: dto.name.trim(), description: texto(dto.description) } }).catch((e) => emUso(e, ''));
    await this.audit.log(u.id, 'criar', 'UserCategory', c.id, { nome: c.name }, ip);
    return c;
  }

  @Patch('categorias-usuario/:id')
  async editarCategoria(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoriaDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const c = await this.prisma.userCategory.update({ where: { id }, data: { name: dto.name.trim(), description: texto(dto.description) } }).catch((e) => emUso(e, ''));
    await this.audit.log(u.id, 'editar', 'UserCategory', id, { nome: c.name }, ip);
    return c;
  }

  @Delete('categorias-usuario/:id')
  @HttpCode(204)
  async excluirCategoria(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const c = await this.prisma.userCategory.delete({ where: { id } }).catch((e) => emUso(e, 'Há usuários nesta categoria. Troque a categoria deles antes de excluir.'));
    await this.audit.log(u.id, 'excluir', 'UserCategory', id, { nome: c.name }, ip);
  }

  // ---------- grupos ----------
  @Get('grupos')
  grupos() {
    return this.prisma.orgGroup.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } } } });
  }

  @Post('grupos')
  async criarGrupo(@Body() dto: GrupoDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const g = await this.prisma.orgGroup
      .create({ data: { name: dto.name.trim(), description: texto(dto.description), email: texto(dto.email)?.toLowerCase() ?? null } })
      .catch((e) => emUso(e, ''));
    await this.audit.log(u.id, 'criar', 'OrgGroup', g.id, { nome: g.name }, ip);
    return g;
  }

  @Patch('grupos/:id')
  async editarGrupo(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GrupoDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const g = await this.prisma.orgGroup
      .update({ where: { id }, data: { name: dto.name.trim(), description: texto(dto.description), email: texto(dto.email)?.toLowerCase() ?? null } })
      .catch((e) => emUso(e, ''));
    await this.audit.log(u.id, 'editar', 'OrgGroup', id, { nome: g.name }, ip);
    return g;
  }

  /** Excluir o grupo só desfaz a ligação com os usuários; eles continuam cadastrados. */
  @Delete('grupos/:id')
  @HttpCode(204)
  async excluirGrupo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const g = await this.prisma.orgGroup.delete({ where: { id } }).catch((e) => emUso(e, ''));
    await this.audit.log(u.id, 'excluir', 'OrgGroup', id, { nome: g.name }, ip);
  }
}
