import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Ticket, TicketChannel, TicketPriority, TicketSector, TicketStatus } from '@prisma/client';
import { AuthUser } from '../common/decorators';
import { stripTags } from '../common/sanitize';
import { FilesService } from '../files/files.service';
import { MailService } from '../integrations/mail.service';
import { WhatsappService } from '../integrations/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { renderMensagem } from '../mensagens/mensagens.service';
import { acompanhadas, chamadosRules, sectorTexts } from './config';
import { CommentDto, CreateTicketDto, ProrrogarDto, UpdateTicketDto } from './dto';
import { isStaff, isStaffOf, parseSector, scopeSectors, SECTOR_LABEL, SECTOR_ROLE } from './sectors';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  NOVO: 'Novo',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_USUARIO: 'Aguardando você',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
  CANCELADO: 'Cancelado',
};
export const OPEN_STATUSES: TicketStatus[] = ['NOVO', 'EM_ATENDIMENTO', 'AGUARDANDO_USUARIO'];
// multiplicador do SLA por prioridade, SLA padrão e setor padrão dos canais: Painel › Categorias e SLA (config.ts)

export { isStaff, isStaffOf, staffSectors } from './sectors';

const TICKET_INCLUDE = {
  category: { select: { id: true, name: true, slaHours: true, sector: true } },
  department: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, email: true, phone: true, extension: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.TicketInclude;

export interface ExternalRequester {
  name?: string;
  email?: string;
  phone?: string;
}

/** Notas até esta (de 1 a 5) precisam de motivo na avaliação do chamado. */
export const NOTA_BAIXA = 2;

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService, private files: FilesService, private whatsapp: WhatsappService, private mail: MailService) {}

  /** Confere se a categoria existe, está ativa e pertence ao setor. */
  private async checkCategory(categoryId: string, sector: TicketSector) {
    const cat = await this.prisma.ticketCategory.findUnique({ where: { id: categoryId } });
    if (!cat || !cat.active) throw new BadRequestException('Categoria não encontrada ou desativada.');
    if (cat.sector !== sector) throw new BadRequestException(`A categoria "${cat.name}" não pertence ao setor ${SECTOR_LABEL[sector]}.`);
    return cat;
  }

  /** Pode ser responsável: ativo e atende o setor (perfil do setor ou ADMIN). */
  private async podeSerResponsavel(userId: string, sector: TicketSector) {
    return !!(await this.prisma.user.findFirst({ where: { id: userId, active: true, roles: { hasSome: [SECTOR_ROLE[sector], 'ADMIN'] } }, select: { id: true } }));
  }

  /** O responsável precisa estar ativo e atender o setor (perfil do setor ou ADMIN). */
  private async checkAssignee(assigneeId: string, sector: TicketSector) {
    const a = await this.prisma.user.findFirst({ where: { id: assigneeId, active: true, roles: { hasSome: [SECTOR_ROLE[sector], 'ADMIN'] } }, select: { id: true } });
    if (!a) throw new BadRequestException(`O responsável escolhido não atende chamados de ${SECTOR_LABEL[sector]}.`);
  }

  /** Prazo pelo SLA da categoria e pela prioridade, mais as horas das prorrogações já feitas. */
  private async dueAt(categoryId: string | undefined | null, priority: TicketPriority, from = new Date(), prorrogadoHoras = 0) {
    const cat = categoryId ? await this.prisma.ticketCategory.findUnique({ where: { id: categoryId } }) : null;
    const rules = await chamadosRules(this.prisma);
    const hours = (cat?.slaHours ?? rules.defaultSlaHours) * rules.slaFactor[priority] + prorrogadoHoras;
    return new Date(from.getTime() + hours * 3_600_000);
  }

  async create(dto: CreateTicketDto, user: AuthUser | null, channel: TicketChannel = 'PORTAL', external?: ExternalRequester) {
    // qualquer pessoa da equipe de atendimento pode registrar em nome de alguém, em qualquer setor
    const staff = isStaff(user);
    const rules = await chamadosRules(this.prisma);
    const sector: TicketSector = dto.sector ?? (channel === 'WHATSAPP' ? rules.whatsappSector : channel === 'EMAIL' ? rules.emailSector : 'TI');
    if (dto.categoryId) await this.checkCategory(dto.categoryId, sector);
    const priority = dto.priority ?? 'MEDIA';
    let requesterId: string | null = user?.id ?? null;
    if (staff && dto.requesterId) requesterId = dto.requesterId;
    if (staff && (dto.requesterName || dto.requesterPhone) && !dto.requesterId) requesterId = null;

    // vincula ao cadastro quando o telefone/e-mail externo pertence a um colaborador
    if (!requesterId && (external?.phone || external?.email)) {
      const match = await this.findUserByContact(external.phone, external.email);
      requesterId = match?.id ?? null;
    }
    const requester = requesterId ? await this.prisma.user.findUnique({ where: { id: requesterId } }) : null;

    const ticket = await this.prisma.ticket.create({
      data: {
        title: stripTags(dto.title),
        description: stripTags(dto.description),
        sector,
        priority,
        channel: staff && dto.channel ? dto.channel : channel,
        categoryId: dto.categoryId,
        departmentId: dto.departmentId ?? requester?.departmentId ?? undefined,
        location: dto.location,
        requesterId,
        requesterName: requester?.name ?? external?.name ?? dto.requesterName,
        requesterEmail: requester ? requester.ticketEmail || (requester.email.endsWith('@sem-email.invalid') ? null : requester.email) : external?.email,
        requesterPhone: external?.phone ?? dto.requesterPhone ?? requester?.phone,
        requesterExtension: dto.extension?.trim() || requester?.extension || null,
        dueAt: await this.dueAt(dto.categoryId, priority),
        events: { create: { actorId: user?.id, type: 'criado', to: 'NOVO' } },
      },
      include: TICKET_INCLUDE,
    });
    if (dto.fileId) {
      const f = await this.prisma.fileAsset.findUnique({ where: { id: dto.fileId } });
      if (f && f.uploadedById === user?.id) {
        await this.prisma.ticketComment.create({
          data: { ticketId: ticket.id, authorId: user?.id, body: 'Anexo enviado na abertura', fileId: f.id, fileName: f.originalName },
        });
      }
    }
    return ticket;
  }

  async findUserByContact(phone?: string, email?: string) {
    if (email) {
      const u = await this.prisma.user.findFirst({ where: { email: email.toLowerCase(), active: true } });
      if (u) return u;
    }
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      const tail = digits.slice(-8); // compara os 8 últimos dígitos (ignora DDI/DDD/9º dígito)
      const candidates = await this.prisma.user.findMany({ where: { active: true, phone: { not: null } }, select: { id: true, phone: true, name: true, email: true, departmentId: true } });
      return candidates.find((c) => c.phone!.replace(/\D/g, '').endsWith(tail)) ?? null;
    }
    return null;
  }

  async list(user: AuthUser, q: Record<string, string | undefined>) {
    const where: Prisma.TicketWhereInput = {};
    const setor = parseSector(q.setor);
    if (!isStaff(user) || q.mine === '1') {
      // chamados que a própria pessoa abriu, de qualquer setor
      where.requesterId = user.id;
      if (setor) where.sector = setor;
    } else {
      // fila de atendimento: só os setores que a pessoa atende; outra equipe só se ela a acompanha (leitura)
      let sectors = scopeSectors(user, setor);
      if (!sectors && setor && (await acompanhadas(this.prisma, user)).includes(setor)) sectors = [setor];
      // painel misto: a própria fila e as equipes acompanhadas juntas (as acompanhadas continuam só leitura)
      else if (sectors && !setor && q.misto === '1') sectors = [...new Set([...sectors, ...(await acompanhadas(this.prisma, user))])];
      if (!sectors) throw new ForbiddenException('Você não atende chamados deste setor.');
      where.sector = { in: sectors };
    }
    if (q.status) where.status = { in: q.status.split(',') as TicketStatus[] };
    if (q.open === '1') where.status = { in: OPEN_STATUSES };
    if (q.priority) where.priority = q.priority as TicketPriority;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.assigneeId) where.assigneeId = q.assigneeId === 'none' ? null : q.assigneeId;
    if (q.channel) where.channel = q.channel as TicketChannel;
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: endOfDay(q.to) } : {}) };
    if (q.q) {
      const n = Number(q.q.replace('#', ''));
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { requesterName: { contains: q.q, mode: 'insensitive' } },
        ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
      ];
    }
    const take = Math.min(Number(q.take) || 50, 500);
    const skip = Number(q.skip) || 0;
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({ where, include: TICKET_INCLUDE, orderBy: [{ createdAt: 'desc' }], take, skip }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string, user: AuthUser) {
    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...TICKET_INCLUDE,
        comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, roles: true } } } },
        events: { orderBy: { createdAt: 'asc' } },
        prorrogacoes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!t) throw new NotFoundException('Chamado não encontrado');
    const staff = isStaffOf(user, t.sector);
    // equipe que acompanha o setor do chamado: vê sem atender e sem as notas internas
    const acompanhando = !staff && (await acompanhadas(this.prisma, user)).includes(t.sector);
    if (!staff && !acompanhando && t.requesterId !== user.id) throw new ForbiddenException('Você não tem acesso a este chamado.');
    return {
      ...t,
      /** quem vê pode atender (staff do setor do chamado) */
      canManage: staff,
      acompanhando,
      comments: t.comments
        .filter((c) => staff || !c.internal)
        .map((c) => ({ ...c, fileUrl: c.fileId ? this.files.urlFor(c.fileId, false) : null })),
      events: staff || acompanhando ? t.events : [],
      // justificativa e evidências são da equipe: o solicitante vê só o prazo novo
      prorrogacoes:
        staff || acompanhando
          ? t.prorrogacoes.map((p) => ({ ...p, arquivos: arquivosDe(p.arquivos).map((a) => ({ ...a, url: this.files.urlFor(a.id, false) })) }))
          : [],
    };
  }

  /** Aumenta o prazo do chamado aberto, com justificativa e evidências; só a equipe do setor. */
  async prorrogar(id: string, dto: ProrrogarDto, user: AuthUser) {
    const t = await this.prisma.ticket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Chamado não encontrado');
    if (!isStaffOf(user, t.sector)) throw new ForbiddenException('Você não atende chamados deste setor.');
    if (!OPEN_STATUSES.includes(t.status) || !t.dueAt) throw new BadRequestException('Só é possível aumentar o prazo de um chamado aberto.');
    const justificativa = stripTags(dto.justificativa).trim();
    if (justificativa.length < 10) throw new BadRequestException('Explique o motivo da prorrogação (mínimo 10 caracteres).');
    if (t.prorrogadoHoras + dto.horas > PRORROGACAO_MAX_HORAS) {
      throw new BadRequestException(`O prazo deste chamado já foi aumentado em ${t.prorrogadoHoras} h; o total não pode passar de ${PRORROGACAO_MAX_HORAS / 24} dias.`);
    }
    const ids = [...new Set(dto.fileIds ?? [])];
    const files = ids.length ? await this.prisma.fileAsset.findMany({ where: { id: { in: ids } }, select: { id: true, originalName: true, uploadedById: true } }) : [];
    // só vale arquivo que a própria pessoa acabou de enviar
    if (files.length !== ids.length || files.some((f) => f.uploadedById !== user.id)) throw new BadRequestException('Evidência inválida. Envie o arquivo de novo.');
    const arquivos = ids.map((fid) => ({ id: fid, name: files.find((f) => f.id === fid)!.originalName }));
    const prazoNovo = new Date(t.dueAt.getTime() + dto.horas * 3_600_000);

    const [updated] = await this.prisma.$transaction([
      this.prisma.ticket.update({ where: { id }, data: { dueAt: prazoNovo, prorrogadoHoras: { increment: dto.horas } }, include: TICKET_INCLUDE }),
      this.prisma.ticketProrrogacao.create({
        data: { ticketId: id, authorId: user.id, authorName: user.name, horas: dto.horas, prazoAnterior: t.dueAt, prazoNovo, justificativa, arquivos },
      }),
      this.prisma.ticketEvent.create({ data: { ticketId: id, actorId: user.id, type: 'prazo', from: t.dueAt.toISOString(), to: prazoNovo.toISOString() } }),
    ]);
    if (dto.avisar) {
      const prazo = prazoNovo.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
      await this.notifyRequester(updated, 'chamados.prazo', { prazo }).catch(() => undefined);
    }
    return updated;
  }

  async update(id: string, dto: UpdateTicketDto, user: AuthUser) {
    const t = await this.prisma.ticket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Chamado não encontrado');
    if (!isStaffOf(user, t.sector)) throw new ForbiddenException('Você não atende chamados deste setor.');
    if (dto.sector && dto.sector !== t.sector) return this.transfer(t, dto, user);

    const { sector: _sector, ...rest } = dto;
    const data: Prisma.TicketUncheckedUpdateInput = { ...rest };
    if (dto.title !== undefined) {
      data.title = stripTags(dto.title).trim();
      if ((data.title as string).length < 3) throw new BadRequestException('O título precisa ter pelo menos 3 caracteres.');
    }
    if (dto.categoryId) await this.checkCategory(dto.categoryId, t.sector);
    if (dto.assigneeId) await this.checkAssignee(dto.assigneeId, t.sector);
    const events: Prisma.TicketEventCreateManyInput[] = [];
    const now = new Date();

    if (dto.status && dto.status !== t.status) {
      events.push({ ticketId: id, actorId: user.id, type: 'status', from: t.status, to: dto.status });
      if (dto.status === 'RESOLVIDO') data.resolvedAt = now;
      if (dto.status === 'FECHADO' || dto.status === 'CANCELADO') data.closedAt = now;
      if (OPEN_STATUSES.includes(dto.status)) {
        data.resolvedAt = null;
        data.closedAt = null;
      }
      if (dto.status === 'EM_ATENDIMENTO' && !t.firstResponseAt) data.firstResponseAt = now;
      // quem atende um chamado sem responsável (em atendimento, aguardando, resolvido ou fechado) passa a ser o responsável
      if (['EM_ATENDIMENTO', 'AGUARDANDO_USUARIO', 'RESOLVIDO', 'FECHADO'].includes(dto.status) && !t.assigneeId && dto.assigneeId === undefined && (await this.podeSerResponsavel(user.id, t.sector))) {
        data.assigneeId = user.id;
        events.push({ ticketId: id, actorId: user.id, type: 'responsavel', from: null, to: user.id });
      }
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== t.assigneeId) {
      events.push({ ticketId: id, actorId: user.id, type: 'responsavel', from: t.assigneeId, to: dto.assigneeId });
    }
    if (dto.priority && dto.priority !== t.priority) {
      events.push({ ticketId: id, actorId: user.id, type: 'prioridade', from: t.priority, to: dto.priority });
      data.dueAt = await this.dueAt(dto.categoryId ?? t.categoryId, dto.priority, t.createdAt, t.prorrogadoHoras);
    } else if (dto.categoryId !== undefined && dto.categoryId !== t.categoryId) {
      data.dueAt = await this.dueAt(dto.categoryId, t.priority, t.createdAt, t.prorrogadoHoras);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.ticket.update({ where: { id }, data, include: TICKET_INCLUDE }),
      this.prisma.ticketEvent.createMany({ data: events }),
    ]);
    if (dto.status && dto.status !== t.status) {
      await this.notifyRequester(updated, 'chamados.status', { status: STATUS_LABEL[dto.status] });
    }
    return updated;
  }

  /**
   * Transfere o chamado para outra fila: mantém a categoria só se ela for do novo setor,
   * recalcula o prazo a partir de agora e devolve o chamado a NOVO, sem responsável.
   */
  private async transfer(t: Ticket, dto: UpdateTicketDto, user: AuthUser) {
    const to = dto.sector!;
    let categoryId: string | null = null;
    if (dto.categoryId) categoryId = (await this.checkCategory(dto.categoryId, to)).id;
    else if (t.categoryId) {
      const cur = await this.prisma.ticketCategory.findUnique({ where: { id: t.categoryId }, select: { sector: true } });
      if (cur?.sector === to) categoryId = t.categoryId;
    }
    const priority = dto.priority ?? t.priority;
    const now = new Date();
    const data: Prisma.TicketUncheckedUpdateInput = {
      sector: to,
      categoryId,
      priority,
      status: 'NOVO',
      assigneeId: null,
      resolvedAt: null,
      closedAt: null,
      dueAt: await this.dueAt(categoryId, priority, now),
      // a nova equipe começa com o prazo cheio; as prorrogações antigas ficam no histórico
      prorrogadoHoras: 0,
    };
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.title !== undefined && stripTags(dto.title).trim().length >= 3) data.title = stripTags(dto.title).trim();

    const events: Prisma.TicketEventCreateManyInput[] = [{ ticketId: t.id, actorId: user.id, type: 'setor', from: t.sector, to }];
    if (t.status !== 'NOVO') events.push({ ticketId: t.id, actorId: user.id, type: 'status', from: t.status, to: 'NOVO' });
    if (t.assigneeId) events.push({ ticketId: t.id, actorId: user.id, type: 'responsavel', from: t.assigneeId, to: null });
    if (priority !== t.priority) events.push({ ticketId: t.id, actorId: user.id, type: 'prioridade', from: t.priority, to: priority });

    const [updated] = await this.prisma.$transaction([
      this.prisma.ticket.update({ where: { id: t.id }, data, include: TICKET_INCLUDE }),
      this.prisma.ticketEvent.createMany({ data: events }),
    ]);
    await this.notifyRequester(updated, 'chamados.encaminhado', { setor: (await sectorTexts(this.prisma))[to].label, equipe: (await sectorTexts(this.prisma))[to].team });
    return updated;
  }

  async comment(id: string, dto: CommentDto, user: AuthUser) {
    const t = await this.prisma.ticket.findUnique({ where: { id }, include: TICKET_INCLUDE });
    if (!t) throw new NotFoundException('Chamado não encontrado');
    const staff = isStaffOf(user, t.sector);
    if (!staff && t.requesterId !== user.id) throw new ForbiddenException('Você não tem acesso a este chamado.');
    if (!staff && dto.internal) throw new ForbiddenException('Só a equipe do setor pode escrever notas internas.');
    let fileName: string | undefined;
    if (dto.fileId) {
      const f = await this.prisma.fileAsset.findUnique({ where: { id: dto.fileId } });
      if (!f || f.uploadedById !== user.id) throw new BadRequestException('Anexo inválido');
      fileName = f.originalName;
    }
    const c = await this.prisma.ticketComment.create({
      data: { ticketId: id, authorId: user.id, authorName: user.name, body: stripTags(dto.body), internal: !!dto.internal, fileId: dto.fileId, fileName },
    });
    const patch: Prisma.TicketUpdateInput = {};
    if (staff && !dto.internal && !t.firstResponseAt) patch.firstResponseAt = new Date();
    // quem responde ao solicitante num chamado sem responsável passa a ser o responsável
    let assumiu = false;
    if (staff && !dto.internal && !t.assigneeId && (await this.podeSerResponsavel(user.id, t.sector))) {
      patch.assignee = { connect: { id: user.id } };
      assumiu = true;
    }
    // resposta do solicitante reabre o atendimento
    if (!staff && (t.status === 'AGUARDANDO_USUARIO' || t.status === 'RESOLVIDO')) {
      patch.status = 'EM_ATENDIMENTO';
      patch.resolvedAt = null;
    }
    if (Object.keys(patch).length) await this.prisma.ticket.update({ where: { id }, data: patch });
    if (assumiu) await this.prisma.ticketEvent.create({ data: { ticketId: id, actorId: user.id, type: 'responsavel', from: null, to: user.id } });
    if (staff && !dto.internal) {
      await this.notifyRequester(t, 'chamados.resposta', { nome: user.name, mensagem: stripTags(dto.body) });
    }
    return c;
  }

  /** Comentário vindo de canal externo (WhatsApp / e-mail). */
  async externalComment(ticket: Ticket, body: string, channel: TicketChannel, authorName: string, file?: { id: string; name: string }) {
    await this.prisma.ticketComment.create({
      data: { ticketId: ticket.id, authorId: ticket.requesterId, authorName, body: stripTags(body) || '(anexo)', channel, fileId: file?.id, fileName: file?.name },
    });
    if (ticket.status === 'AGUARDANDO_USUARIO' || ticket.status === 'RESOLVIDO') {
      await this.prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'EM_ATENDIMENTO', resolvedAt: null } });
    }
  }

  async rate(id: string, rating: number, comment: string | undefined, user: AuthUser) {
    const t = await this.prisma.ticket.findUnique({ where: { id } });
    if (!t || t.requesterId !== user.id) throw new ForbiddenException();
    if (!['RESOLVIDO', 'FECHADO'].includes(t.status)) throw new BadRequestException('Avalie depois que o chamado for resolvido');
    // nota baixa (1 ou 2) exige o motivo, para a equipe saber o que melhorar
    if (rating <= NOTA_BAIXA && (comment?.trim().length ?? 0) < 10) throw new BadRequestException('Para nota 1 ou 2, conte o motivo (mínimo 10 caracteres).');
    return this.prisma.ticket.update({ where: { id }, data: { rating, ratingComment: comment ? stripTags(comment) : null, status: 'FECHADO', closedAt: t.closedAt ?? new Date() } });
  }

  /** Avisa o solicitante externo (WhatsApp ou e-mail) com os modelos de Painel › Mensagens automáticas. */
  async notifyRequester(t: Ticket, kind: 'chamados.status' | 'chamados.resposta' | 'chamados.encaminhado' | 'chamados.prazo', extra: Record<string, string> = {}) {
    if (!(t.channel === 'WHATSAPP' && t.requesterPhone) && !t.requesterEmail) return;
    const vars: Record<string, string | number> = {
      numero: t.number,
      titulo: t.title,
      equipe: (await sectorTexts(this.prisma))[t.sector].team,
      link: `${process.env.PUBLIC_URL}/chamados/${t.id}`,
      ...extra,
    };
    const assunto = await renderMensagem(this.prisma, `${kind}.assunto`, vars);
    const texto = await renderMensagem(this.prisma, `${kind}.texto`, vars);
    if (t.channel === 'WHATSAPP' && t.requesterPhone) {
      await this.whatsapp.sendText(t.requesterPhone, await renderMensagem(this.prisma, 'chamados.whatsapp.atualizacao', { ...vars, assunto, texto }));
    } else if (t.requesterEmail) {
      // quem desligou "Receber os avisos dos chamados por e-mail" no cadastro continua vendo tudo no sistema
      if (t.requesterId) {
        const r = await this.prisma.user.findUnique({ where: { id: t.requesterId }, select: { ticketEmailOn: true } });
        if (r && !r.ticketEmailOn) return;
      }
      // o prefixo [Chamado #N] é fixo: é por ele que as respostas por e-mail voltam para o chamado
      await this.mail.send(t.requesterEmail, `[Chamado #${t.number}] ${assunto}`, await renderMensagem(this.prisma, 'chamados.email.atualizacao', { ...vars, assunto, texto }));
    }
  }
}

/** Soma máxima das prorrogações de um chamado (30 dias). */
export const PRORROGACAO_MAX_HORAS = 720;

function arquivosDe(v: Prisma.JsonValue): { id: string; name: string }[] {
  return Array.isArray(v) ? (v as { id: string; name: string }[]).filter((a) => a && typeof a.id === 'string') : [];
}

export function endOfDay(d: string) {
  const x = new Date(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) x.setHours(23, 59, 59, 999);
  return x;
}
