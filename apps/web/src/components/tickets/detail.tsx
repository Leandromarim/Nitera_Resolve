'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Hand,
  History,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  RefreshCw,
  Send,
  Star,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Avatar, Badge, Button, Card, clsx, EmptyState, Field, Loading, Select, Textarea, useConfirm, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, fmtRelative, TICKET_CHANNEL, TICKET_PRIORITY, TICKET_STATUS } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { AttachButton, AttachmentPreview, useAttachment } from './attachment';
import { CategoryIcon, ChannelIcon, PriorityBadge, SlaIndicator, StatusBadge, statusLabel, useNow } from './meta';
import { SECTOR_LABEL, SECTOR_SHORT, SECTOR_TEAM, SECTORS, SectorBadge, useStaffSectors } from './sectors';
import { Timeline } from './timeline';
import { fmtHoras, PrazoCard } from './prorrogacao';
import type { Department, Technician, Ticket, TicketCategory, TicketDetail, TicketSector, TicketStatus } from './types';
import { isOpen, localSemRamal, ramalDo } from './types';
import { usePoll } from './use-poll';
import { linkWhatsapp } from '@/lib/whatsapp';

export function TicketDetailView({ id }: { id: string }) {
  const { user } = useAuth();
  // atende alguma fila (para o link de volta); atender ESTE chamado depende do setor dele
  const mySectors = useStaffSectors();
  const deskUser = mySectors.length > 0;
  const router = useRouter();
  const now = useNow(30_000);
  const { data: t, error, loading, reload, setData } = usePoll<TicketDetail>(`/tickets/${id}`, 30_000);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  if (loading && !t) return <Loading label="Carregando chamado…" />;
  if (error && !t) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <EmptyState
            icon={<AlertTriangle className="size-7" />}
            title="Não foi possível abrir este chamado"
            description={error === 'Forbidden resource' ? 'Você não tem acesso a este chamado.' : error}
            action={
              <Link href="/chamados">
                <Button variant="secondary">Voltar aos chamados</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }
  if (!t) return null;

  const staff = !!t.canManage;
  const isRequester = t.requesterId === user?.id;
  const acompanhando = !!t.acompanhando && !isRequester;
  const closed = t.status === 'FECHADO' || t.status === 'CANCELADO';
  const merge = (u: Partial<Ticket>) => setData((d) => (d ? { ...d, ...u } : d));

  return (
    <div className="mx-auto max-w-[var(--largura-pagina)] w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <Link href="/chamados" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700 dark:hover:text-brand-300">
        <ArrowLeft className="size-4" /> {deskUser && !isRequester ? 'Central de atendimento' : deskUser ? 'Chamados' : 'Meus chamados'}
      </Link>

      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">#{t.number}</span>
              <StatusBadge status={t.status} forRequester={!staff && !acompanhando} />
              <PriorityBadge priority={t.priority} />
              <ChannelIcon channel={t.channel} withLabel />
              <SectorBadge sector={t.sector} short={false} />
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight break-words sm:text-2xl">{t.title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CategoryIcon category={t.category} className="size-4" /> {t.category?.name ?? 'Sem categoria'}
              </span>
              <span>Aberto em {fmtDateTime(t.createdAt)}</span>
              <span>Atualizado {fmtRelative(t.updatedAt)}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 md:items-end">
            <SlaIndicator ticket={t} now={now} />
            {t.dueAt && isOpen(t.status) && <span className="text-xs text-slate-500">Prazo: {fmtDateTime(t.dueAt)}</span>}
            {t.assignee ? (
              <span className="mt-1 flex items-center gap-2 text-sm">
                <Avatar name={t.assignee.name} size={24} /> <span className="text-slate-500">Responsável:</span> <b>{t.assignee.name}</b>
              </span>
            ) : (
              <span className="mt-1 text-sm text-amber-700 dark:text-amber-300">Aguardando um técnico assumir</span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {isRequester && t.status === 'AGUARDANDO_USUARIO' && (
            <div className="flex items-center gap-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900 ring-1 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-100 dark:ring-violet-800">
              <MessageCircle className="size-5 shrink-0" aria-hidden />
              <span>A {SECTOR_TEAM[t.sector]} aguarda sua resposta para continuar o atendimento.</span>
            </div>
          )}

          {isRequester && t.status === 'RESOLVIDO' && <RatingBox t={t} onDone={(u) => (merge(u), reload())} onNotSolved={() => replyRef.current?.focus()} />}
          {t.rating != null && <RatingResult rating={t.rating} comment={t.ratingComment} />}

          <Card className="p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-slate-500 uppercase">Conversa</h2>
            <Timeline t={t} viewerIsStaff={staff || acompanhando} />
          </Card>

          {acompanhando ? (
            <Card className="p-5 text-center text-sm text-slate-500">Você acompanha a {SECTOR_TEAM[t.sector]} só para leitura: pode ver o andamento, mas não atender nem responder.</Card>
          ) : closed && !staff ? (
            <Card className="p-5 text-center text-sm text-slate-500">
              Este chamado foi encerrado. Se o problema voltar,{' '}
              <Link href="/chamados/novo" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
                abra um novo chamado
              </Link>
              .
            </Card>
          ) : (
            <ReplyBox t={t} staff={staff} textRef={replyRef} onSent={reload} />
          )}
        </div>

        <aside className="space-y-4">
          <RequesterCard t={t} />
          {staff ? <StaffPanel t={t} me={user!.id} onChange={(u) => (merge(u), reload())} onTransferred={(u) => (u.sector && !mySectors.includes(u.sector) && !isRequester ? router.push('/chamados') : reload())} /> : <InfoCard t={t} />}
          {acompanhando && <PrazoCard t={t} podeAumentar={false} onChange={() => undefined} />}
        </aside>
      </div>
    </div>
  );
}

// ───────── Resposta ─────────

function ReplyBox({ t, staff, textRef, onSent }: { t: TicketDetail; staff: boolean; textRef: React.RefObject<HTMLTextAreaElement | null>; onSent: () => void }) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [after, setAfter] = useState<'' | TicketStatus>('');
  const [sending, setSending] = useState(false);
  const attachment = useAttachment();

  const send = async () => {
    const text = body.trim() || (attachment.fileId ? '(anexo)' : '');
    if (!text) return textRef.current?.focus();
    if (attachment.uploading) return toast('Aguarde o envio do anexo.', 'info');
    setSending(true);
    try {
      await api(`/tickets/${t.id}/comments`, { method: 'POST', json: { body: text, internal: staff ? internal : undefined, fileId: attachment.fileId } });
      if (staff && !internal && after && after !== t.status) await api(`/tickets/${t.id}`, { method: 'PATCH', json: { status: after } });
      setBody('');
      setAfter('');
      attachment.clear();
      toast(internal ? 'Nota interna adicionada' : 'Mensagem enviada');
      onSent();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={clsx('no-print overflow-hidden transition', internal && 'ring-2 ring-amber-300 dark:ring-amber-700')}>
      {staff && (
        <div className="flex border-b border-slate-200 text-sm dark:border-slate-800" role="tablist" aria-label="Tipo de mensagem">
          {[
            [false, 'Responder ao solicitante', MessageCircle],
            [true, 'Nota interna', Lock],
          ].map(([v, label, Icon]: any) => (
            <button
              key={String(v)}
              role="tab"
              aria-selected={internal === v}
              onClick={() => setInternal(v)}
              className={clsx(
                'flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 font-medium transition',
                internal === v ? (v ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' : 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200') : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50',
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}
      <div className={clsx('p-4', internal && 'bg-amber-50/50 dark:bg-amber-900/10')}>
        <label htmlFor="reply" className="sr-only">
          {internal ? 'Nota interna' : 'Sua mensagem'}
        </label>
        <Textarea
          id="reply"
          ref={textRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && send()}
          rows={3}
          maxLength={20000}
          placeholder={internal ? `Anotação visível apenas para a ${SECTOR_TEAM[t.sector]}…` : staff ? 'Escreva a resposta para o solicitante…' : `Escreva uma mensagem para a ${SECTOR_TEAM[t.sector]}…`}
        />
        {attachment.att && (
          <div className="mt-3">
            <AttachmentPreview att={attachment.att} onRemove={attachment.clear} compact />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AttachButton onPick={attachment.pick} disabled={sending} />
          <span className="hidden text-xs text-slate-400 sm:inline">Ctrl + Enter para enviar</span>
          <div className="ml-auto flex items-center gap-2">
            {staff && !internal && (
              <Select value={after} onChange={(e) => setAfter(e.target.value as TicketStatus | '')} className="h-10 w-auto py-2 text-xs" aria-label="Status após enviar">
                <option value="">Manter status</option>
                <option value="AGUARDANDO_USUARIO">e aguardar usuário</option>
                <option value="EM_ATENDIMENTO">e manter em atendimento</option>
                <option value="RESOLVIDO">e marcar como resolvido</option>
              </Select>
            )}
            <Button onClick={send} loading={sending} disabled={attachment.uploading} variant={internal ? 'secondary' : 'primary'} className={clsx(internal && 'bg-amber-500! text-white! ring-0! hover:bg-amber-600!')}>
              <Send className="size-4" /> {internal ? 'Salvar nota' : 'Enviar'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ───────── Avaliação ─────────

function RatingBox({ t, onDone, onNotSolved }: { t: Ticket; onDone: (u: Partial<Ticket>) => void; onNotSolved: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const LABELS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];
  // mesma regra da API: nota 1 ou 2 precisa do motivo
  const motivoObrigatorio = rating > 0 && rating <= 2;
  const erroMotivo = tried && motivoObrigatorio && comment.trim().length < 10 ? 'Conte o motivo da nota baixa (mínimo 10 caracteres).' : undefined;
  const submit = async () => {
    if (!rating) return toast('Escolha de 1 a 5 estrelas.', 'info');
    if (motivoObrigatorio && comment.trim().length < 10) {
      setTried(true);
      return;
    }
    setSaving(true);
    try {
      const u = await api<Ticket>(`/tickets/${t.id}/rate`, { method: 'POST', json: { rating, comment: comment.trim() || undefined } });
      toast('Obrigado pela avaliação!');
      onDone(u);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const shown = hover || rating;
  return (
    <Card className="no-print overflow-hidden ring-2 ring-emerald-300 dark:ring-emerald-800">
      <div className="flex items-center gap-3 bg-emerald-50 px-5 py-4 dark:bg-emerald-900/20">
        <CheckCircle2 className="size-6 shrink-0 text-emerald-600" aria-hidden />
        <div>
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">Seu chamado foi resolvido!</p>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">Como foi o atendimento? Sua avaliação encerra o chamado.</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5 estrelas" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'} — ${LABELS[n]}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                className="rounded-lg p-1 transition hover:scale-110"
              >
                <Star className={clsx('size-8 transition', n <= shown ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')} />
              </button>
            ))}
          </div>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300" aria-live="polite">
            {LABELS[shown]}
          </span>
        </div>
        <Field
          label={motivoObrigatorio ? 'Motivo da nota' : 'Comentário (opcional)'}
          required={motivoObrigatorio}
          error={erroMotivo}
          hint={motivoObrigatorio ? 'Obrigatório para nota 1 ou 2: conte o que não foi bem, para a equipe melhorar.' : undefined}
        >
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={motivoObrigatorio ? 3 : 2}
            maxLength={1000}
            placeholder={motivoObrigatorio ? 'O que aconteceu? Ex.: demorou para atender, o problema voltou…' : 'Conte o que achou do atendimento…'}
            className={clsx(erroMotivo && 'ring-2! ring-rose-500!')}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onNotSolved}>
            Ainda não foi resolvido
          </Button>
          <Button variant="success" onClick={submit} loading={saving} disabled={!rating}>
            <Star className="size-4" /> Avaliar e encerrar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RatingResult({ rating, comment }: { rating: number; comment: string | null }) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className="flex shrink-0" aria-label={`Avaliação: ${rating} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={clsx('size-5', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')} aria-hidden />
        ))}
      </div>
      <div className="text-sm">
        <p className="font-semibold">Avaliação do solicitante</p>
        {comment ? <p className="mt-1 text-slate-600 italic dark:text-slate-300">“{comment}”</p> : <p className="mt-1 text-slate-500">Sem comentário.</p>}
      </div>
    </Card>
  );
}

// ───────── Barra lateral ─────────

function RequesterCard({ t }: { t: TicketDetail }) {
  const name = t.requester?.name ?? t.requesterName ?? 'Não identificado';
  const email = t.requester?.email ?? t.requesterEmail;
  const phone = t.requester?.phone ?? t.requesterPhone;
  const digits = phone?.replace(/\D/g, '');
  const ramal = ramalDo(t);
  const local = localSemRamal(t.location);
  const row = (Icon: typeof Mail, content: React.ReactNode, label: string) => (
    <li className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-slate-400" aria-label={label} />
      <span className="min-w-0 truncate">{content}</span>
    </li>
  );
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Solicitante</h2>
      <div className="flex items-center gap-3">
        <Avatar name={name} size={44} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          {!t.requesterId && <Badge className="mt-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Sem cadastro no sistema</Badge>}
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {email &&
          row(
            Mail,
            <a href={`mailto:${email}`} className="text-brand-600 hover:underline dark:text-brand-300">
              {email}
            </a>,
            'E-mail',
          )}
        {phone &&
          row(
            Phone,
            <span className="flex items-center gap-2">
              <a href={`tel:${digits}`} className="hover:underline">
                {phone}
              </a>
              {digits && digits.length >= 10 && (
                <a href={linkWhatsapp(digits)} target="_blank" rel="noopener noreferrer" className="rounded bg-emerald-50 px-1.5 text-xs font-medium text-emerald-700 hover:underline dark:bg-emerald-900/30 dark:text-emerald-300">
                  WhatsApp
                </a>
              )}
            </span>,
            'Telefone',
          )}
        {ramal && row(PhoneCall, <span className="font-medium">Ramal {ramal}</span>, 'Ramal')}
        {t.department && row(Building2, t.department.name, 'Setor')}
        {local && row(MapPin, local, 'Local')}
        {!email && !phone && !ramal && !t.department && !local && <li className="text-slate-500">Sem dados de contato.</li>}
      </ul>
    </Card>
  );
}

function InfoCard({ t }: { t: TicketDetail }) {
  const items: [string, React.ReactNode][] = [
    ['Equipe', SECTOR_LABEL[t.sector]],
    ['Status', statusLabel(t.status, true)],
    ['Prioridade', TICKET_PRIORITY[t.priority]?.label],
    ['Categoria', t.category?.name ?? '—'],
    ['Responsável', t.assignee?.name ?? 'Aguardando técnico'],
    ['Prazo previsto', fmtDateTime(t.dueAt)],
    ...(t.resolvedAt ? ([['Resolvido em', fmtDateTime(t.resolvedAt)]] as [string, React.ReactNode][]) : []),
  ];
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Detalhes</h2>
      <dl className="space-y-2.5 text-sm">
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function StaffPanel({ t, me, onChange, onTransferred }: { t: TicketDetail; me: string; onChange: (u: Partial<Ticket>) => void; onTransferred: (u: Partial<Ticket>) => void }) {
  const toast = useToast();
  const { data: categories } = useApi<TicketCategory[]>(`/tickets/categories?setor=${t.sector}`, [t.sector]);
  const { data: techs } = useApi<Technician[]>(`/tickets/technicians?setor=${t.sector}`, [t.sector]);
  const { data: departments } = useApi<Department[]>('/departments');
  const [busy, setBusy] = useState<string | null>(null);

  const patch = async (key: string, body: Record<string, unknown>, msg: string) => {
    setBusy(key);
    try {
      const u = await api<Ticket>(`/tickets/${t.id}`, { method: 'PATCH', json: body });
      onChange(u);
      toast(msg);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const mine = t.assigneeId === me;
  const names = new Map<string, string>([...(techs ?? []).map((x) => [x.id, x.name] as const), ...(t.requesterId ? [[t.requesterId, t.requester?.name ?? 'Solicitante'] as const] : [])]);

  return (
    <>
      <Card className="no-print p-5">
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Atendimento</h2>
        <div className="mb-4 grid gap-2">
          {!mine && (
            <Button variant="coral" loading={busy === 'assume'} onClick={() => patch('assume', { assigneeId: me, ...(t.status === 'NOVO' ? { status: 'EM_ATENDIMENTO' } : {}) }, 'Você assumiu este chamado')}>
              <Hand className="size-4" /> Assumir chamado
            </Button>
          )}
          {isOpen(t.status) && (
            <Button variant="success" loading={busy === 'resolve'} onClick={() => patch('resolve', { status: 'RESOLVIDO' }, 'Chamado marcado como resolvido')}>
              <CheckCircle2 className="size-4" /> Marcar como resolvido
            </Button>
          )}
          {!isOpen(t.status) && (
            <Button variant="secondary" loading={busy === 'reopen'} onClick={() => patch('reopen', { status: 'EM_ATENDIMENTO' }, 'Chamado reaberto')}>
              <RefreshCw className="size-4" /> Reabrir chamado
            </Button>
          )}
        </div>
        <div className="space-y-3">
          <Field label="Status">
            <Select value={t.status} disabled={!!busy} onChange={(e) => patch('status', { status: e.target.value }, `Status: ${TICKET_STATUS[e.target.value]?.label}`)}>
              {Object.entries(TICKET_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prioridade" hint="Mudar a prioridade recalcula o prazo (SLA); as prorrogações continuam somadas.">
            <Select value={t.priority} disabled={!!busy} onChange={(e) => patch('priority', { priority: e.target.value }, `Prioridade: ${TICKET_PRIORITY[e.target.value]?.label}`)}>
              {Object.entries(TICKET_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={t.categoryId ?? ''} disabled={!!busy} onChange={(e) => patch('category', { categoryId: e.target.value || null }, 'Categoria atualizada')}>
              <option value="">Sem categoria</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slaHours} h)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={t.assigneeId ?? ''} disabled={!!busy} onChange={(e) => patch('assignee', { assigneeId: e.target.value || null }, 'Responsável atualizado')}>
              <option value="">Sem responsável</option>
              {techs?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.id === me ? ' (você)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Setor do solicitante">
            <Select value={t.departmentId ?? ''} disabled={!!busy} onChange={(e) => patch('department', { departmentId: e.target.value || null }, 'Setor atualizado')}>
              <option value="">Não informado</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <PrazoCard t={t} podeAumentar onChange={onChange} />

      <TransferCard
        t={t}
        onDone={(u) => {
          onChange(u);
          onTransferred(u);
        }}
      />

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <History className="size-3.5" aria-hidden /> Histórico
        </h2>
        <dl className="mb-4 grid grid-cols-2 gap-2 text-xs">
          {[
            ['1ª resposta', t.firstResponseAt ? fmtDateTime(t.firstResponseAt) : '—'],
            ['Resolvido', t.resolvedAt ? fmtDateTime(t.resolvedAt) : '—'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
          {[...t.events].reverse().map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute top-1 -left-[25px] grid size-[9px] place-items-center rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-900" aria-hidden />
              <p className="text-slate-700 dark:text-slate-200">{describeEvent(e, names, t)}</p>
              <p className="text-xs text-slate-400">
                {e.actorId ? names.get(e.actorId) ?? 'Usuário' : 'Sistema'} · <time title={fmtDateTime(e.createdAt)}>{fmtRelative(e.createdAt)}</time>
              </p>
            </li>
          ))}
          {!t.events.length && <li className="text-sm text-slate-500">Sem eventos.</li>}
        </ol>
      </Card>
    </>
  );
}

/** Transferência para a fila de outra equipe (volta a "Novo", sem responsável). */
function TransferCard({ t, onDone }: { t: TicketDetail; onDone: (u: Partial<Ticket>) => void }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const others = SECTORS.filter((s) => s !== t.sector);
  const [to, setTo] = useState<TicketSector | ''>('');
  const [busy, setBusy] = useState(false);

  const transfer = async () => {
    if (!to) return toast('Escolha a equipe de destino.', 'info');
    const ok = await confirm(
      `Transferir o chamado #${t.number} para ${SECTOR_LABEL[to]}? Ele volta para "Novo", sem responsável, e o prazo é recalculado. A categoria só é mantida se for da nova equipe.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const u = await api<Ticket>(`/tickets/${t.id}`, { method: 'PATCH', json: { sector: to } });
      toast(`Chamado transferido para ${SECTOR_SHORT[to]}`);
      setTo('');
      onDone(u);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="no-print p-5">
      <h2 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <ArrowRightLeft className="size-3.5" aria-hidden /> Transferir para outra equipe
      </h2>
      <p className="mb-3 text-xs text-slate-500">Use quando o pedido não é da {SECTOR_TEAM[t.sector]}.</p>
      <div className="flex gap-2">
        <label htmlFor="transferir-setor" className="sr-only">
          Equipe de destino
        </label>
        <Select id="transferir-setor" value={to} disabled={busy} onChange={(e) => setTo(e.target.value as TicketSector | '')} className="min-w-0 flex-1">
          <option value="">Escolha a equipe…</option>
          {others.map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABEL[s]}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={transfer} loading={busy} disabled={!to}>
          Transferir
        </Button>
      </div>
      {dialog}
    </Card>
  );
}

function describeEvent(e: TicketDetail['events'][number], names: Map<string, string>, t: TicketDetail): React.ReactNode {
  const st = (s: string | null) => (s ? <b>{TICKET_STATUS[s]?.label ?? s}</b> : '—');
  switch (e.type) {
    case 'criado':
      return (
        <>
          Chamado aberto via <b>{TICKET_CHANNEL[t.channel]}</b>
        </>
      );
    case 'status':
      return (
        <>
          Status: {st(e.from)} → {st(e.to)}
        </>
      );
    case 'prazo': {
      const h = e.from && e.to ? Math.round((+new Date(e.to) - +new Date(e.from)) / 3_600_000) : 0;
      return (
        <>
          Prazo aumentado{h > 0 ? <> em <b>{fmtHoras(h)}</b></> : null}, até <b>{e.to ? fmtDateTime(e.to) : '—'}</b>
        </>
      );
    }
    case 'prioridade':
      return (
        <>
          Prioridade: <b>{TICKET_PRIORITY[e.from ?? '']?.label ?? '—'}</b> → <b>{TICKET_PRIORITY[e.to ?? '']?.label ?? '—'}</b>
        </>
      );
    case 'setor':
      return (
        <>
          Transferido de <b>{SECTOR_LABEL[e.from as TicketSector] ?? e.from ?? '—'}</b> para <b>{SECTOR_LABEL[e.to as TicketSector] ?? e.to ?? '—'}</b>
        </>
      );
    case 'responsavel':
      return e.to ? (
        <>
          Atribuído a <b>{names.get(e.to) ?? 'técnico'}</b>
        </>
      ) : (
        <>Responsável removido</>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1">
          <Tag className="size-3" aria-hidden /> {e.type}
        </span>
      );
  }
}

