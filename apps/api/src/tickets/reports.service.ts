import { Injectable } from '@nestjs/common';
import { Prisma, TicketSector, TicketStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { autorPlanilha, nomeDoSite } from '../mensagens/mensagens.service';
import { SECTOR_LABEL, SECTOR_ROLE } from './sectors';
import { endOfDay, STATUS_LABEL } from './tickets.service';

export interface ReportFilter {
  from?: string;
  to?: string;
  categoryId?: string;
  assigneeId?: string;
  departmentId?: string;
  channel?: string;
  status?: string;
  priority?: string;
  /** TI, INFRAESTRUTURA, MANUTENCAO ou COMUNICACAO; sem setor = todos os setores do usuário */
  setor?: string;
}

const CHANNEL_LABEL: Record<string, string> = { PORTAL: 'Portal', WHATSAPP: 'WhatsApp', EMAIL: 'E-mail', TELEFONE: 'Telefone' };
const PRIORITY_LABEL: Record<string, string> = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };
const hours = (a?: Date | null, b?: Date | null) => (a && b ? (b.getTime() - a.getTime()) / 3_600_000 : null);
const fmt = (d?: Date | null) => (d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private where(f: ReportFilter, sectors: TicketSector[]): Prisma.TicketWhereInput {
    const from = f.from ? new Date(f.from) : new Date(Date.now() - 30 * 86_400_000);
    return {
      sector: { in: sectors },
      createdAt: { gte: from, ...(f.to ? { lte: endOfDay(f.to) } : {}) },
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(f.assigneeId ? { assigneeId: f.assigneeId } : {}),
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.channel ? { channel: f.channel as any } : {}),
      ...(f.status ? { status: { in: f.status.split(',') as TicketStatus[] } } : {}),
      ...(f.priority ? { priority: f.priority as any } : {}),
    };
  }

  /** Título do relatório conforme os setores incluídos. */
  private title(sectors: TicketSector[]) {
    return sectors.length === 1 ? `Relatório de chamados — ${SECTOR_LABEL[sectors[0]]}` : 'Relatório de chamados';
  }

  private rows(f: ReportFilter, sectors: TicketSector[]) {
    return this.prisma.ticket.findMany({
      where: this.where(f, sectors),
      include: { category: true, assignee: { select: { name: true } }, department: true },
      orderBy: { createdAt: 'asc' },
      take: 50_000,
    });
  }

  /**
   * Quem atendeu cada chamado sem responsável: quem o resolveu ou fechou (histórico) ou, sem isso,
   * o primeiro da equipe que respondeu ao solicitante. Só leitura: o chamado não é alterado.
   */
  private async atendidoPor(tickets: Awaited<ReturnType<ReportsService['rows']>>) {
    const sem = tickets.filter((t) => !t.assigneeId);
    const quem = new Map<string, string>();
    if (!sem.length) return new Map<string, string>();
    const solicitante = new Map(sem.map((t) => [t.id, t.requesterId]));
    const ids = sem.map((t) => t.id);
    const eventos = await this.prisma.ticketEvent.findMany({
      where: { ticketId: { in: ids }, type: 'status', to: { in: ['RESOLVIDO', 'FECHADO'] }, actorId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { ticketId: true, actorId: true },
    });
    for (const e of eventos) if (!quem.has(e.ticketId) && e.actorId !== solicitante.get(e.ticketId)) quem.set(e.ticketId, e.actorId!);
    const respostas = await this.prisma.ticketComment.findMany({
      where: { ticketId: { in: ids.filter((id) => !quem.has(id)) }, internal: false, authorId: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { ticketId: true, authorId: true },
    });
    for (const c of respostas) if (!quem.has(c.ticketId) && c.authorId !== solicitante.get(c.ticketId)) quem.set(c.ticketId, c.authorId!);
    const nomes = new Map((await this.prisma.user.findMany({ where: { id: { in: [...new Set(quem.values())] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    const nomePorChamado = new Map<string, string>();
    for (const [ticketId, userId] of quem) if (nomes.get(userId)) nomePorChamado.set(ticketId, nomes.get(userId)!);
    return nomePorChamado;
  }

  async summary(f: ReportFilter, sectors: TicketSector[]) {
    const tickets = await this.rows(f, sectors);
    const atendido = await this.atendidoPor(tickets);
    const now = new Date();
    const group = (key: (t: (typeof tickets)[number]) => string) => {
      const m = new Map<string, number>();
      for (const t of tickets) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
      return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    const resolved = tickets.filter((t) => t.resolvedAt);
    const withDue = tickets.filter((t) => t.dueAt && (t.resolvedAt || t.dueAt < now));
    const withinSla = withDue.filter((t) => t.resolvedAt && t.resolvedAt <= t.dueAt!);
    const byDay = new Map<string, { abertos: number; resolvidos: number }>();
    for (const t of tickets) {
      const d = t.createdAt.toISOString().slice(0, 10);
      byDay.set(d, { abertos: (byDay.get(d)?.abertos ?? 0) + 1, resolvidos: byDay.get(d)?.resolvidos ?? 0 });
      if (t.resolvedAt) {
        const r = t.resolvedAt.toISOString().slice(0, 10);
        byDay.set(r, { abertos: byDay.get(r)?.abertos ?? 0, resolvidos: (byDay.get(r)?.resolvidos ?? 0) + 1 });
      }
    }
    const byAssignee = new Map<string, { total: number; resolvidos: number; horas: number[] }>();
    for (const t of tickets) {
      const k = t.assignee?.name ?? atendido.get(t.id) ?? 'Sem responsável';
      const e = byAssignee.get(k) ?? { total: 0, resolvidos: 0, horas: [] };
      e.total++;
      if (t.resolvedAt) {
        e.resolvidos++;
        e.horas.push(hours(t.createdAt, t.resolvedAt)!);
      }
      byAssignee.set(k, e);
    }
    // todos os técnicos das equipes do relatório aparecem, inclusive quem ficou sem chamado no período
    if (!f.assigneeId) {
      const equipe = await this.prisma.user.findMany({ where: { active: true, roles: { hasSome: sectors.map((x) => SECTOR_ROLE[x]) } }, select: { name: true } });
      for (const u of equipe) if (!byAssignee.has(u.name)) byAssignee.set(u.name, { total: 0, resolvidos: 0, horas: [] });
    }
    const ratings = tickets.filter((t) => t.rating).map((t) => t.rating!);
    return {
      total: tickets.length,
      open: tickets.filter((t) => ['NOVO', 'EM_ATENDIMENTO', 'AGUARDANDO_USUARIO'].includes(t.status)).length,
      resolved: resolved.length,
      overdue: tickets.filter((t) => !t.resolvedAt && t.dueAt && t.dueAt < now && !['CANCELADO', 'FECHADO'].includes(t.status)).length,
      avgResolutionHours: avg(resolved.map((t) => hours(t.createdAt, t.resolvedAt)!)),
      avgFirstResponseHours: avg(tickets.filter((t) => t.firstResponseAt).map((t) => hours(t.createdAt, t.firstResponseAt)!)),
      slaPercent: withDue.length ? (withinSla.length / withDue.length) * 100 : null,
      satisfaction: avg(ratings),
      ratingsCount: ratings.length,
      byStatus: group((t) => STATUS_LABEL[t.status]),
      byCategory: group((t) => t.category?.name ?? 'Sem categoria'),
      bySector: group((t) => SECTOR_LABEL[t.sector]),
      byChannel: group((t) => CHANNEL_LABEL[t.channel]),
      byPriority: group((t) => PRIORITY_LABEL[t.priority]),
      byDepartment: group((t) => t.department?.name ?? 'Não informado'),
      byAssignee: [...byAssignee.entries()].map(([label, e]) => ({ label, total: e.total, resolvidos: e.resolvidos, mediaHoras: avg(e.horas) })),
      byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    };
  }

  private table(tickets: Awaited<ReturnType<ReportsService['rows']>>, atendido: Map<string, string>) {
    return tickets.map((t) => ({
      Número: t.number,
      Título: t.title,
      Status: STATUS_LABEL[t.status],
      Prioridade: PRIORITY_LABEL[t.priority],
      'Equipe responsável': SECTOR_LABEL[t.sector],
      Categoria: t.category?.name ?? '',
      Canal: CHANNEL_LABEL[t.channel],
      Solicitante: t.requesterName ?? '',
      Setor: t.department?.name ?? '',
      Responsável: t.assignee?.name ?? '',
      'Atendido por': t.assignee?.name ?? atendido.get(t.id) ?? '',
      Abertura: fmt(t.createdAt),
      'Primeira resposta': fmt(t.firstResponseAt),
      Resolução: fmt(t.resolvedAt),
      'Prazo (SLA)': fmt(t.dueAt),
      'Prazo aumentado (h)': t.prorrogadoHoras || '',
      'Dentro do SLA': t.resolvedAt && t.dueAt ? (t.resolvedAt <= t.dueAt ? 'Sim' : 'Não') : '',
      'Tempo de resolução (h)': t.resolvedAt ? Number(hours(t.createdAt, t.resolvedAt)!.toFixed(1)) : '',
      Avaliação: t.rating ?? '',
    }));
  }

  async csv(f: ReportFilter, sectors: TicketSector[]) {
    const tickets = await this.rows(f, sectors);
    const rows = this.table(tickets, await this.atendidoPor(tickets));
    if (!rows.length) return '﻿Sem chamados no período\n';
    const esc = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita injeção de fórmulas no Excel
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = Object.keys(rows[0]);
    return '﻿' + [head.join(';'), ...rows.map((r) => head.map((h) => esc((r as any)[h])).join(';'))].join('\n');
  }

  async xlsx(f: ReportFilter, sectors: TicketSector[]) {
    const [tickets, s] = await Promise.all([this.rows(f, sectors), this.summary(f, sectors)]);
    const wb = new ExcelJS.Workbook();
    wb.creator = await autorPlanilha(this.prisma);
    const resumo = wb.addWorksheet('Resumo');
    resumo.columns = [{ width: 36 }, { width: 18 }];
    resumo.addRow([this.title(sectors)]).font = { bold: true, size: 14 };
    resumo.addRow([]);
    const kpis: [string, unknown][] = [
      ['Total de chamados', s.total],
      ['Em aberto', s.open],
      ['Resolvidos', s.resolved],
      ['Atrasados (fora do SLA)', s.overdue],
      ['Tempo médio de resolução (h)', s.avgResolutionHours?.toFixed(1) ?? '-'],
      ['Tempo médio de 1ª resposta (h)', s.avgFirstResponseHours?.toFixed(1) ?? '-'],
      ['SLA cumprido (%)', s.slaPercent?.toFixed(1) ?? '-'],
      ['Satisfação média (1-5)', s.satisfaction?.toFixed(2) ?? '-'],
    ];
    kpis.forEach((k) => resumo.addRow(k));
    for (const [title, data] of [...(sectors.length > 1 ? ([['Por equipe', s.bySector]] as const) : []), ['Por categoria', s.byCategory], ['Por status', s.byStatus], ['Por canal', s.byChannel], ['Por setor', s.byDepartment]] as const) {
      resumo.addRow([]);
      resumo.addRow([title]).font = { bold: true };
      data.forEach((d) => resumo.addRow([d.label, d.value]));
    }
    const ws = wb.addWorksheet('Chamados');
    const rows = this.table(tickets, await this.atendidoPor(tickets));
    const head = rows[0] ? Object.keys(rows[0]) : ['Número'];
    ws.columns = head.map((h) => ({ header: h, key: h, width: Math.max(12, h.length + 4) }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3C4B78' } };
    rows.forEach((r) => ws.addRow(r));
    ws.autoFilter = { from: 'A1', to: { row: 1, column: head.length } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async pdf(f: ReportFilter, sectors: TicketSector[]): Promise<Buffer> {
    const [tickets, s, site] = await Promise.all([this.rows(f, sectors), this.summary(f, sectors), nomeDoSite(this.prisma)]);
    const title = this.title(sectors);
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: title } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((r) => doc.on('end', () => r(Buffer.concat(chunks))));

    doc.rect(0, 0, doc.page.width, 70).fill('#3c4b78');
    doc.fill('#ffffff').fontSize(18).text(site, 40, 20).fontSize(11).text(title, 40, 44);
    doc.fill('#111111').moveDown(3);
    const period = `${f.from ?? 'últimos 30 dias'}${f.to ? ' a ' + f.to : ''}`;
    doc.fontSize(10).fill('#555555').text(`Período: ${period} · Gerado em ${fmt(new Date())}`, 40, 85);
    doc.moveDown();

    const kpis: [string, string][] = [
      ['Total', String(s.total)],
      ['Em aberto', String(s.open)],
      ['Resolvidos', String(s.resolved)],
      ['Atrasados', String(s.overdue)],
      ['Resolução média', s.avgResolutionHours != null ? `${s.avgResolutionHours.toFixed(1)} h` : '-'],
      ['SLA cumprido', s.slaPercent != null ? `${s.slaPercent.toFixed(0)}%` : '-'],
      ['1ª resposta média', s.avgFirstResponseHours != null ? `${s.avgFirstResponseHours.toFixed(1)} h` : '-'],
      ['Satisfação', s.satisfaction != null ? `${s.satisfaction.toFixed(1)} / 5` : '-'],
    ];
    const boxW = (doc.page.width - 80 - 30) / 4;
    kpis.forEach(([label, value], i) => {
      const x = 40 + (i % 4) * (boxW + 10);
      const y = 110 + Math.floor(i / 4) * 60;
      doc.roundedRect(x, y, boxW, 50, 6).fill('#f1f3f9');
      doc.fill('#666666').fontSize(8).text(label, x + 8, y + 8, { width: boxW - 16 });
      doc.fill('#3c4b78').fontSize(16).text(value, x + 8, y + 22, { width: boxW - 16 });
    });
    let y = 240;
    const section = (title: string, data: { label: string; value: number }[]) => {
      if (y > 700) {
        doc.addPage();
        y = 40;
      }
      doc.fill('#111111').fontSize(12).text(title, 40, y);
      y += 18;
      const max = Math.max(1, ...data.map((d) => d.value));
      for (const d of data.slice(0, 10)) {
        doc.fill('#333333').fontSize(9).text(d.label, 40, y, { width: 160, ellipsis: true });
        doc.rect(205, y, (280 * d.value) / max, 10).fill('#ff6b4a');
        doc.fill('#333333').text(String(d.value), 490, y);
        y += 15;
      }
      y += 10;
    };
    if (sectors.length > 1) section('Por equipe', s.bySector);
    section('Por categoria', s.byCategory);
    section('Por status', s.byStatus);
    section('Por canal de abertura', s.byChannel);

    doc.addPage();
    doc.fill('#111111').fontSize(12).text('Chamados do período', 40, 40);
    y = 62;
    const cols = [
      ['#', 30],
      ['Título', 165],
      ['Status', 75],
      ['Categoria', 85],
      ['Responsável', 85],
      ['Abertura', 75],
    ] as const;
    const header = () => {
      let x = 40;
      doc.rect(40, y - 3, doc.page.width - 80, 16).fill('#3c4b78');
      for (const [h, w] of cols) {
        doc.fill('#ffffff').fontSize(8).text(h, x + 3, y, { width: w - 6 });
        x += w;
      }
      y += 18;
    };
    header();
    tickets.slice(0, 2000).forEach((t, i) => {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 40;
        header();
      }
      if (i % 2) doc.rect(40, y - 2, doc.page.width - 80, 14).fill('#f6f7fb');
      const vals = [String(t.number), t.title, STATUS_LABEL[t.status], t.category?.name ?? '', t.assignee?.name ?? '', t.createdAt.toLocaleDateString('pt-BR')];
      let x = 40;
      vals.forEach((v, j) => {
        doc.fill('#222222').fontSize(7.5).text(v, x + 3, y, { width: cols[j][1] - 6, height: 10, ellipsis: true, lineBreak: false });
        x += cols[j][1];
      });
      y += 14;
    });
    doc.end();
    return done;
  }
}
