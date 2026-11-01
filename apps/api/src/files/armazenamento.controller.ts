import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Roles } from '../common/decorators';
import { ArmazenamentoService } from './armazenamento.service';

class ConfigArmazenamentoDto {
  @IsBoolean() pdfSemPerdas: boolean;
  @Type(() => Number) @IsInt() @Min(0) @Max(3650) manterOriginalDias: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(3650) cachePaginasDias: number;
}

/** Painel › Armazenamento e otimização. Consulta: ADMIN e TI. Ações que mexem em arquivos: só ADMIN, com auditoria. */
@Controller('admin/armazenamento')
export class ArmazenamentoController {
  constructor(
    private service: ArmazenamentoService,
    private audit: AuditService,
  ) {}

  @Roles('TI')
  @Get()
  resumo(@Query('atualizar') atualizar?: string) {
    return this.service.resumo(atualizar === '1');
  }

  @Roles('TI')
  @Get('historico')
  historico(@Query('take') take?: string, @Query('status') status?: string) {
    return this.service.historico(Number(take) || 100, status === 'erros' ? 'erros' : undefined);
  }

  @Roles('ADMIN')
  @Put('config')
  async salvarConfig(@Body() dto: ConfigArmazenamentoDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const c = await this.service.salvarConfig({ pdfSemPerdas: dto.pdfSemPerdas, manterOriginalDias: dto.manterOriginalDias, cachePaginasDias: dto.cachePaginasDias });
    await this.audit.log(u.id, 'editar', 'Armazenamento', null, c, ip);
    return c;
  }

  @Roles('ADMIN')
  @Post('duplicados/unificar')
  @HttpCode(200)
  async unificar(@CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.service.unificarDuplicados();
    await this.audit.log(u.id, 'unificar_duplicados', 'Armazenamento', null, r, ip);
    return r;
  }

  @Roles('ADMIN')
  @Post('pdfs-antigos/otimizar')
  @HttpCode(200)
  async pdfsAntigos(@CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.service.otimizarPdfsAntigos();
    await this.audit.log(u.id, 'otimizar_pdfs', 'Armazenamento', null, r, ip);
    return r;
  }

  @Roles('ADMIN')
  @Post('erros/reprocessar')
  @HttpCode(200)
  async reprocessar(@CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.service.reprocessarErros();
    await this.audit.log(u.id, 'reprocessar', 'Armazenamento', null, r, ip);
    return r;
  }

  @Roles('ADMIN')
  @Post('limpeza')
  @HttpCode(200)
  async limpeza(@CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.service.limpezaDiaria();
    await this.audit.log(u.id, 'limpeza', 'Armazenamento', null, r, ip);
    return r;
  }

  @Roles('ADMIN')
  @Post('arquivos/:id/restaurar-original')
  @HttpCode(200)
  async restaurar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.service.restaurarOriginal(id);
    await this.audit.log(u.id, 'restaurar_original', 'FileAsset', id, r, ip);
    return r;
  }
}
