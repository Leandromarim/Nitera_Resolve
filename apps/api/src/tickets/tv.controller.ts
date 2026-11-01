import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Put, Query } from '@nestjs/common';
import { Prisma, TicketSector, TicketStatus } from '@prisma/client';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Public, Roles } from '../common/decorators';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { loadChamadosConfig } from './config';
import { loadCategoryExtras } from './config.controller';
import { parseSector, SECTOR_LABEL, SECTOR_ROLE, SECTORS, staffSectors, TICKET_STAFF_ROLES } from './sectors';

/** TI mantém a chave antiga ("painelTv") para não quebrar a TV já instalada. */
const settingKey = (sector: TicketSector) => (sector === 'TI' ? 'painelTv' : `painelTv:${sector}`);
const OPEN: TicketStatus[] = ['NOVO', 'EM_ATENDIMENTO', 'AGUARDANDO_USUARIO'];
const TONES = ['sino', 'alerta', 'suave', 'campainha'] as const;
const THEMES = ['escuro', 'claro'] as const;

export interface TvSettings {
  enabled: boolean;
  key: string;
  title: string;
  subtitle: string;
  refreshSec: number;
  soundEnabled: boolean;
  soundTone: (typeof TONES)[number];
  soundVolume: number;
  /** Voz que fala `voiceText` quando chega chamado novo (depois do toque). */
  voiceEnabled: boolean;
  voiceText: string;
  criticalRepeat: number;
  reminderMin: number;
  newHighlightSec: number;
  statuses: TicketStatus[];
  categoryIds: string[];
  maxPerColumn: number;
  theme: (typeof THEMES)[number];
  showClock: boolean;
  showStats: boolean;
  showTechnicians: boolean;
  showRequester: boolean;
  showLocation: boolean;
  blinkCritical: boolean;
  highlightOverdue: boolean;
  ticker: string;
}

const SUBTITLE: Record<TicketSector, string> = { TI: 'Equipe de TI', INFRAESTRUTURA: 'Infraestrutura de TI', MANUTENCAO: 'Manutenção', COMUNICACAO: 'Comunicação' };

const DEFAULTS: Omit<TvSettings, 'key' | 'subtitle'> = {
  enabled: true,
  title: 'Central de Chamados',
  refreshSec: 15,
  soundEnabled: true,
  soundTone: 'sino',
  soundVolume: 80,
  voiceEnabled: true,
  voiceText: 'Chegou um novo chamado',
  criticalRepeat: 3,
  reminderMin: 5,
  newHighlightSec: 60,
  statuses: OPEN,
  categoryIds: [],
  maxPerColumn: 12,
  theme: 'escuro',
  showClock: true,
  showStats: true,
  showTechnicians: true,
  showRequester: true,
  showLocation: true,
  blinkCritical: true,
  highlightOverdue: true,
  ticker: '',
};

const newKey = () => randomBytes(24).toString('base64url');

function sameKey(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Painel de chamados para a TV de cada equipe (um por setor). A TV entra com uma chave secreta, sem login. */
@Controller()
export class TvPanelController {
  constructor(private prisma: PrismaService, private audit: AuditService, private files: FilesService) {}

  /** Configuração salva do setor, sem criar nada (null se nunca foi salva). */
  private async read(sector: TicketSector): Promise<TvSettings | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: settingKey(sector) } });
    if (!row) return null;
    const saved = (row.value ?? {}) as Partial<TvSettings>;
    return { ...DEFAULTS, subtitle: SUBTITLE[sector], ...saved } as TvSettings;
  }

  /** Configuração do setor; cria a chave na primeira vez. */
  private async load(sector: TicketSector): Promise<TvSettings> {
    const s = (await this.read(sector)) ?? ({ ...DEFAULTS, subtitle: SUBTITLE[sector], key: '' } as TvSettings);
    if (!s.key) {
      s.key = newKey();
      await this.store(sector, s);
    }
    return s;
  }

  private store(sector: TicketSector, s: TvSettings) {
    const value = s as unknown as Prisma.InputJsonValue;
    const key = settingKey(sector);
    return this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  /** Setor que o usuário pode configurar (padrão: o primeiro que ele atende). */
  private sectorFor(u: AuthUser, setor?: string): TicketSector {
    const mine = staffSectors(u);
    const wanted = parseSector(setor) ?? mine[0];
    if (!wanted || !mine.includes(wanted)) throw new ForbiddenException('Você não pode configurar o painel deste setor.');
    return wanted;
  }

  // ───────── Painel (TV) ─────────

  @Public()
  @Get('painel-tv')
  async board(@Query('chave') chave?: string) {
    // a chave do endereço identifica o setor
    let sector: TicketSector | null = null;
    let s: TvSettings | null = null;
    if (chave) {
      for (const x of SECTORS) {
        const cfg = await this.read(x);
        if (cfg?.key && sameKey(chave, cfg.key)) {
          sector = x;
          s = cfg;
          break;
        }
      }
    }
    if (!s || !sector) throw new ForbiddenException('Chave do painel inválida. Copie o endereço de novo no painel administrativo.');
    if (!s.enabled) throw new ForbiddenException('O painel da TV está desativado no painel administrativo.');

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const cat = { sector, ...(s.categoryIds.length ? { categoryId: { in: s.categoryIds } } : {}) };

    const [tickets, openedToday, resolvedToday, firstResp, technicians] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { status: { in: OPEN }, ...cat },
        orderBy: [{ createdAt: 'asc' }],
        take: 500,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          channel: true,
          location: true,
          requesterName: true,
          dueAt: true,
          firstResponseAt: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          department: { select: { name: true } },
          requester: { select: { name: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.ticket.count({ where: { createdAt: { gte: today }, ...cat } }),
      this.prisma.ticket.count({ where: { resolvedAt: { gte: today }, ...cat } }),
      this.prisma.ticket.findMany({ where: { createdAt: { gte: today }, firstResponseAt: { not: null }, ...cat }, select: { createdAt: true, firstResponseAt: true } }),
      this.prisma.user.findMany({ where: { active: true, roles: { hasSome: [SECTOR_ROLE[sector]] } }, select: { id: true, name: true, avatarUrl: true }, orderBy: { name: 'asc' } }),
    ]);

    const avgFirstResponseMin = firstResp.length
      ? Math.round(firstResp.reduce((acc, t) => acc + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / firstResp.length / 60000)
      : null;

    const load = new Map<string, number>();
    for (const t of tickets) if (t.assignee && t.status !== 'AGUARDANDO_USUARIO') load.set(t.assignee.id, (load.get(t.assignee.id) ?? 0) + 1);

    // nome, ícone e cor do setor e ícone das categorias: Painel › Categorias e SLA
    const [cfg, extras] = await Promise.all([loadChamadosConfig(this.prisma), loadCategoryExtras(this.prisma, this.files)]);
    const sc = cfg.sectors[sector];
    const { key: _key, categoryIds: _c, ...view } = s;
    // a TV não tem login: as imagens vão com link assinado (com "Exigir login", /api/files só abre assim para quem não entrou)
    const ass = (url: string | null) => this.files.assinarUrl(url);
    return {
      settings: { ...view, sector, sectorLabel: sc?.label ?? SECTOR_LABEL[sector] },
      sector: { label: sc.label, short: sc.short, icon: sc.icon, image: sc.imageId ? ass(this.files.urlFor(sc.imageId, true)) : null, color: sc.color },
      categoryIcons: Object.fromEntries(
        [...new Set(tickets.map((t) => t.category?.id).filter((x): x is string => !!x))].map((id) => [id, { icon: extras[id]?.icon ?? null, image: ass(extras[id]?.image ?? null) }]),
      ),
      serverTime: now.toISOString(),
      tickets: tickets.map(({ requester, ...t }) => ({
        ...t,
        assignee: t.assignee ? { ...t.assignee, avatarUrl: ass(t.assignee.avatarUrl) } : null,
        requesterName: requester?.name ?? t.requesterName,
        overdue: !!t.dueAt && t.dueAt < now,
      })),
      stats: {
        open: tickets.length,
        unassigned: tickets.filter((t) => t.status === 'NOVO' && !t.assignee).length,
        overdue: tickets.filter((t) => t.dueAt && t.dueAt < now).length,
        critical: tickets.filter((t) => t.priority === 'CRITICA').length,
        openedToday,
        resolvedToday,
        avgFirstResponseMin,
      },
      technicians: technicians.map((u) => ({ ...u, avatarUrl: ass(u.avatarUrl), active: load.get(u.id) ?? 0 })),
    };
  }

  // ───────── Configuração (painel administrativo) ─────────

  @Roles(...TICKET_STAFF_ROLES)
  @Get('admin/painel-tv')
  async settings(@CurrentUser() u: AuthUser, @Query('setor') setor?: string) {
    const sector = this.sectorFor(u, setor);
    const [s, categories] = await Promise.all([
      this.load(sector),
      this.prisma.ticketCategory.findMany({ where: { active: true, sector }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { sector, sectors: staffSectors(u), settings: s, categories };
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Put('admin/painel-tv')
  async save(@Body() body: Partial<TvSettings>, @CurrentUser() u: AuthUser, @ClientIp() ip: string, @Query('setor') setor?: string) {
    const sector = this.sectorFor(u, setor);
    const cur = await this.load(sector);
    const b = body ?? {};
    const bool = (k: keyof TvSettings) => (typeof b[k] === 'boolean' ? (b[k] as boolean) : (cur[k] as boolean));
    const int = (k: keyof TvSettings, min: number, max: number) => {
      const v = b[k] === undefined ? cur[k] : b[k];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new BadRequestException(`Valor inválido em "${k}": use de ${min} a ${max}.`);
      return v;
    };
    const text = (k: keyof TvSettings, max: number, required = false) => {
      const v = b[k] === undefined ? cur[k] : b[k];
      if (typeof v !== 'string') throw new BadRequestException(`Valor inválido em "${k}".`);
      const t = v.trim();
      if (required && !t) throw new BadRequestException('Informe o título do painel.');
      if (t.length > max) throw new BadRequestException(`O campo "${k}" aceita até ${max} caracteres.`);
      return t;
    };

    const statuses = b.statuses ?? cur.statuses;
    if (!Array.isArray(statuses) || !statuses.length || statuses.some((x) => !OPEN.includes(x))) throw new BadRequestException('Escolha pelo menos uma coluna do painel.');
    const categoryIds = b.categoryIds ?? cur.categoryIds;
    if (!Array.isArray(categoryIds) || categoryIds.some((x) => typeof x !== 'string')) throw new BadRequestException('Categorias inválidas.');
    const ownCategories = categoryIds.length
      ? await this.prisma.ticketCategory.count({ where: { id: { in: [...new Set(categoryIds)] }, sector } })
      : 0;
    if (ownCategories !== new Set(categoryIds).size) throw new BadRequestException('Escolha apenas categorias deste setor.');
    const soundTone = b.soundTone ?? cur.soundTone;
    if (!TONES.includes(soundTone)) throw new BadRequestException('Tipo de som inválido.');
    const theme = b.theme ?? cur.theme;
    if (!THEMES.includes(theme)) throw new BadRequestException('Tema inválido.');

    const next: TvSettings = {
      key: cur.key,
      enabled: bool('enabled'),
      title: text('title', 80, true),
      subtitle: text('subtitle', 80),
      refreshSec: int('refreshSec', 5, 300),
      soundEnabled: bool('soundEnabled'),
      soundTone,
      soundVolume: int('soundVolume', 0, 100),
      voiceEnabled: bool('voiceEnabled'),
      voiceText: text('voiceText', 120) || DEFAULTS.voiceText,
      criticalRepeat: int('criticalRepeat', 1, 5),
      reminderMin: int('reminderMin', 0, 120),
      newHighlightSec: int('newHighlightSec', 5, 600),
      statuses: OPEN.filter((x) => statuses.includes(x)),
      categoryIds: [...new Set(categoryIds)],
      maxPerColumn: int('maxPerColumn', 3, 50),
      theme,
      showClock: bool('showClock'),
      showStats: bool('showStats'),
      showTechnicians: bool('showTechnicians'),
      showRequester: bool('showRequester'),
      showLocation: bool('showLocation'),
      blinkCritical: bool('blinkCritical'),
      highlightOverdue: bool('highlightOverdue'),
      ticker: text('ticker', 300),
    };
    await this.store(sector, next);
    const { key: _k, ...logged } = next;
    await this.audit.log(u.id, 'editar', 'PainelTV', sector, logged, ip);
    return next;
  }

  @Roles(...TICKET_STAFF_ROLES)
  @Post('admin/painel-tv/chave')
  async rotateKey(@CurrentUser() u: AuthUser, @ClientIp() ip: string, @Query('setor') setor?: string) {
    const sector = this.sectorFor(u, setor);
    const s = await this.load(sector);
    s.key = newKey();
    await this.store(sector, s);
    await this.audit.log(u.id, 'gerar nova chave', 'PainelTV', sector, undefined, ip);
    return s;
  }
}
