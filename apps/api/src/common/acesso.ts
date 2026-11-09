import { Body, Controller, Get, Global, Injectable, Module, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsIn } from 'class-validator';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AuthUser, ClientIp, CurrentUser, Public, Roles } from './decorators';

export const ACESSO_KEY = 'acesso';
/** Cookie que deixa o navegador de quem entrou abrir as imagens e PDFs do portal (as tags <img> não levam o token). */
export const COOKIE_ARQUIVOS = 'nr_fa';
const VALIDADE_COOKIE_S = 8 * 3600;

/** Configurações cujas imagens aparecem antes do login (logo e ícone da aba). */
const CHAVES_ABERTAS = ['logoUrl', 'logoLightUrl', 'faviconUrl'];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Perfis que podem ficar obrigados a usar a verificação em duas etapas. */
export const PERFIS_DUAS_ETAPAS: Role[] = Object.values(Role).filter((r) => r !== 'COLABORADOR');
/** Padrão (auditoria AUT-01): administradores e TI sempre com duas etapas. */
export const DUAS_ETAPAS_PADRAO: Role[] = ['ADMIN', 'TI'];

class DuasEtapasDto {
  @IsArray()
  @ArrayMaxSize(40)
  @IsIn(PERFIS_DUAS_ETAPAS, { each: true })
  perfis!: Role[];
}

/**
 * No NITERA Resolve tudo exige login. O serviço guarda também o cookie que deixa o navegador de quem entrou
 * abrir as imagens (as tags <img> não levam o token) e a lista de arquivos que a tela de login mostra (logo, ícone).
 */
@Injectable()
export class AcessoService {
  private cache: { exigir: boolean; ate: number } | null = null;
  private abertos: { ids: Set<string>; ate: number } | null = null;
  private duas: { perfis: Role[]; ate: number } | null = null;

  constructor(private prisma: PrismaService) {}

  async exigirLogin(): Promise<boolean> {
    return true;
  }

  private async lerValor(): Promise<Record<string, unknown>> {
    const row = await this.prisma.setting.findUnique({ where: { key: ACESSO_KEY } });
    return row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? (row.value as Record<string, unknown>) : {};
  }

  /** Perfis obrigados a usar a verificação em duas etapas (sem configuração: ADMIN e TI). */
  async perfisDuasEtapas(): Promise<Role[]> {
    if (this.duas && this.duas.ate > Date.now()) return this.duas.perfis;
    const v = (await this.lerValor()).duasEtapas;
    const perfis = Array.isArray(v) ? v.filter((r): r is Role => PERFIS_DUAS_ETAPAS.includes(r as Role)) : DUAS_ETAPAS_PADRAO;
    this.duas = { perfis, ate: Date.now() + 15_000 };
    return perfis;
  }

  async salvarDuasEtapas(perfis: Role[]) {
    const unicos = [...new Set(perfis)];
    const value = { ...(await this.lerValor()), duasEtapas: unicos } as object;
    await this.prisma.setting.upsert({ where: { key: ACESSO_KEY }, create: { key: ACESSO_KEY, value }, update: { value } });
    this.duas = null;
    return { perfis: unicos };
  }

  /** A pessoa tem perfil obrigado a usar duas etapas e ainda não ativou? */
  async duasEtapasPendente(u: { roles: Role[]; totpEnabled: boolean }): Promise<boolean> {
    if (u.totpEnabled) return false;
    const perfis = await this.perfisDuasEtapas();
    return u.roles.some((r) => perfis.includes(r));
  }

  /** Arquivos que a tela de login precisa mostrar a quem ainda não entrou. */
  async arquivoAberto(id: string): Promise<boolean> {
    if (!this.abertos || this.abertos.ate < Date.now()) {
      const rows = await this.prisma.setting.findMany({ where: { key: { in: CHAVES_ABERTAS } } });
      const ids = new Set<string>();
      for (const r of rows) for (const m of JSON.stringify(r.value ?? '').match(UUID) ?? []) ids.add(m.toLowerCase());
      this.abertos = { ids, ate: Date.now() + 30_000 };
    }
    return this.abertos.ids.has(id.toLowerCase());
  }

  private assinar(texto: string) {
    return createHmac('sha256', `${process.env.JWT_ACCESS_SECRET ?? ''}:arquivos`).update(texto).digest('base64url');
  }

  /** Valor do cookie de arquivos: validade + usuário, assinados. Não serve para nada além de abrir arquivos do portal. */
  cookieArquivos(userId: string) {
    const exp = Math.floor(Date.now() / 1000) + VALIDADE_COOKIE_S;
    const corpo = `${exp}.${userId}`;
    return { valor: `${corpo}.${this.assinar(corpo)}`, maxAge: VALIDADE_COOKIE_S * 1000 };
  }

  cookieValido(valor?: string): boolean {
    if (!valor || typeof valor !== 'string') return false;
    const i = valor.lastIndexOf('.');
    if (i < 0) return false;
    const corpo = valor.slice(0, i);
    const exp = Number(corpo.split('.')[0]);
    if (!exp || exp < Date.now() / 1000) return false;
    const esperado = Buffer.from(this.assinar(corpo));
    const dado = Buffer.from(valor.slice(i + 1));
    return esperado.length === dado.length && timingSafeEqual(esperado, dado);
  }
}

@Controller()
export class AcessoController {
  constructor(private acesso: AcessoService, private audit: AuditService) {}

  /** O site pergunta se precisa mandar o visitante para o login: no Resolve, sempre. */
  @Public()
  @Get('acesso')
  publico() {
    return { exigirLogin: true, abertas: [] as string[] };
  }

  /** Configurações › Acesso: perfis obrigados a usar a verificação em duas etapas (auditoria AUT-01). */
  @Roles('ADMIN')
  @Get('admin/acesso')
  async ler() {
    return { exigirLogin: true, duasEtapas: await this.acesso.perfisDuasEtapas(), perfisPossiveis: PERFIS_DUAS_ETAPAS };
  }

  @Roles('ADMIN')
  @Put('admin/acesso/duas-etapas')
  async salvarDuasEtapas(@Body() dto: DuasEtapasDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const antes = await this.acesso.perfisDuasEtapas();
    const r = await this.acesso.salvarDuasEtapas(dto.perfis);
    await this.audit.log(u.id, 'editar duas etapas obrigatória', 'Acesso', null, { antes, depois: r.perfis }, ip);
    return r;
  }
}

@Global()
@Module({ controllers: [AcessoController], providers: [AcessoService], exports: [AcessoService] })
export class AcessoModule {}
