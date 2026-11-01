import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { IsObject } from 'class-validator';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Roles } from '../common/decorators';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { VersionsService } from '../versions/versions.service';
import {
  CategoryExtra,
  CHAMADOS_CATEGORIAS_KEY,
  CHAMADOS_KEY,
  ChamadosConfig,
  clearChamadosCache,
  defaultChamadosConfig,
  parseCategoryExtras,
  parseChamadosConfig,
} from './config';

class ChamadosConfigBody {
  @IsObject({ message: 'Dados inválidos' }) value: Record<string, unknown>;
}

/** Confere se as imagens escolhidas são imagens públicas enviadas pelo painel. */
export async function checkPublicImages(prisma: PrismaService, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  const found = await prisma.fileAsset.count({ where: { id: { in: unique }, public: true, mimeType: { startsWith: 'image/' } } });
  if (found !== unique.length) throw new BadRequestException('Uma das imagens de ícone não foi encontrada ou não é uma imagem pública. Envie a imagem novamente.');
}

/** Ícone e dicas das categorias, com a URL das imagens. */
export async function loadCategoryExtras(prisma: PrismaService, files: FilesService) {
  const row = await prisma.setting.findUnique({ where: { key: CHAMADOS_CATEGORIAS_KEY } });
  const extras = parseCategoryExtras(row?.value);
  return Object.fromEntries(Object.entries(extras).map(([id, e]) => [id, { ...e, image: e.imageId ? files.urlFor(e.imageId, true) : null }]));
}

/** Grava (ou remove, com `extra` null) o ícone e as dicas de uma categoria, com revisão e auditoria. */
export async function saveCategoryExtra(
  prisma: PrismaService,
  versions: VersionsService,
  audit: AuditService,
  categoryId: string,
  extra: CategoryExtra | null,
  u: AuthUser,
) {
  const row = await prisma.setting.findUnique({ where: { key: CHAMADOS_CATEGORIAS_KEY } });
  const all = parseCategoryExtras(row?.value);
  const before = JSON.stringify(all[categoryId] ?? null);
  if (extra) all[categoryId] = extra;
  else delete all[categoryId];
  if (JSON.stringify(all[categoryId] ?? null) === before) return;
  const value = all as unknown as Prisma.InputJsonValue;
  await prisma.setting.upsert({ where: { key: CHAMADOS_CATEGORIAS_KEY }, create: { key: CHAMADOS_CATEGORIAS_KEY, value }, update: { value } });
  await versions.record('Setting', CHAMADOS_CATEGORIAS_KEY, 'editar', u, { [CHAMADOS_CATEGORIAS_KEY]: all });
  await audit.log(u.id, 'editar', 'Setting', CHAMADOS_CATEGORIAS_KEY, { categoria: categoryId, icone: extra?.icon ?? null, imagem: !!extra?.imageId, dicas: extra?.tips.length ?? 0 });
}

/**
 * Configuração dos chamados.
 * - GET /tickets/config: leitura para quem está logado (formulário de abertura, meus chamados, atendimento).
 * - GET/PUT /admin/chamados-config: edição no painel (Categorias e SLA), perfil TI.
 */
@Controller()
export class ChamadosConfigController {
  constructor(private prisma: PrismaService, private audit: AuditService, private versions: VersionsService, private files: FilesService) {}

  private async saved() {
    const row = await this.prisma.setting.findUnique({ where: { key: CHAMADOS_KEY } });
    return { value: parseChamadosConfig(row?.value), customized: !!row };
  }

  /** Acrescenta a URL da imagem de cada setor. */
  private withImages(c: ChamadosConfig) {
    const sectors = Object.fromEntries(
      Object.entries(c.sectors).map(([k, s]) => [k, { ...s, image: s.imageId ? this.files.urlFor(s.imageId, true) : null }]),
    );
    return { ...c, sectors };
  }

  @Get('tickets/config')
  async publicConfig() {
    const [{ value }, categories] = await Promise.all([this.saved(), loadCategoryExtras(this.prisma, this.files)]);
    return { ...this.withImages(value), categories };
  }

  @Roles('TI')
  @Get('admin/chamados-config')
  async get() {
    const { value, customized } = await this.saved();
    return { value: this.withImages(value), defaults: defaultChamadosConfig(), customized };
  }

  @Roles('TI')
  @Put('admin/chamados-config')
  async save(@Body() body: ChamadosConfigBody, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const errors: string[] = [];
    const value = parseChamadosConfig(body.value, errors);
    if (errors.length) throw new BadRequestException([...new Set(errors)].slice(0, 20));
    await checkPublicImages(
      this.prisma,
      Object.values(value.sectors).map((s) => s.imageId ?? ''),
    );
    const json = value as unknown as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key: CHAMADOS_KEY }, create: { key: CHAMADOS_KEY, value: json }, update: { value: json } });
    clearChamadosCache();
    // revisão só desta chave: restaurar uma versão não mexe nas demais configurações
    await this.versions.record('Setting', CHAMADOS_KEY, 'editar', u, { [CHAMADOS_KEY]: value });
    await this.audit.log(
      u.id,
      'editar',
      'Setting',
      CHAMADOS_KEY,
      {
        chaves: [CHAMADOS_KEY],
        setores: Object.fromEntries(Object.entries(value.sectors).map(([k, s]) => [k, s.label])),
        multiplicadores: value.rules.slaFactor,
        slaPadrao: value.rules.defaultSlaHours,
        setorWhatsapp: value.rules.whatsappSector,
        setorEmail: value.rules.emailSector,
        janelaWhatsappDias: value.rules.whatsappWindowDays,
        perguntaAreaWhatsapp: value.rules.whatsappAskSector,
        perguntaCategoriaWhatsapp: value.rules.whatsappAskCategory,
        areasWhatsapp: value.rules.whatsappSectors,
        encaminhamentos: value.rules.redirects.length,
        dicasPorPalavra: value.keywordTips.length,
      },
      ip,
    );
    return this.get();
  }
}
