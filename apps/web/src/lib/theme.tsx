'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/** claro, escuro ou automático (segue o sistema operacional, inclusive quando ele muda sozinho à noite) */
export type ThemeMode = 'light' | 'dark' | 'auto';

const Ctx = createContext<{ dark: boolean; mode: ThemeMode; toggle: () => void; setMode: (m: ThemeMode) => void }>({ dark: false, mode: 'auto', toggle: () => {}, setMode: () => {} });

/** Script inline no <head> que aplica o tema antes da pintura (evita "piscar" claro → escuro). Sem escolha salva = automático. */
export const themeScript = `try{var t=localStorage.getItem('nr-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

const sistemaEscuro = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('auto');
  const [dark, setDark] = useState(false);

  const aplicar = useCallback((m: ThemeMode) => {
    const d = m === 'dark' || (m === 'auto' && sistemaEscuro());
    const html = document.documentElement;
    // troca sem animar tudo de uma vez (as transições de cor dos componentes ficariam "piscando")
    html.classList.add('sem-transicao');
    html.classList.toggle('dark', d);
    setDark(d);
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('sem-transicao')));
  }, []);

  useEffect(() => {
    let m: ThemeMode = 'auto';
    try {
      const t = localStorage.getItem('nr-theme');
      if (t === 'light' || t === 'dark') m = t;
    } catch {}
    setModeState(m);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  // no automático, acompanha o sistema operacional sem recarregar
  useEffect(() => {
    if (mode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => aplicar('auto');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [mode, aplicar]);

  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      try {
        if (m === 'auto') localStorage.removeItem('nr-theme');
        else localStorage.setItem('nr-theme', m);
      } catch {}
      aplicar(m);
    },
    [aplicar],
  );

  const toggle = useCallback(() => setMode(dark ? 'light' : 'dark'), [dark, setMode]);

  return <Ctx.Provider value={{ dark, mode, toggle, setMode }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
