import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Mensagens padrão do Nest/Throttler traduzidas para o português. */
const DEFAULT_PT: Record<string, string> = {
  'Forbidden resource': 'Você não tem permissão para esta ação',
  Forbidden: 'Você não tem permissão para esta ação',
  Unauthorized: 'Faça login para continuar',
  'Not Found': 'Não encontrado',
  'Bad Request': 'Requisição inválida',
  'Payload Too Large': 'Arquivo ou conteúdo grande demais',
  'ThrottlerException: Too Many Requests': 'Muitas tentativas. Aguarde um pouco e tente novamente',
  'Too Many Requests': 'Muitas tentativas. Aguarde um pouco e tente novamente',
};

const FIELD_PT: Record<string, string> = {
  email: 'e-mail',
  username: 'usuário',
  slug: 'endereço da página',
  name: 'nome',
  code: 'código',
  phone: 'celular',
};

/**
 * Filtro global: respostas de erro sempre em português e sem detalhes internos.
 * Erros de unicidade/vínculo do Prisma viram 409 com mensagem clara em vez de 500.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Erro');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (!res || typeof res.status !== 'function') throw exception; // WebSocket: deixa o Nest tratar

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno. Tente novamente ou fale com a TI';
    let campos: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as any).message ?? exception.message);
      // erros de validação levam o campo exato de cada problema (o site aponta e destaca o campo)
      if (typeof body === 'object' && Array.isArray((body as any).campos)) campos = (body as any).campos;
      if (typeof message === 'string') message = DEFAULT_PT[message] ?? message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = ([] as string[]).concat((exception.meta?.target as any) ?? []);
        const fields = target.map((f) => FIELD_PT[f] ?? f).join(', ');
        message = fields ? `Já existe um cadastro com este ${fields}` : 'Já existe um cadastro com estes dados';
      } else if (exception.code === 'P2003' || exception.code === 'P2014') {
        status = HttpStatus.CONFLICT;
        message = 'Não é possível concluir: existem registros vinculados a este item';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Não encontrado';
      } else {
        this.log.error(exception.message);
      }
    } else {
      this.log.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    }

    res.status(status).json({ statusCode: status, message, ...(campos ? { campos } : {}) });
  }
}
