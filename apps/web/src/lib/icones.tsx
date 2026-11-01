'use client';

import {
  BarChart3, Bell, BellOff, Cake, CalendarDays, CalendarRange, Camera, Contact, FileText, FolderSearch, GraduationCap, Headset, HeartHandshake, History, Images,
  KeyRound, LayoutDashboard, LifeBuoy, Lock, LogIn, LogOut, Mail, MonitorSmartphone, Newspaper, PartyPopper, Phone, Rocket, Route, Search, ShieldCheck,
  Smartphone, Star, Stethoscope, UserRound, Users, type LucideIcon,
} from 'lucide-react';
import { Icone } from '@/components/icons/icone';

export interface PontoIcone {
  grupo: string;
  rotulo: string;
  Padrao: LucideIcon;
}

/**
 * Pontos fixos da intranet cujo ícone pode ser trocado em Painel › Ícones da intranet.
 * Os menus do painel, do NITERA Qualis e os atalhos da Visão geral entram sozinhos (ver app/admin/icones).
 * Para tornar um ícone novo trocável: registre aqui e use <IconePonto ponto="..." className="..." />.
 */
export const PONTOS: Record<string, PontoIcone> = {
  'cabecalho.entrar': { grupo: 'Cabeçalho e menus do portal', rotulo: 'Botão Entrar', Padrao: LogIn },
  'cabecalho.perfil': { grupo: 'Cabeçalho e menus do portal', rotulo: 'Menu do usuário: Meu perfil', Padrao: UserRound },
  'cabecalho.painel': { grupo: 'Cabeçalho e menus do portal', rotulo: 'Menu do usuário: Painel administrativo', Padrao: LayoutDashboard },
  'cabecalho.sair': { grupo: 'Cabeçalho e menus do portal', rotulo: 'Menu do usuário: Sair', Padrao: LogOut },
  'cabecalho.privacidade': { grupo: 'Cabeçalho e menus do portal', rotulo: 'Link da política de privacidade', Padrao: Lock },
  'menu.restrito': { grupo: 'Cabeçalho e menus do portal', rotulo: 'Item de menu restrito', Padrao: Lock },
  'cards.restrito': { grupo: 'Cabeçalho e menus do portal', rotulo: 'Card restrito da página inicial', Padrao: Lock },

  'inicio.noticias': { grupo: 'Página inicial', rotulo: 'Últimas notícias', Padrao: Newspaper },
  'inicio.aniversariantes': { grupo: 'Página inicial', rotulo: 'Aniversariantes', Padrao: Cake },
  'aniversariantes.hoje': { grupo: 'Página inicial', rotulo: 'Aniversariante de hoje', Padrao: PartyPopper },
  'noticia.sem-imagem': { grupo: 'Página inicial', rotulo: 'Notícia sem imagem', Padrao: Newspaper },
  'noticia.destaque': { grupo: 'Página inicial', rotulo: 'Selo de notícia em destaque', Padrao: Star },
  'noticia.evento': { grupo: 'Página inicial', rotulo: 'Data de evento na notícia', Padrao: CalendarDays },

  'pagina.aniversariantes': { grupo: 'Títulos das páginas', rotulo: 'Aniversariantes', Padrao: Cake },
  'pagina.avaliacao-intranet': { grupo: 'Títulos das páginas', rotulo: 'Avaliação da Intranet', Padrao: MonitorSmartphone },
  'pagina.avaliacao-ti': { grupo: 'Títulos das páginas', rotulo: 'Avaliação da TI', Padrao: Headset },
  'avaliacao-ti.ajuda': { grupo: 'Títulos das páginas', rotulo: 'Avaliação da TI: atalho de ajuda', Padrao: LifeBuoy },
  'pagina.avisos': { grupo: 'Títulos das páginas', rotulo: 'Avisos', Padrao: Bell },
  'pagina.colaboradores': { grupo: 'Títulos das páginas', rotulo: 'Colaboradores', Padrao: Users },
  'pagina.documentos': { grupo: 'Títulos das páginas', rotulo: 'Documentos', Padrao: FileText },
  'pagina.emails-e-celulares': { grupo: 'Títulos das páginas', rotulo: 'E-mails e celulares', Padrao: Smartphone },
  'pagina.galeria': { grupo: 'Títulos das páginas', rotulo: 'Galeria de fotos', Padrao: Camera },
  'pagina.indicadores': { grupo: 'Títulos das páginas', rotulo: 'Indicadores', Padrao: BarChart3 },
  'pagina.jornal': { grupo: 'Títulos das páginas', rotulo: 'Mini Jornal', Padrao: Newspaper },
  'pagina.novidades': { grupo: 'Títulos das páginas', rotulo: 'Versões e novidades', Padrao: Rocket },
  'pagina.ouvidoria': { grupo: 'Títulos das páginas', rotulo: 'Ouvidoria', Padrao: HeartHandshake },
  'pagina.perfil': { grupo: 'Títulos das páginas', rotulo: 'Meu perfil e segurança', Padrao: UserRound },
  'pagina.ramais': { grupo: 'Títulos das páginas', rotulo: 'Ramais', Padrao: Phone },
  'ramais.telefones-gerais': { grupo: 'Títulos das páginas', rotulo: 'Ramais: telefones gerais', Padrao: Phone },
  'pagina.seguranca-do-paciente': { grupo: 'Títulos das páginas', rotulo: 'Segurança do Paciente', Padrao: ShieldCheck },
  'pagina.treinamentos': { grupo: 'Títulos das páginas', rotulo: 'Treinamentos', Padrao: GraduationCap },
  'pagina.escalas': { grupo: 'Títulos das páginas', rotulo: 'Escalas de trabalho', Padrao: CalendarRange },
  'secao.treinamentos-integracao': { grupo: 'Títulos das páginas', rotulo: 'Treinamentos: integração', Padrao: GraduationCap },
  'secao.treinamentos-trilhas': { grupo: 'Títulos das páginas', rotulo: 'Treinamentos: trilhas', Padrao: Route },
  'pagina.usuarios-chamados': { grupo: 'Títulos das páginas', rotulo: 'Usuários de chamados', Padrao: KeyRound },

  'pessoas.colaborador-sem-foto': { grupo: 'Pessoas', rotulo: 'Colaborador sem foto', Padrao: UserRound },
  'pessoas.medico-sem-foto': { grupo: 'Pessoas', rotulo: 'Médico sem foto', Padrao: Stethoscope },
  'pessoas.telefone': { grupo: 'Pessoas', rotulo: 'Telefone no cartão', Padrao: Phone },
  'pessoas.email': { grupo: 'Pessoas', rotulo: 'E-mail no cartão', Padrao: Mail },
  'aniversariantes.mural-bolo': { grupo: 'Pessoas', rotulo: 'Mural dos aniversariantes: bolo', Padrao: Cake },

  'vazio.busca': { grupo: 'Telas vazias e avisos', rotulo: 'Busca sem resultado (todas as telas)', Padrao: Search },
  'vazio.restrito': { grupo: 'Telas vazias e avisos', rotulo: 'Conteúdo restrito', Padrao: Lock },
  'vazio.album': { grupo: 'Telas vazias e avisos', rotulo: 'Álbum sem fotos', Padrao: Images },
  'vazio.avisos': { grupo: 'Telas vazias e avisos', rotulo: 'Sem avisos', Padrao: BellOff },
  'vazio.colaboradores': { grupo: 'Telas vazias e avisos', rotulo: 'Colaboradores (sem login)', Padrao: Users },
  'vazio.contatos': { grupo: 'Telas vazias e avisos', rotulo: 'Sem contatos', Padrao: Contact },
  'vazio.corpo-clinico': { grupo: 'Telas vazias e avisos', rotulo: 'Corpo clínico vazio', Padrao: Stethoscope },
  'vazio.documento': { grupo: 'Telas vazias e avisos', rotulo: 'Documento não encontrado', Padrao: FileText },
  'vazio.documentos': { grupo: 'Telas vazias e avisos', rotulo: 'Sem documentos', Padrao: FolderSearch },
  'vazio.formularios': { grupo: 'Telas vazias e avisos', rotulo: 'Sem formulários', Padrao: FileText },
  'vazio.galeria': { grupo: 'Telas vazias e avisos', rotulo: 'Galeria vazia', Padrao: Images },
  'vazio.indicadores': { grupo: 'Telas vazias e avisos', rotulo: 'Sem indicadores', Padrao: BarChart3 },
  'vazio.jornal': { grupo: 'Telas vazias e avisos', rotulo: 'Mini Jornal vazio', Padrao: Newspaper },
  'vazio.noticia': { grupo: 'Telas vazias e avisos', rotulo: 'Notícia não encontrada', Padrao: Newspaper },
  'vazio.novidades': { grupo: 'Telas vazias e avisos', rotulo: 'Sem versões publicadas', Padrao: History },
  'vazio.ramais': { grupo: 'Telas vazias e avisos', rotulo: 'Sem ramais', Padrao: Phone },
  'vazio.ramais-login': { grupo: 'Telas vazias e avisos', rotulo: 'Ramais: entrar para ver o diretório', Padrao: Users },
  'vazio.seguranca-do-paciente': { grupo: 'Telas vazias e avisos', rotulo: 'Sem relatórios de segurança', Padrao: ShieldCheck },
  'vazio.treinamento-aulas': { grupo: 'Telas vazias e avisos', rotulo: 'Treinamento sem aulas', Padrao: GraduationCap },
  'vazio.treinamento-indisponivel': { grupo: 'Telas vazias e avisos', rotulo: 'Treinamento indisponível', Padrao: GraduationCap },
  'vazio.usuarios-chamados': { grupo: 'Telas vazias e avisos', rotulo: 'Sem usuários de chamados', Padrao: KeyRound },
  'vazio.versao': { grupo: 'Telas vazias e avisos', rotulo: 'Versão não encontrada', Padrao: Rocket },
};

/** Ícone de um ponto fixo: o padrão registrado acima ou a troca feita no painel. */
export function IconePonto({ ponto, className, style, ...rest }: { ponto: keyof typeof PONTOS; className?: string; style?: React.CSSProperties; 'aria-hidden'?: boolean | 'true' }) {
  const Padrao = PONTOS[ponto]?.Padrao ?? Lock;
  return (
    <Icone ponto={ponto}>
      <Padrao className={className} style={style} {...rest} />
    </Icone>
  );
}
