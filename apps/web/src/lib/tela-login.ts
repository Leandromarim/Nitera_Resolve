/**
 * Aparência da tela de login (Painel › Tela de login). Espelha apps/api/src/content/tela-login.controller.ts;
 * o padrão abaixo só vale enquanto a API não responde.
 */
export interface TelaLogin {
  lateral: boolean;
  lado: 'esquerda' | 'direita';
  fundo: 'padrao' | 'cores' | 'imagem';
  corInicio: string;
  corFim: string;
  imagemId: string | null;
  escurecer: number;
  textoLateral: 'claro' | 'escuro';
  logo: 'padrao' | 'enviada' | 'nenhuma';
  logoId: string | null;
  logoFormulario: 'celular' | 'sempre' | 'nunca';
  icones: boolean;
  /** ícone de cada benefício (login.item-1 a login.item-7) */
  itens: TelaLoginItem[];
  corBotao: string;
}

export interface TelaLoginItem {
  icone: string;
  imagemId: string | null;
  /** vazio = cor padrão daquele item */
  cor: string;
}

export const ICONES_PADRAO_LOGIN = ['message-circle', 'life-buoy', 'lock', 'newspaper', 'graduation-cap', 'file-text', 'phone'];

export const TELA_LOGIN_PADRAO: TelaLogin = {
  lateral: true,
  lado: 'esquerda',
  fundo: 'padrao',
  corInicio: '#3d4a7a',
  corFim: '#141a33',
  imagemId: null,
  escurecer: 45,
  textoLateral: 'claro',
  logo: 'padrao',
  logoId: null,
  logoFormulario: 'celular',
  icones: true,
  itens: ICONES_PADRAO_LOGIN.map((icone) => ({ icone, imagemId: null, cor: '' })),
  corBotao: '',
};

export const arquivoUrl = (id: string | null) => (id ? `/api/files/${id}` : null);
