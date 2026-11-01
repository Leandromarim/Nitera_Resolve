'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { clsx } from '@/components/ui';
import { ThemeMode, useTheme } from '@/lib/theme';

const OPCOES: [ThemeMode, string, typeof Sun][] = [
  ['light', 'Tema claro', Sun],
  ['dark', 'Tema escuro', Moon],
  ['auto', 'Automático (segue o sistema)', Monitor],
];

/** Claro, escuro ou automático, num controle só (substitui os botões de tema repetidos). */
export function ThemeSwitch({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'onDark' }) {
  const { mode, setMode } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className={clsx('inline-flex shrink-0 items-center gap-0.5 rounded-xl p-0.5 ring-1', tone === 'onDark' ? 'bg-white/10 ring-white/15' : 'bg-slate-900/[0.04] ring-slate-900/[0.06] dark:bg-white/[0.06] dark:ring-white/10', className)}>
      {OPCOES.map(([m, label, Icon]) => {
        const on = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => setMode(m)}
            className={clsx(
              'grid size-8 place-items-center rounded-[10px] transition-[background-color,color,box-shadow] duration-200',
              on
                ? tone === 'onDark'
                  ? 'bg-white text-brand-800 shadow-sm'
                  : 'bg-white text-brand-700 shadow-[var(--shadow-soft)] ring-1 ring-slate-900/[0.06] dark:bg-slate-700 dark:text-white dark:ring-white/10'
                : tone === 'onDark'
                  ? 'text-white/70 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
