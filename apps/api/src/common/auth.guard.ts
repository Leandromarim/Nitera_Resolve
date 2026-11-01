import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AcessoService } from './acesso';
import { IS_PORTAL, IS_PUBLIC, ROLES, SENHA_PROVISORIA_OK, AuthUser } from './decorators';

/**
 * Guard global: exige um access token válido (Bearer) em todas as rotas,
 * exceto as marcadas com @Public(). Em rotas públicas o usuário é anexado
 * se houver token, para personalizar a resposta (ex.: itens com cadeado).
 * Rotas @Portal() só ficam públicas quando o administrador desliga "Exigir login".
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector, private readonly acesso: AcessoService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const isPortal = this.reflector.getAllAndOverride<boolean>(IS_PORTAL, [ctx.getHandler(), ctx.getClass()]);
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]) || (isPortal && !(await this.acesso.exigirLogin()));
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync(token, {
          secret: process.env.JWT_ACCESS_SECRET,
          algorithms: ['HS256'],
          audience: 'nitera-resolve',
          issuer: 'nitera-resolve-api',
        });
        req.user = { id: payload.sub, name: payload.name, email: payload.email, roles: payload.roles, sid: payload.sid, mfa: payload.mfa === true, prov: payload.prov === true } as AuthUser;
      } catch {
        if (!isPublic) throw new UnauthorizedException('Sessão expirada');
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException();
    // senha provisória: a sessão só serve para trocar a senha (o resto do sistema fica fechado até lá)
    if (req.user.prov && !this.reflector.getAllAndOverride<boolean>(SENHA_PROVISORIA_OK, [ctx.getHandler(), ctx.getClass()])) {
      throw new ForbiddenException('Troque a senha provisória para continuar.');
    }

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !req.user.roles.includes('ADMIN') && !roles.some((r) => req.user.roles.includes(r))) {
      throw new ForbiddenException('Você não tem permissão para esta ação');
    }
    return true;
  }
}
