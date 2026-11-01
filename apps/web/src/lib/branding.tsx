'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

/** Identidade visual editável em Painel › Configurações › Aparência. */
export interface Branding {
  siteName: string;
  siteTagline: string;
  logoUrl: string; // fundo escuro (cabeçalho, menu lateral, rodapé)
  logoLightUrl: string; // fundo claro (login, avaliação, etiquetas)
  faviconUrl: string; // ícone da aba
  primaryColor: string;
  accentColor: string;
  headerColor: string;
  subbarColor: string;
  footerColor: string;
  sidebarColor: string;
  backgroundColor: string;
  highlightOrangeColor: string;
  highlightRedColor: string;
  /** estilo: fonte, densidade das tabelas, cantos e animações */
  uiFonte: 'inter' | 'sistema';
  uiDensidade: 'confortavel' | 'compacta';
  uiCantos: 'padrao' | 'retos' | 'arredondados';
  uiAnimacoes: 'completas' | 'desligadas';
  /** larguras máximas em px; 0 = tela inteira */
  uiLarguraPortal: number;
  uiLarguraTopo: number;
  uiLarguraPainel: number;
}

export const DEFAULT_BRANDING: Branding = {
  siteName: 'NITERA Resolve',
  siteTagline: 'Central de chamados',
  logoUrl: '/resolve-logo-claro.png',
  logoLightUrl: '/resolve-logo.png',
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
  uiLarguraTopo: 1280,
  uiLarguraPainel: 0,
};

const LARGURAS: [keyof Branding, string][] = [
  ['uiLarguraPortal', '--largura-pagina'],
  ['uiLarguraTopo', '--largura-topo'],
  ['uiLarguraPainel', '--largura-painel'],
];

/** Cada opção de estilo vira um atributo no <html> (ex.: data-cantos="retos"), lido pelo globals.css. */
const ESTILO: [keyof Branding, string][] = [
  ['uiFonte', 'fonte'],
  ['uiDensidade', 'densidade'],
  ['uiCantos', 'cantos'],
  ['uiAnimacoes', 'animacoes'],
];

const HEX = /^#[0-9a-f]{6}$/i;
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const CACHE_KEY = 'nr.branding';

/** Escreve as cores como variáveis CSS; todas as telas (portal, painel, chat, chamados) leem delas. */
export function applyBranding(b: Partial<Branding>) {
  const root = document.documentElement.style;
  const set = (name: string, value?: string) => (value && HEX.test(value) ? root.setProperty(name, value) : root.removeProperty(name));
  const BRAND = ['300', '400', '500', '600', '700', '800', '900', '950'].map((n) => `--color-brand-${n}`);
  const CORAL = ['400', '500', '600'].map((n) => `--color-coral-${n}`);
  // na cor padrão, mantém a paleta afinada do globals.css; em outra cor, gera os tons a partir dela
  const c = b.primaryColor;
  if (!c || c.toLowerCase() === DEFAULT_BRANDING.primaryColor) BRAND.forEach((v) => root.removeProperty(v));
  else if (HEX.test(c)) {
    root.setProperty('--color-brand-300', `color-mix(in oklab, ${c} 45%, white)`);
    root.setProperty('--color-brand-400', `color-mix(in oklab, ${c} 62%, white)`);
    root.setProperty('--color-brand-500', `color-mix(in oklab, ${c} 75%, white)`);
    root.setProperty('--color-brand-600', `color-mix(in oklab, ${c} 88%, white)`);
    root.setProperty('--color-brand-700', c);
    root.setProperty('--color-brand-800', `color-mix(in oklab, ${c} 80%, black)`);
    root.setProperty('--color-brand-900', `color-mix(in oklab, ${c} 62%, black)`);
    root.setProperty('--color-brand-950', `color-mix(in oklab, ${c} 42%, black)`);
  }
  const a = b.accentColor;
  if (!a || a.toLowerCase() === DEFAULT_BRANDING.accentColor) CORAL.forEach((v) => root.removeProperty(v));
  else if (HEX.test(a)) {
    root.setProperty('--color-coral-400', `color-mix(in oklab, ${a} 80%, white)`);
    root.setProperty('--color-coral-500', a);
    root.setProperty('--color-coral-600', `color-mix(in oklab, ${a} 88%, black)`);
  }
  set('--ha-header', b.headerColor);
  set('--ha-subbar', b.subbarColor);
  // texto da faixa: escuro sobre fundo claro, branco sobre fundo escuro
  if (!b.subbarColor || b.subbarColor.toLowerCase() === DEFAULT_BRANDING.subbarColor) root.removeProperty('--ha-subbar-fg');
  else if (HEX.test(b.subbarColor)) root.setProperty('--ha-subbar-fg', luminance(b.subbarColor) > 0.45 ? 'rgba(15,23,42,.85)' : 'rgba(255,255,255,.92)');
  set('--ha-footer', b.footerColor);
  set('--ha-sidebar', b.sidebarColor);
  set('--ha-page', b.backgroundColor);
  set('--ha-hl-orange', b.highlightOrangeColor);
  set('--ha-hl-red', b.highlightRedColor);
  for (const [k, v] of LARGURAS) {
    const n = Number(b[k]);
    if (!Number.isInteger(n) || (n !== 0 && (n < 960 || n > 3840)) || n === DEFAULT_BRANDING[k]) root.removeProperty(v);
    else root.setProperty(v, n === 0 ? 'none' : `${n}px`);
  }
  for (const [k, attr] of ESTILO) {
    const val = b[k];
    if (typeof val === 'string' && /^[a-z]+$/.test(val) && val !== DEFAULT_BRANDING[k]) document.documentElement.setAttribute(`data-${attr}`, val);
    else document.documentElement.removeAttribute(`data-${attr}`);
  }

  if (b.faviconUrl) {
    // Não remove os <link> do <head>: eles pertencem ao Next.js, e removê-los quebra a troca de página
    // ("Cannot read properties of null (reading 'removeChild')"). Só troca o endereço.
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
    if (links.length) links.forEach((l) => l.getAttribute('href') !== b.faviconUrl && (l.href = b.faviconUrl!));
    else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = b.faviconUrl;
      document.head.appendChild(link);
    }
  }
}

const Ctx = createContext<{ branding: Branding; reload: () => void; preview: (b: Partial<Branding> | null) => void }>({
  branding: DEFAULT_BRANDING,
  reload: () => {},
  preview: () => {},
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  const reload = useCallback(() => {
    api<Partial<Branding>>('/branding')
      .then((b) => {
        const merged = { ...DEFAULT_BRANDING, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v || v === 0)) } as Branding;
        setBranding(merged);
        applyBranding(merged);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
        } catch {}
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // aplica na hora o que foi salvo na última visita, para não piscar com as cores padrão
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const b = { ...DEFAULT_BRANDING, ...JSON.parse(cached) } as Branding;
        setBranding(b);
        applyBranding(b);
      }
    } catch {}
    reload();
  }, [reload]);

  /** Mostra uma prévia ao vivo enquanto o administrador edita; null volta ao que está salvo. */
  const preview = useCallback((b: Partial<Branding> | null) => applyBranding(b ? { ...branding, ...b } : branding), [branding]);

  return <Ctx.Provider value={{ branding, reload, preview }}>{children}</Ctx.Provider>;
}

export const useBranding = () => useContext(Ctx);
