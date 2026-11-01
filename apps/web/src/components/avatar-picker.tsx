'use client';

import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadFile } from '@/lib/api';
import { Avatar, Button, useToast } from '@/components/ui';

/** Foto do usuário: mostra a atual e permite enviar outra (JPG, PNG ou WebP) ou remover. */
export function AvatarPicker({ name, value, onChange, size = 72 }: { name: string; value: string | null; onChange: (url: string | null) => void | Promise<void>; size?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const toast = useToast();

  const send = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Escolha uma imagem (JPG, PNG ou WebP).', 'error');
    setProgress(0);
    try {
      const f = await uploadFile(file, { avatar: true }, setProgress);
      await onChange(f.url);
    } catch (e: any) {
      toast(e.message ?? 'Não foi possível enviar a foto.', 'error');
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} className="group relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" aria-label={value ? 'Trocar foto' : 'Enviar foto'}>
        <Avatar name={name} src={value} size={size} />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-slate-950/50 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {progress !== null ? <span className="text-xs font-semibold">{progress}%</span> : <Camera className="size-5" />}
        </span>
      </button>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()} loading={progress !== null}>
          <Camera className="size-4" /> {value ? 'Trocar foto' : 'Enviar foto'}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={progress !== null}>
            <Trash2 className="size-4" /> Remover
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => send(e.target.files?.[0])} />
    </div>
  );
}
