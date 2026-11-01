import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, EsqueciSenhaDto, LoginDto, RedefinirSenhaDto, TokenRecuperacaoDto, TotpCodeDto } from './dto';
import { RecuperarSenhaService } from './recuperar-senha.service';
import { AuthUser, ClientIp, CurrentUser, Public, SenhaProvisoriaOk } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { AcessoService, COOKIE_ARQUIVOS } from '../common/acesso';

const COOKIE = 'nr_rt';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService, private acesso: AcessoService, private recuperar: RecuperarSenhaService) {}

  private setCookie(res: Response, token: string, expires: Date, _remember: boolean, userId: string) {
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE !== 'false',
      sameSite: 'strict',
      path: '/api/auth',
      // sempre com validade: o login sobrevive a fechar o navegador (24 h sem uso; 14 dias com "Manter conectado")
      expires,
    });
    // imagens e PDFs do portal: as tags <img> não mandam o token, então quem entrou leva este cookie (renovado junto com a sessão)
    const arq = this.acesso.cookieArquivos(userId);
    res.cookie(COOKIE_ARQUIVOS, arq.valor, { httpOnly: true, secure: process.env.COOKIE_SECURE !== 'false', sameSite: 'lax', path: '/api/files', maxAge: arq.maxAge });
  }

  private clearCookies(res: Response) {
    res.clearCookie(COOKIE, { path: '/api/auth' });
    res.clearCookie(COOKIE_ARQUIVOS, { path: '/api/files' });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response, @ClientIp() ip: string) {
    const result = await this.auth.login(dto.login, dto.password, dto.totp, !!dto.remember, { ip, userAgent: req.headers['user-agent'] });
    if ('requiresTotp' in result) return result;
    this.setCookie(res, result.refreshToken, result.refreshExpiresAt, result.remember, result.user.id);
    return { accessToken: result.accessToken, user: result.user };
  }

  // ───────── Esqueci minha senha ─────────

  /** A tela mostra o formulário só quando o servidor consegue mandar e-mail. */
  @Public()
  @Get('recuperar-senha')
  recuperacao() {
    return { disponivel: this.recuperar.disponivel() };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('recuperar-senha')
  @HttpCode(200)
  esqueci(@Body() dto: EsqueciSenhaDto, @ClientIp() ip: string) {
    return this.recuperar.solicitar(dto.login, ip);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('recuperar-senha/validar')
  @HttpCode(200)
  validarLink(@Body() dto: TokenRecuperacaoDto) {
    return this.recuperar.validar(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('recuperar-senha/nova')
  @HttpCode(200)
  redefinir(@Body() dto: RedefinirSenhaDto, @ClientIp() ip: string) {
    return this.recuperar.redefinir(dto.token, dto.senha, ip);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @ClientIp() ip: string) {
    try {
      const s = await this.auth.refresh(req.cookies?.[COOKIE], { ip, userAgent: req.headers['user-agent'] });
      this.setCookie(res, s.refreshToken, s.refreshExpiresAt, s.remember, s.user.id);
      return { accessToken: s.accessToken, user: s.user };
    } catch (e) {
      this.clearCookies(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    this.clearCookies(res);
  }

  @SenhaProvisoriaOk()
  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    return this.auth.publicUser(user);
  }

  @SenhaProvisoriaOk()
  @Post('change-password')
  @HttpCode(204)
  changePassword(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.auth.changePassword(u.id, dto.currentPassword, dto.newPassword, req.cookies?.[COOKIE]);
  }

  @Post('2fa/setup')
  totpSetup(@CurrentUser() u: AuthUser) {
    return this.auth.totpSetup(u.id);
  }

  @Post('2fa/enable')
  @HttpCode(204)
  totpEnable(@CurrentUser() u: AuthUser, @Body() dto: TotpCodeDto) {
    return this.auth.totpEnable(u.id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(204)
  totpDisable(@CurrentUser() u: AuthUser, @Body() dto: TotpCodeDto) {
    return this.auth.totpDisable(u.id, dto.code);
  }
}
