'use client';

import { isValidElement } from 'react';
import { arquivoUrl } from '@/lib/tela-login';
import { useTextos } from '@/lib/textos-context';
import { DynamicIcon } from './dynamic-icon';

/**
 * Ícone que pode ser trocado em Painel › Ícones da intranet.
 * O filho é o ícone padrão; se houver troca salva para o `ponto`, desenha o ícone escolhido (ou a imagem enviada)
 * com as mesmas classes do padrão. Cada ponto usado aqui precisa estar em lib/icones.ts para aparecer no painel.
 */
export function Icone({ ponto, children }: { ponto: string; children: React.ReactElement }) {
  const troca = useTextos().icone(ponto);
  if (!troca) return children;
  const props = isValidElement<{ className?: string; style?: React.CSSProperties }>(children) ? children.props : {};
  return <DynamicIcon name={troca.icone} image={arquivoUrl(troca.imagemId)} className={props.className || 'size-5'} style={props.style} />;
}
