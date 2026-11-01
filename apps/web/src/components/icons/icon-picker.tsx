'use client';

import { ImagePlus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { uploadFile } from '@/lib/api';
import { Button, clsx, useToast } from '@/components/ui';
import { DynamicIcon } from './dynamic-icon';
import { ICON_GROUPS, ICON_MAP, searchIcons } from './catalog';

export interface IconValue {
  icon: string;
  imageId: string | null;
  image: string | null;
}

const ACCEPT = ['image/png', 'image/webp', 'image/jpeg'];
const MAX_BYTES = 1024 * 1024;

/**
 * Seletor de ícone em janela: catálogo curado com busca em português ou imagem própria.
 * Tem o próprio tratamento de Esc para não fechar a janela de edição que está por baixo.
 */
export function IconPicker({ open, value, onClose, onChange, dark }: { open: boolean; value: IconValue; onClose: () => void; onChange: (v: IconValue) => void; dark?: boolean }) {
  const [q, setQ] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const results = useMemo(() => searchIcons(q), [q]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setQ('');
    const previous = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const pick = (name: string) => {
    onChange({ icon: name, imageId: null, image: null });
    onClose();
  };

  const send = async (file?: File) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return toast('Envie uma imagem PNG, WEBP ou JPG', 'error');
    if (file.size > MAX_BYTES) return toast('A imagem pode ter no máximo 1 MB', 'error');
    setProgress(0);
    try {
      const f = await uploadFile(file, { public: true, images: true }, setProgress);
      onChange({ ...value, imageId: f.id, image: f.url });
      toast('Imagem enviada');
      onClose();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setProgress(null);
    }
  };

  const grid = (list: typeof results) => (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
      {list.map((i) => {
        const selected = !value.image && value.icon === i.name;
        return (
          <li key={i.name}>
            <button
              type="button"
              onClick={() => pick(i.name)}
              aria-pressed={selected}
              title={i.label}
              className={clsx(
                'flex w-full flex-col items-center gap-1 rounded-xl p-2 text-center text-[11px] leading-tight transition',
                selected ? 'bg-brand-600 text-white ring-2 ring-brand-600' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <i.Icon className="size-6" aria-hidden />
              <span className="line-clamp-2 w-full">{i.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="icon-picker-title" className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:max-w-3xl sm:rounded-3xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 id="icon-picker-title" className="text-lg font-semibold">
            Escolher ícone
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar: telefone, médico, calendário, ti…"
                aria-label="Buscar ícone"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} loading={progress !== null}>
              <ImagePlus className="size-4" /> {progress !== null ? `${progress}%` : 'Enviar imagem própria'}
            </Button>
            <input ref={fileRef} type="file" accept={ACCEPT.join(',')} hidden onChange={(e) => (send(e.target.files?.[0]), (e.target.value = ''))} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              Atual:
              <span className={clsx('grid size-8 place-items-center rounded-lg', dark ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}>
                <DynamicIcon name={value.icon} image={value.image} className="size-5" />
              </span>
              <b className="font-medium text-slate-700 dark:text-slate-300">{value.image ? 'Imagem própria' : ICON_MAP[value.icon]?.label ?? 'Ícone padrão'}</b>
            </span>
            {value.image && (
              <button type="button" onClick={() => onChange({ ...value, imageId: null, image: null })} className="flex items-center gap-1 text-rose-600 hover:underline">
                <Trash2 className="size-3.5" /> Remover imagem e usar o ícone
              </button>
            )}
            <span className="sm:ml-auto">Imagem própria: PNG, WEBP ou JPG, até 1 MB, de preferência quadrada e com fundo transparente.</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {q.trim() ? (
            results.length ? (
              <>
                <p className="mb-3 text-xs text-slate-500" aria-live="polite">
                  {results.length} {results.length === 1 ? 'ícone encontrado' : 'ícones encontrados'}
                </p>
                {grid(results)}
              </>
            ) : (
              <p className="py-10 text-center text-sm text-slate-500" aria-live="polite">
                Nenhum ícone encontrado para “{q}”. Tente outra palavra ou envie uma imagem própria.
              </p>
            )
          ) : (
            <div className="space-y-5">
              {ICON_GROUPS.map((g) => (
                <section key={g} aria-label={g}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g}</h3>
                  {grid(results.filter((i) => i.group === g))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
