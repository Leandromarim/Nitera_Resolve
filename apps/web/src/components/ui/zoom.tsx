'use client';

import { Maximize2, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clsx } from '@/components/ui';

const MIN = 1;
const MAX = 8;
const PASSO = 1.5;
/** Aumento da lupa sobre o tamanho mostrado na tela. */
const LUPA_AUMENTO = 2.5;
const LUPA_TAM = 200;

type Ponto = { x: number; y: number };

/**
 * Imagem com zoom e inspeção: roda do mouse aproxima no ponto do cursor, arrastar anda pela imagem,
 * duplo clique amplia/volta, pinça no celular, +/−/0 no teclado e lupa que segue o mouse.
 * Com zoom, os gestos de deslizar do visualizador (trocar de foto/fechar) ficam desligados.
 */
export function ZoomImagem({
  src,
  alt,
  lupaSrc,
  tema = 'escuro',
  className,
  imgClassName,
  onClickFora,
  imgProps,
}: {
  src: string;
  alt: string;
  /** Versão maior para a lupa (padrão: a mesma imagem). */
  lupaSrc?: string;
  tema?: 'escuro' | 'claro';
  className?: string;
  imgClassName?: string;
  /** Clique no fundo, fora da imagem e sem arrastar (ex.: fechar o visualizador). */
  onClickFora?: () => void;
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [escala, setEscala] = useState(1);
  const [pos, setPos] = useState<Ponto>({ x: 0, y: 0 });
  const [lupaLigada, setLupaLigada] = useState(false);
  const [lupa, setLupa] = useState<{ x: number; y: number; bx: number; by: number; bw: number; bh: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const estado = useRef({ escala: 1, pos: { x: 0, y: 0 } });
  const ponteiros = useRef(new Map<number, Ponto>());
  const gesto = useRef<{ tipo: 'pan'; ini: Ponto; pos0: Ponto } | { tipo: 'pinca'; d0: number; escala0: number } | null>(null);
  const moveu = useRef(false);
  estado.current = { escala, pos };

  // nova imagem: volta ao tamanho normal
  useLayoutEffect(() => {
    setEscala(1);
    setPos({ x: 0, y: 0 });
    setLupa(null);
  }, [src]);

  /** Limita o deslocamento para a imagem não sair da área. */
  const limitar = useCallback((p: Ponto, s: number): Ponto => {
    const c = caixa.current;
    const i = img.current;
    if (!c || !i) return p;
    const mx = Math.max(0, (i.offsetWidth * s - c.clientWidth) / 2);
    const my = Math.max(0, (i.offsetHeight * s - c.clientHeight) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  }, []);

  /** Zoom mantendo parado o ponto (clientX/Y) sob o cursor ou o centro da área. */
  const zoomEm = useCallback(
    (novaEscala: number, cliente?: Ponto) => {
      const c = caixa.current;
      if (!c) return;
      const { escala: s, pos: t } = estado.current;
      const s2 = Math.min(MAX, Math.max(MIN, novaEscala));
      const r = c.getBoundingClientRect();
      const p = cliente ? { x: cliente.x - r.left - r.width / 2, y: cliente.y - r.top - r.height / 2 } : { x: 0, y: 0 };
      const t2 = s2 === 1 ? { x: 0, y: 0 } : limitar({ x: p.x - (s2 * (p.x - t.x)) / s, y: p.y - (s2 * (p.y - t.y)) / s }, s2);
      estado.current = { escala: s2, pos: t2 };
      setEscala(s2);
      setPos(t2);
    },
    [limitar],
  );

  // roda do mouse (listener nativo: precisa de preventDefault para a página não rolar)
  useEffect(() => {
    const c = caixa.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const fator = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.006);
      zoomEm(estado.current.escala * fator, { x: e.clientX, y: e.clientY });
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [zoomEm]);

  // teclado: + aproxima, − afasta, 0 volta
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') zoomEm(estado.current.escala * PASSO);
      else if (e.key === '-' || e.key === '_') zoomEm(estado.current.escala / PASSO);
      else if (e.key === '0') zoomEm(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomEm]);

  const atualizarLupa = (e: React.PointerEvent) => {
    const i = img.current;
    if (!lupaLigada || e.pointerType !== 'mouse' || !i) return setLupa(null);
    const r = i.getBoundingClientRect();
    const c = caixa.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return setLupa(null);
    const bw = r.width * LUPA_AUMENTO;
    const bh = r.height * LUPA_AUMENTO;
    setLupa({ x: e.clientX - c.left, y: e.clientY - c.top, bx: -(x * LUPA_AUMENTO - LUPA_TAM / 2), by: -(y * LUPA_AUMENTO - LUPA_TAM / 2), bw, bh });
  };

  const comZoom = escala > 1.001;
  const parar = (e: React.SyntheticEvent) => {
    // com zoom (ou pinça), o gesto é da imagem: não troca de foto nem fecha
    if (comZoom || ponteiros.current.size > 1) e.stopPropagation();
  };

  const btn =
    tema === 'escuro'
      ? 'grid size-9 place-items-center rounded-full text-white/90 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40'
      : 'grid size-9 place-items-center rounded-full text-slate-700 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/10';

  return (
    <div
      ref={caixa}
      className={clsx('relative flex size-full min-h-0 items-center justify-center overflow-hidden', className)}
      style={{ touchAction: comZoom ? 'none' : 'pan-y', cursor: comZoom ? (arrastando ? 'grabbing' : 'grab') : lupaLigada ? 'crosshair' : 'zoom-in' }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if ((e.target as HTMLElement).closest('button')) return;
        ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moveu.current = false;
        if (ponteiros.current.size === 2) {
          const [a, b] = [...ponteiros.current.values()];
          gesto.current = { tipo: 'pinca', d0: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, escala0: estado.current.escala };
        } else if (ponteiros.current.size === 1) {
          gesto.current = { tipo: 'pan', ini: { x: e.clientX, y: e.clientY }, pos0: estado.current.pos };
        }
        parar(e);
      }}
      onPointerMove={(e) => {
        atualizarLupa(e);
        if (!ponteiros.current.has(e.pointerId)) return;
        ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesto.current;
        if (g?.tipo === 'pinca' && ponteiros.current.size >= 2) {
          const [a, b] = [...ponteiros.current.values()];
          moveu.current = true;
          zoomEm((g.escala0 * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / g.d0, { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 });
        } else if (g?.tipo === 'pan' && estado.current.escala > 1.001) {
          const dx = e.clientX - g.ini.x;
          const dy = e.clientY - g.ini.y;
          if (!moveu.current && Math.hypot(dx, dy) > 3) {
            moveu.current = true;
            setArrastando(true);
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          }
          if (moveu.current) {
            const p = limitar({ x: g.pos0.x + dx, y: g.pos0.y + dy }, estado.current.escala);
            estado.current.pos = p;
            setPos(p);
          }
        } else if (g?.tipo === 'pan' && Math.hypot(e.clientX - g.ini.x, e.clientY - g.ini.y) > 3) {
          moveu.current = true;
        }
      }}
      onPointerUp={(e) => {
        parar(e);
        ponteiros.current.delete(e.pointerId);
        setArrastando(false);
        if (ponteiros.current.size === 1) {
          const [p] = [...ponteiros.current.values()];
          gesto.current = { tipo: 'pan', ini: p!, pos0: estado.current.pos };
        } else if (!ponteiros.current.size) gesto.current = null;
      }}
      onPointerCancel={(e) => {
        ponteiros.current.delete(e.pointerId);
        setArrastando(false);
        if (!ponteiros.current.size) gesto.current = null;
      }}
      onPointerLeave={() => setLupa(null)}
      onTouchStart={parar}
      onTouchEnd={parar}
      onClick={(e) => {
        if (moveu.current) return e.stopPropagation();
        if (e.target === e.currentTarget && onClickFora) onClickFora();
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        zoomEm(comZoom ? 1 : 2.5, { x: e.clientX, y: e.clientY });
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        alt={alt}
        draggable={false}
        {...imgProps}
        className={clsx('max-h-full max-w-full object-contain select-none [-webkit-touch-callout:none]', !arrastando && 'transition-transform duration-150 ease-out', imgClassName)}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`, willChange: 'transform', ...imgProps?.style }}
        onLoad={(e) => {
          imgProps?.onLoad?.(e);
          setPos((p) => limitar(p, estado.current.escala));
        }}
      />

      {lupa && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 rounded-full shadow-2xl ring-2 ring-white/90"
          style={{
            width: LUPA_TAM,
            height: LUPA_TAM,
            left: lupa.x - LUPA_TAM / 2,
            top: lupa.y - LUPA_TAM / 2,
            backgroundColor: '#0f172a',
            backgroundImage: `url("${(lupaSrc ?? src).replace(/"/g, '%22')}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${lupa.bw}px ${lupa.bh}px`,
            backgroundPosition: `${lupa.bx}px ${lupa.by}px`,
          }}
        />
      )}

      <div
        className={clsx(
          'absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full p-1 shadow-lg backdrop-blur',
          tema === 'escuro' ? 'bg-black/55 text-white' : 'bg-white/90 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700',
        )}
        role="group"
        aria-label="Zoom da imagem"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={btn} onClick={() => zoomEm(escala / PASSO)} disabled={!comZoom} aria-label="Diminuir zoom (−)" title="Diminuir zoom (−)">
          <ZoomOut className="size-[18px]" />
        </button>
        <span className="min-w-12 text-center text-xs font-semibold tabular-nums" aria-live="polite">
          {Math.round(escala * 100)}%
        </span>
        <button type="button" className={btn} onClick={() => zoomEm(escala * PASSO)} disabled={escala >= MAX} aria-label="Aumentar zoom (+)" title="Aumentar zoom (+)">
          <ZoomIn className="size-[18px]" />
        </button>
        <button type="button" className={btn} onClick={() => zoomEm(1)} disabled={!comZoom} aria-label="Ajustar à tela (0)" title="Ajustar à tela (0)">
          <Maximize2 className="size-4" />
        </button>
        <button
          type="button"
          className={clsx(btn, 'hidden sm:grid', lupaLigada && (tema === 'escuro' ? 'bg-white/25' : 'bg-brand-100 text-brand-800 dark:bg-brand-500/30 dark:text-brand-100'))}
          onClick={() => {
            setLupaLigada((v) => !v);
            setLupa(null);
          }}
          aria-pressed={lupaLigada}
          aria-label="Lupa: passe o mouse sobre a imagem"
          title="Lupa: passe o mouse sobre a imagem"
        >
          <Search className="size-4" />
        </button>
      </div>
    </div>
  );
}
