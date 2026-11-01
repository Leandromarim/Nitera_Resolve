import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,128}$/;
export const PASSWORD_MESSAGE = 'A senha precisa ter ao menos 6 caracteres, com letra maiúscula, minúscula, número e símbolo';

/** Senha provisória simples (marcada pela TI no cadastro): só abre a troca de senha e vence em poucos dias. */
export const SENHA_PROVISORIA_MIN = 4;
export const SENHA_PROVISORIA_DIAS = 7;
export const SENHA_PROVISORIA_MESSAGE = `A senha provisória precisa ter ao menos ${SENHA_PROVISORIA_MIN} caracteres`;

export class LoginDto {
  @IsString() @MaxLength(120) login: string; // e-mail ou usuário
  @IsString() @MaxLength(128) password: string;
  @IsOptional() @IsString() @Length(6, 6) totp?: string;
  @IsOptional() @IsBoolean() remember?: boolean;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword: string;
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) newPassword: string;
}

export class EsqueciSenhaDto {
  @IsString() @MaxLength(160) login: string; // e-mail ou usuário
}

export class TokenRecuperacaoDto {
  @IsString() @Length(20, 100) token: string;
}

export class RedefinirSenhaDto extends TokenRecuperacaoDto {
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) senha: string;
}

export class TotpCodeDto {
  @IsString() @Length(6, 6) code: string;
}
