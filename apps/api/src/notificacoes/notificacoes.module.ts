import { Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const toInt = (v: unknown, def: number, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : def;
};

/** Regras de público e vigência dos avisos. */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** Filtro dos avisos que o usuário pode ver agora (gerais, do setor, do perfil e pessoais). */
  async visibleWhere(userId: string): Promise<Prisma.NotificationWhereInput> {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { active: true, departmentId: true, roles: true } });
    if (!me || !me.active) throw new UnauthorizedException();
    const now = new Date();
    return {
      startsAt: { lte: now },
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        { OR: [{ userId: null }, { userId }] },
        { OR: [{ departmentId: null }, ...(me.departmentId ? [{ departmentId: me.departmentId }] : [])] },
        { OR: [{ role: null }, ...(me.roles.length ? [{ role: { in: me.roles } }] : [])] },
      ],
    };
  }
}

const shape = (n: Notification & { reads?: { userId: string }[] }) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  link: n.link,
  level: n.level,
  system: n.system,
  startsAt: n.startsAt,
  endsAt: n.endsAt,
  createdAt: n.createdAt,
  read: !!n.reads?.length,
});

@Controller()
export class NotificacoesController {
  constructor(private prisma: PrismaService, private svc: NotificationsService) {}

  // ───────── usuário logado ─────────

  @Get('notificacoes')
  async list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('nivel') nivel?: string, @Query('page') page?: string, @Query('limite') limite?: string) {
    const base = await this.svc.visibleWhere(u.id);
    const levels = (nivel ?? '').split(',').filter((l) => ['INFO', 'IMPORTANTE', 'URGENTE'].includes(l)) as Notification['level'][];
    const where: Prisma.NotificationWhereInput = {
      ...base,
      ...(status === 'nao-lidas' ? { reads: { none: { userId: u.id } } } : {}),
      ...(levels.length ? { level: { in: levels } } : {}),
    };
    const take = toInt(limite, 20, 50);
    const [total, unread] = await Promise.all([this.prisma.notification.count({ where }), this.prisma.notification.count({ where: { ...base, reads: { none: { userId: u.id } } } })]);
    const pages = Math.max(1, Math.ceil(total / take));
    const p = Math.min(toInt(page, 1), pages);
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      skip: (p - 1) * take,
      take,
      include: { reads: { where: { userId: u.id }, select: { userId: true } } },
    });
    return { items: rows.map(shape), total, unread, page: p, pages };
  }

  @Get('notificacoes/nao-lidas')
  async unread(@CurrentUser() u: AuthUser) {
    const base = await this.svc.visibleWhere(u.id);
    return { count: await this.prisma.notification.count({ where: { ...base, reads: { none: { userId: u.id } } } }) };
  }

  @Post('notificacoes/lidas')
  @HttpCode(200)
  async readAll(@CurrentUser() u: AuthUser) {
    const base = await this.svc.visibleWhere(u.id);
    const ids = await this.prisma.notification.findMany({ where: { ...base, reads: { none: { userId: u.id } } }, select: { id: true } });
    if (ids.length) await this.prisma.notificationRead.createMany({ data: ids.map((n) => ({ notificationId: n.id, userId: u.id })), skipDuplicates: true });
    return { marked: ids.length };
  }

  @Post('notificacoes/:id/lida')
  @HttpCode(200)
  async read(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const base = await this.svc.visibleWhere(u.id);
    const n = await this.prisma.notification.findFirst({ where: { ...base, id }, select: { id: true } });
    if (!n) throw new NotFoundException('Aviso não encontrado');
    await this.prisma.notificationRead.createMany({ data: [{ notificationId: id, userId: u.id }], skipDuplicates: true });
    return { ok: true };
  }
}

/** Avisos do sistema para o usuário logado (os chamados criam avisos em common/notify.ts). */
@Module({ controllers: [NotificacoesController], providers: [NotificationsService] })
export class NotificacoesModule {}
