'use client';

import { Cookie } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTextos } from '@/lib/textos-context';

const KEY = 'nr_cookies';

function accepted() {
  try {
    if (localStorage.getItem(KEY) === '1') return true;
  } catch {}
  try {
    return document.cookie.split(';').some((c) => c.trim() === `${KEY}=1`);
  } catch {
    return false;
  }
}

/**
 * Aviso de cookies (LGPD): a intranet usa apenas cookies essenciais e o armazenamento
 * do navegador para preferências. A faixa some depois do "Entendi" e não volta.
 */
export function CookieNotice() {
  const { t: texto, privacyPolicyUrl: privacyUrl } = useTextos();
  const pathname = usePathname() ?? '/';
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hidden = pathname.startsWith('/painel-tv');

  useEffect(() => {
    setShow(!accepted());
  }, []);

  // reserva espaço no fim da página para a faixa não cobrir botões e campos do rodapé
  useEffect(() => {
    const el = ref.current;
    if (!show || hidden || !el) return;
    const apply = () => (document.body.style.paddingBottom = `${el.offsetHeight + 16}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, [show, hidden]);

  if (!show || hidden) return null;

  const destaque = texto('cookies.destaque');
  const linkTexto = texto('cookies.link');

  const accept = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    try {
      document.cookie = `${KEY}=1; Max-Age=31536000; SameSite=Lax; Path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
    } catch {}
    setShow(false);
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Aviso sobre cookies"
      className="no-print fixed inset-x-2 bottom-2 z-40 animate-slide-up sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md"
    >
      <div className="flex flex-col gap-3 rounded-2xl bg-white/95 p-4 text-sm shadow-xl ring-1 ring-slate-200 backdrop-blur sm:flex-row sm:items-end dark:bg-slate-900/95 dark:ring-slate-700">
        <div className="flex gap-3">
          <Cookie className="mt-0.5 size-5 shrink-0 text-coral-500" aria-hidden />
          <p className="text-slate-600 dark:text-slate-300">
            {destaque && <b className="text-slate-800 dark:text-slate-100">{destaque}</b>} <span className="whitespace-pre-line">{texto('cookies.texto')}</span>
            {linkTexto && privacyUrl && (
              <>
                {' '}
                {/^https?:\/\//i.test(privacyUrl) ? (
                  <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300">
                    {linkTexto}
                  </a>
                ) : (
                  <Link href={privacyUrl} className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300">
                    {linkTexto}
                  </Link>
                )}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={accept}
          className="h-10 shrink-0 rounded-xl bg-brand-700 px-5 font-medium text-white shadow-sm hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.98] dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          {texto('cookies.botao')}
        </button>
      </div>
    </div>
  );
}
