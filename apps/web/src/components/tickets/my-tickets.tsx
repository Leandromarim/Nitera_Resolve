'use client';

import { AlertCircle, ArrowRight, Clock, Inbox, LifeBuoy, Mail, MessageCircle, Plus, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, Card, clsx, EmptyState, Input, PageHeader } from '@/components/ui';
import { combina } from '@/lib/busca';
import { fmtDate, fmtRelative } from '@/lib/format';
import { usePortalSettingsLite } from '@/lib/canais-suporte';
import { useTicketsConfig } from './config';
import { CategoryIcon, categoryTone, PriorityBadge, StatusBadge, statusLabel } from './meta';
import { SECTOR_LABEL, SectorBadge } from './sectors';
import type { TicketList } from './types';
import { usePoll } from './use-poll';
import { qrSrc } from '@/components/comum/qr';
import { numeroWhatsapp } from '@/lib/whatsapp';

const FILTERS = [
  { key: 'todos', label: 'Todos', qs: '' },
  { key: 'abertos', label: 'Em aberto', qs: 'open=1' },
  { key: 'aguardando', label: 'Aguardando você', qs: 'status=AGUARDANDO_USUARIO' },
  { key: 'resolvidos', label: 'Resolvidos', qs: 'status=RESOLVIDO' },
  { key: 'fechados', label: 'Fechados', qs: 'status=FECHADO,CANCELADO' },
] as const;

export function MyTickets({ staff }: { staff?: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('todos');
  const f = FILTERS.find((x) => x.key === filter)!;
  const { data, error, loading, reload } = usePoll<TicketList>(`/tickets?mine=1&take=200${f.qs ? '&' + f.qs : ''}`);
  const waiting = usePoll<TicketList>('/tickets?mine=1&take=1&status=AGUARDANDO_USUARIO').data?.total ?? 0;
  const params = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  // busca nos chamados já carregados (até 200 do filtro de status escolhido)
  const items = useMemo(
    () => (data?.items ?? []).filter((t) => !q.trim() || combina([`#${t.number}`, t.title, t.category?.name, t.sector, SECTOR_LABEL[t.sector], statusLabel(t.status, true), t.assignee?.name], q)),
    [data, q],
  );

  return (
    <div className="mx-auto max-w-[var(--largura-pagina)] w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageHeader
        icon={<LifeBuoy className="size-6" />}
        title="Meus chamados"
        description="Acompanhe os pedidos que você abriu para a TI, a Manutenção e a Comunicação."
        actions={
          <Link href="/chamados/novo">
            <Button variant="coral" size="lg" className="w-full sm:w-auto">
              <Plus className="size-5" /> Abrir chamado
            </Button>
          </Link>
        }
      />

      {waiting > 0 && filter !== 'aguardando' && (
        <button
          onClick={() => setFilter('aguardando')}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-violet-50 px-4 py-3 text-left text-sm text-violet-900 ring-1 ring-violet-200 transition hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-100 dark:ring-violet-800"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span className="flex-1">
            <b>{waiting === 1 ? '1 chamado aguarda' : `${waiting} chamados aguardam`} sua resposta.</b> A equipe precisa de uma informação para continuar.
          </span>
          <ArrowRight className="size-4" />
        </button>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section aria-label="Lista de chamados">
          <div className="relative mb-3" role="search">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar chamado, ex.: impressora" aria-label="Buscar nos meus chamados" className="pl-10" />
          </div>
          <div className="mb-4 flex items-center gap-2 flex-wrap pb-1" role="tablist" aria-label="Filtrar por status">
            {FILTERS.map((x) => (
              <button
                key={x.key}
                role="tab"
                aria-selected={filter === x.key}
                onClick={() => setFilter(x.key)}
                className={clsx(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                  filter === x.key ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-500' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-800',
                )}
              >
                {x.label}
              </button>
            ))}
          </div>

          {loading && !data ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          ) : error && !data ? (
            <Card>
              <EmptyState
                icon={<AlertCircle className="size-7" />}
                title="Não foi possível carregar seus chamados"
                description={error}
                action={
                  <Button variant="secondary" onClick={reload}>
                    <RefreshCw className="size-4" /> Tentar novamente
                  </Button>
                }
              />
            </Card>
          ) : !data?.items.length ? (
            <Card>
              <EmptyState
                icon={<Inbox className="size-7" />}
                title={filter === 'todos' ? 'Você ainda não abriu nenhum chamado' : 'Nenhum chamado neste filtro'}
                description={filter === 'todos' ? 'Problema com computador ou sistema, algo para consertar ou um pedido de divulgação? Abra um chamado para a equipe certa.' : 'Experimente outro filtro de status.'}
                action={
                  filter === 'todos' ? (
                    <Link href="/chamados/novo">
                      <Button variant="coral">
                        <Plus className="size-4" /> Abrir meu primeiro chamado
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            </Card>
          ) : !items.length ? (
            <Card>
              <EmptyState icon={<Search className="size-7" />} title={`Nada encontrado para “${q.trim()}”.`} description="Tente outro termo ou outro filtro de status." />
            </Card>
          ) : (
            <ul className={clsx('space-y-3 transition-opacity', loading && 'opacity-60')}>
              {items.map((t) => {
                return (
                  <li key={t.id}>
                    <Link
                      href={`/chamados/${t.id}`}
                      className="group flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-300 dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-brand-700"
                    >
                      <span className={clsx('hidden size-12 shrink-0 place-items-center rounded-xl sm:grid', categoryTone(t.category?.name))}>
                        <CategoryIcon category={t.category} className="size-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-500">#{t.number}</span>
                          <StatusBadge status={t.status} forRequester />
                          <PriorityBadge priority={t.priority} />
                          <SectorBadge sector={t.sector} />
                        </div>
                        <h3 className="mt-1.5 truncate font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{t.title}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{t.category?.name ?? 'Sem categoria'}</span>
                          <span>Aberto em {fmtDate(t.createdAt)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" aria-hidden /> Atualizado {fmtRelative(t.updatedAt)}
                          </span>
                          {t.assignee && <span>Com {t.assignee.name.split(' ')[0]}</span>}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-5 shrink-0 self-center text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <OtherChannels />
          {staff && (
            <Card className="p-5 text-sm">
              <p className="font-semibold">Equipe de atendimento</p>
              <p className="mt-1 text-slate-500">Você está vendo apenas os chamados abertos por você.</p>
              <Link href="/chamados" className="mt-3 inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-300">
                Ir para a central de atendimento <ArrowRight className="size-4" />
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

/** WhatsApp e e-mail do suporte (configurados no painel). */
export function OtherChannels() {
  const suporte = usePortalSettingsLite();
  const { channels } = useTicketsConfig();
  const wa = numeroWhatsapp(suporte?.ticketsWhatsappNumber);
  const email = suporte?.ticketsEmail;
  const fmtPhone = (d: string) => {
    const m = /^(55)?(\d{2})(\d{4,5})(\d{4})$/.exec(d);
    return m ? `(${m[2]}) ${m[3]}-${m[4]}` : d;
  };
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-5 py-4 text-white">
        <p className="font-semibold">{channels.title}</p>
        {channels.text && <p className="mt-0.5 text-xs text-white/80">{channels.text}</p>}
      </div>
      <div className="space-y-2 p-4">
        {!suporte ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <>
            {wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:ring-emerald-300 dark:ring-slate-800 dark:hover:bg-emerald-900/20"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-chat-green text-white">
                  <MessageCircle className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">WhatsApp</span>
                  <span className="block truncate text-xs text-slate-500">{fmtPhone(wa)}</span>
                </span>
              </a>
            ) : null}
            {wa && suporte?.ticketsWhatsappQr ? (
              <div className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 dark:ring-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc(`https://wa.me/${wa}`, 256)} alt="QR Code do WhatsApp do suporte" width={96} height={96} className="size-24 shrink-0 rounded-lg bg-white p-1 ring-1 ring-slate-200" />
                <span className="text-xs text-slate-500">Aponte a câmera do celular para abrir a conversa no WhatsApp.</span>
              </div>
            ) : null}
            {email ? (
              <a
                href={`mailto:${email}${channels.mailSubject ? `?subject=${encodeURIComponent(channels.mailSubject)}` : ''}`}
                className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-sky-50 hover:ring-sky-300 dark:ring-slate-800 dark:hover:bg-sky-900/20"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-sky-600 text-white">
                  <Mail className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">E-mail</span>
                  <span className="block truncate text-xs text-slate-500">{email}</span>
                </span>
              </a>
            ) : null}
            {!wa && !email && <p className="p-2 text-sm text-slate-500">Os contatos do suporte ainda não foram configurados.</p>}
          </>
        )}
      </div>
    </Card>
  );
}
