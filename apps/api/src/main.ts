import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { erroDeValidacao } from './common/validacao';

function checkEnv() {
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'HASH_PEPPER', 'PUBLIC_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);
  if (process.env.NODE_ENV === 'production' && (process.env.JWT_ACCESS_SECRET!.length < 32 || process.env.JWT_ACCESS_SECRET!.startsWith('dev_'))) {
    throw new Error('JWT_ACCESS_SECRET fraco para produção. Gere com: openssl rand -base64 48');
  }
}

async function bootstrap() {
  checkEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bodyParser: true });
  app.set('trust proxy', 1); // atrás do Caddy/Nginx: IP real do cliente para rate limit e auditoria
  app.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );
  app.use(cookieParser());
  // Respostas da API podem ter dados pessoais: nenhum cache compartilhado (proxy) guarda, e o navegador sempre confere
  // com o servidor (ETag → 304 sem corpo quando nada mudou). Rotas de arquivos e imagens definem o próprio cabeçalho.
  app.set('etag', 'strong');
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'private, no-cache');
    next();
  });
  app.useBodyParser('json', { limit: '2mb' });
  app.enableCors({ origin: process.env.PUBLIC_URL, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: erroDeValidacao }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  // vídeos dos treinamentos de até 3 GB: o envio pode levar mais que os 5 minutos padrão do Node
  const server = app.getHttpServer();
  server.requestTimeout = 2 * 60 * 60 * 1000;
  await app.listen(port, '0.0.0.0');
  new Logger('NITERA Resolve').log(`API ouvindo na porta ${port}`);
}
bootstrap();
