import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Portal, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PASSWORD_MESSAGE, PASSWORD_RULE, SENHA_PROVISORIA_DIAS, SENHA_PROVISORIA_MESSAGE, SENHA_PROVISORIA_MIN } from '../auth/dto';
import { CadastrosController, garantirOutroAdmin } from './cadastros.controller';
import { UsuariosCsvController } from './usuarios-csv.controller';

/** Só fotos enviadas para o próprio sistema. */
const AVATAR_RE = /^\/api\/files\/[0-9a-f-]{36}$/;

class AvatarDto {
  @IsOptional() @Matches(AVATAR_RE, { message: 'Foto inválida' }) avatarUrl?: string | null;
}

class UserDto {
  @IsString() @MinLength(1, { message: 'Informe o nome' }) @MaxLength(60) firstName: string;
  @IsString() @MinLength(1, { message: 'Informe o sobrenome' }) @MaxLength(60) lastName: string;
  @IsEmail({}, { message: 'E-mail inválido' }) email: string;
  @IsString() @Matches(/^[a-z0-9._-]{3,40}$/, { message: 'Usuário: 3 a 40 caracteres minúsculos, números, ponto, hífen ou sublinhado' }) username: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(20) extension?: string;
  @IsOptional() @IsString() @MaxLength(80) jobTitle?: string;
  @IsOptional() @IsUUID() departmentId?: string | null;
  /** o perfil define as permissões (roles é copiado dele) */
  @IsUUID('all', { message: 'Escolha o perfil' }) profileId: string;
  @IsUUID('all', { message: 'Escolha a categoria' }) categoryId: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) groupIds?: string[];
  @IsOptional() @IsISO8601({}, { message: 'Data de validade inválida' }) validUntil?: string | null;
  @IsOptional() @IsEmail({}, { message: 'E-mail dos chamados inválido' }) ticketEmail?: string | null;
  @IsOptional() @IsBoolean() ticketEmailOn?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Matches(AVATAR_RE, { message: 'Foto inválida' }) avatarUrl?: string | null;
  /** senha forte; com `senhaSimples`, basta ter SENHA_PROVISORIA_MIN caracteres (vale só para o primeiro acesso) */
  @IsOptional() @IsString() @MaxLength(128) @ValidateIf((o: UserDto) => !o.senhaSimples) @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) password?: string;
  @IsOptional() @IsBoolean() senhaSimples?: boolean;
}

class DepartmentDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(90) location?: string | null;
}

const PUBLIC_FIELDS = {
  id: true, name: true, email: true, username: true, phone: true, extension: true, jobTitle: true, avatarUrl: true,
  roles: true, active: true, totpEnabled: true, lastLoginAt: true, lastSeenAt: true, departmentId: true,
  department: { select: { id: true, name: true } }, createdAt: true,
  firstName: true, lastName: true, validUntil: true, profileId: true, categoryId: true, ticketEmail: true, ticketEmailOn: true,
  profile: { select: { id: true, name: true } }, category: { select: { id: true, name: true } }, groups: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
} as const;

@Controller()
export class UsersController {
  constructor(private prisma: PrismaService, private auth: AuthService, private audit: AuditService) {}

  /** Lista de contatos (chat) e ramais — qualquer colaborador logado. */
  @Get('directory')
  directory(@Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: {
        active: true,
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { extension: { contains: q } }, { jobTitle: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      select: { id: true, name: true, jobTitle: true, extension: true, avatarUrl: true, lastSeenAt: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  @Portal()
  @Get('departments')
  departments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  @Roles('ADMIN')
  @Post('departments')
  async createDepartment(@Body() dto: DepartmentDto, @CurrentUser() u: AuthUser) {
    const d = await this.prisma.department.create({ data: { name: dto.name.trim(), location: dto.location?.trim() || null } });
    await this.audit.log(u.id, 'criar', 'Department', d.id, dto);
    return d;
  }

  @Roles('ADMIN')
  @Patch('departments/:id')
  async updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DepartmentDto, @CurrentUser() u: AuthUser) {
    const d = await this.prisma.department.update({ where: { id }, data: { name: dto.name.trim(), location: dto.location?.trim() || null } });
    await this.audit.log(u.id, 'editar', 'Department', id, dto);
    return d;
  }

  @Roles('ADMIN')
  @Delete('departments/:id')
  @HttpCode(204)
  async deleteDepartment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    await this.prisma.department.delete({ where: { id } }).catch((e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') throw new ConflictException('Este setor ainda está em uso em outro cadastro. Mova o que estiver ligado a ele para outro setor antes de excluir.');
      throw e;
    });
    await this.audit.log(u.id, 'excluir', 'Department', id);
  }

  /**
   * Senha definida pela TI: sempre troca no primeiro acesso. Com "senha provisória simples" aceita uma senha curta,
   * mas a sessão só serve para trocar a senha (AuthGuard) e ela vence em SENHA_PROVISORIA_DIAS dias.
   */
  private async senhaInicial(password: string, simples?: boolean) {
    if (simples && password.length < SENHA_PROVISORIA_MIN) throw new BadRequestException(SENHA_PROVISORIA_MESSAGE);
    return {
      passwordHash: await this.auth.hashPassword(password),
      mustChangePassword: true,
      senhaProvisoria: !!simples,
      senhaProvisoriaAte: simples ? new Date(Date.now() + SENHA_PROVISORIA_DIAS * 86_400_000) : null,
    };
  }

  @Roles('ADMIN')
  @Get('admin/users')
  list(@Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { username: { contains: q } }] } : {},
      select: PUBLIC_FIELDS,
      orderBy: { name: 'asc' },
    });
  }

  @Roles('ADMIN')
  @Post('admin/users')
  async create(@Body() dto: UserDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    if (!dto.password) throw new BadRequestException('Informe uma senha inicial');
    const data = await this.dadosDoCadastro(dto);
    const user = await this.prisma.user.create({
      data: { ...data, groups: { connect: (dto.groupIds ?? []).map((id) => ({ id })) }, ...(await this.senhaInicial(dto.password, dto.senhaSimples)) },
      select: PUBLIC_FIELDS,
    });
    await this.audit.log(u.id, 'criar', 'User', user.id, { email: user.email, perfil: user.profile?.name, roles: user.roles, validoAte: user.validUntil, senhaProvisoria: !!dto.senhaSimples }, ip);
    return user;
  }

  /** Converte o formulário em dados do usuário: nome completo, permissões do perfil, validade e e-mail dos chamados. */
  private async dadosDoCadastro(dto: UserDto) {
    const [profile, category] = await Promise.all([
      this.prisma.accessProfile.findUnique({ where: { id: dto.profileId } }),
      this.prisma.userCategory.findUnique({ where: { id: dto.categoryId } }),
    ]);
    if (!profile) throw new BadRequestException('Perfil não encontrado');
    if (!category) throw new BadRequestException('Categoria não encontrada');
    if (!profile.roles.length) throw new BadRequestException('O perfil escolhido não tem nenhuma permissão');
    if (dto.groupIds?.length && (await this.prisma.orgGroup.count({ where: { id: { in: dto.groupIds } } })) !== new Set(dto.groupIds).size) {
      throw new BadRequestException('Grupo não encontrado');
    }
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    if (!firstName || !lastName) throw new BadRequestException('Informe o nome e o sobrenome');
    const ticketEmail = dto.ticketEmail?.trim().toLowerCase() || null;
    return {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.slice(0, 120),
      email: dto.email.trim().toLowerCase(),
      username: dto.username,
      phone: dto.phone,
      extension: dto.extension,
      jobTitle: dto.jobTitle,
      departmentId: dto.departmentId ?? null,
      profileId: profile.id,
      roles: profile.roles,
      categoryId: category.id,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      ticketEmail: ticketEmail === dto.email.trim().toLowerCase() ? null : ticketEmail,
      ticketEmailOn: dto.ticketEmailOn ?? true,
      active: dto.active,
      avatarUrl: dto.avatarUrl,
    };
  }

  /** O próprio colaborador troca ou remove a foto do perfil. */
  @Patch('me/avatar')
  async myAvatar(@Body() dto: AvatarDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const avatarUrl = dto.avatarUrl ?? null;
    await this.prisma.user.update({ where: { id: u.id }, data: { avatarUrl } });
    await this.audit.log(u.id, 'editar', 'User', u.id, { foto: avatarUrl ? 'alterada' : 'removida' }, ip);
    return { avatarUrl };
  }

  @Roles('ADMIN')
  @Patch('admin/users/:id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UserDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const data = await this.dadosDoCadastro(dto);
    const vencida = !!data.validUntil && data.validUntil <= new Date();
    if (id === u.id && (data.active === false || !data.roles.includes('ADMIN') || vencida)) {
      throw new BadRequestException('Você não pode remover seu próprio acesso de administrador');
    }
    const antes = await this.prisma.user.findUnique({ where: { id }, select: { roles: true } });
    if (!antes) throw new NotFoundException();
    if (antes.roles.includes('ADMIN') && (!data.roles.includes('ADMIN') || data.active === false || vencida)) await garantirOutroAdmin(this.prisma, [id]);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        groups: { set: (dto.groupIds ?? []).map((g) => ({ id: g })) },
        ...(dto.password ? await this.senhaInicial(dto.password, dto.senhaSimples) : {}),
      },
      select: PUBLIC_FIELDS,
    });
    if (dto.password || data.active === false || vencida) {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log(u.id, 'editar', 'User', id, { perfil: user.profile?.name, roles: user.roles, active: user.active, validoAte: user.validUntil, senhaRedefinida: !!dto.password, senhaProvisoria: !!dto.password && !!dto.senhaSimples }, ip);
    return user;
  }

  /** Remove o 2FA de um usuário que perdeu o celular. */
  @Roles('ADMIN')
  @Post('admin/users/:id/reset-2fa')
  @HttpCode(204)
  async reset2fa(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    await this.prisma.user.update({ where: { id }, data: { totpEnabled: false, totpSecret: null } });
    await this.audit.log(u.id, '2fa.redefinido', 'User', id, undefined, ip);
  }

  @Roles('ADMIN')
  @Get('admin/audit')
  auditLog(@Query('entity') entity?: string, @Query('take') take = '200') {
    return this.prisma.auditLog.findMany({
      where: entity ? { entity } : {},
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(take) || 200, 1000),
    });
  }
}

@Module({ controllers: [UsersController, CadastrosController, UsuariosCsvController] })
export class UsersModule {}
