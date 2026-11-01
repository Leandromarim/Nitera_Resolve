'use client';

import clsx from 'clsx';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Info, Loader2, X, Upload, ImageIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initials } from '@/lib/format';
import { uploadFile, UploadedFile } from '@/lib/api';
import { foto } from '@/lib/foto';
import { jaMostradoNoPopup } from '@/lib/erros-campos';

export { clsx };

// ───────── Botões e campos ─────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'coral' | 'success';
// Botões sólidos têm um leve degradê de cima para baixo e um brilho interno de 1px (profundidade sem peso).
const SOLIDO = 'shadow-[var(--shadow-soft)] ring-1 ring-inset ring-white/15 hover:shadow-[var(--shadow-lift)] hover:-translate-y-px active:translate-y-0';
const VARIANTS: Record<Variant, string> = {
  primary: `bg-linear-to-b from-brand-600 to-brand-700 text-white hover:from-brand-600 hover:to-brand-800 dark:from-brand-400 dark:to-brand-500 ${SOLIDO}`,
  secondary: 'bg-white text-slate-700 shadow-[var(--shadow-soft)] ring-1 ring-slate-900/10 hover:bg-slate-50 hover:ring-slate-900/20 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-slate-700/80 dark:hover:ring-white/20',
  ghost: 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
  danger: `bg-linear-to-b from-rose-500 to-rose-600 text-white hover:to-rose-700 ${SOLIDO}`,
  coral: `bg-linear-to-b from-coral-400 to-coral-500 text-white hover:to-coral-600 ${SOLIDO}`,
  success: `bg-linear-to-b from-emerald-500 to-emerald-600 text-white hover:to-emerald-700 ${SOLIDO}`,
};

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' | 'lg' }>(
  function Button({ variant = 'primary', loading, size = 'md', className, children, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[transform,box-shadow,background-color,color,opacity] duration-200 ease-out select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60',
          size === 'sm' && 'h-8 px-3 text-sm',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-12 px-6 text-base',
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

// foco com anel da marca e um halo suave (o contorno padrão do navegador some só aqui, porque o anel o substitui)
const fieldCls =
  'campo rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-[var(--shadow-soft)] ring-1 ring-slate-900/12 transition-[box-shadow,background-color] duration-200 placeholder:text-slate-400 hover:ring-slate-900/25 focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-500)_18%,transparent)] focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-60 aria-[invalid=true]:ring-rose-500 dark:bg-slate-900/80 dark:text-slate-100 dark:ring-white/12 dark:hover:ring-white/25';

export function Field({ label, hint, error, children, className, required }: { label?: string; hint?: string; error?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={clsx('block space-y-1.5', className)}>
      {label && (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && (
            <span className="ml-0.5 text-rose-600 dark:text-rose-400" title="Preenchimento obrigatório" aria-label="obrigatório">
              *
            </span>
          )}
        </span>
      )}
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={clsx(fieldCls, className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={clsx(fieldCls, 'min-h-24', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={clsx(fieldCls, 'pr-8', className)} {...p} />;
});

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm">
      <span className={clsx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700')}>
        <span className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
      </span>
      {label && <span className="text-slate-700 dark:text-slate-300">{label}</span>}
    </button>
  );
}

// ───────── Superfícies ─────────

/** Superfície padrão. `interactive` levanta o cartão no hover (para cartões clicáveis). */
export function Card({ className, children, interactive, ...p }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-900/[0.06] dark:bg-slate-900 dark:ring-white/[0.07]',
        interactive && 'transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]',
        className,
      )}
      {...p}
    >
      {children}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('size-5 animate-spin text-brand-500', className)} />;
}

/** Bloco de esqueleto com brilho. Use no formato do conteúdo que vai chegar, para a tela não "pular". */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('skeleton', className)} />;
}

/** Carregando: esqueleto de lista no lugar do ícone girando (o texto fica para leitores de tela). */
export function Loading({ label = 'Carregando…', linhas = 4 }: { label?: string; linhas?: number }) {
  return (
    <div role="status" className="space-y-4 px-1 py-6">
      <span className="sr-only">{label}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ opacity: 1 - i * 0.18 }}>
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className={clsx('h-3.5', ['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3'][i % 4])} />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex animate-enter flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-linear-to-br from-brand-50 to-brand-100 text-brand-600 ring-1 ring-brand-200/60 dark:from-brand-900/50 dark:to-brand-950/60 dark:text-brand-300 dark:ring-brand-700/40">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, icon }: { title: string; description?: string; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    // o título reserva 18rem: se os botões não couberem ao lado, descem para a linha de baixo em vez de espremer o título
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex min-w-0 animate-enter sm:flex-[1_1_18rem] items-center gap-3.5">
        {icon && <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-800 text-white shadow-[var(--shadow-lift)] ring-1 ring-inset ring-white/15 dark:from-brand-400 dark:to-brand-600">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const AVATAR_COLORS = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-teal-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500'];
export function Avatar({ name, src, size = 40, online }: { name?: string | null; src?: string | null; size?: number; online?: boolean }) {
  const color = AVATAR_COLORS[[...(name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto(src, 320)} alt="" loading="lazy" decoding="async" className="size-full rounded-full object-cover object-top" />
      ) : (
        <span className={clsx('grid size-full place-items-center rounded-full font-semibold text-white', color)} style={{ fontSize: size * 0.38 }}>
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span className={clsx('absolute right-0 bottom-0 rounded-full ring-2 ring-white dark:ring-slate-900', online ? 'bg-chat-green' : 'bg-slate-400')} style={{ width: size * 0.28, height: size * 0.28 }} />
      )}
    </span>
  );
}

// ───────── Modal ─────────

// janelas abertas, da mais antiga para a mais nova: o Esc fecha só a de cima (uma janela pode abrir outra)
const janelasAbertas: object[] = [];

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const eu = {};
    janelasAbertas.push(eu);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && janelasAbertas.at(-1) === eu && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      janelasAbertas.splice(janelasAbertas.indexOf(eu), 1);
      if (!janelasAbertas.length) document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  // fora da árvore da página: uma janela aberta de dentro de outra fica por cima dela, e não presa dentro
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-md animate-fade-in sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-[var(--shadow-pop)] ring-1 ring-slate-900/5 animate-sheet-in sm:animate-pop-in sm:rounded-3xl dark:bg-slate-900 dark:ring-white/10',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
          size === 'xl' && 'sm:max-w-5xl',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] px-6 py-4 dark:border-white/[0.07]">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:rotate-90 hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-900/[0.06] bg-slate-50/60 px-6 py-4 sm:rounded-b-3xl dark:border-white/[0.07] dark:bg-white/[0.02]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback((message: string) => new Promise<boolean>((resolve) => setState({ message, resolve })), []);
  const dialog = (
    <Modal
      open={!!state}
      size="sm"
      title="Confirmar"
      onClose={() => {
        state?.resolve(false);
        setState(null);
      }}
      footer={
        <>
          <Button variant="secondary" onClick={() => (state?.resolve(false), setState(null))}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => (state?.resolve(true), setState(null))}>
            Confirmar
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{state?.message}</p>
    </Modal>
  );
  return { confirm, dialog };
}

// ───────── Toasts ─────────

type ToastKind = 'success' | 'error' | 'info';
type ToastOpts = { action?: { label: string; onClick: () => void }; duration?: number };
type Toast = { id: number; message: string; kind: ToastKind; opts?: ToastOpts };
const ToastCtx = createContext<(message: string, kind?: ToastKind, opts?: ToastOpts) => void>(() => {});
const TOAST_ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TOAST_TONE = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-rose-600 dark:text-rose-400',
  info: 'text-brand-600 dark:text-brand-300',
};
const TOAST_BAR = { success: 'bg-emerald-500', error: 'bg-rose-500', info: 'bg-brand-500' };

/** Avisos no canto da tela: ícone, texto, botão de ação opcional (ex.: "Desfazer") e barra do tempo restante. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fechar = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, kind: ToastKind = 'success', opts?: ToastOpts) => {
      // o pop-up de campos já mostrou este erro, com o campo exato: não repete aqui
      if (kind === 'error' && jaMostradoNoPopup(message)) return;
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, message, kind, opts }]);
      setTimeout(() => fechar(id), opts?.duration ?? (kind === 'error' ? 7000 : opts?.action ? 6500 : 4500));
    },
    [fechar],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.kind];
          const dur = t.opts?.duration ?? (t.kind === 'error' ? 7000 : t.opts?.action ? 6500 : 4500);
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto relative flex w-full animate-toast-in items-start gap-3 overflow-hidden rounded-2xl bg-white/95 py-3 pr-2 pl-4 text-sm shadow-[var(--shadow-pop)] ring-1 ring-slate-900/[0.08] backdrop-blur-xl sm:w-96 dark:bg-slate-900/95 dark:ring-white/10"
            >
              <Icon className={clsx('mt-0.5 size-5 shrink-0', TOAST_TONE[t.kind])} aria-hidden />
              <p className="min-w-0 flex-1 py-0.5 font-medium text-slate-800 dark:text-slate-100">{t.message}</p>
              {t.opts?.action && (
                <button
                  type="button"
                  onClick={() => (t.opts!.action!.onClick(), fechar(t.id))}
                  className="shrink-0 rounded-lg px-2.5 py-1 font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/10"
                >
                  {t.opts.action.label}
                </button>
              )}
              <button type="button" onClick={() => fechar(t.id)} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Fechar aviso">
                <X className="size-4" />
              </button>
              <span aria-hidden className={clsx('absolute bottom-0 left-0 h-0.5 origin-left', TOAST_BAR[t.kind])} style={{ width: '100%', animation: `toast-tempo ${dur}ms linear forwards` }} />
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ───────── Upload ─────────

/** Seletor de imagem com prévia, arrastar-e-soltar e barra de progresso. Envia como arquivo público (portal). */
export function ImageUpload({ value, onChange, aspect = 'aspect-video', label = 'Imagem' }: { value?: string | null; onChange: (f: UploadedFile | null) => void; aspect?: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const toast = useToast();
  const send = async (file?: File) => {
    if (!file) return;
    setProgress(0);
    try {
      onChange(await uploadFile(file, { public: true, images: true }, setProgress));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setProgress(null);
    }
  };
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), send(e.dataTransfer.files[0]))}
        onClick={() => input.current?.click()}
        className={clsx(
          'group relative grid cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition',
          aspect,
          drag ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-300 bg-slate-50 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800/50',
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto(value, 640)} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-slate-500">
            <ImageIcon className="size-8 text-slate-400" />
            <span>
              <b className="text-brand-600">Clique para enviar</b> ou arraste a imagem
            </span>
            <span className="text-xs">JPG, PNG, WEBP ou GIF</span>
          </div>
        )}
        {value && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/50 opacity-0 transition group-hover:opacity-100">
            <span className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-800">
              <Upload className="size-4" /> Trocar imagem
            </span>
          </div>
        )}
        {progress !== null && (
          <div className="absolute inset-x-4 bottom-4 h-2 overflow-hidden rounded-full bg-white/70">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => (send(e.target.files?.[0]), (e.target.value = ''))} />
      {value && (
        <button type="button" className="text-xs text-rose-600 hover:underline" onClick={() => onChange(null)}>
          Remover imagem
        </button>
      )}
    </div>
  );
}

/** Seletor de arquivo genérico (PDF, planilhas, documentos). */
export function FileUpload({ onUploaded, publicFile = true, children, accept }: { onUploaded: (f: UploadedFile) => void; publicFile?: boolean; children?: React.ReactNode; accept?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const toast = useToast();
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => input.current?.click()} loading={progress !== null}>
        <Upload className="size-4" /> {progress !== null ? `${progress}%` : children ?? 'Enviar arquivo'}
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setProgress(0);
          try {
            onUploaded(await uploadFile(f, { public: publicFile }, setProgress));
          } catch (err: any) {
            toast(err.message, 'error');
          } finally {
            setProgress(null);
          }
        }}
      />
    </>
  );
}

// ───────── Tabela ─────────

/** Cabeçalho de coluna que ordena: clique alterna crescente e decrescente; aria-sort informa o leitor de tela. */
export function SortHead({ label, dir, onClick }: { label: string; dir: 'asc' | 'desc' | null; onClick: () => void }) {
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <button type="button" onClick={onClick} data-nome={label} className={clsx('group/sort -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 uppercase transition hover:bg-slate-900/5 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-white', dir && 'text-slate-800 dark:text-white')} aria-label={`Ordenar por ${label}${dir === 'asc' ? ', crescente' : dir === 'desc' ? ', decrescente' : ''}`}>
      {label}
      <Icon className={clsx('size-3.5 transition', !dir && 'opacity-0 group-hover/sort:opacity-60')} aria-hidden />
    </button>
  );
}

/** Ordenação de lista em memória: estado da coluna e direção, e a função que ordena. */
export function useSort<K extends string>(inicial: K | null = null, dirInicial: 'asc' | 'desc' = 'asc') {
  const [sort, setSort] = useState<{ key: K | null; dir: 'asc' | 'desc' }>({ key: inicial, dir: dirInicial });
  const toggle = useCallback((key: K) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })), []);
  const dirOf = (key: K) => (sort.key === key ? sort.dir : null);
  const apply = useCallback(
    <T,>(list: T[], get: Record<K, (x: T) => string | number | null | undefined>) => {
      if (!sort.key) return list;
      const g = get[sort.key];
      const m = sort.dir === 'asc' ? 1 : -1;
      return [...list].sort((a, b) => {
        const va = g(a);
        const vb = g(b);
        if (va == null || va === '') return 1; // vazios sempre no fim
        if (vb == null || vb === '') return -1;
        return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base', numeric: true })) * m;
      });
    },
    [sort],
  );
  return { sort, toggle, dirOf, apply };
}

/** Tabela padrão. Não rola para o lado: TabelasSemRolagem (em Providers) a transforma em cartões quando não cabe. */
export function Table({ head, children, className }: { head: React.ReactNode[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('min-w-0', className)}>
      <table className="tabela-resp w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase dark:border-slate-800">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

/** Mini gráfico de linha (sem biblioteca), para tendência ao lado de um número. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = useId();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 28 - ((v - min) / (max - min || 1)) * 24 - 2] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={clsx('h-8 w-24 overflow-visible', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,30 L0,30 Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Indicador: rótulo, número, variação (com seta e cor) e tendência opcional.
 * `delta` em % ou pontos (`deltaUnit`); `melhorQuando` diz se subir é bom ou ruim (ex.: atrasos).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  delta,
  deltaUnit = '%',
  melhorQuando = 'sobe',
  trend,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'brand' | 'coral' | 'emerald' | 'amber' | 'rose' | 'violet';
  delta?: number | null;
  deltaUnit?: string;
  melhorQuando?: 'sobe' | 'desce';
  trend?: number[];
  onClick?: () => void;
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-200/60 dark:bg-brand-900/40 dark:text-brand-300 dark:ring-brand-700/40',
    coral: 'bg-orange-50 text-coral-600 ring-orange-200/60 dark:bg-orange-900/30 dark:text-coral-400 dark:ring-orange-700/30',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700/30',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700/30',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200/60 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-700/30',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200/60 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-700/30',
  };
  const trendTone = { brand: 'text-brand-500', coral: 'text-coral-500', emerald: 'text-emerald-500', amber: 'text-amber-500', rose: 'text-rose-500', violet: 'text-violet-500' };
  const bom = delta == null || delta === 0 ? null : (delta > 0) === (melhorQuando === 'sobe');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Card data-spotlight interactive={!!onClick} className="overflow-hidden">
      <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="flex w-full flex-col items-start gap-2.5 p-4 text-left min-[480px]:flex-row min-[480px]:gap-4 sm:p-5">
        {icon && <div className={clsx('grid size-9 shrink-0 place-items-center rounded-xl ring-1 sm:size-11', tones[tone])}>{icon}</div>}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-slate-500 dark:text-slate-400">{label}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</p>
            {delta != null && (
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                  bom === null ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' : bom ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                )}
              >
                {delta > 0 ? <TrendingUp className="size-3" aria-hidden /> : delta < 0 ? <TrendingDown className="size-3" aria-hidden /> : null}
                {delta > 0 ? '+' : ''}
                {Number.isInteger(delta) ? delta : delta.toFixed(1).replace('.', ',')}
                {deltaUnit}
              </span>
            )}
          </div>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
        {trend && trend.length > 1 && <Sparkline values={trend} className={clsx('mt-1 shrink-0', trendTone[tone])} />}
      </Tag>
    </Card>
  );
}

// ───────── Abas e dicas ─────────

export type TabItem<K extends string> = { key: K; label: string; icon?: React.ReactNode; count?: number };

/**
 * Abas com indicador que desliza até a aba escolhida. Setas ← → mudam de aba (padrão WAI-ARIA).
 * Quebram linha quando não cabem; nunca rolam para o lado.
 */
export function Tabs<K extends string>({ items, value, onChange, label, className }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; label: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !box.current) return;
    const medir = () => setPos({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [value, items.length]);
  const teclas = (e: React.KeyboardEvent) => {
    const i = items.findIndex((t) => t.key === value);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const k = items[(n + items.length) % items.length]!.key;
    onChange(k);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-tab="${k}"]`)?.focus());
  };
  return (
    <div ref={box} role="tablist" aria-label={label} onKeyDown={teclas} className={clsx('relative flex w-fit max-w-full flex-wrap gap-1 rounded-2xl bg-slate-900/[0.04] p-1 ring-1 ring-slate-900/[0.04] dark:bg-white/[0.05] dark:ring-white/[0.06]', className)}>
      {pos && (
        <span
          aria-hidden
          className="absolute rounded-xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-900/[0.06] transition-all duration-300 ease-[var(--ease-out-expo)] dark:bg-slate-700/80 dark:ring-white/10"
          style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
        />
      )}
      {items.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            data-tab={t.key}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={clsx('relative z-[1] inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors', on ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}
          >
            {t.icon}
            {t.label}
            {t.count != null && <span className={clsx('rounded-full px-1.5 text-xs tabular-nums', on ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/30 dark:text-brand-100' : 'bg-slate-900/[0.06] dark:bg-white/10')}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Dica ao passar o mouse ou focar com o teclado (substitui o title= nativo, que demora e não aparece no foco). */
export function Tip({ label, children, side = 'top', className }: { label: string; children: React.ReactNode; side?: 'top' | 'bottom'; className?: string }) {
  const id = useId();
  return (
    <span className={clsx('group/tip relative inline-flex', className)} aria-describedby={id}>
      {children}
      <span
        role="tooltip"
        id={id}
        className={clsx(
          'pointer-events-none absolute left-1/2 z-40 w-max max-w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-[var(--shadow-lift)] transition duration-150 group-focus-within/tip:opacity-100 group-hover/tip:opacity-100 group-hover/tip:delay-300 dark:bg-slate-100 dark:text-slate-900',
          side === 'top' ? 'bottom-full mb-2 translate-y-1 group-focus-within/tip:translate-y-0 group-hover/tip:translate-y-0' : 'top-full mt-2 -translate-y-1 group-focus-within/tip:translate-y-0 group-hover/tip:translate-y-0',
        )}
      >
        {label}
      </span>
    </span>
  );
}
