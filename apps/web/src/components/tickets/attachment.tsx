'use client';

import { FileText, ImagePlus, Loader2, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clsx, useToast } from '@/components/ui';
import { uploadFile, UploadedFile } from '@/lib/api';
import { fmtSize } from '@/lib/format';

export interface Attachment {
  file: File;
  preview: string | null;
  progress: number;
  uploaded: UploadedFile | null;
}

/** Envia o arquivo como privado e acompanha o progresso. */
export function useAttachment() {
  const [att, setAtt] = useState<Attachment | null>(null);
  const toast = useToast();
  const seq = useRef(0);

  useEffect(() => () => void (att?.preview && URL.revokeObjectURL(att.preview)), [att?.preview]);

  const pick = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast('O arquivo passa de 25 MB.', 'error');
    const id = ++seq.current;
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setAtt({ file, preview, progress: 0, uploaded: null });
    try {
      const up = await uploadFile(file, {}, (p) => id === seq.current && setAtt((a) => (a ? { ...a, progress: p } : a)));
      if (id === seq.current) setAtt((a) => (a ? { ...a, progress: 100, uploaded: up } : a));
    } catch (e: any) {
      if (id === seq.current) {
        setAtt(null);
        toast(e.message ?? 'Falha ao enviar o anexo', 'error');
      }
    }
  };
  const clear = () => {
    seq.current++;
    setAtt(null);
  };
  return { att, pick, clear, uploading: !!att && !att.uploaded, fileId: att?.uploaded?.id };
}

/** Área de arrastar e soltar com prévia (usada no formulário de abertura). */
export function AttachmentDrop({ state }: { state: ReturnType<typeof useAttachment> }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { att, pick, clear } = state;

  // colar um print direto (Ctrl+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])][0];
      if (f && f.type.startsWith('image/')) pick(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (att) return <AttachmentPreview att={att} onRemove={clear} />;
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), pick(e.dataTransfer.files[0]))}
        className={clsx(
          'flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center text-sm transition',
          drag ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-300 bg-slate-50 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800/40',
        )}
      >
        <ImagePlus className="size-8 text-slate-400" aria-hidden />
        <span className="text-slate-600 dark:text-slate-300">
          <b className="text-brand-600 dark:text-brand-300">Clique para anexar</b>, arraste o arquivo ou cole um print (Ctrl+V)
        </span>
        <span className="text-xs text-slate-500">Imagem, PDF ou documento · até 25 MB</span>
      </button>
      <input ref={input} type="file" hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.log,.zip" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
    </>
  );
}

export function AttachmentPreview({ att, onRemove, compact }: { att: Attachment; onRemove: () => void; compact?: boolean }) {
  const done = !!att.uploaded;
  return (
    <div className={clsx('relative flex items-center gap-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700', compact ? 'p-2' : 'p-3')}>
      {att.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={att.preview} alt="Prévia do anexo" className={clsx('shrink-0 rounded-lg object-cover', compact ? 'size-10' : 'size-20')} />
      ) : (
        <span className={clsx('grid shrink-0 place-items-center rounded-lg bg-white text-slate-500 dark:bg-slate-900', compact ? 'size-10' : 'size-14')}>
          <FileText className="size-6" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{att.file.name}</p>
        <p className="text-xs text-slate-500">
          {fmtSize(att.file.size)} · {done ? <span className="text-emerald-600 dark:text-emerald-400">enviado</span> : `enviando ${att.progress}%`}
        </p>
        {!done && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={att.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${att.progress}%` }} />
          </div>
        )}
      </div>
      {!done && <Loader2 className="size-4 animate-spin text-brand-500" aria-hidden />}
      <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Remover anexo">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Botão de clipe para a caixa de resposta. */
export function AttachButton({ onPick, disabled }: { onPick: (f: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
        aria-label="Anexar arquivo"
        title="Anexar arquivo"
      >
        <Paperclip className="size-5" />
      </button>
      <input ref={input} type="file" hidden onChange={(e) => (e.target.files?.[0] && onPick(e.target.files[0]), (e.target.value = ''))} />
    </>
  );
}
