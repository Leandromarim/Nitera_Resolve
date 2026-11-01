'use client';

import { Download, FileText, Lock } from 'lucide-react';
import { Fragment, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageViewer } from '@/components/comum/image-viewer';
import { Avatar, clsx } from '@/components/ui';
import { dayLabel, fmtDateTime, fmtTime, TICKET_CHANNEL } from '@/lib/format';
import { ChannelIcon, isImage } from './meta';
import { SECTOR_ROLE, SECTOR_SHORT, SECTORS } from './sectors';
import type { TicketChannel, TicketComment, TicketDetail } from './types';

interface Msg {
  id: string;
  author: string;
  fromStaff: boolean;
  /** selo da equipe de quem respondeu (TI, Manutenção, Comunicação…) */
  team?: string;
  body: string;
  internal: boolean;
  channel: TicketChannel;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
  opening?: boolean;
}

const STAFF_ROLES = ['ADMIN', ...SECTORS.map((s) => SECTOR_ROLE[s])];
const staffAuthor = (c: TicketComment) => !!c.author?.roles?.some((r) => STAFF_ROLES.includes(r as never));

/** Selo da equipe: o setor do chamado, se a pessoa o atende; senão, o primeiro setor dela. */
function teamOf(c: TicketComment, t: TicketDetail) {
  const roles = c.author?.roles ?? [];
  if (roles.includes(SECTOR_ROLE[t.sector])) return SECTOR_SHORT[t.sector];
  const other = SECTORS.find((s) => roles.includes(SECTOR_ROLE[s]));
  return other ? SECTOR_SHORT[other] : 'Equipe';
}

/** Linha do tempo estilo conversa: solicitante x equipe, notas internas em amarelo. */
export function Timeline({ t, viewerIsStaff }: { t: TicketDetail; viewerIsStaff: boolean }) {
  const requester = t.requester?.name ?? t.requesterName ?? 'Solicitante';
  const msgs: Msg[] = [
    { id: 'abertura', author: requester, fromStaff: false, body: t.description, internal: false, channel: t.channel, fileName: null, fileUrl: null, createdAt: t.createdAt, opening: true },
  ];
  for (const c of t.comments) {
    // o anexo da abertura vira parte da primeira mensagem
    if (c.body === 'Anexo enviado na abertura' && c.fileId && !msgs[0].fileUrl && +new Date(c.createdAt) - +new Date(t.createdAt) < 60_000) {
      msgs[0].fileName = c.fileName;
      msgs[0].fileUrl = c.fileUrl;
      continue;
    }
    const fromStaff = staffAuthor(c) && c.authorId !== t.requesterId;
    msgs.push({
      id: c.id,
      author: c.author?.name ?? c.authorName ?? (fromStaff ? 'Equipe de atendimento' : requester),
      fromStaff,
      team: fromStaff ? teamOf(c, t) : undefined,
      body: c.body,
      internal: c.internal,
      channel: c.channel,
      fileName: c.fileName,
      fileUrl: c.fileUrl,
      createdAt: c.createdAt,
    });
  }

  let lastDay = '';
  return (
    <ol className="space-y-4" aria-label="Conversa do chamado">
      {msgs.map((m) => {
        const day = new Date(m.createdAt).toDateString();
        const sep = day !== lastDay;
        lastDay = day;
        const mine = viewerIsStaff ? m.fromStaff : !m.fromStaff;
        return (
          <Fragment key={m.id}>
            {sep && (
              <li className="flex items-center gap-3 py-1 text-xs font-medium text-slate-400" aria-hidden>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="first-letter:uppercase">{dayLabel(m.createdAt)}</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </li>
            )}
            <li className={clsx('flex gap-3', mine && 'flex-row-reverse')}>
              <Avatar name={m.author} size={36} />
              <div className={clsx('flex max-w-[85%] min-w-0 flex-col sm:max-w-[75%]', mine ? 'items-end' : 'items-start')}>
                <div className={clsx('mb-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500', mine && 'flex-row-reverse')}>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{m.author}</span>
                  {m.fromStaff ? (
                    <span className="rounded bg-brand-100 px-1.5 py-px text-[10px] font-semibold text-brand-800 uppercase dark:bg-brand-900/60 dark:text-brand-200">{m.team ?? 'Equipe'}</span>
                  ) : (
                    <span className="rounded bg-slate-200 px-1.5 py-px text-[10px] font-semibold text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">Solicitante</span>
                  )}
                  {m.channel !== 'PORTAL' && <ChannelIcon channel={m.channel} withLabel />}
                  <time dateTime={m.createdAt} title={fmtDateTime(m.createdAt)}>
                    {fmtTime(m.createdAt)}
                  </time>
                </div>
                <div
                  className={clsx(
                    'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                    m.internal
                      ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-300 dark:bg-amber-900/25 dark:text-amber-50 dark:ring-amber-700'
                      : mine
                        ? 'rounded-tr-md bg-brand-700 text-white dark:bg-brand-600'
                        : 'rounded-tl-md bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800',
                  )}
                >
                  {m.internal && (
                    <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                      <Lock className="size-3" aria-hidden /> Nota interna · só a equipe vê
                    </p>
                  )}
                  {m.opening && <p className={clsx('mb-1 text-[11px] font-semibold tracking-wide uppercase', mine ? 'text-white/70' : 'text-slate-400')}>Abertura · via {TICKET_CHANNEL[m.channel]}</p>}
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                  {m.fileUrl && <AttachmentLink name={m.fileName} url={m.fileUrl} onDark={mine && !m.internal} />}
                </div>
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

export function AttachmentLink({ name, url, onDark }: { name: string | null; url: string; onDark: boolean }) {
  const [aberta, setAberta] = useState(false);
  if (isImage(name)) {
    return (
      <>
        <button type="button" onClick={() => setAberta(true)} className="mt-2 block w-full cursor-zoom-in overflow-hidden rounded-xl ring-1 ring-black/10" title={`Ampliar ${name ?? 'imagem'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name ?? 'Anexo'} className="max-h-64 w-full object-cover" loading="lazy" />
        </button>
        {aberta && createPortal(<ImageViewer src={url} downloadUrl={url} title={name} onClose={() => setAberta(false)} />, document.body)}
      </>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition',
        onDark ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
      )}
    >
      <FileText className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{name ?? 'Anexo'}</span>
      <Download className="ml-auto size-3.5 shrink-0" aria-hidden />
    </a>
  );
}
