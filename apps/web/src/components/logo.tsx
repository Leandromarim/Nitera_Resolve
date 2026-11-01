'use client';

import clsx from 'clsx';
import { useBranding } from '@/lib/branding';

const SIZE = 'h-8 max-w-[11rem] sm:h-10 sm:max-w-[15rem]';

/**
 * Logo do hospital, trocável em Painel › Configurações › Aparência.
 * `light` = sobre fundo escuro (versão com letras brancas); `compact` = só o símbolo (ícone da aba).
 */
export function Logo({ className, light = true, compact = false }: { className?: string; light?: boolean; compact?: boolean }) {
  const { branding } = useBranding();
  /* eslint-disable @next/next/no-img-element */
  if (compact)
    return (
      <span className={clsx('grid size-10 shrink-0 place-items-center rounded-xl bg-white p-1 shadow-sm', className)}>
        <img src={branding.faviconUrl} alt={branding.siteName} className="size-full object-contain" />
      </span>
    );
  if (light) return <img src={branding.logoUrl} alt={branding.siteName} className={clsx('w-auto shrink-0 object-contain', SIZE, className)} />;
  // fundo claro: no tema escuro a tela fica escura, então troca pela versão de letras brancas
  return (
    <span className={clsx('inline-flex', className)}>
      <img src={branding.logoLightUrl} alt={branding.siteName} className={clsx('w-auto shrink-0 object-contain dark:hidden', SIZE)} />
      <img src={branding.logoUrl} alt="" aria-hidden className={clsx('hidden w-auto shrink-0 object-contain dark:block', SIZE)} />
    </span>
  );
}
