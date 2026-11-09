import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Role, TicketSector } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Marca no banco de que a carga inicial já rodou: depois disso, quem manda é o painel. */
const MARCA = '_bootstrap.v1';

/** Categorias de partida de cada equipe (horas de SLA). Dá para mudar tudo em Categorias e SLA. */
const CATEGORIAS: { sector: TicketSector; name: string; slaHours: number; description?: string }[] = [
  { sector: 'TI', name: 'Computadores (Hardware)', slaHours: 8, description: 'Computador que não liga, trava ou está lento por defeito.' },
  { sector: 'TI', name: 'Computadores (Software)', slaHours: 48, description: 'Instalar, atualizar ou corrigir programas.' },
  { sector: 'TI', name: 'Impressoras / Scanners', slaHours: 8, description: 'Impressora que não imprime, atola papel ou scanner com defeito.' },
  { sector: 'TI', name: 'Periféricos (Mouse, Teclado, etc)', slaHours: 24, description: 'Mouse, teclado, monitor, fone ou outro periférico.' },
  { sector: 'TI', name: 'Sistemas', slaHours: 8, description: 'Erro ou dúvida em um sistema usado no trabalho.' },
  { sector: 'TI', name: 'Usuários (Criar / Desativar)', slaHours: 4, description: 'Criar, liberar ou desativar acesso de alguém.' },
  { sector: 'TI', name: 'Internet e e-mail', slaHours: 8, description: 'Sem internet, site que não abre ou problema no e-mail.' },
  { sector: 'TI', name: 'Treinamentos', slaHours: 72, description: 'Treinamento para usar um sistema.' },
  { sector: 'TI', name: 'Outros', slaHours: 24 },
  { sector: 'INFRAESTRUTURA', name: 'Pontos de rede / Cabeamento', slaHours: 24, description: 'Ponto de rede sem sinal, novo ponto ou troca de cabo.' },
  { sector: 'INFRAESTRUTURA', name: 'Telefonia', slaHours: 24, description: 'Telefone, ramal ou linha com defeito.' },
  { sector: 'INFRAESTRUTURA', name: 'Sistemas de CFTV', slaHours: 24, description: 'Câmeras de segurança, gravador (DVR/NVR) e gravações.' },
  { sector: 'MANUTENCAO', name: 'Ar Condicionado', slaHours: 24, description: 'Aparelho que não liga, não gela, pinga ou faz barulho.' },
  { sector: 'MANUTENCAO', name: 'Elétrica', slaHours: 8, description: 'Tomadas, lâmpadas, disjuntores e quedas de energia.' },
  { sector: 'MANUTENCAO', name: 'Equipamentos / Máquinas', slaHours: 4, description: 'Defeito em equipamento usado no trabalho.' },
  { sector: 'MANUTENCAO', name: 'Hidráulica', slaHours: 8, description: 'Vazamentos, torneiras, descargas, ralos e falta de água.' },
  { sector: 'MANUTENCAO', name: 'Predial', slaHours: 72, description: 'Portas, fechaduras, pintura, forro, pisos e paredes.' },
  { sector: 'MANUTENCAO', name: 'Televisores', slaHours: 24, description: 'TV que não liga, sem sinal ou com controle com defeito.' },
  { sector: 'MANUTENCAO', name: 'Outros (Manutenção)', slaHours: 48, description: 'Outros serviços de manutenção.' },
  { sector: 'COMUNICACAO', name: 'Comunicação / Marketing', slaHours: 72, description: 'Cartazes, banners, folhetos e artes para campanhas.' },
];

/** Perfis de partida. As permissões de cada pessoa são copiadas do perfil (Usuários › Perfis). */
const PERFIS: { name: string; description: string; roles: Role[]; isDefault?: boolean }[] = [
  { name: 'Colaborador', description: 'Abre e acompanha os próprios chamados', roles: ['COLABORADOR'], isDefault: true },
  { name: 'Administrador', description: 'Acesso total: configurações, usuários e todos os chamados', roles: ['ADMIN'] },
  { name: 'Técnico de TI', description: 'Atende os chamados da TI', roles: ['TI'] },
  { name: 'Técnico da Infraestrutura de TI', description: 'Atende os chamados da Infraestrutura de TI', roles: ['INFRAESTRUTURA'] },
  { name: 'Técnico da Manutenção', description: 'Atende os chamados da Manutenção', roles: ['MANUTENCAO'] },
  { name: 'Comunicação', description: 'Atende os pedidos para a Comunicação', roles: ['COMUNICACAO'] },
  { name: 'Gestor da TI', description: 'Atende a TI e acompanha as equipes ligadas a ela', roles: ['TI', 'GESTOR_AREA'] },
  { name: 'Gestor da Infraestrutura de TI', description: 'Atende a Infraestrutura de TI e acompanha as equipes ligadas a ela', roles: ['INFRAESTRUTURA', 'GESTOR_AREA'] },
  { name: 'Gestor da Manutenção', description: 'Atende a Manutenção e acompanha as equipes ligadas a ela', roles: ['MANUTENCAO', 'GESTOR_AREA'] },
];

/** Categorias de usuário de partida (o cadastro de usuário exige uma). Dá para mudar em Usuários › Categorias. */
const CATEGORIAS_USUARIO: { name: string; description: string }[] = [
  { name: 'Administrativo', description: 'Equipes administrativas e de apoio' },
  { name: 'Operacional', description: 'Equipes que atuam na operação do dia a dia' },
  { name: 'Terceirizado', description: 'Prestadores de serviço de empresas parceiras' },
];

/**
 * Carga inicial de uma instalação nova, uma vez só: categorias, perfis, um setor e a primeira versão nas
 * novidades. Nunca apaga nem altera o que já existe (usa "criar se não existir"). O primeiro administrador
 * é criado pela linha de comando (dist/scripts/criar-usuario.js), para nenhuma senha passar por aqui.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly log = new Logger('Carga inicial');
  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.rodar();
    } catch (e) {
      // a API continua no ar; a carga tenta de novo na próxima vez que subir
      this.log.error(`Não foi possível fazer a carga inicial: ${(e as Error).message}`);
    }
  }

  async rodar() {
    await this.categoriasUsuario();
    await this.versao101();
    if (await this.prisma.setting.findUnique({ where: { key: MARCA } })) return;
    for (const c of CATEGORIAS) await this.prisma.ticketCategory.upsert({ where: { name: c.name }, update: {}, create: c });
    for (const p of PERFIS) await this.prisma.accessProfile.upsert({ where: { name: p.name }, update: {}, create: { ...p, isDefault: !!p.isDefault } });
    if (!(await this.prisma.department.count())) await this.prisma.department.create({ data: { name: 'Administração' } });
    await this.prisma.release.upsert({
      where: { system_version: { system: 'RESOLVE', version: '1.0.0' } },
      update: {},
      create: {
        version: '1.0.0',
        title: 'Primeira versão do NITERA Resolve',
        summary: 'Abertura e acompanhamento de chamados pelo site, WhatsApp e e-mail, com prazos (SLA), quadro de atendimento e relatórios.',
        published: true,
        publishedAt: new Date(),
        announce: false,
        items: {
          create: [
            { order: 0, kind: 'NOVIDADE', title: 'Chamados pelo site, WhatsApp e e-mail', description: 'Quem precisa de ajuda abre o chamado pelo canal que preferir e acompanha cada passo.' },
            { order: 1, kind: 'NOVIDADE', title: 'Central de atendimento', description: 'Quadro e lista com prazos, prioridades, responsáveis e a aba que junta a fila da equipe com as equipes acompanhadas.' },
            { order: 2, kind: 'NOVIDADE', title: 'Relatórios', description: 'Indicadores por equipe, categoria e técnico, com exportação para planilha.' },
          ],
        },
      },
    });
    await this.prisma.setting.create({ data: { key: MARCA, value: new Date().toISOString() } });
    this.log.log('Carga inicial concluída: categorias, perfis e primeiro setor criados.');
  }

  /** Novidades da 1.0.1 (correções de segurança vindas da Intranet 4.55.0): grava uma vez, também em quem já tinha a 1.0.0. */
  private async versao101() {
    await this.prisma.release.upsert({
      where: { system_version: { system: 'RESOLVE', version: '1.0.1' } },
      update: {},
      create: {
        version: '1.0.1',
        title: 'Correções de segurança',
        summary: 'Duas etapas obrigatória para Administrador e TI, sessão encerrada de verdade ao sair e proteções no texto dos chamados.',
        published: true,
        publishedAt: new Date(),
        announce: false,
        items: {
          create: [
            { order: 0, kind: 'SEGURANCA', title: 'Duas etapas obrigatória por perfil', description: 'Administrador e TI só usam o sistema depois de ativar o código do celular. Os perfis obrigados ficam em Configurações › Acesso.' },
            { order: 1, kind: 'SEGURANCA', title: 'Sair encerra a sessão de verdade', description: 'Depois de sair ou trocar a senha, um token antigo não abre mais uma sessão nova, nem nos 60 segundos de tolerância entre abas.' },
            { order: 2, kind: 'SEGURANCA', title: 'Texto dos chamados sem travar o sistema', description: 'A limpeza de marcações no texto ficou linear: um texto preparado para travar a API não tem mais efeito.' },
            { order: 3, kind: 'SEGURANCA', title: 'Voltar versão sem apagar o banco', description: 'O comando deploy/voltar-versao.sh devolve o banco de antes da atualização num banco novo e guarda o atual.' },
          ],
        },
      },
    });
  }

  /** Categorias de usuário: uma vez só, e só se ainda não houver nenhuma. */
  private async categoriasUsuario() {
    const marca = '_bootstrap.categorias-usuario.v1';
    if (await this.prisma.setting.findUnique({ where: { key: marca } })) return;
    if (!(await this.prisma.userCategory.count())) for (const c of CATEGORIAS_USUARIO) await this.prisma.userCategory.upsert({ where: { name: c.name }, update: {}, create: c });
    await this.prisma.setting.create({ data: { key: marca, value: new Date().toISOString() } });
  }
}
