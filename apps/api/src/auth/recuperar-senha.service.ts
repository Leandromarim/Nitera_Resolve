import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../common/audit.service';
import { randomToken, sha256 } from '../common/crypto';
import {
  RECUPERACAO_MAX_HORA,
  RECUPERACAO_MINUTOS,
  enviarAvisoSenhaAlterada,
  enviarLinkRecuperacao,
  linkRecuperacao,
  recuperacaoDisponivel,
} from '../common/recuperar-senha';
import { MailService } from '../integrations/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, contaVencida } from './auth.service';

const INVALIDO = 'Este link não vale mais. Peça um novo em "Esqueci minha senha".';

/** "Esqueci minha senha": link de uso único, por 30 minutos, para o e-mail do cadastro. */
@Injectable()
export class RecuperarSenhaService {
  private readonly log = new Logger('Recuperar senha');

  constructor(private prisma: PrismaService, private mail: MailService, private audit: AuditService, private auth: AuthService) {}

  disponivel() {
    return recuperacaoDisponivel(this.mail);
  }

  /**
   * A resposta é sempre a mesma e sai na hora, exista a conta ou não; o trabalho segue em segundo plano.
   * Assim nem a mensagem nem o tempo de resposta revelam quais usuários ou e-mails existem.
   */
  solicitar(login: string, ip?: string) {
    if (this.disponivel()) {
      void this.processar(login.trim().toLowerCase(), ip).catch((e) => this.log.warn(`Falha ao processar pedido: ${e.message}`));
    }
    return { ok: true };
  }

  private async processar(login: string, ip?: string) {
    if (!login) return;
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: login }, { username: login }] } });
    if (!user || !user.active || contaVencida(user) || !user.email || user.email.endsWith('@sem-email.invalid')) return;
    const recentes = await this.prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (recentes >= RECUPERACAO_MAX_HORA) {
      await this.audit.log(user.id, 'senha.recuperacao.limite', 'User', user.id, undefined, ip);
      return;
    }
    const token = randomToken(32);
    await this.prisma.$transaction([
      // só o link mais novo vale
      this.prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RECUPERACAO_MINUTOS * 60_000), ip } }),
    ]);
    await this.audit.log(user.id, 'senha.recuperacao.solicitada', 'User', user.id, undefined, ip);
    await enviarLinkRecuperacao(this.prisma, this.mail, user.email, user.name, 'NITERA Resolve', linkRecuperacao('/redefinir-senha', token));
  }

  private async pedidoValido(token: string) {
    const r = await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!r || r.usedAt || r.expiresAt < new Date() || !r.user.active || contaVencida(r.user)) return null;
    return r;
  }

  async validar(token: string) {
    const r = await this.pedidoValido(token);
    return r ? { valido: true, nome: r.user.name.split(/\s+/)[0] } : { valido: false };
  }

  async redefinir(token: string, senha: string, ip?: string) {
    const r = await this.pedidoValido(token);
    if (!r) throw new BadRequestException(INVALIDO);
    if (await argon2.verify(r.user.passwordHash, senha)) throw new BadRequestException('A nova senha precisa ser diferente da atual');
    const hash = await this.auth.hashPassword(senha);
    await this.prisma.$transaction(async (tx) => {
      // marca o uso primeiro: dois envios ao mesmo tempo com o mesmo link não passam os dois
      const uso = await tx.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: new Date() } });
      if (uso.count !== 1) throw new BadRequestException(INVALIDO);
      await tx.user.update({ where: { id: r.userId }, data: { passwordHash: hash, mustChangePassword: false, senhaProvisoria: false, senhaProvisoriaAte: null, failedLogins: 0, lockedUntil: null } });
      await tx.passwordReset.updateMany({ where: { userId: r.userId, usedAt: null }, data: { usedAt: new Date() } });
      // quem estava logado com a senha antiga (inclusive um invasor) sai de todos os aparelhos
      await tx.refreshToken.updateMany({ where: { userId: r.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    await this.audit.log(r.userId, 'senha.redefinida.email', 'User', r.userId, undefined, ip);
    await enviarAvisoSenhaAlterada(this.prisma, this.mail, r.user.email, r.user.name, 'NITERA Resolve').catch(() => undefined);
    return { ok: true };
  }
}
