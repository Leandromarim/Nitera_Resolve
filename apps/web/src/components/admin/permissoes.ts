import type { Role } from '@/lib/api';

/** Permissões que um perfil de uso pode ter (na API são os "roles"). */
export const ROLES: Role[] = ['ADMIN', 'TI', 'INFRAESTRUTURA', 'MANUTENCAO', 'COMUNICACAO', 'GESTOR_AREA', 'COLABORADOR'];

export const ROLE_COLOR: Record<Role, string> = {
  ADMIN: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  TI: 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200',
  COMUNICACAO: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  MANUTENCAO: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  INFRAESTRUTURA: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  GESTOR_AREA: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  COLABORADOR: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export const ROLE_HINT: Record<Role, string> = {
  ADMIN: 'Acesso total, inclusive usuários e configurações',
  TI: 'Atende chamados e configura categorias/SLA',
  COMUNICACAO: 'Atende os pedidos para a Comunicação e configura as categorias dessa fila',
  MANUTENCAO: 'Atende os chamados de manutenção',
  INFRAESTRUTURA: 'Atende os chamados de Infraestrutura de TI (rede, servidores, Wi-Fi) e configura as categorias dessa fila',
  GESTOR_AREA: 'Gestor da área: junto com a equipe (ex.: Manutenção), acompanha só para leitura os chamados das equipes marcadas em Categorias e SLA › Setores',
  COLABORADOR: 'Abre e acompanha os próprios chamados',
};
