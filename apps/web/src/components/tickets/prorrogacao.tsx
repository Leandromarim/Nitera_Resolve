'use client';

import { CalendarClock, FileText, ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Card, clsx, Field, Modal, Switch, Textarea, useToast } from '@/components/ui';
import { api, uploadFile } from '@/lib/api';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { isImage } from './meta';
import { AttachmentLink } from './timeline';
import type { Ticket, TicketDetail } from './types';
import { isOpen } from './types';

/** Mesmos limites da API: até 1 semana por vez e 30 dias somados. */
const OPCOES = [4, 8, 24, 48, 72, 120, 168];
const MAX_TOTAL = 720;
const MAX_ARQUIVOS = 10;

export function fmtHoras(h: number) {
  if (h < 24) return `${h} h`;
  if (h === 168) return '1 semana';
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d} d ${r} h` : `${d} dia${d > 1 ? 's' : ''}`;
}

interface Evidencia {
  key: number;
  file: File;
  preview: string | null;
  id: string | null;
}

/** Prazo do chamado com o botão "Aumentar prazo" e o histórico das prorrogações (justificativa e evidências). */
export function PrazoCard({ t, podeAumentar, onChange }: { t: TicketDetail; podeAumentar: boolean; onChange: (u: Partial<Ticket>) => void }) {
  const [aberto, setAberto] = useState(false);
  const lista = t.prorrogacoes ?? [];
  const usado = t.prorrogadoHoras ?? 0;
  if (!t.dueAt && !lista.length) return null;
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <CalendarClock className="size-3.5" aria-hidden /> Prazo
      </h2>
      {t.dueAt && (
        <p className="text-sm">
          <span className="text-slate-500">Prazo atual:</span> <b>{fmtDateTime(t.dueAt)}</b>
          {usado > 0 && <span className="block text-xs text-slate-500">Inclui {fmtHoras(usado)} de prorrogação.</span>}
        </p>
      )}
      {podeAumentar && isOpen(t.status) && t.dueAt && usado < MAX_TOTAL && (
        <Button variant="secondary" size="sm" className="no-print mt-3 w-full" onClick={() => setAberto(true)}>
          <CalendarClock className="size-4" /> Aumentar prazo
        </Button>
      )}
      {lista.length > 0 && (
        <ol className="mt-4 space-y-3">
          {lista.map((p) => (
            <li key={p.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
              <p className="font-medium">
                +{fmtHoras(p.horas)} <span className="font-normal text-slate-500">até {fmtDateTime(p.prazoNovo)}</span>
              </p>
              <p className="mt-1 break-words whitespace-pre-wrap text-slate-700 dark:text-slate-200">{p.justificativa}</p>
              {p.arquivos.length > 0 && (
                <div className={clsx('mt-1 grid gap-1', p.arquivos.some((a) => isImage(a.name)) && 'grid-cols-2')}>
                  {p.arquivos.map((a) => (
                    <AttachmentLink key={a.id} name={a.name} url={a.url} onDark={false} />
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-xs text-slate-400">
                {p.authorName} · <time title={fmtDateTime(p.createdAt)}>{fmtRelative(p.createdAt)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
      {aberto && (
        <ProrrogarModal
          t={t}
          restante={MAX_TOTAL - usado}
          onClose={() => setAberto(false)}
          onDone={(u) => {
            setAberto(false);
            onChange(u);
          }}
        />
      )}
    </Card>
  );
}

function ProrrogarModal({ t, restante, onClose, onDone }: { t: TicketDetail; restante: number; onClose: () => void; onDone: (u: Partial<Ticket>) => void }) {
  const toast = useToast();
  const opcoes = OPCOES.filter((h) => h <= restante);
  const [horas, setHoras] = useState(opcoes.includes(24) ? 24 : opcoes.at(-1) ?? 0);
  const [justificativa, setJustificativa] = useState('');
  const [avisar, setAvisar] = useState(true);
  const [evid, setEvid] = useState<Evidencia[]>([]);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const novo = new Date(new Date(t.dueAt!).getTime() + horas * 3_600_000);
  const erroJust = tried && justificativa.trim().length < 10 ? 'Explique o motivo (mínimo 10 caracteres).' : undefined;
  const enviando = evid.some((e) => !e.id);

  const adicionar = (files: FileList | null) => {
    const novos = [...(files ?? [])].slice(0, MAX_ARQUIVOS - evid.length);
    if ((files?.length ?? 0) > novos.length) toast(`Até ${MAX_ARQUIVOS} evidências.`, 'info');
    for (const file of novos) {
      if (file.size > 25 * 1024 * 1024) {
        toast(`${file.name} passa de 25 MB.`, 'error');
        continue;
      }
      const key = ++seq.current;
      setEvid((l) => [...l, { key, file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, id: null }]);
      uploadFile(file, {})
        .then((up) => setEvid((l) => l.map((e) => (e.key === key ? { ...e, id: up.id } : e))))
        .catch((e) => {
          setEvid((l) => l.filter((x) => x.key !== key));
          toast(e.message ?? 'Falha ao enviar o arquivo', 'error');
        });
    }
  };
  const remover = (key: number) =>
    setEvid((l) => {
      const e = l.find((x) => x.key === key);
      if (e?.preview) URL.revokeObjectURL(e.preview);
      return l.filter((x) => x.key !== key);
    });

  const salvar = async () => {
    if (justificativa.trim().length < 10) return setTried(true);
    if (enviando) return toast('Aguarde o envio das evidências.', 'info');
    setSaving(true);
    try {
      const u = await api<Ticket>(`/tickets/${t.id}/prorrogar`, { method: 'POST', json: { horas, justificativa: justificativa.trim(), fileIds: evid.map((e) => e.id), avisar } });
      toast(`Prazo aumentado para ${fmtDateTime(u.dueAt!)}`);
      onDone(u);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Aumentar o prazo do chamado #${t.number}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={!horas}>
            Aumentar prazo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Quanto tempo a mais?</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tempo a mais">
            {opcoes.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={horas === h}
                onClick={() => setHoras(h)}
                className={clsx('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition', horas === h ? 'bg-brand-700 text-white ring-brand-700' : 'ring-slate-300 hover:bg-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800')}
              >
                +{fmtHoras(h)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            De {fmtDateTime(t.dueAt!)} para <b className="text-slate-800 dark:text-slate-100">{fmtDateTime(novo.toISOString())}</b>
            {novo.getTime() < Date.now() && <span className="block text-amber-700 dark:text-amber-300">O novo prazo ainda fica no passado: o chamado continua atrasado.</span>}
          </p>
        </div>
        <Field label="Justificativa" required error={erroJust} hint="Fica no histórico do chamado, visível só para a equipe.">
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ex.: aguardando a peça do fornecedor, prevista para chegar na sexta"
            className={clsx(erroJust && 'ring-2! ring-rose-500!')}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Evidências (opcional)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {evid.map((e) => (
              <div key={e.key} className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                {e.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.preview} alt={e.file.name} className="size-full object-cover" />
                ) : (
                  <span className="flex min-w-0 flex-col items-center gap-1 px-2 text-center text-xs text-slate-600 dark:text-slate-300">
                    <FileText className="size-6 shrink-0" aria-hidden />
                    <span className="line-clamp-2 break-all">{e.file.name}</span>
                  </span>
                )}
                {!e.id && (
                  <span className="absolute inset-0 grid place-items-center bg-white/60 dark:bg-slate-900/60">
                    <Loader2 className="size-5 animate-spin" aria-label="Enviando" />
                  </span>
                )}
                <button type="button" onClick={() => remover(e.key)} className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900" aria-label={`Remover ${e.file.name}`}>
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {evid.length < MAX_ARQUIVOS && (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 px-2 text-center text-xs text-slate-500 hover:border-brand-400 dark:border-slate-700"
              >
                <ImagePlus className="size-6" aria-hidden />
                Fotos ou documentos
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt"
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = '';
            }}
          />
          <p className="mt-1 text-xs text-slate-500">Até {MAX_ARQUIVOS} arquivos de 25 MB. Ex.: foto do equipamento, orçamento ou e-mail do fornecedor.</p>
        </div>
        <Switch checked={avisar} onChange={setAvisar} label="Avisar o solicitante do novo prazo (sem a justificativa)" />
      </div>
    </Modal>
  );
}
