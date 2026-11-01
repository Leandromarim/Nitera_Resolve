import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, UnauthorizedException } from '@nestjs/common';
import { Prisma, Release, ReleaseItem, ReleaseSystem } from '@prisma/client';
import { AcessoService } from '../common/acesso';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Portal, Public, Roles } from '../common/decorators';
import { notify } from '../common/notify';
import { renderMensagem } from '../mensagens/mensagens.service';
import { sanitizeHtml, stripTags } from '../common/sanitize';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PublishDto, ReleaseDto, ReleaseItemDto, ReorderItemsDto, SEMVER } from './dto';

/** Compara versões semânticas (4.10.0 > 4.9.3). */
export function compareVersions(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/** Mais nova primeiro: pelo número da versão e, no empate, pela data de publicação. */
const newestFirst = (a: Release, b: Release) =>
  compareVersions(b.version, a.version) || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);

/** Um sistema só (o parâmetro `sistema` é ignorado; fica para não quebrar links antigos). */
export const sistemaDe = (_q?: string): ReleaseSystem => 'RESOLVE';
const nomeSistema = (_s: ReleaseSystem) => 'do NITERA Resolve';

type ReleaseWithItems = Release & { items: ReleaseItem[]; _count?: { views: number } };

/** Dependências do package.json da API, com a versão realmente instalada (ou a pedida, se não achar). */
async function lerDependencias() {
  const dependencies: Record<string, string> = {};
  try {
    const pkg = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    for (const [name, range] of Object.entries<string>(pkg.dependencies ?? {})) {
      let version = String(range).replace(/^[\^~>=<\s]+/, '');
      try {
        version = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'node_modules', name, 'package.json'), 'utf8')).version ?? version;
      } catch {
        // pacote sem package.json acessível: fica a versão pedida
      }
      dependencies[name] = version;
    }
  } catch {
    // sem package.json (não deve acontecer): a lista sai vazia
  }
  return { dependencies };
}

/**
 * Versões do NITERA Resolve ("O que há de novo"). Para quem entrou em /api/novidades; painel em
 * /api/admin/novidades (TI e Comunicação).
 */
let techCache: { dependencies: Record<string, string>; node: string } | null = null;

/**
 * Bibliotecas que o servidor usa, com a versão instalada de cada uma, mais Node.js e PostgreSQL.
 * A seção "Tecnologias" junta isto com as bibliotecas do portal; nada é digitado à mão.
 * Só sai para quem entrou : versões ajudam quem procura falhas conhecidas.
 */
export async function lerTecnologias(prisma: PrismaService) {
  if (!techCache) techCache = { ...(await lerDependencias()), node: process.versions.node };
  let postgres: string | null = null;
  try {
    const [row] = await prisma.$queryRaw<{ server_version: string }[]>`SHOW server_version`;
    postgres = row?.server_version?.split(' ')[0] ?? null;
  } catch {
    postgres = null;
  }
  return { ...techCache, postgres };
}

@Controller()
export class NovidadesController {
  constructor(private prisma: PrismaService, private files: FilesService, private audit: AuditService, private acesso: AcessoService) {}

  private item(i: ReleaseItem) {
    return {
      id: i.id,
      kind: i.kind,
      title: i.title,
      description: i.description,
      reason: i.reason,
      imageId: i.imageId,
      image: i.imageId ? this.files.urlFor(i.imageId, true) : null,
      order: i.order,
    };
  }

  private view(r: ReleaseWithItems) {
    return {
      id: r.id,
      system: r.system,
      version: r.version,
      title: r.title,
      summary: r.summary,
      published: r.published,
      publishedAt: r.publishedAt,
      announce: r.announce,
      items: [...r.items].sort((a, b) => a.order - b.order).map((i) => this.item(i)),
      ...(r._count ? { views: r._count.views } : {}),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private publicView(r: ReleaseWithItems) {
    const { id, version, title, summary, publishedAt, items } = this.view(r);
    return { id, version, title, summary, publishedAt, items };
  }

  private async published(system: ReleaseSystem) {
    const list = await this.prisma.release.findMany({ where: { system, published: true }, include: { items: true } });
    return list.sort(newestFirst);
  }

  // ───────── público ─────────

  /** As notas de versão são só para quem entrou. */
  private async portalAberto(_sistema: string | undefined, u?: AuthUser) {
    if (!u && (await this.acesso.exigirLogin())) throw new UnauthorizedException('Faça login para continuar');
  }

  @Public()
  @Get('novidades')
  async list(@Query('sistema') sistema?: string, @CurrentUser() u?: AuthUser) {
    await this.portalAberto(sistema, u);
    return (await this.published(sistemaDe(sistema))).map((r) => this.publicView(r));
  }

  /** Versão atual (a publicada mais recente) usada no rodapé e no menu. */
  @Public()
  @Get('novidades/atual')
  async current(@Query('sistema') sistema?: string) {
    const list = await this.prisma.release.findMany({ where: { system: sistemaDe(sistema), published: true }, select: { version: true, publishedAt: true, title: true } });
    const r = list.sort((a, b) => compareVersions(b.version, a.version))[0];
    return r ? { version: r.version, title: r.title, publishedAt: r.publishedAt } : null;
  }

  /**
   * Bibliotecas que o servidor usa, com a versão instalada de cada uma, mais Node.js e PostgreSQL.
   * A seção "Tecnologias do NITERA Resolve" junta isto com as bibliotecas do portal; nada é digitado à mão.
   */
  @Portal()
  @Get('novidades/tecnologias')
  tecnologias() {
    return lerTecnologias(this.prisma);
  }

  /** A versão mais recente com janela "O que há de novo" que o usuário ainda não viu. */
  @Get('novidades/pendente')
  async pending(@CurrentUser() u: AuthUser) {
    const list = await this.prisma.release.findMany({ where: { system: 'RESOLVE', published: true, announce: true }, include: { items: true } });
    const latest = list.sort(newestFirst)[0];
    if (!latest) return null;
    const seen = await this.prisma.releaseView.findUnique({ where: { releaseId_userId: { releaseId: latest.id, userId: u.id } } });
    return seen ? null : this.publicView(latest);
  }

  @Post('novidades/:id/vista')
  @HttpCode(204)
  async seen(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const r = await this.prisma.release.findUnique({ where: { id }, select: { published: true, system: true } });
    if (!r?.published || r.system !== 'RESOLVE') throw new NotFoundException('Versão não encontrada');
    try {
      await this.prisma.releaseView.upsert({
        where: { releaseId_userId: { releaseId: id, userId: u.id } },
        create: { releaseId: id, userId: u.id },
        update: {},
      });
    } catch (e) {
      // usuário removido entre o login e o clique: não há o que registrar
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003')) throw e;
    }
  }

  @Public()
  @Get('novidades/:version')
  async one(@Param('version') version: string, @Query('sistema') sistema?: string, @CurrentUser() u?: AuthUser) {
    await this.portalAberto(sistema, u);
    if (!SEMVER.test(version)) throw new NotFoundException('Versão não encontrada');
    const r = await this.prisma.release.findUnique({ where: { system_version: { system: sistemaDe(sistema), version } }, include: { items: true } });
    if (!r || !r.published) throw new NotFoundException('Versão não encontrada');
    return this.publicView(r);
  }

  // ───────── painel ─────────

  private async load(id: string) {
    const r = await this.prisma.release.findUnique({ where: { id }, include: { items: true, _count: { select: { views: true } } } });
    if (!r) throw new NotFoundException('Versão não encontrada');
    return r;
  }

  private async checkVersion(system: ReleaseSystem, version: string, ignoreId?: string) {
    const other = await this.prisma.release.findUnique({ where: { system_version: { system, version } }, select: { id: true } });
    if (other && other.id !== ignoreId) throw new ConflictException(`A versão ${version} ${nomeSistema(system)} já existe`);
  }

  private releaseData(dto: ReleaseDto) {
    return {
      version: dto.version.trim(),
      title: stripTags(dto.title).slice(0, 160),
      summary: dto.summary ? stripTags(dto.summary).slice(0, 600) || null : null,
      ...(dto.announce !== undefined ? { announce: dto.announce } : {}),
    };
  }

  private async itemData(dto: ReleaseItemDto) {
    const title = stripTags(dto.title).slice(0, 160);
    if (title.length < 3) throw new BadRequestException('O título do item precisa ter ao menos 3 caracteres');
    const description = sanitizeHtml(dto.description ?? '').trim();
    if (stripTags(description).length < 3 && !/<img\s/i.test(description)) throw new BadRequestException('Descreva o que mudou neste item');
    if (dto.imageId && !(await this.prisma.fileAsset.findFirst({ where: { id: dto.imageId, public: true, mimeType: { startsWith: 'image/' } } })))
      throw new BadRequestException('Imagem não encontrada. Envie a imagem novamente');
    const reason = dto.reason ? stripTags(dto.reason).trim().slice(0, 1000) || null : null;
    return { kind: dto.kind, title, description, reason, imageId: dto.imageId ?? null };
  }

  private saveError(e: unknown, system: ReleaseSystem, version: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(`A versão ${version} ${nomeSistema(system)} já existe`);
    throw e;
  }

  @Roles('TI', 'COMUNICACAO')
  @Get('admin/novidades')
  async adminList(@Query('sistema') sistema?: string) {
    const list = await this.prisma.release.findMany({ where: { system: sistemaDe(sistema) }, include: { items: true, _count: { select: { views: true } } } });
    // rascunhos (sem data) aparecem junto, ordenados pelo número da versão
    return list.sort((a, b) => compareVersions(b.version, a.version)).map((r) => this.view(r));
  }

  @Roles('TI', 'COMUNICACAO')
  @Get('admin/novidades/:id')
  async adminOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.view(await this.load(id));
  }

  @Roles('TI', 'COMUNICACAO')
  @Post('admin/novidades')
  async create(@Body() dto: ReleaseDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const data = this.releaseData(dto);
    const system = sistemaDe(dto.sistema);
    await this.checkVersion(system, data.version);
    const r = await this.prisma.release
      .create({ data: { ...data, system, published: false } })
      .catch((e) => this.saveError(e, system, data.version));
    await this.audit.log(u.id, 'criar', 'Release', r.id, { ...data, system }, ip);
    return this.view(await this.load(r.id));
  }

  @Roles('TI', 'COMUNICACAO')
  @Patch('admin/novidades/:id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const atual = await this.load(id);
    const data = this.releaseData(dto);
    await this.checkVersion(atual.system, data.version, id);
    await this.prisma.release.update({ where: { id }, data }).catch((e) => this.saveError(e, atual.system, data.version));
    await this.audit.log(u.id, 'editar', 'Release', id, data, ip);
    return this.view(await this.load(id));
  }

  @Roles('TI', 'COMUNICACAO')
  @Delete('admin/novidades/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.load(id);
    await this.prisma.release.delete({ where: { id } });
    await this.audit.log(u.id, 'excluir', 'Release', id, { version: r.version, title: r.title }, ip);
  }

  @Roles('TI', 'COMUNICACAO')
  @Post('admin/novidades/:id/publicacao')
  async publish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.load(id);
    if (dto.published && !r.items.length) throw new BadRequestException('Adicione ao menos um item antes de publicar a versão');
    const first = dto.published && !r.publishedAt;
    await this.prisma.$transaction(async (tx) => {
      await tx.release.update({ where: { id }, data: { published: dto.published, ...(first ? { publishedAt: new Date() } : {}) } });
      // o aviso no sino vai para todos só na primeira publicação (republicar não repete o aviso)
      if (first) {
        const vars = { versao: r.version, titulo: r.title };
        await notify(tx, {
          title: await renderMensagem(tx, 'novidades.publicada.titulo', vars),
          body: await renderMensagem(tx, 'novidades.publicada.texto', vars),
          link: `/novidades/${r.version}`,
          level: 'INFO',
        });
      }
    });
    await this.audit.log(u.id, dto.published ? 'publicar' : 'despublicar', 'Release', id, { version: r.version }, ip);
    return this.view(await this.load(id));
  }

  // ───────── itens ─────────

  @Roles('TI', 'COMUNICACAO')
  @Post('admin/novidades/:id/itens')
  async addItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseItemDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.load(id);
    if (r.items.length >= 200) throw new BadRequestException('Limite de 200 itens por versão');
    const data = await this.itemData(dto);
    const order = r.items.reduce((m, i) => Math.max(m, i.order + 1), 0);
    const it = await this.prisma.releaseItem.create({ data: { ...data, order, releaseId: id } });
    await this.audit.log(u.id, 'criar', 'ReleaseItem', it.id, { version: r.version, kind: data.kind, title: data.title, imageId: data.imageId }, ip);
    return this.item(it);
  }

  @Roles('TI', 'COMUNICACAO')
  @Patch('admin/novidades/:id/itens/:itemId')
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ReleaseItemDto,
    @CurrentUser() u: AuthUser,
    @ClientIp() ip: string,
  ) {
    const found = await this.prisma.releaseItem.findFirst({ where: { id: itemId, releaseId: id } });
    if (!found) throw new NotFoundException('Item não encontrado');
    const data = await this.itemData(dto);
    const it = await this.prisma.releaseItem.update({ where: { id: itemId }, data });
    await this.audit.log(u.id, 'editar', 'ReleaseItem', itemId, { kind: data.kind, title: data.title, imageId: data.imageId }, ip);
    return this.item(it);
  }

  @Roles('TI', 'COMUNICACAO')
  @Delete('admin/novidades/:id/itens/:itemId')
  @HttpCode(204)
  async removeItem(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const found = await this.prisma.releaseItem.findFirst({ where: { id: itemId, releaseId: id } });
    if (!found) throw new NotFoundException('Item não encontrado');
    await this.prisma.releaseItem.delete({ where: { id: itemId } });
    await this.audit.log(u.id, 'excluir', 'ReleaseItem', itemId, { title: found.title }, ip);
  }

  @Roles('TI', 'COMUNICACAO')
  @Put('admin/novidades/:id/itens/ordem')
  async reorder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderItemsDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.load(id);
    const own = new Set(r.items.map((i) => i.id));
    if (new Set(dto.ids).size !== dto.ids.length || dto.ids.some((i) => !own.has(i))) throw new BadRequestException('Lista de itens inválida');
    // itens não enviados vão para o fim, mantendo a ordem atual
    const rest = [...r.items].sort((a, b) => a.order - b.order).map((i) => i.id).filter((i) => !dto.ids.includes(i));
    const ids = [...dto.ids, ...rest];
    await this.prisma.$transaction(ids.map((itemId, order) => this.prisma.releaseItem.update({ where: { id: itemId }, data: { order } })));
    await this.audit.log(u.id, 'reordenar', 'ReleaseItem', null, { version: r.version, total: ids.length }, ip);
    return this.view(await this.load(id));
  }
}

@Module({ controllers: [NovidadesController] })
export class NovidadesModule {}
