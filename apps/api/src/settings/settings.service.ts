import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Configurações gerais do NITERA Resolve (Configurações › Instituição e aparência).
 * O nome da instituição vem do instalador (INSTITUICAO_NOME) até ser trocado na tela.
 */
export const DEFAULT_SETTINGS: Record<string, unknown> = {
  siteName: process.env.INSTITUICAO_NOME || 'Minha instituição',
  siteTagline: 'NITERA Resolve',
  // logo para fundo escuro (topo e menu) e para fundo claro (login e impressões)
  logoUrl: '/resolve-logo.png',
  logoLightUrl: '/resolve-logo-claro.png',
  faviconUrl: '/favicon.png',
  primaryColor: '#3c4b78',
  accentColor: '#ff6b4a',
  headerColor: '#3c4b78',
  subbarColor: '#5269a3',
  footerColor: '#3c4b78',
  sidebarColor: '#1f2a4d',
  backgroundColor: '#f1f5f9',
  highlightOrangeColor: '#f5a524',
  highlightRedColor: '#ff6b4a',
  uiFonte: 'inter',
  uiDensidade: 'confortavel',
  uiCantos: 'padrao',
  uiAnimacoes: 'completas',
  uiLarguraPortal: 1280,
  uiLarguraPainel: 0,
  uiLarguraTopo: 1280,
  privacyPolicyUrl: '',
  ticketsWhatsappNumber: '',
  /** mostra um QR Code do WhatsApp do suporte ao lado do link (login e Meus chamados) */
  ticketsWhatsappQr: false,
  ticketsEmail: '',
};

/** Opções de estilo aceitas; a primeira de cada lista é o padrão. */
export const UI_OPCOES: Record<string, string[]> = {
  uiFonte: ['inter', 'sistema'],
  uiDensidade: ['confortavel', 'compacta'],
  uiCantos: ['padrao', 'retos', 'arredondados'],
  uiAnimacoes: ['completas', 'desligadas'],
};
/** Larguras em px: 0 (tela inteira) ou entre min e max. */
export const UI_LARGURA = { chaves: ['uiLarguraPortal', 'uiLarguraTopo', 'uiLarguraPainel'], min: 960, max: 3840 };

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async settings() {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
    const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) s[r.key] = r.value;
    return s;
  }

  /** Identidade visual (logo, ícone, nome, cores e estilo) e contatos do suporte: pública e leve. */
  async branding() {
    const s = await this.settings();
    const keys = ['siteName', 'siteTagline', 'logoUrl', 'logoLightUrl', 'faviconUrl', 'privacyPolicyUrl', 'ticketsWhatsappNumber', 'ticketsWhatsappQr', 'ticketsEmail'];
    return Object.fromEntries(Object.entries(s).filter(([k]) => keys.includes(k) || k.endsWith('Color') || k in UI_OPCOES || UI_LARGURA.chaves.includes(k)));
  }
}
