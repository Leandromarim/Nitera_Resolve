import { BadRequestException, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query, Req, Res, UploadedFile, UseInterceptors, Global, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { AcessoService, COOKIE_ARQUIVOS } from '../common/acesso';
import { PrismaService } from '../prisma/prisma.service';
import { podeVerPrivado } from './acesso-privado';
import { FilesService, LARGURAS } from './files.service';
import { REDUZ } from './otimizacao';
import { ArmazenamentoController } from './armazenamento.controller';
import { ArmazenamentoService } from './armazenamento.service';

/** Perfis que enviam imagens públicas (logo e ícone da instituição). */
const CMS_ROLES = ['ADMIN'];

/**
 * Interpreta o cabeçalho Range (um único intervalo de bytes).
 * Retorna null quando não há Range utilizável (resposta 200 completa) e 'invalid' para 416.
 */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return header.includes(',') ? null : header.trim().startsWith('bytes=') ? 'invalid' : null; // vários intervalos: responde o arquivo inteiro
  const [, a, b] = m;
  if (!a && !b) return 'invalid';
  let start: number;
  let end: number;
  if (!a) {
    // sufixo: últimos N bytes
    const n = Number(b);
    if (n === 0) return 'invalid';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(a);
    end = b ? Math.min(Number(b), size - 1) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return 'invalid';
  return { start, end };
}

@Controller('files')
export class FilesController {
  constructor(private files: FilesService, private prisma: PrismaService, private acesso: AcessoService) {}

  /**
   * Upload. `?public=1` é para a identidade visual (logo, ícone) e exige administrador.
   * `?avatar=1` é a foto do perfil: qualquer usuário logado, só imagem, até 5 MB, pública.
   */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser, @Query('public') pub?: string, @Query('images') images?: string, @Query('avatar') avatar?: string) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (avatar === '1') {
      if (file.size > 5 * 1024 * 1024) throw new BadRequestException('A foto pode ter no máximo 5 MB');
      return this.files.store(file.buffer, name, true, user.id, true, 'PORTAL');
    }
    const isPublic = pub === '1';
    if (isPublic && !user.roles.some((r) => CMS_ROLES.includes(r))) throw new ForbiddenException();
    return this.files.store(file.buffer, name, isPublic, user.id, images === '1', isPublic ? 'PORTAL' : 'UPLOAD');
  }

  @Public()
  @Get(':id')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @Req() req: Request,
    @CurrentUser() user?: AuthUser,
    @Query('exp') exp?: string,
    @Query('sig') sig?: string,
    @Query('download') download?: string,
    @Query('w') largura?: string,
  ) {
    const w = largura ? Number(largura) : undefined;
    if (w !== undefined && !(LARGURAS as readonly number[]).includes(w)) throw new BadRequestException(`Largura inválida (use ${LARGURAS.join(', ')})`);
    const aberto = await this.files.open(id, exp, sig, !!user);
    const asset = aberto.asset;
    // arquivos do portal: com "Exigir login", só para quem entrou (token ou cookie de arquivos), por link assinado
    // ou quando aparecem na tela de login (logo, ícone da aba, fundo). Resposta 404 para não confirmar que o arquivo existe.
    const exigir = asset.public && (await this.acesso.exigirLogin());
    const naTelaDeLogin = exigir && (await this.acesso.arquivoAberto(id));
    if (exigir && !naTelaDeLogin && !user && !this.acesso.cookieValido(req.cookies?.[COOKIE_ARQUIVOS]) && !this.files.assinaturaValida(id, exp, sig)) throw new NotFoundException();
    // arquivo privado: só quem tem direito ao registro dono dele (o chamado), ou pelo link assinado
    if (!asset.public && user && !this.files.assinaturaValida(id, exp, sig) && !(await podeVerPrivado(this.prisma, id, user))) throw new NotFoundException();
    const inline = !download && /^(image|video|audio)\/|^application\/pdf$/.test(asset.mimeType);
    // na tela vai a foto reduzida, no formato moderno que o navegador aceita; o download leva o arquivo guardado
    const entregue = inline ? await this.files.variante(asset, aberto.path, w, req.headers.accept) : { path: aberto.path, mime: asset.mimeType, negociado: false };
    const path = entregue.path;
    const info = await stat(path).catch(() => null);
    if (!info) return res.status(404).end();
    const size = info.size;
    res.setHeader('Content-Type', entregue.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`);
    // cada envio gera um id novo, então o conteúdo de um id nunca muda: o navegador pode guardar por um ano.
    // Arquivos privados: só o navegador de quem tem acesso guarda (nunca um cache compartilhado).
    // Com "Exigir login", nem os do portal vão para cache compartilhado (proxy), só para o navegador de quem entrou.
    res.setHeader('Cache-Control', !asset.public ? 'private, max-age=3600' : exigir && !naTelaDeLogin ? 'private, max-age=31536000, immutable' : 'public, max-age=31536000, immutable');
    if (inline && REDUZ.has(asset.mimeType)) res.setHeader('Vary', 'Accept');
    res.setHeader('Accept-Ranges', 'bytes');
    // validação de cache: o navegador pergunta "mudou?" e recebe 304 sem o arquivo (o acesso já foi conferido acima)
    const etag = `"${createHash('sha1').update(`${path}:${size}:${info.mtimeMs}`).digest('base64url').slice(0, 22)}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', info.mtime.toUTCString());
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)) return res.status(304).end();

    // Suporte a HTTP Range (necessário para o player de vídeo buscar posições).
    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
      if (req.method === 'HEAD') return res.end();
      return createReadStream(path, { start: range.start, end: range.end }).on('error', () => res.status(404).end()).pipe(res);
    }
    res.setHeader('Content-Length', String(size));
    if (req.method === 'HEAD') return res.end();
    createReadStream(path).on('error', () => res.status(404).end()).pipe(res);
  }
}

@Global()
@Module({ controllers: [FilesController, ArmazenamentoController], providers: [FilesService, ArmazenamentoService], exports: [FilesService, ArmazenamentoService] })
export class FilesModule {}
