import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
/** Rota acessível sem login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const IS_PORTAL = 'isPortal';
/** Conteúdo do portal: só abre sem login se o administrador desligar "Exigir login" (Painel › Configurações › Acesso). */
export const Portal = () => SetMetadata(IS_PORTAL, true);

export const SENHA_PROVISORIA_OK = 'senhaProvisoriaOk';
/** Rota que quem entrou com senha provisória pode usar (as demais respondem 403 até a troca da senha). */
export const SenhaProvisoriaOk = () => SetMetadata(SENHA_PROVISORIA_OK, true);

export const ROLES = 'roles';
/** Restringe a rota aos perfis informados (ADMIN sempre tem acesso). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  /** sessão (família do refresh token) que emitiu o token */
  sid?: string;
  /** a sessão foi aberta com segundo fator */
  mfa?: boolean;
  /** entrou com senha provisória: só pode trocar a senha */
  prov?: boolean;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});

export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return req.ip ?? req.socket?.remoteAddress ?? '';
});
