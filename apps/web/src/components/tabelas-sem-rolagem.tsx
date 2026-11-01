'use client';

import { useEffect } from 'react';

/**
 * Nenhuma tabela da intranet rola para o lado: no celular, ou quando as colunas não cabem na largura,
 * cada linha vira um cartão com o nome da coluna acima de cada valor (CSS .tabela-resp em globals.css).
 * Vale para toda <table> da página; folhas A4, grades de edição e mapas de calor usam data-fixa e cuidam
 * da própria largura.
 */
const ajustadas = new Map<HTMLTableElement, () => void>();

function ajustar(t: HTMLTableElement) {
  const box = t.parentElement;
  if (!box) return () => {};
  t.classList.add('tabela-resp');
  const rotular = () => {
    const head = t.tHead?.rows[t.tHead.rows.length - 1];
    const nomes: string[] = [];
    for (const th of Array.from(head?.cells ?? [])) for (let i = 0; i < th.colSpan; i++) nomes.push(th.colSpan > 1 ? '' : (th.dataset.nome ?? th.textContent?.trim() ?? ''));
    for (const tb of Array.from(t.tBodies))
      for (const tr of Array.from(tb.rows)) {
        let col = 0;
        for (const td of Array.from(tr.cells)) {
          // a primeira célula de uma linha com <th> já tem o nome dela
          const nome = td.colSpan > 1 || td.tagName === 'TH' ? '' : (nomes[col] ?? '');
          if (td.getAttribute('data-label') !== nome) td.setAttribute('data-label', nome);
          col += td.colSpan;
        }
      }
  };
  const caber = () => {
    t.classList.remove('cartoes');
    if (t.scrollWidth > box.clientWidth + 1) t.classList.add('cartoes');
  };
  rotular();
  caber();
  const mo = new MutationObserver(() => (rotular(), caber()));
  mo.observe(t, { childList: true, subtree: true, characterData: true });
  const ro = new ResizeObserver(caber);
  ro.observe(box);
  return () => (mo.disconnect(), ro.disconnect());
}

export function TabelasSemRolagem() {
  useEffect(() => {
    const varrer = () => {
      for (const [t, parar] of ajustadas)
        if (!t.isConnected) {
          parar();
          ajustadas.delete(t);
        }
      for (const t of Array.from(document.querySelectorAll<HTMLTableElement>('table:not([data-fixa]):not(.sr-only)')))
        if (!ajustadas.has(t) && !t.closest('[data-fixa]')) ajustadas.set(t, ajustar(t));
    };
    varrer();
    let pendente = 0;
    const mo = new MutationObserver(() => {
      if (pendente) return;
      pendente = requestAnimationFrame(() => ((pendente = 0), varrer()));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(pendente);
      for (const parar of ajustadas.values()) parar();
      ajustadas.clear();
    };
  }, []);
  return null;
}
