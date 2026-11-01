import { NotificationLevel, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  title: string;
  body?: string;
  link?: string;
  level?: NotificationLevel;
  /** Sem destinatário = todos. */
  userId?: string;
  departmentId?: string;
  role?: Role;
}

/** Cria um aviso automático (chamado respondido, versão nova…). Aparece no sino. */
export function notify(prisma: PrismaService | Prisma.TransactionClient, n: NotifyInput) {
  return prisma.notification.create({ data: { ...n, level: n.level ?? 'INFO', system: true } });
}
