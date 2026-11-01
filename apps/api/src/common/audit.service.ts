import { Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string | undefined | null, action: string, entity: string, entityId?: string | null, data?: unknown, ip?: string) {
    await this.prisma.auditLog.create({
      data: { userId: userId ?? null, action, entity, entityId: entityId ?? null, data: (data ?? undefined) as any, ip },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
