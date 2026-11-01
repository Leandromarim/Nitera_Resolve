/**
 * Cria uma conta direto no servidor (o primeiro administrador, ou quando ninguém consegue entrar).
 * A senha temporária aparece uma única vez e precisa ser trocada no primeiro acesso. Nada é gravado em log.
 *
 * Uso (no servidor, dentro da pasta do NITERA Resolve):
 *   docker compose exec api node dist/scripts/criar-usuario.js --usuario admin --nome "Nome Completo" [--email nome@instituicao.com.br] [--perfil "Administrador"]
 *   docker compose exec api node dist/scripts/criar-usuario.js --usuario admin --redefinir [--zerar-duas-etapas]
 *
 * --redefinir: gera outra senha temporária, desbloqueia e reativa a conta e encerra as sessões dela;
 * com --zerar-duas-etapas também desliga a verificação em duas etapas (celular perdido).
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { ARGON_OPTS } from '../auth/auth.service';

const arg = (nome: string) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const flag = (nome: string) => process.argv.includes(`--${nome}`);

/** 14 caracteres com maiúscula, minúscula, número e símbolo, sem letras que se confundem (I, l, O, 0). */
function senhaTemporaria(tamanho = 14) {
  const mai = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const min = 'abcdefghijkmnpqrstuvwxyz';
  const num = '23456789';
  const sim = '@#%&*!?-_';
  const pick = (s: string) => s[randomInt(s.length)];
  const base = [pick(mai), pick(min), pick(num), pick(sim)];
  while (base.length < tamanho) base.push(pick(mai + min + num + sim));
  for (let i = base.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}

async function redefinir(prisma: PrismaClient, usuario: string) {
  const u = await prisma.user.findUnique({ where: { username: usuario } });
  if (!u) throw new Error(`Não existe o usuário ${usuario}`);
  const zerar = flag('zerar-duas-etapas');
  const senha = senhaTemporaria();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: u.id },
      data: {
        passwordHash: await argon2.hash(senha, ARGON_OPTS),
        mustChangePassword: true,
        senhaProvisoria: false,
        senhaProvisoriaAte: null,
        failedLogins: 0,
        lockedUntil: null,
        active: true,
        validUntil: null,
        ...(zerar ? { totpEnabled: false, totpSecret: null } : {}),
      },
    }),
    prisma.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({ data: { action: 'redefinir-senha', entity: 'User', entityId: u.id, data: { usuario, origem: 'linha de comando no servidor', duasEtapasZerada: zerar, reativada: !u.active } } }),
  ]);
  console.log('');
  console.log(`Senha do usuário ${usuario} redefinida${zerar ? ' e verificação em duas etapas desligada' : ''}. As sessões abertas foram encerradas.`);
  console.log(`Senha temporária (aparece só agora): ${senha}`);
  console.log('No próximo acesso a pessoa troca a senha.');
  console.log('');
}

async function criar(prisma: PrismaClient, usuario: string) {
  const nome = arg('nome')?.trim();
  if (!nome || nome.length < 3) throw new Error('Informe --nome "Nome Completo"');
  const email = (arg('email')?.trim().toLowerCase() || `${usuario}@sem-email.invalid`).slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido');
  const perfilNome = arg('perfil') ?? 'Administrador';
  const perfil = await prisma.accessProfile.findUnique({ where: { name: perfilNome } });
  if (!perfil) throw new Error(`Perfil "${perfilNome}" não encontrado. Suba a API uma vez (ela cria os perfis) e tente de novo.`);
  if (await prisma.user.findUnique({ where: { username: usuario } })) throw new Error(`Já existe o usuário ${usuario}. Para trocar a senha dele, use --redefinir.`);
  if (await prisma.user.findUnique({ where: { email } })) throw new Error(`Já existe uma conta com o e-mail ${email}.`);
  const setor = await prisma.department.findFirst({ orderBy: { createdAt: 'asc' } });
  const senha = senhaTemporaria();
  const [primeiro, ...resto] = nome.split(/\s+/);
  const u = await prisma.user.create({
    data: {
      username: usuario,
      name: nome,
      firstName: primeiro,
      lastName: resto.join(' ') || null,
      email,
      passwordHash: await argon2.hash(senha, ARGON_OPTS),
      mustChangePassword: true,
      roles: perfil.roles,
      profileId: perfil.id,
      departmentId: setor?.id ?? null,
    },
  });
  await prisma.auditLog.create({ data: { action: 'criar', entity: 'User', entityId: u.id, data: { usuario, nome, perfil: perfil.name, origem: 'linha de comando no servidor' } } });
  console.log('');
  console.log(`Conta criada: ${usuario} (${nome}), perfil ${perfil.name}.`);
  console.log(`Senha temporária (aparece só agora): ${senha}`);
  console.log('No primeiro acesso a pessoa troca a senha. Para o administrador, ative também a verificação em duas etapas em Meu perfil.');
  console.log('');
}

async function main() {
  const usuario = arg('usuario')?.trim().toLowerCase();
  if (!usuario || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(usuario)) {
    console.error('Uso: node dist/scripts/criar-usuario.js --usuario <login> --nome "Nome Completo" [--email <e-mail>] [--perfil "Administrador"]');
    console.error('  ou: node dist/scripts/criar-usuario.js --usuario <login> --redefinir [--zerar-duas-etapas]');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    if (flag('redefinir')) await redefinir(prisma, usuario);
    else await criar(prisma, usuario);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`Erro: ${(e as Error).message}`);
  process.exit(1);
});
