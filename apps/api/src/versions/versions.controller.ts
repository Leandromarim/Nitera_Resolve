import { Controller, ForbiddenException, Get, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Roles } from '../common/decorators';
import { VERSIONED, VersionsService } from './versions.service';

/** Quem pode ver e restaurar o histórico de cada tipo (ADMIN sempre pode). */
const ENTITY_ROLES: Record<string, Role[]> = {
  TicketCategory: ['TI', 'INFRAESTRUTURA', 'MANUTENCAO', 'COMUNICACAO'],
};
const SETTING_ROLES: Record<string, Role[]> = {
  mensagens: ['TI', 'COMUNICACAO'],
  chamados: ['TI'],
  chamadosCategorias: ['TI', 'INFRAESTRUTURA', 'MANUTENCAO', 'COMUNICACAO'],
};
/** Configuração fora da lista (configurações gerais, manutenção, acesso…) só o administrador vê e restaura. */
const rolesDe = (entity: string, entityId?: string): Role[] =>
  entity === 'Setting' ? (entityId && SETTING_ROLES[entityId]) || [] : ENTITY_ROLES[entity] ?? [];

@Controller('admin/versions')
@Roles('TI', 'MANUTENCAO', 'INFRAESTRUTURA', 'COMUNICACAO')
export class VersionsController {
  constructor(private versions: VersionsService, private audit: AuditService, private prisma: PrismaService) {}

  private allowed(u: AuthUser, entity: string, entityId?: string) {
    if (u.roles.includes('ADMIN')) return;
    if (!rolesDe(entity, entityId).some((r) => u.roles.includes(r))) throw new ForbiddenException('Seu perfil não tem acesso a este histórico.');
  }

  /** Lista sem filtro: só os tipos de conteúdo que o perfil pode ver. */
  private visiveis(u: AuthUser): Prisma.RevisionWhereInput | undefined {
    if (u.roles.includes('ADMIN')) return undefined;
    const tem = (roles: Role[]) => roles.some((r) => u.roles.includes(r));
    return {
      OR: [
        { entity: { in: VERSIONED.filter((e) => e !== 'Setting' && tem(rolesDe(e))) } },
        { entity: 'Setting', entityId: { in: Object.keys(SETTING_ROLES).filter((k) => tem(SETTING_ROLES[k])) } },
      ],
    };
  }

  private async allowedRevision(u: AuthUser, id: string) {
    const r = await this.prisma.revision.findUnique({ where: { id }, select: { entity: true, entityId: true } });
    if (!r) throw new NotFoundException('Versão não encontrada.');
    this.allowed(u, r.entity, r.entityId);
  }

  @Get('revisions')
  revisions(@Query() q: { entity?: string; entityId?: string; take?: string; skip?: string }, @CurrentUser() u: AuthUser) {
    if (q.entity && q.entityId) this.allowed(u, q.entity, q.entityId);
    return this.versions.list(q, this.visiveis(u));
  }

  @Get('revisions/:id')
  async revision(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    await this.allowedRevision(u, id);
    return this.versions.get(id);
  }

  @Post('revisions/:id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    await this.allowedRevision(u, id);
    const r = await this.versions.restoreRevision(id, u);
    await this.audit.log(u.id, 'restaurar_revisao', 'Revision', id, undefined, ip);
    return r;
  }
}

@Module({ controllers: [VersionsController] })
export class VersionsModule {}
