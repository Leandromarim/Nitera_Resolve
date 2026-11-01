'use client';

import { useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import { ZoomImagem } from '@/components/ui/zoom';

/** Visualizador de imagem em tela cheia, com zoom (roda, arrastar, duplo clique, pinça) e lupa. */
export function ImageViewer({ src, downloadUrl, title, date, onClose }: { src: string; downloadUrl?: string | null; title?: string | null; date?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Imagem em tela cheia" className="fixed inset-0 z-[60] flex flex-col bg-white/95 animate-fade-in dark:bg-[#0b141a]/95" onClick={onClose}>
      <div className="flex h-16 shrink-0 items-center gap-3 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          {title && <p className="truncate font-medium text-slate-800 dark:text-[#e9edef]">{title}</p>}
          {date && <p className="text-xs text-slate-500 dark:text-[#8696a0]">{fmtDateTime(date)}</p>}
        </div>
        {downloadUrl && (
          <a href={downloadUrl} className="grid size-10 place-items-center rounded-full text-slate-600 hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10" aria-label="Baixar imagem" title="Baixar">
            <Download className="size-5" />
          </a>
        )}
        <button onClick={onClose} className="grid size-10 place-items-center rounded-full text-slate-600 hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10" aria-label="Fechar" title="Fechar">
          <X className="size-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 p-4 sm:p-10" onClick={(e) => e.stopPropagation()}>
        <ZoomImagem src={src} alt={title ?? 'Imagem'} tema="claro" imgClassName="rounded-md shadow-2xl animate-slide-up" onClickFora={onClose} />
      </div>
    </div>
  );
}
