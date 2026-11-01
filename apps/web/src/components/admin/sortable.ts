'use client';

import { useRef, useState } from 'react';

/**
 * Reordenação por arrastar-e-soltar (HTML5) com atualização ao vivo da lista.
 * `setItems` atualiza o estado local durante o arraste; `commit` salva a nova ordem ao soltar.
 * Use `move(id, ±1)` para os botões de mover (teclado/celular).
 */
export function useSortable<T extends { id: string }>(items: T[], setItems: (t: T[]) => void, commit: (t: T[]) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const startOrder = useRef<string>('');
  const latest = useRef<T[]>(items);
  latest.current = items;

  const reorder = (from: number, to: number) => {
    const next = [...latest.current];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    return next;
  };

  const itemProps = (id: string) => ({
    draggable: true,
    'data-dragging': dragId === id || undefined,
    onDragStart: (e: React.DragEvent) => {
      setDragId(id);
      startOrder.current = latest.current.map((i) => i.id).join();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragId === id) return;
      const from = latest.current.findIndex((i) => i.id === dragId);
      const to = latest.current.findIndex((i) => i.id === id);
      if (from < 0 || to < 0) return;
      const next = reorder(from, to);
      latest.current = next;
      setItems(next);
    },
    onDrop: (e: React.DragEvent) => e.preventDefault(),
    onDragEnd: () => {
      setDragId(null);
      if (latest.current.map((i) => i.id).join() !== startOrder.current) commit(latest.current);
    },
  });

  const move = (id: string, delta: number) => {
    const from = latest.current.findIndex((i) => i.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= latest.current.length) return;
    const next = reorder(from, to);
    setItems(next);
    commit(next);
  };

  return { itemProps, move, dragId };
}
