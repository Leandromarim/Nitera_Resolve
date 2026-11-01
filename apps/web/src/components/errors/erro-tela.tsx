'use client';

import { useEffect } from 'react';

/** Erro de carregamento de código depois de uma atualização (o navegador ainda tinha a versão anterior). */
function versaoNova(e: Error) {
  return e.name === 'ChunkLoadError' || /Loading (CSS )?chunk|dynamically imported module|Failed to fetch/i.test(e.message);
}

const CHAVE = 'nr-recarregou-versao';

/** Tela de erro amigável: recarrega sozinha uma vez quando o motivo é uma versão nova. */
export function ErroTela({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const nova = versaoNova(error);
  useEffect(() => {
    if (!nova) return;
    try {
      if (sessionStorage.getItem(CHAVE)) return;
      sessionStorage.setItem(CHAVE, '1');
    } catch {
      return;
    }
    window.location.reload();
  }, [nova]);

  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 py-10">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold">{nova ? 'O sistema foi atualizado' : 'Algo deu errado nesta tela'}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {nova ? 'Recarregue a página para usar a versão nova.' : 'Tente de novo. Se continuar, avise a TI informando o horário e a tela.'}
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">Código: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          {!nova && (
            <button onClick={reset} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
              Tentar de novo
            </button>
          )}
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem(CHAVE);
              } catch {}
              window.location.reload();
            }}
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white dark:bg-brand-500"
          >
            Recarregar a página
          </button>
        </div>
      </div>
    </div>
  );
}
