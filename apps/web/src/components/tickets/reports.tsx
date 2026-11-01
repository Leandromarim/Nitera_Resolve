'use client';

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Inbox,
  MessageSquareReply,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sheet,
  Star,
  Ticket as TicketIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, clsx, EmptyState, Field, Input, PageHeader, Select, useToast } from '@/components/ui';
import { downloadAuthenticated } from '@/lib/api';
import { TICKET_CHANNEL, TICKET_PRIORITY, TICKET_STATUS } from '@/lib/format';
import { CORES_GRAFICO, TOOLTIP_CURSOR, TOOLTIP_CURSOR_LINHA } from '@/lib/graficos';
import { useApi } from '@/lib/use-api';
import { fmtHours } from './meta';
import { parseSector, SECTOR_LABEL, SECTOR_TEAM, SectorTabs, useStaffSectors } from './sectors';
import type { Department, ReportSummary, Technician, TicketCategory, TicketSector } from './types';

// Paleta categórica (ordem fixa) dos tokens --chart-*: já troca sozinha entre claro e escuro.
const colors = CORES_GRAFICO;
const GRID = 'var(--chart-grid)';
const EIXO = 'var(--chart-eixo)';
// Cor fixa por entidade (nunca pela posição no ranking)
const CHANNEL_SLOT: Record<string, number> = { Portal: 0, WhatsApp: 2, 'E-mail': 1, Telefone: 3 };
const STATUS_COR: Record<string, string> = {
  Novo: 'var(--chart-6)',
  'Em atendimento': 'var(--chart-4)',
  'Aguardando você': 'var(--chart-5)',
  'Aguardando usuário': 'var(--chart-5)',
  Resolvido: 'var(--chart-bom)',
  Fechado: 'var(--chart-8)',
  Cancelado: 'var(--chart-ruim)',
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
const PRESETS = [7, 30, 90] as const;

interface Filters {
  preset: number | 'custom';
  from: string;
  to: string;
  categoryId: string;
  assigneeId: string;
  departmentId: string;
  channel: string;
  status: string;
  priority: string;
}

export function Reports() {
  const toast = useToast();
  const [f, setF] = useState<Filters>({ preset: 30, from: daysAgo(30), to: iso(new Date()), categoryId: '', assigneeId: '', departmentId: '', channel: '', status: '', priority: '' });
  const [exporting, setExporting] = useState<string | null>(null);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));
  const sectors = useStaffSectors();
  const params = useSearchParams();
  const fromUrl = parseSector(params.get('setor'));
  const [sector, setSector] = useState<TicketSector | ''>(fromUrl && sectors.includes(fromUrl) ? fromUrl : '');
  const multi = sectors.length > 1;
  const current: TicketSector | '' = multi ? sector : sectors[0] ?? '';
  const changeSector = (v: TicketSector | '') => {
    setSector(v);
    setF((x) => ({ ...x, categoryId: '', assigneeId: '' }));
  };
  const sectorQs = current ? `setor=${current}` : '';

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (current) p.set('setor', current);
    (['from', 'to', 'categoryId', 'assigneeId', 'departmentId', 'channel', 'status', 'priority'] as const).forEach((k) => f[k] && p.set(k, f[k]));
    return p.toString();
  }, [f, current]);

  const { data: s, error, loading, reload } = useApi<ReportSummary>(`/tickets/reports/summary?${qs}`);
  const { data: allCategories } = useApi<TicketCategory[]>(`/tickets/categories${sectorQs ? '?' + sectorQs : ''}`);
  const categories = useMemo(() => allCategories?.filter((c) => sectors.includes(c.sector)), [allCategories, sectors]);
  const { data: techs } = useApi<Technician[]>(`/tickets/technicians${sectorQs ? '?' + sectorQs : ''}`);
  const { data: departments } = useApi<Department[]>('/departments');

  const days = useMemo(() => {
    if (!s) return [];
    const map = new Map(s.byDay.map((d) => [d.date, d]));
    const out: { date: string; label: string; abertos: number; resolvidos: number }[] = [];
    const start = new Date(f.from + 'T00:00:00');
    const end = new Date((f.to || iso(new Date())) + 'T00:00:00');
    for (let d = start; d <= end && out.length < 400; d = new Date(d.getTime() + 86_400_000)) {
      const k = iso(d);
      const v = map.get(k);
      out.push({ date: k, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), abertos: v?.abertos ?? 0, resolvidos: v?.resolvidos ?? 0 });
    }
    return out;
  }, [s, f.from, f.to]);

  const exportAs = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setExporting(format);
    try {
      await downloadAuthenticated(`/tickets/reports/export?format=${format}&${qs}`, `chamados.${format}`);
      toast('Arquivo gerado');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  const periodText = `${new Date(f.from + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date((f.to || iso(new Date())) + 'T00:00:00').toLocaleDateString('pt-BR')}`;

  return (
    <div className="mx-auto max-w-[var(--largura-pagina)] w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 print:max-w-none print:p-0">
      <style>{`@media print { header, footer { display: none !important; } body { background: #fff !important; } .print-break { break-inside: avoid; } }`}</style>
      <PageHeader
        icon={<BarChart3 className="size-6" />}
        title="Relatórios de chamados"
        description={`Indicadores da ${current ? SECTOR_TEAM[current] : 'equipe de atendimento'} · ${periodText}`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => exportAs('csv')} loading={exporting === 'csv'}>
              <Sheet className="size-4" /> CSV
            </Button>
            <Button variant="secondary" onClick={() => exportAs('xlsx')} loading={exporting === 'xlsx'}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button variant="secondary" onClick={() => exportAs('pdf')} loading={exporting === 'pdf'}>
              <FileText className="size-4" /> PDF
            </Button>
            <Button variant="ghost" onClick={() => window.print()} aria-label="Imprimir" title="Imprimir">
              <Printer className="size-4" />
            </Button>
          </div>
        }
      />

      {multi && (
        <div className="no-print mb-4">
          <SectorTabs sectors={sectors} value={sector} onChange={changeSector} label="Equipe do relatório" className="w-fit max-w-full" />
        </div>
      )}
      {current && multi && <p className="mb-4 hidden text-sm font-medium print:block">Equipe: {SECTOR_LABEL[current]}</p>}

      {/* Filtros */}
      <Card className="no-print mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Período</span>
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Atalhos de período">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => setF((x) => ({ ...x, preset: n, from: daysAgo(n), to: iso(new Date()) }))}
                  aria-pressed={f.preset === n}
                  className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium transition', f.preset === n ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}
                >
                  {n} dias
                </button>
              ))}
              <button
                onClick={() => set('preset', 'custom')}
                aria-pressed={f.preset === 'custom'}
                className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium transition', f.preset === 'custom' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}
              >
                Personalizado
              </button>
            </div>
          </div>
          {f.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="De">
                <Input type="date" value={f.from} max={f.to} onChange={(e) => e.target.value && set('from', e.target.value)} />
              </Field>
              <Field label="Até">
                <Input type="date" value={f.to} min={f.from} max={iso(new Date())} onChange={(e) => e.target.value && set('to', e.target.value)} />
              </Field>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={f.assigneeId} onChange={(e) => set('assigneeId', e.target.value)} aria-label="Responsável">
            <option value="">Todos os técnicos</option>
            {techs?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)} aria-label="Setor do solicitante">
            <option value="">Todos os setores</option>
            {departments?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
          <Select value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
            <option value="">Todos os status</option>
            <option value="NOVO,EM_ATENDIMENTO,AGUARDANDO_USUARIO">Em aberto</option>
            {Object.entries(TICKET_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select value={f.priority} onChange={(e) => set('priority', e.target.value)} aria-label="Prioridade">
            <option value="">Todas as prioridades</option>
            {Object.entries(TICKET_PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && !s ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : error && !s ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle className="size-7" />}
            title="Não foi possível gerar o relatório"
            description={error}
            action={
              <Button variant="secondary" onClick={reload}>
                <RefreshCw className="size-4" /> Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : s ? (
        <div className={clsx('space-y-6 transition-opacity', loading && 'opacity-60')}>
          {/* KPIs */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
            <Kpi icon={TicketIcon} label="Total de chamados" value={s.total} tone="brand" />
            <Kpi icon={Inbox} label="Em aberto" value={s.open} tone="amber" />
            <Kpi icon={CheckCircle2} label="Resolvidos" value={s.resolved} tone="emerald" hint={s.total ? `${Math.round((s.resolved / s.total) * 100)}% do total` : undefined} />
            <Kpi icon={AlertTriangle} label="Atrasados" value={s.overdue} tone="rose" hint="Abertos com o prazo vencido" />
            <Kpi icon={Clock} label="Tempo médio de resolução" value={fmtHours(s.avgResolutionHours)} tone="brand" />
            <Kpi icon={MessageSquareReply} label="Tempo médio de 1ª resposta" value={fmtHours(s.avgFirstResponseHours)} tone="violet" />
            <Kpi
              icon={ShieldCheck}
              label="SLA cumprido"
              value={s.slaPercent == null ? '—' : `${s.slaPercent.toFixed(0)}%`}
              tone={s.slaPercent == null ? 'brand' : s.slaPercent >= 90 ? 'emerald' : s.slaPercent >= 70 ? 'amber' : 'rose'}
              meter={s.slaPercent}
            />
            <Kpi
              icon={Star}
              label="Satisfação"
              value={s.satisfaction == null ? '—' : `${s.satisfaction.toFixed(1).replace('.', ',')} / 5`}
              tone="amber"
              hint={`${s.ratingsCount} ${s.ratingsCount === 1 ? 'avaliação' : 'avaliações'}`}
            />
          </section>

          {s.total === 0 ? (
            <Card>
              <EmptyState icon={<Inbox className="size-7" />} title="Nenhum chamado no período" description="Amplie o período ou remova filtros para ver os gráficos." />
            </Card>
          ) : (
            <>
              <ChartCard title="Abertos x resolvidos por dia" subtitle="Quantidade de chamados abertos e resolvidos em cada dia do período">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={days} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors[0]} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={colors[0]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors[2]} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={colors[2]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: EIXO, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fill: EIXO, fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTip />} cursor={{ ...TOOLTIP_CURSOR_LINHA, strokeDasharray: '4 4' }} />
                      <Legend content={<LegendRow />} />
                      <Area type="monotone" dataKey="abertos" name="Abertos" stroke={colors[0]} strokeWidth={2} fill="url(#gA)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
                      <Area type="monotone" dataKey="resolvidos" name="Resolvidos" stroke={colors[2]} strokeWidth={2} fill="url(#gR)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Por categoria">
                  <HBars data={s.byCategory} color={colors[0]} />
                </ChartCard>
                <ChartCard title="Por canal de abertura">
                  <Donut data={s.byChannel} colorOf={(l) => colors[CHANNEL_SLOT[l] ?? 4]} total={s.total} />
                </ChartCard>
                <ChartCard title="Por status">
                  <HBars data={s.byStatus} colorOf={(l) => STATUS_COR[l] ?? colors[0]} />
                </ChartCard>
                {multi && !current && s.bySector && (
                  <ChartCard title="Por equipe">
                    <HBars data={s.bySector} color={colors[2]} />
                  </ChartCard>
                )}
                <ChartCard title="Por setor do solicitante">
                  <HBars data={s.byDepartment} color={colors[6]} />
                </ChartCard>
              </div>

              <ChartCard title="Desempenho por técnico" subtitle="Chamados abertos no período, pelo responsável (ou por quem resolveu, quando ninguém foi atribuído)">
                <TechTable rows={s.byAssignee} color={colors[2]} />
              </ChartCard>
            </>
          )}
          <p className="no-print text-center text-xs text-slate-400">
            Os dados exportados seguem os mesmos filtros. ·{' '}
            <Link href="/chamados" className="hover:underline">
              Voltar à central de atendimento
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ───────── Peças ─────────

const TONES = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};
const METER = { brand: 'bg-brand-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500', violet: 'bg-violet-500' };

function Kpi({ icon: Icon, label, value, hint, tone, meter }: { icon: typeof Clock; label: string; value: React.ReactNode; hint?: string; tone: keyof typeof TONES; meter?: number | null }) {
  return (
    <Card className="print-break p-4">
      <div className="flex items-center gap-2.5">
        <span className={clsx('grid size-9 shrink-0 place-items-center rounded-lg', TONES[tone])}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {meter != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="meter" aria-valuenow={Math.round(meter)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className={clsx('h-full rounded-full', METER[tone])} style={{ width: `${Math.min(100, meter)}%` }} />
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="print-break p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      {label != null && <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="size-2.5 rounded-sm" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}: <b className="text-slate-900 tabular-nums dark:text-white">{p.value}</b>
        </p>
      ))}
    </div>
  );
}

function LegendRow({ payload }: any) {
  return (
    <ul className="mt-2 flex justify-center gap-4 text-xs text-slate-600 dark:text-slate-300">
      {payload?.map((p: any) => (
        <li key={p.value} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: p.color }} /> {p.value}
        </li>
      ))}
    </ul>
  );
}

function HBars({ data, color, colorOf }: { data: { label: string; value: number }[]; color?: string; colorOf?: (l: string) => string }) {
  const rows = data.slice(0, 10);
  if (!rows.length) return <p className="py-10 text-center text-sm text-slate-500">Sem dados</p>;
  return (
    <div style={{ height: Math.max(160, rows.length * 38 + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: EIXO, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={150} tick={{ fill: EIXO, fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
          <Tooltip content={<ChartTip />} cursor={TOOLTIP_CURSOR} />
          <Bar dataKey="value" name="Chamados" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fill: EIXO, fontSize: 12 }}>
            {rows.map((r) => (
              <Cell key={r.label} fill={colorOf ? colorOf(r.label) : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Donut({ data, colorOf, total }: { data: { label: string; value: number }[]; colorOf: (l: string) => string; total: number }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-56 w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.label} fill={colorOf(d.label)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums">{total}</p>
            <p className="text-xs text-slate-500">chamados</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-2 sm:w-1/2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: colorOf(d.label) }} aria-hidden />
            <span className="flex-1 text-slate-600 dark:text-slate-300">{d.label}</span>
            <b className="tabular-nums">{d.value}</b>
            <span className="w-12 text-right text-xs text-slate-500 tabular-nums">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TechTable({ rows, color }: { rows: ReportSummary['byAssignee']; color: string }) {
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase dark:border-slate-800">
            <th className="px-5 py-2.5 font-semibold">Técnico</th>
            <th className="px-3 py-2.5 text-right font-semibold">Chamados</th>
            <th className="px-3 py-2.5 text-right font-semibold">Resolvidos</th>
            <th className="px-3 py-2.5 font-semibold">Taxa de resolução</th>
            <th className="px-5 py-2.5 text-right font-semibold">Tempo médio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((r) => {
            const pct = r.total ? (r.resolvidos / r.total) * 100 : 0;
            return (
              <tr key={r.label}>
                <td className={clsx('px-5 py-2.5 font-medium', r.label === 'Sem responsável' && 'text-amber-700 dark:text-amber-300')}>{r.label}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.total}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.resolvidos}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums">{r.total ? `${pct.toFixed(0)}%` : '—'}</span>
                  </div>
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums">{fmtHours(r.mediaHoras)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
