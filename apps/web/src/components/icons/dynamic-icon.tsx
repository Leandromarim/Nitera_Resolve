'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import type { IconEntry } from './catalog';

/**
 * O catálogo de ícones (mais de 300) é baixado à parte, logo que a página abre, e fica no cache do navegador:
 * assim ele não pesa no carregamento inicial do portal. Enquanto chega, um espaço do mesmo tamanho segura o layout.
 */
let mapa: Record<string, IconEntry> | null = null;
let carregando: Promise<void> | null = null;
const carregar = () =>
  (carregando ??= import('./catalog').then((m) => {
    mapa = m.ICON_MAP;
  }));
if (typeof window !== 'undefined') void carregar();

const FALLBACK_ICON = 'link';
let hidratado = false;

/**
 * Desenha um ícone a partir do nome salvo (catálogo curado) ou a imagem própria enviada no painel.
 * Nome desconhecido cai no ícone padrão. Decorativo por padrão: o texto ao lado ou o aria-label do link descreve a ação.
 */
export function DynamicIcon({ name, image, className, label, style }: { name?: string | null; image?: string | null; className?: string; label?: string; style?: React.CSSProperties }) {
  // na hidratação o primeiro desenho precisa ser igual ao do servidor (sem o catálogo); depois disso, já desenha direto
  const [pronto, setPronto] = useState(() => hidratado && !!mapa);
  useEffect(() => {
    hidratado = true;
    if (mapa) setPronto(true);
    else void carregar().then(() => setPronto(true));
  }, []);
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={label ?? ''} aria-hidden={label ? undefined : true} className={clsx('object-contain', className)} style={style} draggable={false} decoding="async" />;
  }
  if (!pronto || !mapa) return <span aria-hidden className={clsx('inline-block', className)} style={style} />;
  const Icon = (mapa[name ?? ''] ?? mapa[FALLBACK_ICON]!).Icon;
  return <Icon className={className} style={style} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} />;
}
