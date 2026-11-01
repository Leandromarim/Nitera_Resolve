'use client';

import { AlertTriangle, BarChart3, Bell, BellOff, Columns3, Flame, Headset, Layers, Inbox, List, Plus, RefreshCw, Search, UserX, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, clsx, EmptyState, Input, PageHeader, Select, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';
import { TICKET_CHANNEL, TICKET_PRIORITY, TICKET_STATUS } from '@/lib/format';
import { Kanban, KANBAN_COLUMNS } from './kanban';
import { isOverdue, statusLabel, useNow } from './meta';
import { TicketTable } from './ticket-table';
import type { Technician, Ticket, TicketCategory, TicketList, TicketSector, TicketStatus } from './types';
import { SECTOR_LABEL, SECTOR_SHORT, SectorIcon, SectorTabs, useStaffSectors, useWatchedSectors } from './sectors';
import { useNewTicketAlert } from './new-ticket-alert';
import { usePoll } from './use-poll';

interface Filters {
  q: string;
  status: string; // '' = todos, 'open' = em aberto, ou um status
  priority: string;
  categoryId: string;
  assigneeId: string; // '', 'none', 'me' ou id
  channel: string;
  from: string;
  to: string;
  overdue: boolean;
}
const EMPTY: Filters = { q: '', status: 'open', priority: '', categoryId: '', assigneeId: '', channel: '', from: '', to: '', overdue: false };
type View = 'kanban' | 'lista';
const VIEW_KEY = 'nr-chamados-view';
const SECTOR_KEY = 'nr-chamados-setor';
const WATCH_KEY = 'nr-chamados-fila';

export function Desk() {
  const { user, hasRole } = useAuth();
  const toast = useToast();
  const now = useNow(30_000);
  const [view, setView] = useState<View>('kanban');
  const [f, setF] = useState<Filters>(EMPTY);
  const [q, setQ] = useState('');
  const sectors = useStaffSectors();
  // '' = todos os setores que a pessoa atende
  const [sector, setSector] = useState<TicketSector | ''>('');
  const multi = sectors.length > 1;
  // equipe acompanhada só para leitura (vazio = a própria fila)
  const watched = useWatchedSectors();
  // 'misto' = a própria fila e as equipes acompanhadas juntas (as acompanhadas continuam só leitura)
  const [watch, setWatch] = useState<TicketSector | '' | 'misto'>('');
  const misto = watch === 'misto' && watched.length > 0;
  const readOnly = !!watch && watch !== 'misto' && watched.includes(watch);
  const current: TicketSector | '' = readOnly ? (watch as TicketSector) : misto ? '' : multi ? sector : sectors[0] ?? '';
  const minhaEquipe = useCallback((t: Ticket) => sectors.includes(t.sector), [sectors]);
  const nomeMisto = [...sectors, ...watched].map((s) => SECTOR_SHORT[s]).join(' + ');

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'kanban' || v === 'lista') setView(v);
      const s = localStorage.getItem(SECTOR_KEY) as TicketSector | null;
      if (s && sectors.includes(s)) setSector(s);
      if (localStorage.getItem(WATCH_KEY) === 'misto') setWatch('misto');
    } catch {}
  }, [sectors]);
  const changeWatch = (v: TicketSector | '' | 'misto') => {
    setWatch(v);
    try {
      localStorage.setItem(WATCH_KEY, v === 'misto' ? 'misto' : '');
    } catch {}
    setF((x) => ({ ...x, categoryId: '', assigneeId: x.assigneeId === 'none' ? 'none' : '' }));
  };
  const changeSector = (v: TicketSector | '') => {
    setSector(v);
    // categoria e responsável dependem do setor
    setF((x) => ({ ...x, categoryId: '', assigneeId: x.assigneeId === 'me' || x.assigneeId === 'none' ? x.assigneeId : '' }));
    try {
      localStorage.setItem(SECTOR_KEY, v);
    } catch {}
  };
  const sectorQs = current ? `&setor=${current}` : misto ? '&misto=1' : '';
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  // busca com atraso para não disparar a cada tecla
  useEffect(() => {
    const t = setTimeout(() => setF((x) => (x.q === q ? x : { ...x, q })), 350);
    return () => clearTimeout(t);
  }, [q]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));

  const path = useMemo(() => {
    const p = new URLSearchParams({ take: '500' });
    if (current) p.set('setor', current);
    else if (misto) p.set('misto', '1');
    if (f.q) p.set('q', f.q);
    if (view === 'kanban') p.set('status', KANBAN_COLUMNS.join(','));
    else if (f.status === 'open') p.set('open', '1');
    else if (f.status) p.set('status', f.status);
    if (f.priority) p.set('priority', f.priority);
    if (f.categoryId) p.set('categoryId', f.categoryId);
    if (f.assigneeId) p.set('assigneeId', f.assigneeId === 'me' ? user!.id : f.assigneeId);
    if (f.channel) p.set('channel', f.channel);
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
    return `/tickets?${p}`;
  }, [f, view, user, current, misto]);

  const list = usePoll<TicketList>(path, 15_000);
  const openAll = usePoll<TicketList>(`/tickets?open=1&take=500${sectorQs}`, 15_000);
  const onNewTickets = useCallback(
    (fresh: Ticket[]) => {
      toast(fresh.length > 1 ? `${fresh.length} chamados novos chegaram` : `Novo chamado #${fresh[0].number}: ${fresh[0].title}`, 'info');
      list.reload();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );
  // o som de chamado novo vale só para a própria fila
  const minhaFila = useMemo(() => (misto ? openAll.data?.items.filter(minhaEquipe) : openAll.data?.items), [misto, openAll.data, minhaEquipe]);
  const { soundOn, toggleSound } = useNewTicketAlert(readOnly ? undefined : minhaFila, onNewTickets, current || 'todos');
  const { data: allCategories } = useApi<TicketCategory[]>(`/tickets/categories${current ? `?setor=${current}` : ''}`);
  const categories = useMemo(
    () => allCategories?.filter((c) => (readOnly ? c.sector === watch : sectors.includes(c.sector) || (misto && watched.includes(c.sector)))),
    [allCategories, sectors, readOnly, watch, misto, watched],
  );
  const { data: techs } = useApi<Technician[]>(`/tickets/technicians${current ? `?setor=${current}` : misto ? '?misto=1' : ''}`);

  const tickets = useMemo(() => (list.data?.items ?? []).filter((t) => !f.overdue || isOverdue(t, now)), [list.data, f.overdue, now]);

  const counters = useMemo(() => {
    const xs = openAll.data?.items ?? [];
    return {
      open: openAll.data?.total ?? 0,
      unassigned: xs.filter((t) => !t.assigneeId).length,
      overdue: xs.filter((t) => isOverdue(t, now)).length,
      critical: xs.filter((t) => t.priority === 'CRITICA').length,
    };
  }, [openAll.data, now]);

  const move = async (t: Ticket, status: TicketStatus) => {
    const prev = list.data;
    list.setData((d) => d && { ...d, items: d.items.map((x) => (x.id === t.id ? { ...x, status } : x)) });
    try {
      const updated = await api<Ticket>(`/tickets/${t.id}`, { method: 'PATCH', json: { status } });
      list.setData((d) => d && { ...d, items: d.items.map((x) => (x.id === t.id ? { ...x, ...updated } : x)) });
      toast(`Chamado #${t.number} movido para "${statusLabel(status)}"`);
      openAll.reload();
    } catch (e: any) {
      list.setData(prev);
      toast(e.message, 'error');
    }
  };

  const activeFilters =
    (f.q ? 1 : 0) + (f.priority ? 1 : 0) + (f.categoryId ? 1 : 0) + (f.assigneeId ? 1 : 0) + (f.channel ? 1 : 0) + (f.from || f.to ? 1 : 0) + (f.overdue ? 1 : 0) + (view === 'lista' && f.status !== 'open' ? 1 : 0);
  const clear = () => {
    setQ('');
    setF(EMPTY);
  };

  const counter = (label: string, value: number, icon: React.ReactNode, tone: string, active: boolean, onClick: () => void, hint: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900',
        active ? 'ring-2 ring-brand-500' : 'ring-slate-200/70 dark:ring-slate-800',
      )}
    >
      <span className={clsx('grid size-11 shrink-0 place-items-center rounded-xl', tone)}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl leading-tight font-bold tabular-nums">{openAll.data ? value : '–'}</span>
        <span className="block truncate text-xs text-slate-500">{label}</span>
        <span className="sr-only">{hint}</span>
      </span>
    </button>
  );

  return (
    <div className="mx-auto max-w-[var(--largura-pagina)] w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageHeader
        icon={<Headset className="size-6" />}
        title={current ? `Central de atendimento · ${SECTOR_SHORT[current]}` : misto ? `Central de atendimento · ${nomeMisto}` : 'Central de atendimento'}
        description={
          list.updatedAt
            ? `Atualiza sozinha a cada 15 segundos · última às ${new Date(list.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : readOnly
              ? `Acompanhando ${SECTOR_LABEL[watch as TicketSector]} só para leitura`
              : misto
                ? `Chamados de ${nomeMisto} juntos`
              : current
                ? `Chamados de ${SECTOR_LABEL[current]} de todos os setores`
                : 'Chamados de todos os seus setores'
        }
        actions={
          <>
            <Button
              variant="ghost"
              onClick={toggleSound}
              aria-pressed={soundOn}
              aria-label={soundOn ? 'Som de chamado novo ligado. Clique para desligar' : 'Som de chamado novo desligado. Clique para ligar'}
              title={soundOn ? 'Som de chamado novo: ligado' : 'Som de chamado novo: desligado'}
            >
              {soundOn ? <Bell className="size-4" /> : <BellOff className="size-4 text-slate-400" />}
              <span className="hidden sm:inline">{soundOn ? 'Som ligado' : 'Som desligado'}</span>
            </Button>
            <Button variant="ghost" onClick={() => (list.reload(), openAll.reload())} aria-label="Atualizar agora" title="Atualizar agora">
              <RefreshCw className={clsx('size-4', list.loading && 'animate-spin')} />
            </Button>
            <Link href="/chamados?meus=1">
              <Button variant="ghost">Meus chamados</Button>
            </Link>
            <Link href={current && !readOnly ? `/chamados/relatorios?setor=${current.toLowerCase()}` : '/chamados/relatorios'}>
              <Button variant="secondary">
                <BarChart3 className="size-4" /> Relatórios
              </Button>
            </Link>
            <Link href={current ? `/chamados/novo?setor=${current.toLowerCase()}` : '/chamados/novo'}>
              <Button variant="coral">
                <Plus className="size-4" /> Abrir chamado
              </Button>
            </Link>
          </>
        }
      />

      {(multi || watched.length > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {watched.length > 0 && (
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Fila exibida">
              {([['', 'Minha fila'], ['misto', nomeMisto], ...watched.map((w) => [w, `${SECTOR_SHORT[w]} · só leitura`])] as [TicketSector | '' | 'misto', string][]).map(([v, text]) => (
                <button
                  key={v || 'minha'}
                  type="button"
                  role="tab"
                  aria-selected={watch === v}
                  onClick={() => changeWatch(v)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-500',
                    watch === v ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {v === 'misto' ? <Layers className="size-4" aria-hidden /> : v ? <SectorIcon sector={v} className="size-4" /> : <Inbox className="size-4" aria-hidden />}
                  {text}
                </button>
              ))}
            </div>
          )}
          {multi && !readOnly && !misto && <SectorTabs sectors={sectors} value={sector} onChange={changeSector} label="Fila de atendimento por setor" className="w-fit max-w-full" />}
        </div>
      )}
      {misto && (
        <p className="mb-4 rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-900 ring-1 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-100 dark:ring-sky-800">
          Os chamados de {watched.map((w) => SECTOR_LABEL[w]).join(' e ')} aparecem aqui só para acompanhar: dá para abrir e ler, mas não atender, mover ou responder.
        </p>
      )}
      {readOnly && (
        <p className="mb-4 rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-900 ring-1 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-100 dark:ring-sky-800">
          Você está vendo os chamados de {SECTOR_LABEL[current as TicketSector]} só para acompanhar: dá para abrir e ler, mas não atender, mover ou responder.
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counter('Em aberto', counters.open, <Inbox className="size-5" />, 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300', false, clear, 'Mostrar todos os abertos')}
        {counter('Sem responsável', counters.unassigned, <UserX className="size-5" />, 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', f.assigneeId === 'none', () => set('assigneeId', f.assigneeId === 'none' ? '' : 'none'), 'Filtrar sem responsável')}
        {counter('Atrasados (SLA)', counters.overdue, <AlertTriangle className="size-5" />, 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', f.overdue, () => set('overdue', !f.overdue), 'Filtrar atrasados')}
        {counter('Críticos', counters.critical, <Flame className="size-5" />, 'bg-red-600 text-white', f.priority === 'CRITICA', () => set('priority', f.priority === 'CRITICA' ? '' : 'CRITICA'), 'Filtrar críticos')}
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex shrink-0 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Modo de visualização">
            {(
              [
                ['kanban', 'Kanban', Columns3],
                ['lista', 'Lista', List],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => changeView(v)}
                className={clsx(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  view === v ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, título, descrição ou solicitante…" className="pl-9" aria-label="Buscar chamados" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {view === 'lista' && (
            <Select value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
              <option value="open">Em aberto</option>
              <option value="">Todos os status</option>
              {Object.entries(TICKET_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          )}
          <Select value={f.priority} onChange={(e) => set('priority', e.target.value)} aria-label="Prioridade">
            <option value="">Todas as prioridades</option>
            {Object.entries(TICKET_PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!current && (multi || misto) ? ` · ${SECTOR_SHORT[c.sector]}` : ''}
              </option>
            ))}
          </Select>
          <Select value={f.assigneeId} onChange={(e) => set('assigneeId', e.target.value)} aria-label="Responsável">
            <option value="">Todos os responsáveis</option>
            <option value="me">Atribuídos a mim</option>
            <option value="none">Sem responsável</option>
            {techs
              ?.filter((t) => t.id !== user?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
          <Select value={f.channel} onChange={(e) => set('channel', e.target.value)} aria-label="Canal">
            <option value="">Todos os canais</option>
            {Object.entries(TICKET_CHANNEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Input type="date" value={f.from} max={f.to || undefined} onChange={(e) => set('from', e.target.value)} aria-label="Aberto a partir de" title="Aberto a partir de" />
          <Input type="date" value={f.to} min={f.from || undefined} onChange={(e) => set('to', e.target.value)} aria-label="Aberto até" title="Aberto até" />
        </div>
        {activeFilters > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-500">
              {tickets.length} {tickets.length === 1 ? 'chamado encontrado' : 'chamados encontrados'}
            </span>
            <button onClick={clear} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-300">
              <X className="size-4" /> Limpar filtros
            </button>
          </div>
        )}
      </Card>

      {list.loading && !list.data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : list.error && !list.data ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle className="size-7" />}
            title="Não foi possível carregar os chamados"
            description={list.error}
            action={
              <Button variant="secondary" onClick={list.reload}>
                <RefreshCw className="size-4" /> Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : view === 'kanban' ? (
        <div className={clsx('transition-opacity', list.loading && 'opacity-60')}>
          <Kanban tickets={tickets} now={now} onMove={readOnly ? undefined : move} podeMover={misto ? minhaEquipe : undefined} showSector={(multi && !current) || misto} />
        </div>
      ) : (
        <Card className={clsx('overflow-hidden transition-opacity', list.loading && 'opacity-60')}>
          {tickets.length ? (
            <TicketTable tickets={tickets} now={now} showSector={(multi && !current) || misto} />
          ) : (
            <EmptyState
              icon={<Inbox className="size-7" />}
              title="Nenhum chamado encontrado"
              description="Ajuste os filtros ou a busca para ver outros chamados."
              action={
                activeFilters ? (
                  <Button variant="secondary" onClick={clear}>
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          )}
        </Card>
      )}
    </div>
  );
}
