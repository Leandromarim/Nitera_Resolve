import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Prisma, TicketSector } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Public, Roles } from '../common/decorators';
import { WhatsappService } from '../integrations/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto, CommentDto, PortalTicketDto, ProrrogarDto, RateDto, UpdateTicketDto } from './dto';
import { InboundService } from './inbound.service';
import { ReportFilter, ReportsService } from './reports.service';
import { TicketsService } from './tickets.service';
import { VersionsService } from '../versions/versions.service';
import { TvPanelController } from './tv.controller';
import { FilesService } from '../files/files.service';
import { acompanhadas, checkCategoryExtra } from './config';
import { ChamadosConfigController, checkPublicImages, loadCategoryExtras, saveCategoryExtra } from './config.controller';
import { isStaffOf, parseSector, scopeSectors, SECTOR_ROLE, staffSectors, TICKET_STAFF_ROLES } from './sectors';

/** Nome de categoria é único entre todos os setores. */
function uniqueName(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new ConflictException('Já existe uma categoria com esse nome (em algum setor). Use um nome diferente, por exemplo com o setor entre parênteses.');
  }
  throw e;
}

@Controller('tickets')
export class TicketsController {
  constructor(
    private tickets: TicketsService,
    private reports: ReportsService,
    private prisma: PrismaService,
    private audit: AuditService,
    private versions: VersionsService,
    private files: FilesService,
  ) {}

  /** Separa o ícone e as dicas (guardados à parte) e valida. */
  private async splitExtra(dto: CategoryDto) {
    const { icon, imageId, tips, ...rest } = dto;
    const touched = icon !== undefined || imageId !== undefined || tips !== undefined;
    const errors: string[] = [];
    const extra = checkCategoryExtra(icon, imageId, tips, errors);
    if (errors.length) throw new BadRequestException(errors);
    if (extra?.imageId) await checkPublicImages(this.prisma, [extra.imageId]);
    return { rest, extra, touched };
  }

  /** Junta ícone, imagem e dicas configurados a cada categoria. */
  private async withExtras<T extends { id: string }>(cats: T[]) {
    const extras = await loadCategoryExtras(this.prisma, this.files);
    return cats.map((c) => ({ ...c, icon: extras[c.id]?.icon ?? null, imageId: extras[c.id]?.imageId ?? null, image: extras[c.id]?.image ?? null, tips: extras[c.id]?.tips ?? [] }));
  }

  /** Setores do usuário para a consulta pedida; 403 se pedir um setor que não atende. */
  private scope(u: AuthUser, setor?: string): TicketSector[] {
    const sectors = scopeSectors(u, parseSector(setor));
    if (!sectors) throw new ForbiddenException('Você não atende chamados deste setor.');
    return sectors;
  }

  private async categoryOf(id: string, u: AuthUser) {
    const c = await this.prisma.ticketCategory.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Categoria não encontrada.');
    if (!isStaffOf(u, c.sector)) throw new ForbiddenException('Você só pode alterar categorias do seu setor.');
    return c;
  }

  /** Categorias ativas para o formulário de abertura (filtradas por setor com ?setor=). */
  @Get('categories')
  async categories(@Query('setor') setor?: string) {
    const sector = parseSector(setor);
    return this.withExtras(await this.prisma.ticketCategory.findMany({ where: { active: true, ...(sector ? { sector } : {}) }, orderBy: { name: 'asc' } }));
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Get('admin/categories')
  async allCategories(@CurrentUser() u: AuthUser, @Query('setor') setor?: string) {
    return this.withExtras(
      await this.prisma.ticketCategory.findMany({
        where: { sector: { in: this.scope(u, setor) } },
        orderBy: { name: 'asc' },
        include: { _count: { select: { tickets: true } } },
      }),
    );
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Post('admin/categories')
  async createCategory(@Body() dto: CategoryDto, @CurrentUser() u: AuthUser) {
    const sector = dto.sector ?? 'TI';
    if (!isStaffOf(u, sector)) throw new ForbiddenException('Você só pode criar categorias do seu setor.');
    const { rest, extra } = await this.splitExtra(dto);
    const data = { ...rest, name: dto.name.trim(), sector };
    if (!data.name) throw new BadRequestException('Informe o nome da categoria.');
    const c = await this.prisma.ticketCategory.create({ data }).catch(uniqueName);
    await this.versions.record('TicketCategory', c.id, 'criar', u);
    await this.audit.log(u.id, 'criar', 'TicketCategory', c.id, data);
    if (extra) await saveCategoryExtra(this.prisma, this.versions, this.audit, c.id, extra, u);
    return c;
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Patch('admin/categories/:id')
  async updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryDto, @CurrentUser() u: AuthUser) {
    const cur = await this.categoryOf(id, u);
    if (dto.sector && dto.sector !== cur.sector) throw new BadRequestException('Não é possível mudar o setor de uma categoria. Crie uma nova categoria no outro setor.');
    const { rest: fields, extra, touched } = await this.splitExtra(dto);
    const { sector: _s, ...rest } = fields;
    const data = { ...rest, name: dto.name.trim() };
    if (!data.name) throw new BadRequestException('Informe o nome da categoria.');
    const c = await this.prisma.ticketCategory.update({ where: { id }, data }).catch(uniqueName);
    await this.versions.record('TicketCategory', id, 'editar', u);
    await this.audit.log(u.id, 'editar', 'TicketCategory', id, data);
    // só mexe no ícone/dicas quando o painel enviou esses campos (o botão Ativa/Inativa não envia)
    if (touched) await saveCategoryExtra(this.prisma, this.versions, this.audit, id, extra, u);
    return c;
  }

  /**
   * Exclui a categoria. Se ela já tem chamados:
   * - com `?moverPara=<id>` (outra categoria do mesmo setor) os chamados passam para ela e a categoria é apagada;
   * - sem `moverPara` ela só é desativada, para não perder o histórico.
   */
  @Roles(...TICKET_STAFF_ROLES)
  @Delete('admin/categories/:id')
  @HttpCode(204)
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Query('moverPara') moverPara?: string) {
    const cur = await this.categoryOf(id, u);
    let destino: { id: string; name: string } | null = null;
    if (moverPara) {
      if (!/^[0-9a-f-]{36}$/i.test(moverPara) || moverPara === id) throw new BadRequestException('Escolha outra categoria para receber os chamados.');
      const d = await this.prisma.ticketCategory.findUnique({ where: { id: moverPara } });
      if (!d || d.sector !== cur.sector) throw new BadRequestException('A categoria que recebe os chamados precisa ser do mesmo setor.');
      destino = { id: d.id, name: d.name };
    }
    await this.versions.record('TicketCategory', id, 'excluir', u);
    const used = await this.prisma.ticket.count({ where: { categoryId: id } });
    if (used && !destino) {
      await this.prisma.ticketCategory.update({ where: { id }, data: { active: false } });
      await this.audit.log(u.id, 'desativar', 'TicketCategory', id);
      return;
    }
    await this.prisma.$transaction([
      ...(used && destino ? [this.prisma.ticket.updateMany({ where: { categoryId: id }, data: { categoryId: destino.id } })] : []),
      this.prisma.ticketCategory.delete({ where: { id } }),
    ]);
    await saveCategoryExtra(this.prisma, this.versions, this.audit, id, null, u).catch(() => undefined);
    await this.audit.log(u.id, 'excluir', 'TicketCategory', id, { nome: cur.name, chamadosMovidos: used, para: destino?.name ?? null });
  }

  /** Técnicos que podem ser responsáveis: perfil do setor (ou dos setores do usuário) e ADMIN. */
  @Roles(...TICKET_STAFF_ROLES)
  @Get('technicians')
  async technicians(@CurrentUser() u: AuthUser, @Query('setor') setor?: string, @Query('misto') misto?: string) {
    // equipe acompanhada (só leitura) também lista os técnicos, para o filtro por responsável
    const pedido = parseSector(setor);
    const acompanha = pedido && !isStaffOf(u, pedido) && (await acompanhadas(this.prisma, u)).includes(pedido);
    const setores = acompanha ? [pedido] : [...this.scope(u, setor)];
    if (!pedido && misto === '1') setores.push(...(await acompanhadas(this.prisma, u)));
    const roles = [...new Set(setores)].map((s) => SECTOR_ROLE[s]);
    const users = await this.prisma.user.findMany({
      where: { active: true, roles: { hasSome: [...roles, 'ADMIN'] } },
      select: { id: true, name: true, avatarUrl: true, roles: true },
      orderBy: { name: 'asc' },
    });
    return users.map(({ roles: r, ...x }) => ({ ...x, sectors: staffSectors({ roles: r }) }));
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Get('reports/summary')
  summary(@Query() f: ReportFilter, @CurrentUser() u: AuthUser) {
    return this.reports.summary(f, this.scope(u, f.setor));
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Get('reports/export')
  async export(@Query() f: ReportFilter & { format?: string }, @Res() res: Response, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const sectors = this.scope(u, f.setor);
    const stamp = new Date().toISOString().slice(0, 10);
    await this.audit.log(u.id, 'exportar', 'Relatorio', null, { ...f, setores: sectors }, ip);
    if (f.format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="chamados-${stamp}.xlsx"`);
      return res.send(await this.reports.xlsx(f, sectors));
    }
    if (f.format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="chamados-${stamp}.pdf"`);
      return res.send(await this.reports.pdf(f, sectors));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chamados-${stamp}.csv"`);
    return res.send(await this.reports.csv(f, sectors));
  }

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: Record<string, string>) {
    return this.tickets.list(u, q);
  }

  @Post()
  create(@Body() dto: PortalTicketDto, @CurrentUser() u: AuthUser) {
    return this.tickets.create(dto, u);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.tickets.get(id, u);
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto, @CurrentUser() u: AuthUser) {
    return this.tickets.update(id, dto, u);
  }

  @Post(':id/comments')
  comment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto, @CurrentUser() u: AuthUser) {
    return this.tickets.comment(id, dto, u);
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Post(':id/prorrogar')
  prorrogar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ProrrogarDto, @CurrentUser() u: AuthUser) {
    return this.tickets.prorrogar(id, dto, u);
  }

  @Post(':id/rate')
  rate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RateDto, @CurrentUser() u: AuthUser) {
    return this.tickets.rate(id, dto.rating, dto.comment, u);
  }
}

/** Webhook da WhatsApp Cloud API: GET para verificação, POST para mensagens recebidas. */
@Controller('webhooks/whatsapp')
@SkipThrottle()
export class WhatsappWebhookController {
  constructor(private inbound: InboundService, private whatsapp: WhatsappService, private prisma: PrismaService) {}

  @Public()
  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string, @Res() res: Response) {
    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).type('text/plain').send(challenge);
    return res.sendStatus(403);
  }

  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }, @Body() body: any) {
    if (!this.whatsapp.verifySignature(req.rawBody, req.headers['x-hub-signature-256'] as string)) throw new ForbiddenException();
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        // a mesma conta do WhatsApp Business pode ter outros números (ex.: o atendimento ao paciente de outro sistema):
        // só o número configurado para os chamados é tratado; o resto é ignorado
        if (!value?.metadata?.phone_number_id || String(value.metadata.phone_number_id) !== process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
        const contacts: any[] = value?.contacts ?? [];
        for (const m of value?.messages ?? []) {
          const name = contacts.find((c) => c.wa_id === m.from)?.profile?.name;
          const media = m.image ?? m.document ?? m.audio ?? m.video;
          await this.inbound
            .handleWhatsapp({
              id: m.id,
              from: m.from,
              name,
              text: m.text?.body ?? media?.caption ?? m.button?.text ?? m.interactive?.list_reply?.title ?? m.interactive?.button_reply?.title,
              choiceId: m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id,
              mediaId: media?.id,
              mediaName: m.document?.filename,
            })
            .catch(() => undefined);
        }
      }
    }
    return { ok: true };
  }
}

@Module({
  // ChamadosConfigController antes de TicketsController: GET /tickets/config não pode cair em GET /tickets/:id
  controllers: [ChamadosConfigController, TicketsController, WhatsappWebhookController, TvPanelController],
  providers: [TicketsService, ReportsService, InboundService],
  exports: [TicketsService],
})
export class TicketsModule {}
