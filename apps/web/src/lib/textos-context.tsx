'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { DEFAULT_BRANDING, useBranding } from './branding';
import { CREDITO_PADRAO, type FooterCredit } from './layout';
import { resolverTexto, type TextoChave } from './textos';
import { TELA_LOGIN_PADRAO, type TelaLogin } from './tela-login';

interface TextosPayload {
  textos: Record<string, string>;
  credito: FooterCredit;
  privacyPolicyUrl: string;
  telaLogin?: TelaLogin;
  icones?: Record<string, IconeTroca>;
}

/** Ícone trocado em Painel › Ícones da intranet. */
export interface IconeTroca {
  icone: string;
  imagemId: string | null;
}

interface Ctx {
  /** Texto final (personalizado ou padrão), com {site}, {tagline} e as variáveis extras trocadas. */
  t: (chave: TextoChave, vars?: Record<string, string>) => string;
  /** Bloco "Desenvolvido por" de Painel › Cabeçalho e rodapé. */
  credito: FooterCredit;
  /** Link da política de privacidade definido em Configurações (vazio = sem link). */
  privacyPolicyUrl: string;
  /** Aparência da tela de login (Painel › Tela de login). */
  telaLogin: TelaLogin;
  /** Troca de ícone salva para um ponto da intranet (undefined = ícone padrão). */
  icone: (ponto: string) => IconeTroca | undefined;
  reload: () => void;
}

const CACHE_KEY = 'nr.textos';
const PRIVACIDADE_PADRAO = '';
const TextosCtx = createContext<Ctx | null>(null);

export function TextosProvider({ children }: { children: React.ReactNode }) {
  const { branding } = useBranding();
  const [data, setData] = useState<TextosPayload | null>(null);

  const reload = useCallback(() => {
    api<TextosPayload>('/textos')
      .then((d) => {
        setData(d);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(d));
        } catch {}
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // usa o que foi salvo na última visita para não piscar com o texto padrão
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const d = JSON.parse(cached);
        if (d && typeof d === 'object' && d.textos && typeof d.textos === 'object') setData(d);
      }
    } catch {}
    reload();
  }, [reload]);

  const value = useMemo<Ctx>(() => {
    const base = { site: branding.siteName, tagline: branding.siteTagline };
    return {
      t: (chave, vars) => resolverTexto(chave, data?.textos, vars ? { ...base, ...vars } : base),
      credito: data?.credito ?? CREDITO_PADRAO,
      privacyPolicyUrl: typeof data?.privacyPolicyUrl === 'string' ? data.privacyPolicyUrl : PRIVACIDADE_PADRAO,
      telaLogin: data?.telaLogin && typeof data.telaLogin === 'object' ? { ...TELA_LOGIN_PADRAO, ...data.telaLogin } : TELA_LOGIN_PADRAO,
      icone: (ponto) => (data?.icones && typeof data.icones === 'object' ? data.icones[ponto] : undefined),
      reload,
    };
  }, [branding.siteName, branding.siteTagline, data, reload]);

  return <TextosCtx.Provider value={value}>{children}</TextosCtx.Provider>;
}

const FALLBACK: Ctx = {
  t: (chave, vars) => resolverTexto(chave, null, { site: DEFAULT_BRANDING.siteName, tagline: DEFAULT_BRANDING.siteTagline, ...vars }),
  credito: CREDITO_PADRAO,
  privacyPolicyUrl: PRIVACIDADE_PADRAO,
  telaLogin: TELA_LOGIN_PADRAO,
  icone: () => undefined,
  reload: () => {},
};

/** Função `t(chave)` e o crédito; fora do provedor, cai nos textos padrão. */
export const useTextos = () => useContext(TextosCtx) ?? FALLBACK;

/** Um texto só: `const titulo = useTexto('ramais.titulo')`. */
export function useTexto(chave: TextoChave, vars?: Record<string, string>) {
  return useTextos().t(chave, vars);
}
