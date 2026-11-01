'use client';

import clsx from 'clsx';
import { AlertTriangle, BellRing, CheckCircle2, Clock, Globe, Inbox, Mail, Maximize, MessageCircle, Phone, Timer, UserX, Volume2, WifiOff, Zap } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Logo } from '@/components/logo';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import { Avatar } from '@/components/ui';
import { sectorSolid } from './config';
import { ChimeTone, VOICE_TEXT, playTicketChime, speakTicketAlert, unlockAudio } from './new-ticket-alert';
import type { TicketChannel, TicketPriority, TicketStatus } from './types';

interface TvTicket {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  location: string | null;
  requesterName: string | null;
  dueAt: string | null;
  createdAt: string;
  overdue: boolean;
  category: { id?: string; name: string } | null;
  department: { name: string } | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
}

interface TvSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  refreshSec: number;
  soundEnabled: boolean;
  soundTone: ChimeTone;
  voiceEnabled?: boolean;
  voiceText?: string;
  soundVolume: number;
  criticalRepeat: number;
  reminderMin: number;
  newHighlightSec: number;
  statuses: TicketStatus[];
  maxPerColumn: number;
  theme: 'escuro' | 'claro';
  showClock: boolean;
  showStats: boolean;
  showTechnicians: boolean;
  showRequester: boolean;
  showLocation: boolean;
  blinkCritical: boolean;
  highlightOverdue: boolean;
  ticker: string;
}

interface Board {
  settings: TvSettings;
  serverTime: string;
  tickets: TvTicket[];
  stats: { open: number; unassigned: number; overdue: number; critical: number; openedToday: number; resolvedToday: number; avgFirstResponseMin: number | null };
  technicians: { id: string; name: string; avatarUrl: string | null; active: number }[];
  /** nome, ícone e cor do setor (Painel › Categorias e SLA › Setores) */
  sector?: { label: string; short: string; icon: string; image: string | null; color: string };
  /** ícone escolhido para cada categoria dos chamados exibidos */
  categoryIcons?: Record<string, { icon: string | null; image: string | null }>;
}

const KEY_STORAGE = 'nr-painel-tv-chave';
const PRIORITY_ORDER: Record<TicketPriority, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };
const PRIORITY: Record<TicketPriority, { label: string; bar: string; pill: string }> = {
  CRITICA: { label: 'Crítica', bar: 'bg-rose-500', pill: 'bg-rose-500 text-white' },
  ALTA: { label: 'Alta', bar: 'bg-orange-500', pill: 'bg-orange-500 text-white' },
  MEDIA: { label: 'Média', bar: 'bg-sky-500', pill: 'bg-sky-500/90 text-white' },
  BAIXA: { label: 'Baixa', bar: 'bg-slate-400', pill: 'bg-slate-500 text-white' },
};
const COLUMN: Record<string, { label: string; icon: React.ReactNode; accent: string }> = {
  NOVO: { label: 'Novos', icon: <Inbox />, accent: 'from-coral-500 to-rose-500' },
  EM_ATENDIMENTO: { label: 'Em atendimento', icon: <Zap />, accent: 'from-sky-500 to-brand-500' },
  AGUARDANDO_USUARIO: { label: 'Aguardando usuário', icon: <Clock />, accent: 'from-amber-500 to-orange-500' },
};
const CHANNEL: Record<TicketChannel, { label: string; icon: React.ReactNode }> = {
  PORTAL: { label: 'Site', icon: <Globe /> },
  WHATSAPP: { label: 'WhatsApp', icon: <MessageCircle /> },
  EMAIL: { label: 'E-mail', icon: <Mail /> },
  TELEFONE: { label: 'Telefone', icon: <Phone /> },
};

function since(iso: string, now: number) {
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

function duration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

function longDate(d: Date) {
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dueText(iso: string, now: number) {
  const m = Math.round((new Date(iso).getTime() - now) / 60000);
  return m < 0 ? `Atrasado ${duration(-m)}` : `Vence em ${duration(m)}`;
}

/** Tela cheia da TV: chamados abertos por coluna, números do dia, técnicos e aviso sonoro para chamado novo. */
export function TvBoard() {
  const params = useSearchParams();
  const [key, setKey] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const [banner, setBanner] = useState<{ title: string; text: string; critical: boolean } | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const lastReminder = useRef(Date.now());
  const settingsRef = useRef<TvSettings | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // a chave vem do endereço; fica guardada na TV para os próximos acessos
  useEffect(() => {
    const fromUrl = params.get('chave');
    let k = fromUrl;
    try {
      if (fromUrl) localStorage.setItem(KEY_STORAGE, fromUrl);
      else k = localStorage.getItem(KEY_STORAGE);
    } catch {}
    if (k) setKey(k);
    else setFatal('Abra este painel pelo endereço copiado em Painel administrativo › Chamados › Painel da TV.');
  }, [params]);

  // se o navegador já permite som sem clique (modo quiosque), o painel começa sozinho
  useEffect(() => {
    try {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      const probe = AC ? new AC() : null;
      if (probe?.state === 'running') setStarted(true);
      probe?.close().catch(() => undefined);
    } catch {}
  }, []);

  const showBanner = useCallback((b: { title: string; text: string; critical: boolean }) => {
    setBanner(b);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 10_000);
  }, []);

  const chime = useCallback((times = 1) => {
    const s = settingsRef.current;
    if (s?.soundEnabled) playTicketChime(times, s.soundTone, s.soundVolume);
  }, []);

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch(`/api/painel-tv?chave=${encodeURIComponent(key)}`, { cache: 'no-store' });
      if (res.status === 403 || res.status === 404) {
        const body = await res.json().catch(() => ({}));
        setFatal(body?.message ?? 'Acesso ao painel negado.');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data: Board = await res.json();
      setFatal(null);
      setOffline(false);
      settingsRef.current = data.settings;
      setBoard(data);

      const ids = new Set(data.tickets.map((t) => t.id));
      if (!seen.current) {
        seen.current = ids; // primeira carga: só mostra, não toca
        return;
      }
      const arrived = data.tickets.filter((t) => !seen.current!.has(t.id));
      seen.current = ids;
      if (!arrived.length) return;

      const critical = arrived.some((t) => t.priority === 'CRITICA');
      const repeat = critical ? data.settings.criticalRepeat : 1;
      chime(repeat);
      const s = data.settings;
      if (s.soundEnabled && s.voiceEnabled !== false) speakTicketAlert(s.voiceText || VOICE_TEXT, s.soundVolume, 300 + repeat * 950);
      lastReminder.current = Date.now();
      const until = Date.now() + data.settings.newHighlightSec * 1000;
      setFresh((f) => ({ ...f, ...Object.fromEntries(arrived.map((t) => [t.id, until])) }));
      const first = arrived[0];
      showBanner({
        title: arrived.length > 1 ? `${arrived.length} chamados novos` : `Novo chamado #${first.number}`,
        text: arrived.length > 1 ? arrived.map((t) => `#${t.number} ${t.title}`).join('  ·  ') : `${first.title}${first.requesterName ? ` · ${first.requesterName}` : ''}`,
        critical,
      });
    } catch {
      setOffline(true);
    }
  }, [key, chime, showBanner]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshSec = board?.settings.refreshSec ?? 15;
  useEffect(() => {
    if (!key) return;
    const t = setInterval(load, refreshSec * 1000);
    return () => clearInterval(t);
  }, [key, load, refreshSec]);

  // relógio e tempos relativos
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // lembrete: toca de novo enquanto houver chamado novo sem responsável
  useEffect(() => {
    const s = board?.settings;
    if (!s || !s.reminderMin || !board.stats.unassigned) return;
    if (now - lastReminder.current < s.reminderMin * 60_000) return;
    lastReminder.current = now;
    chime(1);
    showBanner({ title: 'Chamado aguardando atendimento', text: `${board.stats.unassigned} chamado${board.stats.unassigned > 1 ? 's' : ''} novo${board.stats.unassigned > 1 ? 's' : ''} sem responsável`, critical: false });
  }, [now, board, chime, showBanner]);

  // limpa os destaques de "novo" que já venceram
  useEffect(() => {
    if (Object.values(fresh).some((u) => u < now)) setFresh((f) => Object.fromEntries(Object.entries(f).filter(([, u]) => u >= now)));
  }, [now, fresh]);

  // mantém a TV ligada enquanto o painel está aberto
  useEffect(() => {
    if (!started) return;
    let lock: any = null;
    const ask = () => (navigator as any).wakeLock?.request('screen').then((l: any) => (lock = l)).catch(() => undefined);
    ask();
    const onVis = () => document.visibilityState === 'visible' && ask();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release?.().catch(() => undefined);
    };
  }, [started]);

  useEffect(() => {
    document.title = board ? `${board.stats.unassigned ? `(${board.stats.unassigned}) ` : ''}${board.settings.title}` : 'Painel de chamados';
  }, [board]);

  const start = () => {
    unlockAudio();
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    setStarted(true);
    if (settingsRef.current?.soundEnabled) setTimeout(() => chime(1), 150);
  };

  const columns = useMemo(() => {
    if (!board) return [];
    return board.settings.statuses.map((st) => ({
      status: st,
      items: board.tickets.filter((t) => t.status === st).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt)),
    }));
  }, [board]);

  const s = board?.settings;
  const dark = (s?.theme ?? 'escuro') === 'escuro';
  const clock = new Date(now);

  if (fatal)
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-950 p-10 text-center text-white">
        <div className="max-w-2xl space-y-4">
          <AlertTriangle className="mx-auto size-16 text-amber-400" />
          <h1 className="text-3xl font-bold">Painel de chamados indisponível</h1>
          <p className="text-xl text-white/80">{fatal}</p>
        </div>
      </div>
    );

  return (
    <div className={clsx('flex h-dvh flex-col overflow-hidden', dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900')} style={{ fontSize: 'clamp(12px, 0.9vw, 22px)' }}>
      {/* cabeçalho */}
      <header className={clsx('flex shrink-0 items-center gap-[1.5em] px-[1.6em] py-[0.9em]', dark ? 'bg-brand-950/80' : 'bg-[var(--ha-header)]')}>
        <Logo className="!h-[3em] !max-w-[14em]" />
        {board?.sector && (
          <span className={clsx('grid size-[3.2em] shrink-0 place-items-center rounded-[0.9em] text-white shadow', sectorSolid(board.sector.color))} title={`Equipe: ${board.sector.label}`}>
            <DynamicIcon name={board.sector.icon} image={board.sector.image} className="size-[1.8em]" label={`Equipe: ${board.sector.label}`} />
          </span>
        )}
        <div className="min-w-0 border-l border-white/20 pl-[1.2em] text-white">
          <h1 className="truncate text-[1.9em] leading-tight font-extrabold tracking-tight">{s?.title ?? 'Central de Chamados'}</h1>
          {s?.subtitle && <p className="truncate text-[1em] text-white/70">{s.subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-[1em] text-white">
          {offline && (
            <span className="flex items-center gap-[0.4em] rounded-full bg-rose-600 px-[0.9em] py-[0.35em] text-[0.95em] font-semibold animate-pulse">
              <WifiOff className="size-[1.1em]" /> Sem conexão
            </span>
          )}
          {s?.soundEnabled && started && <Volume2 className="size-[1.4em] text-white/60" aria-label="Som ligado" />}
          {s?.showClock !== false && (
            <div className="text-right">
              <div className="text-[2.4em] leading-none font-black tabular-nums">{clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="text-[0.95em] text-white/70">{longDate(clock)}</div>
            </div>
          )}
        </div>
      </header>

      {/* números */}
      {board && s?.showStats && (
        <div className="grid shrink-0 grid-cols-6 gap-[0.9em] px-[1.6em] pt-[1em]">
          <Stat dark={dark} icon={<Inbox />} label="Abertos agora" value={board.stats.open} tone="brand" />
          <Stat dark={dark} icon={<UserX />} label="Sem responsável" value={board.stats.unassigned} tone={board.stats.unassigned ? 'coral' : 'slate'} pulse={board.stats.unassigned > 0} />
          <Stat dark={dark} icon={<AlertTriangle />} label="Atrasados" value={board.stats.overdue} tone={board.stats.overdue ? 'rose' : 'slate'} />
          <Stat dark={dark} icon={<BellRing />} label="Abertos hoje" value={board.stats.openedToday} tone="sky" />
          <Stat dark={dark} icon={<CheckCircle2 />} label="Resolvidos hoje" value={board.stats.resolvedToday} tone="emerald" />
          <Stat dark={dark} icon={<Timer />} label="1ª resposta (média hoje)" value={board.stats.avgFirstResponseMin === null ? '—' : duration(board.stats.avgFirstResponseMin)} tone="violet" />
        </div>
      )}

      {/* colunas */}
      <main className="grid min-h-0 flex-1 gap-[1em] px-[1.6em] py-[1em]" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}>
        {!board && <div className="col-span-full grid place-items-center text-[1.6em] opacity-60">Carregando chamados…</div>}
        {columns.map((col) => {
          const meta = COLUMN[col.status];
          const shown = col.items.slice(0, s!.maxPerColumn);
          const rest = col.items.length - shown.length;
          return (
            <section key={col.status} className={clsx('flex min-h-0 flex-col overflow-hidden rounded-[1.2em]', dark ? 'bg-slate-900/70 ring-1 ring-white/5' : 'bg-white shadow-md ring-1 ring-black/5')}>
              <div className={clsx('flex items-center gap-[0.6em] bg-gradient-to-r px-[1em] py-[0.7em] text-white', meta.accent)}>
                <span className="[&>svg]:size-[1.4em]">{meta.icon}</span>
                <h2 className="text-[1.35em] font-bold">{meta.label}</h2>
                <span className="ml-auto rounded-full bg-white/25 px-[0.7em] text-[1.35em] font-black tabular-nums">{col.items.length}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-[0.7em] overflow-hidden p-[0.8em]">
                {!shown.length && (
                  <div className="grid h-full place-items-center text-center text-[1.15em] opacity-50">
                    <div>
                      <CheckCircle2 className="mx-auto mb-[0.4em] size-[2.4em]" />
                      Nenhum chamado
                    </div>
                  </div>
                )}
                {shown.map((t) => (
                  <TicketCard key={t.id} t={t} s={s!} now={now} dark={dark} isNew={(fresh[t.id] ?? 0) > now} catIcon={t.category?.id ? board?.categoryIcons?.[t.category.id] : undefined} />
                ))}
                {rest > 0 && <div className="text-center text-[1.05em] font-semibold opacity-70">+ {rest} chamado{rest > 1 ? 's' : ''}</div>}
              </div>
            </section>
          );
        })}
      </main>

      {/* técnicos e recado */}
      {board && (s?.showTechnicians || s?.ticker) && (
        <footer className={clsx('flex shrink-0 items-center gap-[1em] overflow-hidden px-[1.6em] py-[0.7em]', dark ? 'bg-slate-900' : 'bg-white shadow-inner')}>
          {s?.showTechnicians && board.technicians.length > 0 && (
            <div className="flex shrink-0 items-center gap-[0.6em]">
              <span className="text-[0.95em] font-semibold tracking-wide uppercase opacity-60">Técnicos</span>
              {board.technicians.map((u) => (
                <span key={u.id} className={clsx('flex items-center gap-[0.45em] rounded-full py-[0.25em] pr-[0.8em] pl-[0.25em]', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                  <Avatar name={u.name} src={u.avatarUrl} size={28} />
                  <span className="text-[1em] font-medium">{u.name.split(' ')[0]}</span>
                  <span className={clsx('rounded-full px-[0.5em] text-[0.9em] font-bold tabular-nums', u.active ? 'bg-sky-500 text-white' : 'bg-emerald-500/20 text-emerald-500')}>{u.active || 'livre'}</span>
                </span>
              ))}
            </div>
          )}
          {s?.ticker && (
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <div className="inline-block animate-[tv-ticker_30s_linear_infinite] pl-[100%] text-[1.15em] font-medium whitespace-nowrap">{s.ticker}</div>
            </div>
          )}
        </footer>
      )}

      {/* aviso de chamado novo */}
      {banner && (
        <div className="pointer-events-none fixed inset-x-0 top-[18%] z-40 flex justify-center px-[2em]">
          <div className={clsx('flex max-w-[80%] items-center gap-[1.2em] rounded-[1.4em] px-[2em] py-[1.4em] text-white shadow-2xl animate-[tv-pop_.5s_cubic-bezier(.22,1,.36,1)]', banner.critical ? 'bg-rose-600' : 'bg-coral-500')}>
            <BellRing className="size-[3.2em] shrink-0 animate-[tv-ring_1s_ease-in-out_3]" />
            <div className="min-w-0">
              <div className="text-[2.4em] leading-tight font-black">{banner.title}</div>
              <div className="mt-[0.2em] line-clamp-2 text-[1.4em] text-white/90">{banner.text}</div>
            </div>
          </div>
        </div>
      )}

      {/* o navegador só deixa tocar som depois de um clique */}
      {!started && (
        <button onClick={start} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 text-white backdrop-blur-sm">
          <span className="space-y-[1em] text-center">
            <Maximize className="mx-auto size-[4em] text-coral-400" />
            <span className="block text-[2.6em] font-black">Toque para iniciar o painel</span>
            <span className="block text-[1.3em] text-white/70">Isso libera o som de chamado novo e abre em tela cheia.</span>
          </span>
        </button>
      )}

      <style>{`@keyframes tv-ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}
@keyframes tv-pop{from{opacity:0;transform:translateY(-30px) scale(.9)}to{opacity:1;transform:none}}
@keyframes tv-ring{0%,100%{transform:rotate(0)}20%{transform:rotate(-18deg)}40%{transform:rotate(16deg)}60%{transform:rotate(-10deg)}80%{transform:rotate(6deg)}}
@keyframes tv-new{0%,100%{box-shadow:0 0 0 0 rgba(255,107,74,.0)}50%{box-shadow:0 0 0 .35em rgba(255,107,74,.75)}}
@keyframes tv-blink{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>
  );
}

function Stat({ icon, label, value, tone, dark, pulse }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: 'brand' | 'coral' | 'rose' | 'sky' | 'emerald' | 'violet' | 'slate'; dark: boolean; pulse?: boolean }) {
  const tones = {
    brand: 'text-brand-400',
    coral: 'text-coral-500',
    rose: 'text-rose-500',
    sky: 'text-sky-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    slate: 'text-slate-400',
  };
  return (
    <div className={clsx('flex items-center gap-[0.8em] rounded-[1em] px-[1em] py-[0.7em]', dark ? 'bg-slate-900/70 ring-1 ring-white/5' : 'bg-white shadow ring-1 ring-black/5')}>
      <span className={clsx('[&>svg]:size-[2em]', tones[tone], pulse && 'animate-pulse')}>{icon}</span>
      <div className="min-w-0">
        <div className={clsx('text-[2.1em] leading-none font-black tabular-nums', tones[tone])}>{value}</div>
        <div className="truncate text-[0.9em] opacity-70">{label}</div>
      </div>
    </div>
  );
}

function TicketCard({ t, s, now, dark, isNew, catIcon }: { t: TvTicket; s: TvSettings; now: number; dark: boolean; isNew: boolean; catIcon?: { icon: string | null; image: string | null } }) {
  const p = PRIORITY[t.priority];
  const overdue = s.highlightOverdue && t.overdue;
  const where = [t.department?.name, s.showLocation ? t.location : null].filter(Boolean).join(' · ');
  return (
    <article
      className={clsx(
        'relative overflow-hidden rounded-[0.9em] py-[0.7em] pr-[0.9em] pl-[1.2em]',
        dark ? 'bg-slate-800/80' : 'bg-slate-50 ring-1 ring-slate-200',
        overdue && (dark ? 'bg-rose-950/60 ring-1 ring-rose-500/60' : 'bg-rose-50 ring-rose-300'),
      )}
      style={isNew ? { animation: 'tv-new 1.2s ease-in-out infinite' } : undefined}
    >
      <span className={clsx('absolute inset-y-0 left-0 w-[0.4em]', p.bar)} style={s.blinkCritical && t.priority === 'CRITICA' ? { animation: 'tv-blink 1s infinite' } : undefined} />
      <div className="flex items-center gap-[0.5em] text-[0.95em]">
        <span className="font-black tabular-nums opacity-80">#{t.number}</span>
        <span className={clsx('rounded-full px-[0.6em] py-[0.05em] text-[0.85em] font-bold uppercase', p.pill)} style={s.blinkCritical && t.priority === 'CRITICA' ? { animation: 'tv-blink 1s infinite' } : undefined}>
          {p.label}
        </span>
        {isNew && <span className="rounded-full bg-coral-500 px-[0.6em] py-[0.05em] text-[0.85em] font-bold text-white uppercase">Novo</span>}
        <span className="ml-auto flex items-center gap-[0.3em] opacity-60 [&>svg]:size-[1em]" title={CHANNEL[t.channel]?.label}>
          {CHANNEL[t.channel]?.icon}
          {since(t.createdAt, now)}
        </span>
      </div>
      <h3 className="mt-[0.25em] line-clamp-2 text-[1.2em] leading-snug font-semibold">{t.title}</h3>
      <div className="mt-[0.35em] flex flex-wrap items-center gap-x-[0.8em] gap-y-[0.2em] text-[0.92em] opacity-75">
        {t.category && (
          <span className="flex items-center gap-[0.3em]">
            {(catIcon?.icon || catIcon?.image) && <DynamicIcon name={catIcon.icon} image={catIcon.image} className="size-[1em]" />}
            {t.category.name}
          </span>
        )}
        {where && <span>{where}</span>}
        {s.showRequester && t.requesterName && <span>Solicitante: {t.requesterName}</span>}
      </div>
      <div className="mt-[0.45em] flex items-center gap-[0.5em] text-[0.92em]">
        {t.assignee ? (
          <span className="flex items-center gap-[0.4em]">
            <Avatar name={t.assignee.name} src={t.assignee.avatarUrl} size={22} />
            <span className="font-medium">{t.assignee.name}</span>
          </span>
        ) : (
          <span className="flex items-center gap-[0.35em] font-semibold text-amber-500">
            <UserX className="size-[1.1em]" /> Sem responsável
          </span>
        )}
        {t.dueAt && <span className={clsx('ml-auto font-semibold', t.overdue ? 'text-rose-500' : 'opacity-60')}>{dueText(t.dueAt, now)}</span>}
      </div>
    </article>
  );
}
