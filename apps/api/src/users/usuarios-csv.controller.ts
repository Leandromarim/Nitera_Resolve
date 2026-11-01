import { BadRequestException, Body, Controller, Get, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuditService } from '../common/audit.service';
import { randomToken } from '../common/crypto';
import { AuthUser, ClientIp, CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { parseCsv } from '../common/csv';

/** Domínio reservado (RFC 2606): nunca entrega e-mail. Marca quem veio sem e-mail próprio. */
export const SEM_EMAIL = '@sem-email.invalid';
export const semEmailProprio = (email: string) => email.endsWith(SEM_EMAIL);

const MAX_LINHAS = 5000;
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Colunas lidas (nomes do GLPI e da exportação do próprio sistema). Qualquer outra coluna é ignorada. */
const COLUNAS: Record<string, string[]> = {
  username: ['usuario', 'usuario (login)', 'login', 'nome de usuario'],
  firstName: ['primeiro nome', 'nome'],
  lastName: ['ultimo nome', 'sobrenome'],
  email: ['e-mails', 'e-mail', 'emails', 'email'],
  validUntil: ['valido ate', 'validade'],
  category: ['categoria'],
  profile: ['perfil', 'perfis'],
  active: ['ativo'],
};

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const capitalizar = (s: string) =>
  s
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, _i, todas) => (todas.length > 1 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');

function loginDe(s: string) {
  return norm(s)
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.]+|[.]+$/g, '')
    .slice(0, 40);
}

function dataDe(s: string | null): Date | null {
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59);
  return null;
}

/** Evita que planilhas executem fórmulas vindas do cadastro (CSV injection). */
function celula(v: unknown) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface Linha {
  linha: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketEmail: string | null;
  semEmail: boolean;
  categoria: string;
  perfil: string;
  validUntil: string | null;
  active: boolean;
  avisos: string[];
}

@Controller('admin/users')
@Roles('ADMIN')
export class UsuariosCsvController {
  constructor(private prisma: PrismaService, private auth: AuthService, private audit: AuditService) {}

  @Get('exportar')
  async exportar(@CurrentUser() u: AuthUser, @ClientIp() ip: string, @Res() res: Response) {
    const users = await this.prisma.user.findMany({
      orderBy: { username: 'asc' },
      select: {
        username: true, firstName: true, lastName: true, name: true, email: true, ticketEmail: true, phone: true, extension: true, jobTitle: true,
        validUntil: true, active: true, department: { select: { name: true } }, category: { select: { name: true } }, profile: { select: { name: true } },
        groups: { select: { name: true }, orderBy: { name: 'asc' } },
      },
    });
    const head = ['Usuário', 'Nome', 'Sobrenome', 'E-mail', 'E-mail dos chamados', 'Telefone', 'Ramal', 'Setor', 'Cargo', 'Categoria', 'Perfil', 'Grupos', 'Válido até', 'Ativo'];
    const linhas = users.map((x) => [
      x.username,
      x.firstName ?? x.name,
      x.lastName ?? '',
      semEmailProprio(x.email) ? '' : x.email,
      x.ticketEmail ?? '',
      x.phone ?? '',
      x.extension ?? '',
      x.department?.name ?? '',
      x.jobTitle ?? '',
      x.category?.name ?? '',
      x.profile?.name ?? '',
      x.groups.map((g) => g.name).join(', '),
      x.validUntil ? x.validUntil.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
      x.active ? 'Sim' : 'Não',
    ]);
    const csv = '﻿' + [head, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
    await this.audit.log(u.id, 'exportar', 'User', null, { total: users.length }, ip);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="usuarios-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  /**
   * Importa o CSV do GLPI ("Todas páginas em CSV") ou o da exportação acima.
   * Lê só os campos obrigatórios do cadastro; sem `confirmar=1` apenas mostra a prévia.
   * Nunca altera usuários existentes, nunca importa senha e nunca dá perfil com permissão de administrador.
   */
  @Post('importar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 5 } }))
  async importar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { categoryId?: string; profileId?: string },
    @Query('confirmar') confirmar: string | undefined,
    @CurrentUser() u: AuthUser,
    @ClientIp() ip: string,
  ) {
    if (!file) throw new BadRequestException('Envie o arquivo .csv');
    const nome = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (!/\.(csv|txt)$/i.test(nome) || file.buffer.includes(0)) throw new BadRequestException('Envie um arquivo .csv (no GLPI: "Todas páginas em CSV").');
    const uuid = /^[0-9a-f-]{36}$/i;
    if (!body.categoryId || !uuid.test(body.categoryId) || !body.profileId || !uuid.test(body.profileId)) throw new BadRequestException('Escolha a categoria e o perfil padrão.');

    const [perfis, categorias, padraoPerfil, padraoCategoria] = await Promise.all([
      this.prisma.accessProfile.findMany(),
      this.prisma.userCategory.findMany(),
      this.prisma.accessProfile.findUnique({ where: { id: body.profileId } }),
      this.prisma.userCategory.findUnique({ where: { id: body.categoryId } }),
    ]);
    if (!padraoPerfil || !padraoCategoria) throw new BadRequestException('Categoria ou perfil não encontrados.');
    if (padraoPerfil.roles.includes('ADMIN')) throw new BadRequestException('O perfil padrão da importação não pode ter permissão de administrador.');

    const rows = parseCsv(file.buffer).filter((r) => r.some((c) => c != null && String(c).trim()));
    if (rows.length < 2) throw new BadRequestException('O arquivo não tem usuários.');
    if (rows.length - 1 > MAX_LINHAS) throw new BadRequestException(`Até ${MAX_LINHAS} usuários por arquivo.`);
    const cab = rows[0]!.map((c) => norm(String(c ?? '')));
    const idx: Record<string, number> = {};
    for (const [campo, nomes] of Object.entries(COLUNAS)) {
      const i = cab.findIndex((c) => nomes.includes(c));
      if (i >= 0) idx[campo] = i;
    }
    if (idx.username === undefined) throw new BadRequestException('Não achei a coluna "Usuário". Exporte no GLPI com a coluna Usuário visível.');
    const ignoradas = rows[0]!.filter((_, i) => !Object.values(idx).includes(i)).map((c) => String(c ?? '')).filter(Boolean);
    const val = (r: (string | number | Date | null)[], campo: string) => (idx[campo] === undefined ? null : r[idx[campo]!] == null ? null : String(r[idx[campo]!]).trim() || null);

    // e-mails repetidos no arquivo (caixas de setor, ex.: recepcao@) não servem de login
    const emailDe = (r: (string | number | Date | null)[]) => (val(r, 'email') ?? '').split(/[\s,;]+/).map((e) => e.toLowerCase()).find((e) => EMAIL_RE.test(e)) ?? null;
    const usoEmail = new Map<string, number>();
    for (const r of rows.slice(1)) {
      const e = emailDe(r);
      if (e) usoEmail.set(e, (usoEmail.get(e) ?? 0) + 1);
    }
    const existentes = await this.prisma.user.findMany({ select: { username: true, email: true } });
    const loginsUsados = new Set(existentes.map((x) => x.username));
    const emailsUsados = new Set(existentes.map((x) => x.email));

    const prontos: Linha[] = [];
    const ignorados: { linha: number; usuario: string; motivo: string }[] = [];
    rows.slice(1).forEach((r, i) => {
      const linha = i + 2;
      const original = val(r, 'username') ?? '';
      const username = loginDe(original);
      if (username.length < 3) return ignorados.push({ linha, usuario: original, motivo: 'Usuário vazio ou curto demais' });
      if (loginsUsados.has(username)) return ignorados.push({ linha, usuario: username, motivo: 'Já existe no sistema (não foi alterado)' });
      const partes = original.trim().split(/\s+/);
      const firstName = capitalizar(val(r, 'firstName') ?? partes[0] ?? '');
      const lastName = capitalizar(val(r, 'lastName') ?? partes.slice(1).join(' '));
      if (!firstName || !lastName) return ignorados.push({ linha, usuario: username, motivo: 'Sem sobrenome (coluna Último nome vazia)' });
      const avisos: string[] = [];
      const e = emailDe(r);
      let email = `${username}${SEM_EMAIL}`;
      let ticketEmail: string | null = null;
      let semEmail = true;
      if (!e) avisos.push('Sem e-mail: não usa o Esqueci minha senha');
      else if ((usoEmail.get(e) ?? 0) > 1 || emailsUsados.has(e)) {
        ticketEmail = e;
        avisos.push(`E-mail ${e} é compartilhado: vai só para os avisos dos chamados`);
      } else {
        email = e;
        semEmail = false;
      }
      const pNome = val(r, 'profile');
      let perfil = pNome ? perfis.find((p) => norm(p.name) === norm(pNome.split(/[,\n]/)[0]!)) : undefined;
      if (perfil?.roles.includes('ADMIN')) {
        avisos.push(`Perfil "${perfil.name}" tem permissão de administrador: usado o perfil padrão`);
        perfil = undefined;
      }
      const cNome = val(r, 'category');
      const categoria = cNome ? categorias.find((c) => norm(c.name) === norm(cNome)) : undefined;
      const validUntil = dataDe(val(r, 'validUntil'));
      const ativo = val(r, 'active');
      loginsUsados.add(username);
      emailsUsados.add(email);
      prontos.push({
        linha,
        username,
        firstName: firstName.slice(0, 60),
        lastName: lastName.slice(0, 60),
        email,
        ticketEmail,
        semEmail,
        perfil: (perfil ?? padraoPerfil).name,
        categoria: (categoria ?? padraoCategoria).name,
        validUntil: validUntil?.toISOString() ?? null,
        active: !(ativo && ['nao', 'n', '0', 'false', 'inativo'].includes(norm(ativo))),
        avisos,
      });
    });

    if (confirmar !== '1') return { arquivo: nome, colunasIgnoradas: ignoradas, prontos, ignorados, criados: 0 };

    let criados = 0;
    for (let i = 0; i < prontos.length; i += 4) {
      const lote = prontos.slice(i, i + 4);
      await Promise.all(
        lote.map(async (l) => {
          const perfil = perfis.find((p) => p.name === l.perfil)!;
          const categoria = categorias.find((c) => c.name === l.categoria)!;
          // senha aleatória que ninguém conhece: a pessoa entra pelo Esqueci minha senha ou o administrador define uma
          const passwordHash = await this.auth.hashPassword(randomToken(32));
          const ok = await this.prisma.user.create({
            data: {
              username: l.username, firstName: l.firstName, lastName: l.lastName, name: `${l.firstName} ${l.lastName}`.slice(0, 120),
              email: l.email, ticketEmail: l.ticketEmail, profileId: perfil.id, roles: perfil.roles, categoryId: categoria.id,
              validUntil: l.validUntil ? new Date(l.validUntil) : null, active: l.active, passwordHash, mustChangePassword: true,
            },
          }).catch(() => null);
          if (ok) criados++;
          else ignorados.push({ linha: l.linha, usuario: l.username, motivo: 'Não foi possível criar (usuário ou e-mail já em uso)' });
        }),
      );
    }
    await this.audit.log(u.id, 'importar', 'User', null, { arquivo: nome, criados, ignorados: ignorados.length }, ip);
    return { arquivo: nome, colunasIgnoradas: ignoradas, prontos, ignorados, criados };
  }
}
