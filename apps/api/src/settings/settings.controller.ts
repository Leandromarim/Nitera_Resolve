import { BadRequestException, Body, Controller, Get, Module, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
import { IsObject } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Public, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { VersionsService } from '../versions/versions.service';
import { DEFAULT_SETTINGS, SettingsService, UI_LARGURA, UI_OPCOES } from './settings.service';
import { TEXTOS_KEY, readTextos } from './textos';

const HTTP_OR_PATH = /^(https?:\/\/|\/(?!\/))/i;

class SettingsDto {
  @IsObject() values: Record<string, unknown>;
}

@Controller()
export class SettingsController {
  constructor(private prisma: PrismaService, private svc: SettingsService, private audit: AuditService, private versions: VersionsService) {}

  @Public()
  @Get('branding')
  branding() {
    return this.svc.branding();
  }

  /** Textos personalizados das telas e o link da política de privacidade (login e aviso de cookies). */
  @Public()
  @Get('textos')
  async textos() {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: [TEXTOS_KEY, 'privacyPolicyUrl'] } } });
    const v = (k: string) => rows.find((r) => r.key === k)?.value;
    const privacy = v('privacyPolicyUrl');
    return {
      textos: readTextos(v(TEXTOS_KEY)),
      credito: { enabled: true, text: 'Desenvolvido por', logoUrl: '/nitera-logo-claro.png', logoAlt: 'NITERA Tecnologia', url: '', badge: false },
      privacyPolicyUrl: typeof privacy === 'string' ? privacy : '',
    };
  }

  /** QR Code PNG de um endereço (WhatsApp do suporte na tela de login). Só http(s) ou caminho do próprio site. */
  @Public()
  @Get('qr')
  async qr(@Res() res: Response, @Query('data') data?: string, @Query('size') size?: string) {
    if (typeof data !== 'string' || data.length > 2000 || !HTTP_OR_PATH.test(data)) throw new BadRequestException('O QR Code aceita apenas endereços http(s) ou caminhos que começam com /');
    const text = data.startsWith('/') ? `${(process.env.PUBLIC_URL ?? '').replace(/\/+$/, '')}${data}` : data;
    const n = Number(size);
    const width = Number.isFinite(n) && n > 0 ? Math.min(1024, Math.max(64, Math.round(n))) : 256;
    const png = await QRCode.toBuffer(text, { type: 'png', width, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1f2a4d', light: '#ffffff' } });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(png);
  }

  @Roles('ADMIN')
  @Get('admin/settings')
  settings() {
    return this.svc.settings();
  }

  @Roles('ADMIN')
  @Put('admin/settings')
  async save(@Body() dto: SettingsDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const entries = Object.entries(dto.values).filter(([key]) => key in DEFAULT_SETTINGS);
    for (const [key, value] of entries) {
      if (key.endsWith('Color') && !(typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value))) throw new BadRequestException(`Cor inválida em "${key}". Use o formato #RRGGBB`);
      if (key.endsWith('Url') && value !== null && value !== '' && !(typeof value === 'string' && /^(\/(?!\/)|https:\/\/)/.test(value))) throw new BadRequestException(`Endereço inválido em "${key}"`);
      if ((key === 'siteName' || key === 'siteTagline') && !(typeof value === 'string' && value.trim().length >= 2 && value.length <= 120)) throw new BadRequestException('O nome precisa ter de 2 a 120 caracteres');
      if (key === 'ticketsWhatsappQr' && typeof value !== 'boolean') throw new BadRequestException('Opção do QR Code inválida');
      if ((key === 'ticketsWhatsappNumber' || key === 'ticketsEmail') && typeof value !== 'string') throw new BadRequestException(`Valor inválido em "${key}"`);
      if (UI_LARGURA.chaves.includes(key) && !(Number.isInteger(value) && (value === 0 || ((value as number) >= UI_LARGURA.min && (value as number) <= UI_LARGURA.max))))
        throw new BadRequestException(`Largura inválida em "${key}". Use 0 (tela inteira) ou de ${UI_LARGURA.min} a ${UI_LARGURA.max} px`);
      if (key in UI_OPCOES && !UI_OPCOES[key].includes(value as string)) throw new BadRequestException(`Opção de estilo inválida em "${key}"`);
    }
    await this.prisma.$transaction(entries.map(([key, value]) => this.prisma.setting.upsert({ where: { key }, create: { key, value: value as any }, update: { value: value as any } })));
    await this.versions.record('Setting', 'settings', 'editar', u, Object.fromEntries(entries));
    await this.audit.log(u.id, 'editar', 'Setting', null, { chaves: entries.map(([k]) => k) }, ip);
    return this.svc.settings();
  }
}

@Module({ controllers: [SettingsController], providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
