import { Controller, Get, Global, Injectable, Module } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from './decorators';

export const ACESSO_KEY = 'acesso';
/** Cookie que deixa o navegador de quem entrou abrir as imagens e PDFs do portal (as tags <img> não levam o token). */
export const COOKIE_ARQUIVOS = 'nr_fa';
const VALIDADE_COOKIE_S = 8 * 3600;

/** Configurações cujas imagens aparecem antes do login (logo e ícone da aba). */
const CHAVES_ABERTAS = ['logoUrl', 'logoLightUrl', 'faviconUrl'];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * No NITERA Resolve tudo exige login. O serviço guarda também o cookie que deixa o navegador de quem entrou
 * abrir as imagens (as tags <img> não levam o token) e a lista de arquivos que a tela de login mostra (logo, ícone).
 */
@Injectable()
export class AcessoService {
  private cache: { exigir: boolean; ate: number } | null = null;
  private abertos: { ids: Set<string>; ate: number } | null = null;

  constructor(private prisma: PrismaService) {}

  async exigirLogin(): Promise<boolean> {
    return true;
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
  /** O site pergunta se precisa mandar o visitante para o login: no Resolve, sempre. */
  @Public()
  @Get('acesso')
  publico() {
    return { exigirLogin: true, abertas: [] as string[] };
  }
}

@Global()
@Module({ controllers: [AcessoController], providers: [AcessoService], exports: [AcessoService] })
export class AcessoModule {}
