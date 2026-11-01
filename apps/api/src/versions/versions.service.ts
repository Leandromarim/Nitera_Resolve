import { Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/decorators';
import { DEFAULT_SETTINGS } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Histórico de versões das configurações: cada criar/editar/excluir grava o estado completo do item,
 * e qualquer revisão pode ser restaurada (a restauração também vira revisão).
 */
export type VersionedEntity = 'Setting' | 'TicketCategory';
export const VERSIONED: VersionedEntity[] = ['Setting', 'TicketCategory'];

/** Revisões de configuração guardam só a chave daquele item ("settings" = configurações gerais). */
const GERAIS = 'settings';
const chavesDa = (entityId: string, snap: Record<string, unknown>) => (entityId === GERAIS ? Object.keys(snap).filter((k) => k in DEFAULT_SETTINGS) : entityId in snap ? [entityId] : []);
export function recorteSetting(entityId: string, snap: unknown): Record<string, unknown> | null {
  if (!snap || typeof snap !== 'object') return null;
  const s = snap as Record<string, unknown>;
  return Object.fromEntries(chavesDa(entityId, s).map((k) => [k, s[k]]));
}

const SETTING_LABEL: Record<string, string> = {
  mensagens: 'Mensagens automáticas',
  chamados: 'Configuração dos chamados',
  chamadosCategorias: 'Ícones e dicas das categorias de chamado',
};

@Injectable()
export class VersionsService {
  constructor(private prisma: PrismaService) {}

  private async current(entity: VersionedEntity, id: string): Promise<any> {
    if (entity === 'TicketCategory') return this.prisma.ticketCategory.findUnique({ where: { id } });
    const rows = await this.prisma.setting.findMany({ where: id === GERAIS ? { key: { in: Object.keys(DEFAULT_SETTINGS) } } : { key: id } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  private labelOf(entity: VersionedEntity, s: any, entityId?: string) {
    if (entity === 'Setting') return SETTING_LABEL[entityId ?? ''] ?? 'Instituição e aparência';
    return s?.name ?? '(sem nome)';
  }

  /** Grava uma revisão. Chamar DEPOIS de criar/editar e ANTES de excluir. */
  async record(entity: VersionedEntity, entityId: string, action: string, user?: AuthUser | null, snapshot?: any) {
    const snap = snapshot ?? (await this.current(entity, entityId));
    if (!snap) return;
    const last = await this.prisma.revision.findFirst({ where: { entity, entityId }, orderBy: { version: 'desc' } });
    await this.prisma.revision.create({
      data: { entity, entityId, version: (last?.version ?? 0) + 1, action, label: this.labelOf(entity, snap, entityId), snapshot: snap as Prisma.InputJsonValue, userId: user?.id, userName: user?.name },
    });
  }

  /** `visiveis` vem do controller: o que o perfil pode ver (undefined = administrador, vê tudo). */
  async list(q: { entity?: string; entityId?: string; take?: string; skip?: string }, visiveis?: Prisma.RevisionWhereInput) {
    const rows = await this.prisma.revision.findMany({
      where: { AND: [{ ...(q.entity ? { entity: q.entity } : {}), ...(q.entityId ? { entityId: q.entityId } : {}) }, visiveis ?? {}] },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(q.take) || 100, 500),
      skip: Number(q.skip) || 0,
    });
    return rows.map((r) => (r.entity === 'Setting' ? { ...r, snapshot: recorteSetting(r.entityId, r.snapshot) as Prisma.JsonValue } : r));
  }

  async get(id: string) {
    const r = await this.prisma.revision.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Versão não encontrada');
    const previous = await this.prisma.revision.findFirst({ where: { entity: r.entity, entityId: r.entityId, version: { lt: r.version } }, orderBy: { version: 'desc' } });
    const current = await this.current(r.entity as VersionedEntity, r.entityId);
    if (r.entity === 'Setting') return { ...r, snapshot: recorteSetting(r.entityId, r.snapshot), previous: recorteSetting(r.entityId, previous?.snapshot), current };
    return { ...r, previous: previous?.snapshot ?? null, current };
  }

  /** Volta o item ao estado daquela revisão (recria se tiver sido excluído). */
  async restoreRevision(id: string, user: AuthUser) {
    const r = await this.prisma.revision.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Versão não encontrada');
    const entity = r.entity as VersionedEntity;
    const s: any = r.snapshot;
    await this.prisma.$transaction(async (tx) => {
      if (entity === 'TicketCategory') {
        await tx.ticketCategory.upsert({ where: { id: s.id }, create: s, update: s });
        return;
      }
      for (const [key, value] of Object.entries(recorteSetting(r.entityId, s) ?? {})) {
        await tx.setting.upsert({ where: { key }, create: { key, value: value as any }, update: { value: value as any } });
      }
    });
    await this.record(entity, r.entityId, 'restaurar', user);
    return { ok: true };
  }
}

@Global()
@Module({ providers: [VersionsService], exports: [VersionsService] })
export class VersionsCoreModule {}
