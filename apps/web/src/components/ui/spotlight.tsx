'use client';

import { useEffect } from 'react';

/**
 * Luz que acompanha o cursor nas superfícies marcadas com data-spotlight (CSS em globals.css).
 * Um único ouvinte para a página toda; só atualiza duas variáveis CSS, sem re-renderizar nada.
 * No toque e com "movimento reduzido" não faz nada.
 */
export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return;
    let alvo: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    let quadro = 0;
    const pintar = () => {
      quadro = 0;
      if (!alvo) return;
      const r = alvo.getBoundingClientRect();
      alvo.style.setProperty('--mx', `${x - r.left}px`);
      alvo.style.setProperty('--my', `${y - r.top}px`);
    };
    const mover = (e: PointerEvent) => {
      alvo = (e.target as Element | null)?.closest?.<HTMLElement>('[data-spotlight]') ?? null;
      if (!alvo) return;
      x = e.clientX;
      y = e.clientY;
      if (!quadro) quadro = requestAnimationFrame(pintar);
    };
    document.addEventListener('pointermove', mover, { passive: true });
    return () => {
      document.removeEventListener('pointermove', mover);
      cancelAnimationFrame(quadro);
    };
  }, []);
  return null;
}
