import { Controller, Get, Module } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { staffSectors } from '../tickets/sectors';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  /** Números do painel inicial do administrador. */
  @Roles('TI', 'MANUTENCAO', 'INFRAESTRUTURA', 'COMUNICACAO')
  @Get('overview')
  async overview(@CurrentUser() u: AuthUser) {
    // chamados: só as filas que o usuário atende
    const sector = { in: staffSectors(u) };
    const abertos = ['NOVO', 'EM_ATENDIMENTO', 'AGUARDANDO_USUARIO'] as const;
    const [users, openTickets, overdue] = await Promise.all([
      this.prisma.user.count({ where: { active: true } }),
      this.prisma.ticket.count({ where: { sector, status: { in: [...abertos] } } }),
      this.prisma.ticket.count({ where: { sector, status: { in: [...abertos] }, dueAt: { lt: new Date() } } }),
    ]);
    return { users, openTickets, overdue };
  }
}

@Module({ controllers: [AdminController] })
export class AdminModule {}
