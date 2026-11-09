import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

/** Prisma em memória — só o necessário para o fluxo de login/refresh. */
function fakePrisma(user: any) {
  const tokens: any[] = [];
  return {
    tokens,
    user: {
      findFirst: async () => user,
      findUniqueOrThrow: async () => user,
      update: async ({ data }: any) => Object.assign(user, data),
    },
    refreshToken: {
      create: async ({ data }: any) => {
        const t = { id: String(tokens.length + 1), createdAt: new Date(), revokedAt: null, ...data };
        tokens.push(t);
        return t;
      },
      findUnique: async ({ where }: any) => {
        const t = tokens.find((x) => (where.tokenHash ? x.tokenHash === where.tokenHash : x.id === where.id));
        return t ? { ...t, user } : null;
      },
      update: async ({ where, data }: any) => Object.assign(tokens.find((x) => x.id === where.id), data),
      updateMany: async ({ where, data }: any) => {
        tokens.filter((x) => x.family === where.family && !x.revokedAt).forEach((x) => Object.assign(x, data));
      },
    },
  };
}

describe('AuthService', () => {
  process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret';
  const audit = { log: async () => undefined } as any;
  let user: any;

  beforeEach(async () => {
    user = {
      id: 'u1', name: 'Teste', email: 't@h.com', username: 't', roles: ['COLABORADOR'], active: true,
      passwordHash: await argon2.hash('Senha@Forte123'), failedLogins: 0, lockedUntil: null, totpEnabled: false,
    };
  });

  it('bloqueia a conta após 5 senhas erradas', async () => {
    const svc = new AuthService(fakePrisma(user) as any, new JwtService(), audit);
    for (let i = 0; i < 5; i++) await expect(svc.login('t', 'errada', undefined, false, {})).rejects.toThrow();
    expect(user.lockedUntil).toBeInstanceOf(Date);
    await expect(svc.login('t', 'Senha@Forte123', undefined, false, {})).rejects.toThrow(/bloqueada/);
  });

  it('pede o código quando o 2FA está ativo', async () => {
    user.totpEnabled = true;
    user.totpSecret = 'JBSWY3DPEHPK3PXP';
    const svc = new AuthService(fakePrisma(user) as any, new JwtService(), audit);
    await expect(svc.login('t', 'Senha@Forte123', undefined, false, {})).resolves.toEqual({ requiresTotp: true });
  });

  it('rotaciona o refresh token e revoga a família quando um token antigo é reutilizado', async () => {
    const prisma = fakePrisma(user);
    const svc = new AuthService(prisma as any, new JwtService(), audit);
    const s1: any = await svc.login('t', 'Senha@Forte123', undefined, false, {});
    const s2 = await svc.refresh(s1.refreshToken, {});
    expect(s2.refreshToken).not.toEqual(s1.refreshToken);
    // reuso muito antes (fora da tolerância entre abas) é tratado como roubo
    prisma.tokens[0].revokedAt = new Date(Date.now() - 5 * 60_000);
    await expect(svc.refresh(s1.refreshToken, {})).rejects.toThrow(/segurança/);
    await expect(svc.refresh(s2.refreshToken, {})).rejects.toThrow();
  });

  it('aceita o token recém-trocado por outra aba sem derrubar a sessão', async () => {
    const prisma = fakePrisma(user);
    const svc = new AuthService(prisma as any, new JwtService(), audit);
    const s1: any = await svc.login('t', 'Senha@Forte123', undefined, false, {});
    const s2 = await svc.refresh(s1.refreshToken, {});
    const s3 = await svc.refresh(s1.refreshToken, {});
    expect(s3.refreshToken).not.toEqual(s2.refreshToken);
    await expect(svc.refresh(s2.refreshToken, {})).resolves.toBeTruthy();
    await expect(svc.refresh(s3.refreshToken, {})).resolves.toBeTruthy();
  });

  it('depois de sair, o token antigo não revive a sessão nem dentro da tolerância de 60 s (AUT-02)', async () => {
    const prisma = fakePrisma(user);
    const svc = new AuthService(prisma as any, new JwtService(), audit);
    const s1: any = await svc.login('t', 'Senha@Forte123', undefined, false, {});
    const s2 = await svc.refresh(s1.refreshToken, {});
    await svc.logout(s2.refreshToken);
    await expect(svc.refresh(s1.refreshToken, {})).rejects.toThrow(/encerrada/);
    await expect(svc.refresh(s2.refreshToken, {})).rejects.toThrow();
  });

  it('a tolerância segue a corrente de trocas enquanto a sessão está viva', async () => {
    const prisma = fakePrisma(user);
    const svc = new AuthService(prisma as any, new JwtService(), audit);
    const s1: any = await svc.login('t', 'Senha@Forte123', undefined, false, {});
    const s2 = await svc.refresh(s1.refreshToken, {});
    const s3 = await svc.refresh(s2.refreshToken, {});
    await expect(svc.refresh(s1.refreshToken, {})).resolves.toBeTruthy();
    await svc.logout(s3.refreshToken);
    await expect(svc.refresh(s1.refreshToken, {})).rejects.toThrow(/encerrada/);
  });

  it('o login sem "manter conectado" vale 24 horas', async () => {
    const svc = new AuthService(fakePrisma(user) as any, new JwtService(), audit);
    const s: any = await svc.login('t', 'Senha@Forte123', undefined, false, {});
    expect(s.refreshExpiresAt.getTime() - Date.now()).toBeGreaterThan(23.9 * 3_600_000);
  });
});
