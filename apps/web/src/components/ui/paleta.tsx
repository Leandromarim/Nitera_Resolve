'use client';

import { Clock, CornerDownLeft, Loader2, Monitor, Moon, Search, Sun, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { clsx } from './index';

/**
 * Paleta de comandos única (Ctrl+K) do painel e do portal: telas na hora, conteúdo da API,
 * últimos itens abertos (guardados só neste navegador) e ações rápidas, como trocar o tema.
 */
export interface PaletaHit {
  title: string;
  subtitle?: string;
  href: string;
}
export interface PaletaGroup {
  group: string;
  items: PaletaHit[];
}
interface Item extends PaletaHit {
  group: string;
  run?: () => void;
  icon?: React.ReactNode;
}

export const normBusca = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Abre a paleta com Ctrl+K (Cmd+K) ou "/" fora de campos de texto. */
export function useAtalhoBusca(abrir: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        abrir();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [abrir]);
}

const MAX_RECENTES = 6;
function lerRecentes(chave: string): Item[] {
  try {
    const v = JSON.parse(localStorage.getItem(chave) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.title === 'string' && typeof x.href === 'string').slice(0, MAX_RECENTES) : [];
  } catch {
    return [];
  }
}
function guardarRecente(chave: string, it: Item) {
  try {
    const novo = { title: it.title, subtitle: it.subtitle, href: it.href, group: it.group };
    const lista = [novo, ...lerRecentes(chave).filter((x) => x.href !== it.href)].slice(0, MAX_RECENTES);
    localStorage.setItem(chave, JSON.stringify(lista));
  } catch {}
}

export function Paleta({
  label,
  endpoint,
  placeholder,
  vazio,
  locais,
  icones,
  storageKey,
  rodape,
  onClose,
}: {
  label: string;
  /** rota da API que recebe ?q= e devolve grupos */
  /** Busca de conteúdo na API; sem ela, a paleta procura só nas telas e ações. */
  endpoint?: string;
  placeholder: string;
  /** texto mostrado antes de digitar, quando não há recentes */
  vazio: string;
  /** resultados calculados na hora, sem ir à API (ex.: telas do painel) */
  locais?: (termos: string[]) => PaletaGroup | null;
  icones?: Record<string, React.ReactNode>;
  storageKey: string;
  rodape?: React.ReactNode;
  onClose: () => void;
}) {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<PaletaGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [active, setActive] = useState(0);
  const [recentes, setRecentes] = useState<Item[]>([]);
  const chave = `${storageKey}-recentes`;

  useEffect(() => {
    setRecentes(lerRecentes(chave));
    input.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [chave]);

  const term = q.trim();
  const termos = useMemo(() => normBusca(term).split(/\s+/).filter(Boolean), [term]);

  // conteúdo: espera a pessoa parar de digitar e pergunta à API
  useEffect(() => {
    setErro('');
    if (!endpoint || term.length < 2) {
      setRemote([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let stale = false;
    const t = setTimeout(() => {
      api<PaletaGroup[]>(`${endpoint}?q=${encodeURIComponent(term)}`)
        .then((r) => !stale && setRemote(r))
        .catch((e: Error) => {
          if (stale) return;
          setRemote([]);
          setErro(e.message);
        })
        .finally(() => !stale && setLoading(false));
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [term, endpoint]);

  // ações rápidas: aparecem quando o termo combina com o nome delas
  const acoes = useMemo<Item[]>(() => {
    const todas: (Item & { chaves: string })[] = [
      { group: 'Ações', title: 'Tema claro', subtitle: mode === 'light' ? 'Em uso' : undefined, href: '#tema-claro', icon: <Sun className="size-4" />, run: () => setMode('light'), chaves: 'tema claro aparencia light modo dia' },
      { group: 'Ações', title: 'Tema escuro', subtitle: mode === 'dark' ? 'Em uso' : undefined, href: '#tema-escuro', icon: <Moon className="size-4" />, run: () => setMode('dark'), chaves: 'tema escuro aparencia dark modo noite' },
      { group: 'Ações', title: 'Tema automático', subtitle: mode === 'auto' ? 'Em uso' : 'Segue o sistema', href: '#tema-auto', icon: <Monitor className="size-4" />, run: () => setMode('auto'), chaves: 'tema automatico aparencia sistema auto' },
    ];
    if (!termos.length) return [];
    return todas.filter((a) => termos.every((t) => normBusca(`${a.title} ${a.chaves}`).includes(t)));
  }, [termos, mode, setMode]);

  const grupos = useMemo<{ group: string; items: Item[] }[]>(() => {
    if (!termos.length) return recentes.length ? [{ group: 'Abertos recentemente', items: recentes.map((r) => ({ ...r, icon: <Clock className="size-4" /> })) }] : [];
    const out: { group: string; items: Item[] }[] = [];
    const loc = locais?.(termos);
    if (loc?.items.length) out.push({ group: loc.group, items: loc.items.map((i) => ({ ...i, group: loc.group })) });
    for (const g of remote) out.push({ group: g.group, items: g.items.map((i) => ({ ...i, group: g.group })) });
    if (acoes.length) out.push({ group: 'Ações', items: acoes });
    return out;
  }, [termos, recentes, locais, remote, acoes]);

  const flat = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);
  useEffect(() => setActive(0), [grupos]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    if (it.run) return it.run();
    guardarRecente(chave, it);
    if (/^https?:\/\//i.test(it.href)) window.open(it.href, '_blank', 'noopener,noreferrer');
    // já está nesta página: recarrega para a lupa da página pegar o novo termo
    else if (it.href.split('?')[0] === location.pathname) location.assign(it.href);
    else router.push(it.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active]);
    }
  };

  const limparRecentes = () => {
    try {
      localStorage.removeItem(chave);
    } catch {}
    setRecentes([]);
    input.current?.focus();
  };

  let index = -1;
  const idBase = storageKey.replace(/[^a-z0-9-]/gi, '');
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[8vh]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-md animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white text-slate-800 shadow-[var(--shadow-pop)] ring-1 ring-slate-900/5 animate-pop-in dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
          <Search className="size-5 shrink-0 text-slate-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={`${idBase}-resultados`}
            aria-activedescendant={flat.length ? `${idBase}-${active}` : undefined}
            maxLength={100}
          />
          {loading && <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Buscando" />}
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" aria-label="Fechar busca">
            <X className="size-5" />
          </button>
        </div>

        <div ref={list} id={`${idBase}-resultados`} role="listbox" className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {!term && !recentes.length && <p className="px-3 py-8 text-center text-sm text-slate-500">{vazio}</p>}
          {term.length === 1 && !flat.length && <p className="px-3 py-8 text-center text-sm text-slate-500">Digite pelo menos 2 letras.</p>}
          {erro && <p className="px-3 py-8 text-center text-sm text-rose-600">{erro}</p>}
          {term.length >= 2 && !flat.length && !loading && !erro && <p className="px-3 py-8 text-center text-sm text-slate-500">Nada encontrado para “{term}”.</p>}
          {grupos.map((g) => (
            <div key={g.group} className="mb-2">
              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{g.group}</p>
                {!term && g.group === 'Abertos recentemente' && (
                  <button type="button" onClick={limparRecentes} className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    Limpar
                  </button>
                )}
              </div>
              {g.items.map((it) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={`${g.group}-${i}`}
                    id={`${idBase}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(it)}
                    className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', i === active ? 'bg-brand-50 dark:bg-brand-900/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')}
                  >
                    <span className={clsx('grid size-8 shrink-0 place-items-center rounded-lg', i === active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
                      {it.icon ?? icones?.[it.group] ?? <Search className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{it.title}</span>
                      {(it.subtitle || (!term && it.group)) && <span className="block truncate text-xs text-slate-500">{it.subtitle ?? it.group}</span>}
                    </span>
                    {i === active && <CornerDownLeft className="size-4 shrink-0 text-slate-400" aria-hidden />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="hidden items-center gap-4 border-t border-slate-200 px-4 py-2 text-xs text-slate-500 sm:flex dark:border-slate-800">
          <span>
            <kbd className="font-sans">↑ ↓</kbd> navegar
          </span>
          <span>
            <kbd className="font-sans">Enter</kbd> abrir
          </span>
          <span>
            <kbd className="font-sans">Esc</kbd> fechar
          </span>
          {rodape && <span className="ml-auto">{rodape}</span>}
        </div>
      </div>
    </div>
  );
}
