import { BadRequestException, ForbiddenException, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { nomeDoSite } from '../mensagens/mensagens.service';
import { AuditService } from '../common/audit.service';
import { randomToken, sha256 } from '../common/crypto';
import { AcessoService } from '../common/acesso';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const REFRESH_DAYS_SHORT = 1;
const REFRESH_DAYS_LONG = 14;
/** Um token recém-trocado ainda vale por este tempo (abas abertas renovando juntas), sem ser tratado como reuso. */
const REUSO_TOLERANCIA_MS = 60_000;

authenticator.options = { window: 1 };
/** Só para explicar o erro: o código bate com até 5 minutos de diferença? Então o relógio do celular está errado. */
const relogio = authenticator.clone();
relogio.options = { window: 10 }; // clone() ignora as opções passadas: precisa atribuir depois

export const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 } as const;

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

/** Conta com "Válido até" no passado (cadastro de usuário): não entra nem renova a sessão. */
export function contaVencida(user: { validUntil?: Date | null }) {
  return !!user.validUntil && user.validUntil <= new Date();
}

@Injectable()
export class AuthService {
  // Hash usado quando o usuário não existe, para que o tempo de resposta não revele contas válidas.
  private readonly dummyHash = argon2.hash(randomToken(), ARGON_OPTS);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
    @Optional() private acesso?: AcessoService,
  ) {}

  /** Perfil obrigado a usar duas etapas (Configurações › Acesso) e ainda sem o autenticador (auditoria AUT-01). */
  async duasEtapasPendente(user: Pick<User, 'roles' | 'totpEnabled'>): Promise<boolean> {
    return this.acesso ? this.acesso.duasEtapasPendente({ roles: user.roles, totpEnabled: user.totpEnabled }) : false;
  }

  hashPassword(password: string) {
    return argon2.hash(password, ARGON_OPTS);
  }

  async login(login: string, password: string, totp: string | undefined, remember: boolean, meta: SessionMeta) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: login.toLowerCase().trim() }, { username: login.toLowerCase().trim() }] },
    });
    if (!user) {
      await argon2.verify(await this.dummyHash, password).catch(() => false);
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }
    if (!user.active) throw new UnauthorizedException('Usuário ou senha inválidos');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em alguns minutos.');
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed >= MAX_FAILED ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await this.audit.log(user.id, 'login.falhou', 'User', user.id, undefined, meta.ip);
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }

    if (senhaProvisoriaVencida(user)) {
      await this.audit.log(user.id, 'login.senha_provisoria_vencida', 'User', user.id, undefined, meta.ip);
      throw new ForbiddenException('A senha provisória venceu. Peça uma nova à TI.');
    }

    if (contaVencida(user)) {
      await this.audit.log(user.id, 'login.conta_vencida', 'User', user.id, undefined, meta.ip);
      throw new ForbiddenException('O prazo de acesso desta conta terminou. Procure a TI.');
    }

    if (user.totpEnabled) {
      if (!totp) return { requiresTotp: true as const };
      if (!user.totpSecret || !authenticator.check(totp, user.totpSecret)) {
        throw new UnauthorizedException(
          user.totpSecret && relogio.check(totp, user.totpSecret)
            ? 'Código de verificação inválido: o horário do celular está diferente do horário certo. Ative "data e hora automáticas" no celular e tente de novo com o código novo.'
            : 'Código de verificação inválido',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.log(user.id, 'login', 'User', user.id, undefined, meta.ip);
    return this.issueSession(user, randomToken(16), remember, meta);
  }

  private async issueSession(user: User, family: string, remember: boolean, meta: SessionMeta) {
    const pendente = await this.duasEtapasPendente(user);
    const accessToken = await this.signAccess(user, family, pendente);
    const raw = randomToken(48);
    const days = remember ? REFRESH_DAYS_LONG : REFRESH_DAYS_SHORT;
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const rt = await this.prisma.refreshToken.create({
      data: { userId: user.id, family, tokenHash: sha256(raw), expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 250) },
    });
    return { accessToken, refreshToken: raw, refreshExpiresAt: expiresAt, refreshId: rt.id, user: this.publicUser(user, pendente), remember };
  }

  /** `sid` liga o token à sessão (família de refresh), para o SGQ conferir revogação a cada requisição; `mfa` indica login com segundo fator. */
  signAccess(user: Pick<User, 'id' | 'name' | 'email' | 'roles' | 'totpEnabled' | 'mustChangePassword' | 'senhaProvisoria'>, family?: string, mfaPendente = false) {
    return this.jwt.signAsync(
      { sub: user.id, name: user.name, email: user.email, roles: user.roles, ...(family ? { sid: family } : {}), mfa: !!user.totpEnabled, ...(user.senhaProvisoria && user.mustChangePassword ? { prov: true } : {}), ...(mfaPendente ? { mfap: true } : {}) },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m', audience: 'nitera-resolve', issuer: 'nitera-resolve-api', algorithm: 'HS256' },
    );
  }

  /** Rotação do refresh token com detecção de reuso: um token já usado revoga a família inteira. */
  async refresh(raw: string | undefined, meta: SessionMeta) {
    if (!raw) throw new UnauthorizedException();
    const current = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, include: { user: true } });
    if (!current) throw new UnauthorizedException();
    // outra aba (ou uma resposta que se perdeu) acabou de trocar este token: não é roubo, só corrida entre abas
    let corrida = !!current.revokedAt && !!current.replacedBy && Date.now() - current.revokedAt.getTime() < REUSO_TOLERANCIA_MS;
    // A tolerância só vale se a sessão ainda está viva: depois de sair, trocar ou redefinir a senha, o token
    // antigo não pode abrir uma sessão nova, mesmo dentro dos 60 s (auditoria AUT-02).
    if (corrida && !(await this.sessaoViva(current.replacedBy!))) {
      await this.audit.log(current.userId, 'sessao.token_antigo_recusado', 'User', current.userId, undefined, meta.ip);
      throw new UnauthorizedException('Sessão encerrada. Faça login novamente.');
    }
    if (current.revokedAt && !corrida) {
      await this.prisma.refreshToken.updateMany({ where: { family: current.family, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log(current.userId, 'sessao.reuso_detectado', 'User', current.userId, undefined, meta.ip);
      throw new UnauthorizedException('Sessão encerrada por segurança. Faça login novamente.');
    }
    if (current.expiresAt < new Date() || !current.user.active || contaVencida(current.user) || senhaProvisoriaVencida(current.user)) throw new UnauthorizedException();

    const remember = current.expiresAt.getTime() - current.createdAt.getTime() > REFRESH_DAYS_SHORT * 86_400_000 + 60_000;
    const session = await this.issueSession(current.user, current.family, remember, meta);
    if (!corrida) await this.prisma.refreshToken.update({ where: { id: current.id }, data: { revokedAt: new Date(), replacedBy: session.refreshId } });
    return session;
  }

  /** Segue a corrente de trocas a partir de um token: a sessão está viva se o último da corrente não foi revogado. */
  private async sessaoViva(id: string): Promise<boolean> {
    let proximo: string | null = id;
    for (let i = 0; proximo && i < 20; i++) {
      const rt: { revokedAt: Date | null; replacedBy: string | null; expiresAt: Date } | null = await this.prisma.refreshToken.findUnique({
        where: { id: proximo },
        select: { revokedAt: true, replacedBy: true, expiresAt: true },
      });
      if (!rt) return false;
      if (!rt.revokedAt) return rt.expiresAt > new Date();
      proximo = rt.replacedBy;
    }
    return false;
  }

  async logout(raw: string | undefined) {
    if (!raw) return;
    const rt = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (rt) await this.prisma.refreshToken.updateMany({ where: { family: rt.family, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async changePassword(userId: string, current: string, next: string, currentRefresh?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, current))) throw new BadRequestException('Senha atual incorreta');
    if (await argon2.verify(user.passwordHash, next)) throw new BadRequestException('A nova senha deve ser diferente da atual');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(next), mustChangePassword: false, senhaProvisoria: false, senhaProvisoriaAte: null } });
    // encerra as outras sessões, mas mantém a deste navegador (senão o usuário cai para o login logo depois)
    const mine = currentRefresh ? await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(currentRefresh) } }) : null;
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(mine?.userId === userId ? { family: { not: mine.family } } : {}) },
      data: { revokedAt: new Date() },
    });
    await this.audit.log(userId, 'senha.alterada', 'User', userId);
  }

  async totpSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw new BadRequestException('A verificação em duas etapas já está ativa');
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
    const otpauth = authenticator.keyuri(user.email, `NITERA Resolve ${await nomeDoSite(this.prisma)}`, secret);
    return { secret, qrCode: await QRCode.toDataURL(otpauth) };
  }

  async totpEnable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecret || !authenticator.check(code, user.totpSecret)) throw new BadRequestException('Código inválido');
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await this.audit.log(userId, '2fa.ativado', 'User', userId);
  }

  async totpDisable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (await this.duasEtapasPendente({ roles: user.roles, totpEnabled: false }))
      throw new ForbiddenException('Seu perfil exige a verificação em duas etapas. Para trocar de celular, peça à TI para zerar e cadastre de novo.');
    if (!user.totpSecret || !authenticator.check(code, user.totpSecret)) throw new BadRequestException('Código inválido');
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null } });
    await this.audit.log(userId, '2fa.desativado', 'User', userId);
  }

  publicUser(u: User, duasEtapasPendente = false) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      roles: u.roles,
      avatarUrl: u.avatarUrl,
      jobTitle: u.jobTitle,
      extension: u.extension,
      departmentId: u.departmentId,
      totpEnabled: u.totpEnabled,
      mustChangePassword: u.mustChangePassword,
      duasEtapasPendente,
    };
  }
}

/** Senha provisória simples que passou do prazo sem ser trocada: não entra mais (a TI define outra). */
export function senhaProvisoriaVencida(u: Pick<User, 'senhaProvisoria' | 'senhaProvisoriaAte'>) {
  return u.senhaProvisoria && !!u.senhaProvisoriaAte && u.senhaProvisoriaAte < new Date();
}
