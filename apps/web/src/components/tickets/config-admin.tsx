'use client';

import { ArrowDown, ArrowUp, Check, CheckCircle2, Lightbulb, Mail, MessageCircle, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import { IconPicker } from '@/components/icons/icon-picker';
import { Badge, Button, Card, clsx, EmptyState, Field, Input, Loading, Select, Textarea, useToast } from '@/components/ui';
import { HistoryButton } from '@/components/versions/history';
import { api, ApiError } from '@/lib/api';
import { TICKET_PRIORITY } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { fillTeam, reloadTicketsConfig, SECTOR_COLORS, sectorTone, tipsFor, type KeywordTip, type SectorConfig, type TicketsConfig } from './config';
import { fmtHours, PRIORITY_ICON } from './meta';
import { SECTORS } from './sectors';
import type { TicketPriority, TicketSector } from './types';

export type ConfigTab = 'setores' | 'prioridades' | 'dicas' | 'canais';

const PRIORITIES: TicketPriority[] = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
const SECTOR_NAME: Record<TicketSector, string> = { TI: 'TI', INFRAESTRUTURA: 'Infraestrutura de TI', MANUTENCAO: 'Manutenção', COMUNICACAO: 'Comunicação' };

interface Loaded {
  value: TicketsConfig;
  defaults: TicketsConfig;
  customized: boolean;
}

// listas editadas em texto: uma dica por linha / palavras separadas por vírgula (split/join sem perdas enquanto digita)
const lines = (v: string[]) => v.join('\n');
const fromLines = (v: string) => v.split('\n');
const clean = (v: string[]) => v.map((x) => x.trim()).filter(Boolean);

let seq = 0;
const newId = () => `regra-${Date.now().toString(36)}-${++seq}`;

/** Tela de edição da configuração dos chamados (abas Setores, Prioridades e SLA, Dicas e Canais). Perfil TI. */
export function ChamadosConfigAdmin({ tab }: { tab: ConfigTab }) {
  const { data, loading, error, reload } = useApi<Loaded>('/admin/chamados-config');
  const toast = useToast();
  const [form, setForm] = useState<TicketsConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [sector, setSector] = useState<TicketSector>('TI');
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (data) setForm(structuredClone(data.value));
  }, [data]);

  const dirty = useMemo(() => !!form && !!data && JSON.stringify(form) !== JSON.stringify(data.value), [form, data]);

  if (loading && !data) return <Loading />;
  if (error && !data)
    return (
      <Card>
        <EmptyState title="Não foi possível carregar a configuração" description={error} action={<Button onClick={reload}>Tentar novamente</Button>} />
      </Card>
    );
  if (!form || !data) return null;

  const patch = (fn: (f: TicketsConfig) => void) =>
    setForm((f) => {
      if (!f) return f;
      const next = structuredClone(f);
      fn(next);
      return next;
    });
  const setSectorField = <K extends keyof SectorConfig>(k: K, v: SectorConfig[K]) => patch((f) => void (f.sectors[sector][k] = v));

  const save = async () => {
    setSaving(true);
    setProblems([]);
    try {
      const r = await api<Loaded>('/admin/chamados-config', { method: 'PUT', json: { value: form } });
      setForm(structuredClone(r.value));
      toast('Configuração dos chamados salva');
      await reloadTicketsConfig();
      reload();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : null;
      if (Array.isArray(body?.message)) setProblems(body.message);
      toast(e instanceof Error ? (Array.isArray(body?.message) ? 'Corrija os campos indicados.' : e.message) : 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Volta só a parte desta aba ao padrão (ainda precisa salvar). */
  const resetTab = () =>
    patch((f) => {
      const d = structuredClone(data.defaults);
      if (tab === 'setores') f.sectors[sector] = d.sectors[sector];
      if (tab === 'prioridades') {
        f.priorities = d.priorities;
        f.rules.slaFactor = d.rules.slaFactor;
        f.rules.defaultSlaHours = d.rules.defaultSlaHours;
      }
      if (tab === 'dicas') {
        f.keywordTips = d.keywordTips;
        f.noSectorTip = d.noSectorTip;
        f.alwaysTip = d.alwaysTip;
      }
      if (tab === 'canais') {
        f.channels = d.channels;
        f.success = d.success;
        f.rules.whatsappSector = d.rules.whatsappSector;
        f.rules.emailSector = d.rules.emailSector;
        f.rules.whatsappWindowDays = d.rules.whatsappWindowDays;
        f.rules.whatsappAskSector = d.rules.whatsappAskSector;
        f.rules.whatsappAskCategory = d.rules.whatsappAskCategory;
        f.rules.whatsappSectors = d.rules.whatsappSectors;
        f.rules.redirects = d.rules.redirects;
      }
    });

  const sc = form.sectors[sector];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-slate-500">
          {dirty ? <b className="text-amber-700 dark:text-amber-300">Há alterações não salvas.</b> : data.customized ? 'Configuração personalizada.' : 'Usando o padrão do sistema.'}
        </p>
        <HistoryButton entity="Setting" entityId="chamados" label="Configuração dos chamados" size="md" onRestored={() => (reload(), void reloadTicketsConfig())} />
        <Button variant="ghost" onClick={resetTab}>
          <RotateCcw className="size-4" /> {tab === 'setores' ? `Padrão de ${SECTOR_NAME[sector]}` : 'Padrão desta aba'}
        </Button>
        <Button variant="secondary" onClick={() => (setForm(structuredClone(data.value)), setProblems([]))} disabled={!dirty || saving}>
          Descartar
        </Button>
        <Button onClick={save} loading={saving} disabled={!dirty}>
          <Save className="size-4" /> Salvar
        </Button>
      </div>

      {problems.length > 0 && (
        <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-rose-800">
          <p className="font-semibold">Não foi possível salvar:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'setores' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Setor em edição">
              {SECTORS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={sector === s}
                  onClick={() => setSector(s)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-500',
                    sector === s ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400',
                  )}
                >
                  <DynamicIcon name={form.sectors[s].icon} image={form.sectors[s].image} className="size-4" />
                  {form.sectors[s].short || SECTOR_NAME[s]}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              As equipes são fixas (TI, Infraestrutura de TI, Manutenção e Comunicação); aqui você muda como cada uma aparece para os colaboradores. Os nomes também valem nas mensagens e no painel da TV.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" hint="Ex.: Tecnologia da Informação">
                <Input placeholder="Ex.: Tecnologia da Informação" value={sc.label} maxLength={60} onChange={(e) => setSectorField('label', e.target.value)} />
              </Field>
              <Field label="Nome curto" hint="Usado em selos e abas. Ex.: TI">
                <Input placeholder="Ex.: TI" value={sc.short} maxLength={30} onChange={(e) => setSectorField('short', e.target.value)} />
              </Field>
              <Field label="“Equipe de…”" hint="Usado em frases: “a equipe de TI já foi avisada”">
                <Input placeholder="Ex.: TI" value={sc.team} maxLength={60} onChange={(e) => setSectorField('team', e.target.value)} />
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Ícone</p>
                <div className="flex items-center gap-3">
                  <span className={clsx('grid size-11 place-items-center rounded-xl', sectorTone(sc.color))}>
                    <DynamicIcon name={sc.icon} image={sc.image} className="size-6" />
                  </span>
                  <Button type="button" variant="secondary" onClick={() => setPicker(true)}>
                    Trocar ícone
                  </Button>
                </div>
              </div>
            </div>
            <Field label="Descrição de ajuda" hint="Aparece no cartão da equipe, na abertura do chamado.">
              <Textarea placeholder="Ex.: Problemas com computador, impressora, rede ou sistemas" value={sc.help} maxLength={200} className="min-h-16" onChange={(e) => setSectorField('help', e.target.value)} />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Cor</legend>
              <div className="flex flex-wrap gap-2">
                {SECTOR_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSectorField('color', c.key)}
                    aria-pressed={sc.color === c.key}
                    title={c.label}
                    className={clsx('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition focus-visible:outline-2 focus-visible:outline-brand-500', c.tone, sc.color === c.key ? 'ring-2 ring-brand-600' : 'ring-transparent')}
                  >
                    {sc.color === c.key && <Check className="size-3" aria-hidden />}
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Acompanha (só leitura)</legend>
              <p className="mb-2 text-xs text-slate-500">
                Quem acompanha vê os chamados e o planejamento das equipes marcadas, sem poder atender, alterar ou comentar. No painel de chamados, aparece também a aba com as filas juntas.
              </p>
              <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label={`Quem de ${sc.short || SECTOR_NAME[sector]} acompanha`}>
                {(
                  [
                    ['equipe', `Toda a equipe de ${sc.short || SECTOR_NAME[sector]}`],
                    ['gestor', 'Só quem tem "Gestor da área" no perfil'],
                  ] as const
                ).map(([v, text]) => {
                  const on = (sc.acompanhaQuem ?? 'gestor') === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSectorField('acompanhaQuem', v)}
                      className={clsx(
                        'rounded-lg px-3 py-1.5 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-500',
                        on ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                      )}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {SECTORS.filter((o) => o !== sector).map((o) => {
                  const on = (sc.acompanha ?? []).includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSectorField('acompanha', on ? (sc.acompanha ?? []).filter((x) => x !== o) : SECTORS.filter((x) => x === o || (sc.acompanha ?? []).includes(x)))}
                      className={clsx(
                        'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 transition focus-visible:outline-2 focus-visible:outline-brand-500',
                        on ? 'bg-brand-50 text-brand-700 ring-brand-500 dark:bg-brand-900/40 dark:text-brand-200' : 'text-slate-600 ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800',
                      )}
                    >
                      {on && <Check className="size-3.5" aria-hidden />}
                      {form.sectors[o].short || SECTOR_NAME[o]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Dicas para agilizar" hint="Uma dica por linha (até 8). Valem quando a categoria não tem dicas próprias nem dicas por palavra-chave.">
              <Textarea placeholder="Ex.: Informe o número do patrimônio do equipamento" value={lines(sc.tips)} rows={4} onChange={(e) => setSectorField('tips', fromLines(e.target.value))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Exemplo de título" hint="Aparece abaixo do campo Título.">
                <Input placeholder="Ex.: Impressora da recepção não imprime" value={sc.titleExample} maxLength={120} onChange={(e) => setSectorField('titleExample', e.target.value)} />
              </Field>
              <Field label="Texto de exemplo da descrição" hint="Aparece dentro do campo Descrição, antes de digitar.">
                <Textarea placeholder="Ex.: Conte o que aconteceu, desde quando e em qual setor" value={sc.descriptionPlaceholder} maxLength={300} className="min-h-16" onChange={(e) => setSectorField('descriptionPlaceholder', e.target.value)} />
              </Field>
            </div>
          </Card>

          <aside className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Prévia</p>
            <div className="flex flex-col items-start gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <span className={clsx('grid size-14 place-items-center rounded-2xl', sectorTone(sc.color))}>
                <DynamicIcon name={sc.icon} image={sc.image} className="size-7" />
              </span>
              <span>
                <span className="block text-base font-semibold">{sc.label || '(sem nome)'}</span>
                <span className="mt-1 block text-sm text-slate-500">{sc.help}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              Selo:
              <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', sectorTone(sc.color))}>
                <DynamicIcon name={sc.icon} image={sc.image} className="size-3" /> {sc.short}
              </span>
            </div>
            <Card className="p-4 text-sm">
              <p className="text-slate-500">Mensagem de sucesso:</p>
              <p className="mt-1 font-medium">{fillTeam(form.success.subtitle || 'A {equipe} já foi avisada.', sc.team)}</p>
            </Card>
            <TipsPreview tips={[...clean(sc.tips), ...(form.alwaysTip.trim() ? [form.alwaysTip.trim()] : [])]} />
          </aside>
          <IconPicker
            open={picker}
            value={{ icon: sc.icon, imageId: sc.imageId, image: sc.image ?? null }}
            onClose={() => setPicker(false)}
            onChange={(v) => patch((f) => void Object.assign(f.sectors[sector], { icon: v.icon, imageId: v.imageId, image: v.image }))}
          />
        </div>
      )}

      {tab === 'prioridades' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="space-y-4 p-5">
            <p className="text-sm text-slate-500">
              O prazo (SLA) de um chamado é o prazo da categoria multiplicado pelo multiplicador da prioridade. Ex.: categoria de 8 h com multiplicador 0,5 = 4 h.
            </p>
            {PRIORITIES.map((p) => {
              const Icon = PRIORITY_ICON[p];
              return (
                <fieldset key={p} className="grid gap-3 rounded-2xl p-4 ring-1 ring-slate-200 sm:grid-cols-[160px_1fr_140px] dark:ring-slate-800">
                  <legend className="sr-only">Prioridade {TICKET_PRIORITY[p].label}</legend>
                  <Field label="Rótulo">
                    <div className="flex items-center gap-2">
                      <span className={clsx('grid size-8 shrink-0 place-items-center rounded-lg', TICKET_PRIORITY[p].color)}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <Input placeholder="Ex.: Urgente" value={form.priorities[p].label} maxLength={30} onChange={(e) => patch((f) => void (f.priorities[p].label = e.target.value))} aria-label={`Rótulo da prioridade ${TICKET_PRIORITY[p].label}`} />
                    </div>
                  </Field>
                  <Field label="Explicação" hint="Ajuda o colaborador a escolher.">
                    <Input placeholder="Ex.: Atendimento ao paciente parado" value={form.priorities[p].help} maxLength={200} onChange={(e) => patch((f) => void (f.priorities[p].help = e.target.value))} aria-label={`Explicação da prioridade ${TICKET_PRIORITY[p].label}`} />
                  </Field>
                  <Field label="Multiplicador do SLA" hint="de 0,05 a 10">
                    <Input
                      placeholder="Ex.: 0,5"
                      type="number"
                      min={0.05}
                      max={10}
                      step={0.05}
                      value={Number.isFinite(form.rules.slaFactor[p]) ? form.rules.slaFactor[p] : ''}
                      onChange={(e) => patch((f) => void (f.rules.slaFactor[p] = e.target.value === '' ? NaN : Number(e.target.value)))}
                      aria-label={`Multiplicador do SLA da prioridade ${TICKET_PRIORITY[p].label}`}
                    />
                  </Field>
                </fieldset>
              );
            })}
            <Field label="SLA padrão para chamado sem categoria (horas)" hint="Usado quando a equipe não tem categorias ou o chamado chega sem categoria (WhatsApp, e-mail). De 1 a 720.">
              <Input
                placeholder="Ex.: 24"
                type="number"
                min={1}
                max={720}
                className="max-w-40"
                value={Number.isFinite(form.rules.defaultSlaHours) ? form.rules.defaultSlaHours : ''}
                onChange={(e) => patch((f) => void (f.rules.defaultSlaHours = e.target.value === '' ? NaN : Number(e.target.value)))}
              />
            </Field>
            <p className="text-xs text-slate-500">A mudança vale para chamados abertos ou reclassificados a partir de agora; prazos já calculados não mudam.</p>
          </Card>
          <aside className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Prévia do prazo</p>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Prioridade</th>
                    <th className="px-3 py-2 text-right font-medium">Categoria 8 h</th>
                    <th className="px-3 py-2 text-right font-medium">Sem categoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {PRIORITIES.map((p) => {
                    const f = form.rules.slaFactor[p];
                    const ok = Number.isFinite(f) && f > 0;
                    return (
                      <tr key={p}>
                        <td className="px-3 py-2">{form.priorities[p].label || TICKET_PRIORITY[p].label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{ok ? fmtHours(8 * f) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{ok && Number.isFinite(form.rules.defaultSlaHours) ? fmtHours(form.rules.defaultSlaHours * f) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </aside>
        </div>
      )}

      {tab === 'dicas' && <TipsEditor form={form} patch={patch} />}

      {tab === 'canais' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card className="space-y-4 p-5">
              <h3 className="font-semibold">WhatsApp e e-mail do suporte</h3>
              <p className="text-sm text-slate-500">Os números e o e-mail ficam em Configurações › Suporte. Aqui você escolhe para qual equipe vão os chamados que chegam por esses canais.</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={form.rules.whatsappAskSector ? 'WhatsApp sem a pergunta da área' : 'Chamados do WhatsApp vão para'} hint={form.rules.whatsappAskSector ? 'Usado só se a pergunta for desligada abaixo.' : undefined}>
                  <Select value={form.rules.whatsappSector} onChange={(e) => patch((f) => void (f.rules.whatsappSector = e.target.value as TicketSector))}>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {form.sectors[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Chamados do e-mail vão para">
                  <Select value={form.rules.emailSector} onChange={(e) => patch((f) => void (f.rules.emailSector = e.target.value as TicketSector))}>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {form.sectors[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Continuação no WhatsApp (dias)" hint="Mensagem nova entra no chamado aberto destes últimos dias. 0 = sempre abre outro.">
                  <Input
                    placeholder="Ex.: 3"
                    type="number"
                    min={0}
                    max={365}
                    value={Number.isFinite(form.rules.whatsappWindowDays) ? form.rules.whatsappWindowDays : ''}
                    onChange={(e) => patch((f) => void (f.rules.whatsappWindowDays = e.target.value === '' ? NaN : Number(e.target.value)))}
                  />
                </Field>
              </div>
            </Card>
            <Card className="space-y-4 p-5">
              <h3 className="font-semibold">Perguntas no WhatsApp</h3>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-600" checked={form.rules.whatsappAskSector} onChange={(e) => patch((f) => void (f.rules.whatsappAskSector = e.target.checked))} />
                <span>
                  <b>Perguntar para qual área é o chamado</b>
                  <span className="block text-slate-500">Depois que a pessoa descreve o problema, o WhatsApp mostra a lista das áreas para ela tocar (ou responder com o número). O texto das mensagens fica em Painel › Mensagens automáticas.</span>
                </span>
              </label>
              {form.rules.whatsappAskSector && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Áreas no menu, nesta ordem</p>
                  <ol className="space-y-1.5">
                    {form.rules.whatsappSectors.map((s, i) => (
                      <li key={s} className="flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-slate-200 dark:ring-slate-800">
                        <span className="w-5 text-sm font-semibold text-slate-500">{i + 1}.</span>
                        <span className="min-w-0 flex-1 break-words text-sm">{form.sectors[s].label}</span>
                        <Button size="sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => patch((f) => void f.rules.whatsappSectors.splice(i - 1, 0, ...f.rules.whatsappSectors.splice(i, 1)))}>
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label="Descer" disabled={i === form.rules.whatsappSectors.length - 1} onClick={() => patch((f) => void f.rules.whatsappSectors.splice(i + 1, 0, ...f.rules.whatsappSectors.splice(i, 1)))}>
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label="Tirar do menu" disabled={form.rules.whatsappSectors.length === 1} onClick={() => patch((f) => void f.rules.whatsappSectors.splice(i, 1))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ol>
                  {SECTORS.some((s) => !form.rules.whatsappSectors.includes(s)) && (
                    <div className="flex flex-wrap gap-2">
                      {SECTORS.filter((s) => !form.rules.whatsappSectors.includes(s)).map((s) => (
                        <Button key={s} size="sm" variant="secondary" onClick={() => patch((f) => void f.rules.whatsappSectors.push(s))}>
                          <Plus className="size-4" /> {form.sectors[s].label}
                        </Button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Com uma área só, a pergunta não é feita.</p>
                </div>
              )}
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-600" checked={form.rules.whatsappAskCategory} onChange={(e) => patch((f) => void (f.rules.whatsappAskCategory = e.target.checked))} />
                <span>
                  <b>Perguntar a categoria</b>
                  <span className="block text-slate-500">
                    Depois da área, mostra as categorias ativas dela, do jeito que estão na aba Categorias desta tela: o que você criar ou desativar lá vale na hora no WhatsApp. A lista mostra 8 por vez, com “Mais opções” e “Não sei / Outro”.
                  </span>
                </span>
              </label>
            </Card>
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto font-semibold">Encaminhamento automático</h3>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={form.rules.redirects.length >= 10}
                  onClick={() => patch((f) => void f.rules.redirects.push({ id: newId(), from: 'TI', to: 'INFRAESTRUTURA', words: [''] }))}
                >
                  <Plus className="size-4" /> Nova regra
                </Button>
              </div>
              <p className="text-sm text-slate-500">
                Vale para os chamados que chegam pelo WhatsApp e pelo e-mail. Se o texto tiver uma das palavras, o chamado vai para a outra equipe e ganha uma nota interna dizendo qual palavra causou a troca. Acentos e maiúsculas
                não importam; só palavras inteiras contam.
              </p>
              {form.rules.redirects.length === 0 && <p className="text-sm text-slate-500">Nenhuma regra: o chamado fica na área escolhida.</p>}
              {form.rules.redirects.map((r, i) => (
                <div key={r.id} className="space-y-3 rounded-xl p-3 ring-1 ring-slate-200 dark:ring-slate-800">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Chamado aberto para">
                      <Select value={r.from} onChange={(e) => patch((f) => void (f.rules.redirects[i].from = e.target.value as TicketSector))}>
                        {SECTORS.map((s) => (
                          <option key={s} value={s}>
                            {form.sectors[s].label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Vai para">
                      <Select value={r.to} onChange={(e) => patch((f) => void (f.rules.redirects[i].to = e.target.value as TicketSector))}>
                        {SECTORS.map((s) => (
                          <option key={s} value={s}>
                            {form.sectors[s].label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button variant="ghost" aria-label="Excluir regra" onClick={() => patch((f) => void f.rules.redirects.splice(i, 1))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Field label="Palavras ou expressões" hint="Separadas por vírgula. Evite palavras que aparecem em quase todo chamado, como “ramal” sozinho (as pessoas escrevem o ramal para contato).">
                    <Textarea
                      placeholder="Ex.: ponto de rede, cabeamento, cftv, câmera de segurança"
                      className="min-h-20"
                      value={r.words.join(',')}
                      onChange={(e) => patch((f) => void (f.rules.redirects[i].words = e.target.value.split(',')))}
                    />
                  </Field>
                </div>
              ))}
            </Card>
            <Card className="space-y-4 p-5">
              <h3 className="font-semibold">Quadro “Outras formas de falar com…”</h3>
              <p className="text-sm text-slate-500">Aparece em Meus chamados e na abertura de chamado.</p>
              <Field label="Título">
                <Input placeholder="Ex.: Outras formas de falar com a TI" value={form.channels.title} maxLength={80} onChange={(e) => patch((f) => void (f.channels.title = e.target.value))} />
              </Field>
              <Field label="Texto">
                <Textarea placeholder="Ex.: Em caso de urgência, ligue no ramal 2045" value={form.channels.text} maxLength={300} className="min-h-16" onChange={(e) => patch((f) => void (f.channels.text = e.target.value))} />
              </Field>
              <Field label="Assunto do e-mail" hint="Já vem preenchido quando a pessoa clica no e-mail do suporte.">
                <Input placeholder="Ex.: Solicitação de suporte" value={form.channels.mailSubject} maxLength={120} onChange={(e) => patch((f) => void (f.channels.mailSubject = e.target.value))} />
              </Field>
            </Card>
            <Card className="space-y-4 p-5">
              <h3 className="font-semibold">Tela “Chamado aberto”</h3>
              <p className="text-sm text-slate-500">
                Use <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{'{equipe}'}</code> para o “equipe de…” do setor do chamado.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Título">
                  <Input placeholder="Ex.: Chamado aberto!" value={form.success.title} maxLength={80} onChange={(e) => patch((f) => void (f.success.title = e.target.value))} />
                </Field>
                <Field label="Subtítulo">
                  <Input placeholder="Ex.: A equipe já foi avisada e vai atender em breve" value={form.success.subtitle} maxLength={200} onChange={(e) => patch((f) => void (f.success.subtitle = e.target.value))} />
                </Field>
                <Field label="Rótulo do número">
                  <Input placeholder="Ex.: Número do chamado" value={form.success.numberLabel} maxLength={40} onChange={(e) => patch((f) => void (f.success.numberLabel = e.target.value))} />
                </Field>
              </div>
              <Field label="Orientação">
                <Textarea placeholder="Ex.: Acompanhe o andamento em Meus chamados" value={form.success.note} maxLength={300} className="min-h-16" onChange={(e) => patch((f) => void (f.success.note = e.target.value))} />
              </Field>
            </Card>
          </div>
          <aside className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Prévia</p>
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-5 py-4 text-white">
                <p className="font-semibold">{form.channels.title || '(sem título)'}</p>
                {form.channels.text && <p className="mt-0.5 text-xs text-white/80">{form.channels.text}</p>}
              </div>
              <div className="space-y-2 p-4 text-sm">
                <p className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-emerald-600" aria-hidden /> WhatsApp →{' '}
                  <b>{form.rules.whatsappAskSector && form.rules.whatsappSectors.length > 1 ? 'pergunta a área' : form.sectors[form.rules.whatsappAskSector ? (form.rules.whatsappSectors[0] ?? form.rules.whatsappSector) : form.rules.whatsappSector].short}</b>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="size-4 text-sky-600" aria-hidden /> E-mail → <b>{form.sectors[form.rules.emailSector].short}</b>
                  {form.channels.mailSubject && <span className="truncate text-xs text-slate-500">assunto “{form.channels.mailSubject}”</span>}
                </p>
              </div>
            </Card>
            <Card className="overflow-hidden text-center">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-6 text-white">
                <CheckCircle2 className="mx-auto size-8" aria-hidden />
                <p className="mt-2 text-lg font-bold">{form.success.title || '(sem título)'}</p>
                {form.success.subtitle && <p className="text-sm text-white/85">{fillTeam(form.success.subtitle, form.sectors.TI.team)}</p>}
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500">{form.success.numberLabel}</p>
                <p className="font-mono text-3xl font-bold text-brand-700 dark:text-brand-300">#1234</p>
                {form.success.note && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{fillTeam(form.success.note, form.sectors.TI.team)}</p>}
              </div>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

function TipsPreview({ tips }: { tips: string[] }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="size-4 text-amber-500" aria-hidden /> Dicas para agilizar
      </p>
      {tips.length ? (
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
          {tips.map((t, i) => (
            <li key={`${i}-${t}`} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Nenhuma dica.</p>
      )}
    </Card>
  );
}

function TipsEditor({ form, patch }: { form: TicketsConfig; patch: (fn: (f: TicketsConfig) => void) => void }) {
  const [testSector, setTestSector] = useState<TicketSector>('TI');
  const [testName, setTestName] = useState('Impressora');
  const move = (i: number, d: -1 | 1) =>
    patch((f) => {
      const j = i + d;
      if (j < 0 || j >= f.keywordTips.length) return;
      [f.keywordTips[i], f.keywordTips[j]] = [f.keywordTips[j]!, f.keywordTips[i]!];
    });
  const setRule = (i: number, fn: (k: KeywordTip) => void) => patch((f) => fn(f.keywordTips[i]!));

  // prévia com os valores digitados (limpos como o servidor faz ao salvar)
  const preview = useMemo(() => {
    const cfg = {
      ...form,
      keywordTips: form.keywordTips.map((k) => ({ ...k, words: clean(k.words).map((w) => w.toLowerCase()), tips: clean(k.tips) })),
      sectors: Object.fromEntries(SECTORS.map((s) => [s, { ...form.sectors[s], tips: clean(form.sectors[s].tips) }])) as TicketsConfig['sectors'],
      categories: {},
    };
    return [...tipsFor(cfg, testSector, testName.trim() ? { id: '', name: testName } : null), ...(form.alwaysTip.trim() ? [form.alwaysTip.trim()] : [])];
  }, [form, testSector, testName]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <h3 className="font-semibold">Dicas gerais</h3>
          <p className="text-sm text-slate-500">
            Ordem usada no formulário: dicas próprias da categoria (editar categoria, na aba Categorias) → primeira dica por palavra-chave que combinar com o nome da categoria → dicas do setor (aba Setores).
          </p>
          <Field label="Antes de escolher a equipe">
            <Input placeholder="Ex.: Escolha a equipe que vai resolver o problema" value={form.noSectorTip} maxLength={200} onChange={(e) => patch((f) => void (f.noSectorTip = e.target.value))} />
          </Field>
          <Field label="Dica que aparece sempre (no fim da lista)" hint="Deixe em branco para não mostrar.">
            <Input placeholder="Ex.: Informe seu ramal para retorno" value={form.alwaysTip} maxLength={200} onChange={(e) => patch((f) => void (f.alwaysTip = e.target.value))} />
          </Field>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="mr-auto font-semibold">Dicas por palavra-chave</h3>
            <Button
              size="sm"
              variant="secondary"
              disabled={form.keywordTips.length >= 40}
              onClick={() => patch((f) => void f.keywordTips.push({ id: newId(), sectors: [], words: [''], tips: [''] }))}
            >
              <Plus className="size-4" /> Nova regra
            </Button>
          </div>
          {!form.keywordTips.length ? (
            <EmptyState title="Nenhuma regra" description="Ex.: quando a categoria tiver “impressora” no nome, mostrar “Informe a etiqueta da impressora”." />
          ) : (
            <ol className="space-y-3">
              {form.keywordTips.map((k, i) => (
                <li key={k.id} className="rounded-2xl p-4 ring-1 ring-slate-200 dark:ring-slate-800">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Regra {i + 1}</Badge>
                    <span className="flex-1" />
                    <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir regra ${i + 1}`}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === form.keywordTips.length - 1} aria-label={`Descer regra ${i + 1}`}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => patch((f) => void f.keywordTips.splice(i, 1))} aria-label={`Excluir regra ${i + 1}`}>
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Palavras no nome da categoria" hint="Separadas por vírgula. Ex.: senha, acesso">
                      <Input placeholder="Ex.: senha, acesso, login" value={k.words.join(',')} onChange={(e) => setRule(i, (r) => void (r.words = e.target.value.split(',')))} />
                    </Field>
                    <fieldset>
                      <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Vale para</legend>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {SECTORS.map((s) => (
                          <label key={s} className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              className="size-4 accent-brand-600"
                              checked={k.sectors.includes(s)}
                              onChange={(e) => setRule(i, (r) => void (r.sectors = e.target.checked ? [...r.sectors, s] : r.sectors.filter((x) => x !== s)))}
                            />
                            {form.sectors[s].short}
                          </label>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Nenhum marcado = todas as equipes.</p>
                    </fieldset>
                  </div>
                  <Field label="Dicas" hint="Uma por linha (até 8)." className="mt-3">
                    <Textarea placeholder="Ex.: Informe o usuário que está sem acesso" value={lines(k.tips)} rows={3} onChange={(e) => setRule(i, (r) => void (r.tips = fromLines(e.target.value)))} />
                  </Field>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
      <aside className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Teste as dicas</p>
        <Card className="space-y-3 p-4">
          <Field label="Equipe">
            <Select value={testSector} onChange={(e) => setTestSector(e.target.value as TicketSector)}>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {form.sectors[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nome de uma categoria">
            <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Ex.: Acesso e senhas" />
          </Field>
        </Card>
        <TipsPreview tips={preview} />
      </aside>
    </div>
  );
}
