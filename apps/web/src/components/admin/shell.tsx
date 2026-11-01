'use client';

import {
  BarChart3,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  GitBranch,
  HardDrive,
  Headset,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  MonitorPlay,
  PlusCircle,
  Rocket,
  Settings,
  Star,
  Tags,
  UserRound,
  Users,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { CurrentVersionLink } from '@/components/novidades/current-version';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Role } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/format';
import { Logo } from '@/components/logo';
import { AdminSearch } from './admin-search';
import { ThemeSwitch } from '@/components/ui/theme-switch';
import { Avatar, clsx } from '@/components/ui';
import { Icone } from '@/components/icons/icone';
import { NotificationBell } from '@/components/notifications/bell';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
  /** quando definido, substitui os perfis do grupo para este item */
  roles?: Role[];
  /** etiqueta curta à direita (ex.: "Em breve") */
  tag?: string;
  /** para que serve (mapa do painel na Visão geral e busca) */
  hint?: string;
}
export interface NavGroup {
  title: string;
  /** resumo da seção (mapa do painel na Visão geral) */
  description?: string;
  roles?: Role[];
  /** só quem tem o perfil de fato (o ADMIN não entra automaticamente: dados de saúde da CCIH) */
  exato?: boolean;
  items: NavItem[];
}

const EQUIPES: Role[] = ['TI', 'INFRAESTRUTURA', 'MANUTENCAO', 'COMUNICACAO'];

export const NAV: NavGroup[] = [
  {
    title: 'Atendimento',
    items: [
      { href: '/chamados', label: 'Chamados', icon: <Headset />, hint: 'Meus chamados e, para as equipes, a fila de atendimento' },
      { href: '/chamados/novo', label: 'Abrir chamado', icon: <PlusCircle />, hint: 'Pedir ajuda a uma das equipes' },
      { href: '/chamados/relatorios', label: 'Relatórios', icon: <BarChart3 />, roles: EQUIPES, hint: 'Prazos, volume, técnicos e avaliações' },
      { href: '/admin/painel-tv', label: 'Painel da TV', icon: <MonitorPlay />, roles: EQUIPES, hint: 'Fila na TV da equipe' },
    ],
  },
  {
    title: 'Configurações',
    description: 'Equipes, categorias, acessos e sistema',
    roles: ['ADMIN'],
    items: [
      { href: '/admin/chamados-config', label: 'Categorias e SLA', icon: <Tags />, roles: EQUIPES, hint: 'Equipes, tipos de chamado, prazos e canais' },
      { href: '/admin/usuarios', label: 'Usuários e setores', icon: <Users />, hint: 'Contas, perfis, grupos e setores' },
      { href: '/admin/configuracoes', label: 'Instituição e aparência', icon: <Settings />, hint: 'Nome, logo, cores, e-mail e WhatsApp do suporte' },
      { href: '/admin/mensagens', label: 'Mensagens automáticas', icon: <MessageSquareText />, roles: ['TI', 'COMUNICACAO'], hint: 'E-mails e WhatsApp enviados pelo sistema' },
      { href: '/admin/versoes', label: 'Histórico de alterações', icon: <GitBranch />, roles: EQUIPES, hint: 'Histórico e restauração das configurações' },
      { href: '/admin/novidades', label: 'Versões e novidades', icon: <Rocket />, roles: ['TI'], hint: 'O que mudou em cada versão' },
      { href: '/admin/armazenamento', label: 'Armazenamento', icon: <HardDrive />, roles: ['TI'], hint: 'Espaço em disco e anexos' },
      { href: '/admin/auditoria', label: 'Auditoria', icon: <History />, hint: 'Quem alterou o quê e quando' },
    ],
  },
];

const EXACT = new Set(['/chamados']);
const isActive = (pathname: string, href: string) => (EXACT.has(href) ? pathname === href : pathname === href || pathname.startsWith(href + '/'));

/** O que muda entre o painel administrativo e o painel do NITERA Qualis. */
export interface ShellConfig {
  /** nome do painel (barra superior e leitores de tela) */
  name: string;
  home: string;
  badge: string;
  storageKey: string;
  /** prefixo do ponto de cada ícone do menu em Painel › Ícones da intranet (ex.: "painel" → "painel:/admin/carrossel") */
  pontoIcone: string;
  /** link extra no rodapé da barra lateral (ex.: voltar ao painel administrativo) */
  back?: { href: string; label: string };
  /** Página de novidades: mostra "Versão X" no rodapé do menu lateral. */
  novidades?: string;
}

const APP_CONFIG: ShellConfig = { name: 'NITERA Resolve', home: '/chamados', badge: 'Resolve', storageKey: 'nr-menu-recolhido', pontoIcone: 'painel', novidades: '/novidades' };

export function useNav() {
  const { hasRole, user } = useAuth();
  return NAV.filter((g) => !g.exato || g.roles!.some((r) => user?.roles.includes(r))).map((g) => ({ ...g, items: g.items.filter((it) => (it.roles ?? g.roles) === undefined || hasRole(...(it.roles ?? g.roles)!)) })).filter((g) => g.items.length);
}

/** Favoritos do menu lateral: atalhos que a pessoa fixa com a estrela, guardados só neste navegador. */
function useFavoritos(chave: string) {
  const [fav, setFav] = useState<string[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(chave) ?? '[]');
      if (Array.isArray(v)) setFav(v.filter((x) => typeof x === 'string').slice(0, 12));
    } catch {}
  }, [chave]);
  const alternar = (href: string) =>
    setFav((f) => {
      const n = f.includes(href) ? f.filter((x) => x !== href) : [...f, href].slice(0, 12);
      try {
        localStorage.setItem(chave, JSON.stringify(n));
      } catch {}
      return n;
    });
  return { fav, alternar };
}

function NavLinks({ groups: todos, label, ponto, collapsed, onNavigate, favKey }: { groups: NavGroup[]; label: string; ponto: string; collapsed: boolean; onNavigate?: () => void; favKey: string }) {
  const pathname = usePathname();
  const { fav, alternar } = useFavoritos(favKey);
  // só vira favorito o que a pessoa pode ver (os grupos já vêm filtrados pelas permissões)
  const itens = todos.flatMap((g) => g.items);
  const favoritos = fav.map((h) => itens.find((it) => it.href === h)).filter((x): x is NavItem => !!x);
  const groups = favoritos.length ? [{ title: 'Favoritos', items: favoritos } as NavGroup, ...todos] : todos;
  // quando dois itens casam (ex.: /qualis/ocorrencias e /qualis/ocorrencias/visao-geral), vale o mais específico
  const current = groups
    .flatMap((g) => g.items.map((it) => it.href))
    .filter((h) => isActive(pathname, h))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label={label} className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {groups.map((g, gi) => (
        <div key={g.title} className={clsx(gi === 0 && favoritos.length && !collapsed && 'rounded-2xl bg-white/[0.04] pb-1 ring-1 ring-white/[0.06]')}>
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-8 bg-white/10" aria-hidden />
          ) : (
            <p className={clsx('mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-semibold tracking-wider text-brand-300/80 uppercase', gi === 0 && favoritos.length && 'pt-2.5')}>
              {gi === 0 && favoritos.length > 0 && <Star className="size-3 fill-current text-amber-300" aria-hidden />}
              {g.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.href === current;
              return (
                <li key={it.href} className="group/item relative">
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    title={collapsed ? it.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:scale-110',
                      collapsed && 'justify-center px-0',
                      !collapsed && 'pr-9',
                      active
                        ? 'bg-linear-to-r from-white/[0.16] to-white/[0.06] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_4px_14px_-6px_rgb(0_0_0/0.35)] ring-1 ring-inset ring-white/10'
                        : 'text-brand-100/80 hover:bg-white/[0.07] hover:text-white',
                    )}
                  >
                    {active && <span className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-coral-500 shadow-[0_0_12px_2px_color-mix(in_oklab,var(--color-coral-500)_60%,transparent)]" aria-hidden />}
                    <Icone ponto={`${ponto}:${it.href}`}>{it.icon as React.ReactElement}</Icone>
                    {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                    {!collapsed && it.tag && <span title={it.tag} aria-label={it.tag} className="size-2 shrink-0 rounded-full bg-amber-400/80" />}
                    {!collapsed && it.external && <ExternalLink className="!size-3.5 opacity-0 transition group-hover:opacity-60" />}
                  </Link>
                  {!collapsed && !it.external && (
                    <button
                      type="button"
                      onClick={() => alternar(it.href)}
                      aria-pressed={fav.includes(it.href)}
                      aria-label={fav.includes(it.href) ? `Tirar ${it.label} dos favoritos` : `Fixar ${it.label} nos favoritos`}
                      title={fav.includes(it.href) ? 'Tirar dos favoritos' : 'Fixar nos favoritos'}
                      className={clsx(
                        'absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-lg transition hover:bg-white/10 focus-visible:opacity-100',
                        fav.includes(it.href) ? 'text-amber-300 opacity-0 group-hover/item:opacity-100' : 'text-brand-100/60 opacity-0 group-hover/item:opacity-100 hover:text-white',
                      )}
                    >
                      <Star className={clsx('!size-3.5', fav.includes(it.href) && 'fill-current')} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ compact = false, up = false }: { compact?: boolean; up?: boolean }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (!user) return null;
  return (
    // largura limitada: com vários perfis a lista de perfis encolhe com reticências em vez de alargar a página
    <div className={clsx('relative min-w-0', !compact && 'max-w-[13rem] shrink xl:max-w-[16rem]')} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={compact ? undefined : `${user.name}: ${user.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}`}
        className={clsx('flex w-full min-w-0 items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800', compact && 'w-auto')}
      >
        <Avatar name={user.name} src={user.avatarUrl} size={34} />
        {!compact && (
          <span className="hidden min-w-0 flex-1 sm:block">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block truncate text-xs text-slate-500">{user.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}</span>
          </span>
        )}
        <ChevronDown className={clsx('hidden size-4 text-slate-400 transition sm:block', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className={clsx('absolute right-0 z-40 w-64 overflow-hidden rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-slate-200 animate-fade-in dark:bg-slate-900 dark:ring-slate-800', up ? 'bottom-full mb-2' : 'top-full mt-2')}>
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <Link role="menuitem" href="/perfil" className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setOpen(false)}>
            <UserRound className="size-4 text-slate-500" /> Meu perfil
          </Link>
          <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm md:hidden">
            <span className="text-slate-600 dark:text-slate-300">Tema</span>
            <ThemeSwitch />
          </div>
          <button
            role="menuitem"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/40"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarBody({ config, groups, collapsed, onNavigate, onToggle }: { config: ShellConfig; groups: NavGroup[]; collapsed: boolean; onNavigate?: () => void; onToggle?: () => void }) {
  return (
    <>
      <div className={clsx('flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4', collapsed && 'justify-center px-2')}>
        <Link href={config.home} onClick={onNavigate} className="flex min-w-0 items-center gap-2" aria-label={`${config.name} — início`}>
          <Logo compact={collapsed} className={collapsed ? undefined : 'h-auto! max-h-9! max-w-full!'} />
        </Link>
        {!collapsed && <span className="ml-auto rounded-md bg-coral-500/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-white uppercase">{config.badge}</span>}
      </div>
      <NavLinks groups={groups} label={config.name} ponto={config.pontoIcone} collapsed={collapsed} onNavigate={onNavigate} favKey={`${config.storageKey}-favoritos`} />
      <div className="space-y-1 border-t border-white/10 p-3">
        {config.back && (
          <Link
            href={config.back.href}
            onClick={onNavigate}
            title={collapsed ? config.back.label : undefined}
            className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100/80 transition hover:bg-white/6 hover:text-white', collapsed && 'justify-center px-0')}
          >
            <LayoutDashboard className="size-[18px] shrink-0" />
            {!collapsed && config.back.label}
          </Link>
        )}
        {config.novidades && (
          <CurrentVersionLink
            href={config.novidades}
            className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100/80 transition hover:bg-white/6 hover:text-white', collapsed && 'justify-center px-0')}
          >
            {(v) => (
              <>
                <Sparkles className="size-[18px] shrink-0" />
                {collapsed ? <span className="sr-only">Versão {v}</span> : <span>Versão {v}</span>}
              </>
            )}
          </CurrentVersionLink>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100/80 transition hover:bg-white/6 hover:text-white', collapsed && 'justify-center px-0')}
          >
            {collapsed ? <ChevronsRight className="size-[18px]" /> : <ChevronsLeft className="size-[18px]" />}
            {!collapsed && 'Recolher menu'}
          </button>
        )}
      </div>
    </>
  );
}

function currentTitle(groups: NavGroup[], pathname: string, fallback: string) {
  return currentPlace(groups, pathname)?.item.label ?? fallback;
}

/** Onde a pessoa está: grupo e item do menu (o mais específico que casa com o endereço). */
function currentPlace(groups: NavGroup[], pathname: string) {
  const hits = groups.flatMap((g) => g.items.map((item) => ({ group: g.title, item }))).filter((h) => isActive(pathname, h.item.href));
  return hits.sort((a, b) => b.item.href.length - a.item.href.length)[0];
}

/** Estrutura de todas as telas do NITERA Resolve (menu lateral + barra superior com o sino de avisos). */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <PanelShell config={APP_CONFIG} groups={useNav()} headerExtra={<NotificationBell />}>
      {children}
    </PanelShell>
  );
}

/** Estrutura dos painéis: barra lateral recolhível (gaveta no celular) + barra superior. */
export function PanelShell({
  config,
  groups: navGroups,
  children,
  userMenu,
  headerExtra,
}: {
  config: ShellConfig;
  groups: NavGroup[];
  children: React.ReactNode;
  /** menu da conta no lugar do menu da intranet */
  userMenu?: React.ReactNode;
  /** itens extras na barra superior (ex.: sino de avisos) */
  headerExtra?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const title = currentTitle(navGroups, pathname, config.name);
  const place = currentPlace(navGroups, pathname);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(config.storageKey) === '1');
    } catch {}
  }, [config.storageKey]);
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [drawer]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(config.storageKey, c ? '0' : '1');
      } catch {}
      return !c;
    });
  };

  const sidebarBg = 'bg-[var(--ha-sidebar)] bg-gradient-to-b from-transparent via-transparent to-black/25 text-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:border-r dark:border-slate-800';

  return (
    <div className="min-h-dvh bg-slate-100 bg-[radial-gradient(1100px_520px_at_100%_-8%,color-mix(in_oklab,var(--color-brand-200)_45%,transparent),transparent_70%)] bg-fixed dark:bg-slate-950 dark:bg-[radial-gradient(1100px_520px_at_100%_-8%,color-mix(in_oklab,var(--color-brand-800)_40%,transparent),transparent_70%)] print:bg-white print:bg-none">
      <a href="#admin-main" className="sr-only z-50 rounded-lg bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>

      {/* barra lateral (desktop) */}
      <aside className={clsx('fixed inset-y-0 left-0 z-30 hidden flex-col transition-[width] duration-200 lg:flex print:!hidden', collapsed ? 'w-[76px]' : 'w-64', sidebarBg)}>
        <SidebarBody config={config} groups={navGroups} collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* gaveta (celular) */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setDrawer(false)} aria-hidden />
          <aside role="dialog" aria-modal="true" aria-label="Menu do painel" className={clsx('absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-drawer-in flex-col shadow-2xl', sidebarBg)}>
            <button onClick={() => setDrawer(false)} className="absolute top-4 right-3 z-10 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            <SidebarBody config={config} groups={navGroups} collapsed={false} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className={clsx('flex min-h-dvh flex-col transition-[padding] duration-200 print:!pl-0', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-900/[0.06] bg-white/70 px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6 dark:border-white/[0.06] dark:bg-slate-900/70 print:hidden">
          <button onClick={() => setDrawer(true)} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <nav aria-label="Você está em" className="hidden sm:block">
              <ol className="flex min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <li className="truncate">
                  <Link href={config.home} className="hover:text-slate-900 dark:hover:text-white">
                    {config.name}
                  </Link>
                </li>
                {place && place.group !== 'Favoritos' && (
                  <>
                    <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
                    <li className="truncate">{place.group}</li>
                  </>
                )}
              </ol>
            </nav>
            <p className="truncate text-sm font-semibold tracking-tight sm:text-base" aria-current="page">
              {title}
            </p>
          </div>
          <AdminSearch groups={navGroups} />
          <span className="hidden md:contents">
            <ThemeSwitch />
          </span>
          {headerExtra}
          {userMenu ?? <UserMenu />}
        </header>
        <main key={pathname} id="admin-main" className="mx-auto w-full max-w-[var(--largura-painel)] flex-1 animate-enter px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
