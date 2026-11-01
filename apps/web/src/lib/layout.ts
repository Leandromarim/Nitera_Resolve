/** Logos da NITERA (crédito "Desenvolvido por" na tela de login). */
export const NITERA_LOGO = '/nitera-logo.png';
export const NITERA_LOGO_LIGHT = '/nitera-logo-claro.png';

export interface FooterCredit {
  enabled: boolean;
  text: string;
  logoUrl: string;
  logoAlt: string;
  url: string;
  badge: boolean;
}

/** Crédito padrão da tela de login (o servidor pode mandar outro em /settings/textos). */
export const CREDITO_PADRAO: FooterCredit = { enabled: true, text: 'Desenvolvido por', logoUrl: NITERA_LOGO_LIGHT, logoAlt: 'NITERA Tecnologia', url: '', badge: false };
