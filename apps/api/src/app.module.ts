import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.controller';
import { AuthModule } from './auth/auth.module';
import { AcessoModule } from './common/acesso';
import { AuditModule } from './common/audit.service';
import { AuthGuard } from './common/auth.guard';
import { FilesModule } from './files/files.controller';
import { HealthController } from './health.controller';
import { IntegrationsModule } from './integrations/integrations.module';
import { MensagensModule } from './mensagens/mensagens.controller';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { BootstrapService } from './bootstrap/bootstrap.service';
import { SettingsModule } from './settings/settings.controller';
import { NovidadesModule } from './novidades/novidades.controller';
import { PrismaModule } from './prisma/prisma.service';
import { TicketsModule } from './tickets/tickets.controller';
import { UsersModule } from './users/users.controller';
import { VersionsModule } from './versions/versions.controller';
import { VersionsCoreModule } from './versions/versions.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AcessoModule,
    VersionsCoreModule,
    VersionsModule,
    AuthModule,
    FilesModule,
    IntegrationsModule,
    UsersModule,
    TicketsModule,
    AdminModule,
    NovidadesModule,
    MensagensModule,
    NotificacoesModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    BootstrapService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
