'use client';

import { BarChart3, Clock, Headset, Lightbulb, Pencil, Plus, Radio, Settings2, SignalHigh, Tags, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { RequireAuth } from '@/components/require-auth';
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Switch, Table, Textarea, clsx, useConfirm, useToast } from '@/components/ui';
import { IconButton, StatusBadge } from '@/components/admin/common';
import { TicketCategory } from '@/components/admin/types';
import { HistoryButton } from '@/components/versions/history';
import { SECTOR_LABEL, SECTOR_SHORT, SectorBadge, SectorTabs, TICKET_STAFF_ROLES, useStaffSectors } from '@/components/tickets/sectors';
import type { TicketSector } from '@/components/tickets/types';
import { DynamicIcon } from '@/components/icons/dynamic-icon';
import { IconPicker } from '@/components/icons/icon-picker';
import { ChamadosConfigAdmin, type ConfigTab } from '@/components/tickets/config-admin';
import { reloadTicketsConfig } from '@/components/tickets/config';
import { categoryIcon } from '@/components/tickets/meta';
import { useAuth } from '@/lib/auth';

/** Categoria com o ícone e as dicas configurados (guardados à parte, no Setting chamadosCategorias). */
type Category = TicketCategory & { icon?: string | null; imageId?: string | null; image?: string | null; tips?: string[] };

const SECTOR_KEY = 'nr-chamados-config-setor';
const EXAMPLES: Record<TicketSector, string> = {
  TI: 'Crie categorias como Impressoras / Scanners, Telefonia, Usuários…',
  INFRAESTRUTURA: 'Crie categorias como Rede / Internet, Wi-Fi, Servidores…',
  MANUTENCAO: 'Crie categorias como Elétrica, Hidráulica, Ar Condicionado…',
  COMUNICACAO: 'Crie categorias como Comunicação / Marketing…',
};

interface Draft {
  id?: string;
  name: string;
  description: string;
  slaHours: string;
  active: boolean;
  icon: string | null;
  imageId: string | null;
  image: string | null;
  tips: string;
}

const SLA_PRESETS = [2, 4, 8, 24, 48, 72, 120, 168];

function fmtSla(h: number) {
  if (h < 24) return `${h} h`;
  if (h === 168) return '1 semana';
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d} d ${r} h` : `${d} dia${d > 1 ? 's' : ''}`;
}

function slaTone(h: number) {
  if (h <= 4) return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
  if (h <= 8) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (h <= 24) return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function CategoriesAdmin() {
  const sectors = useStaffSectors();
  const [picked, setPicked] = useState<TicketSector | ''>('');
  const sector: TicketSector | undefined = picked && sectors.includes(picked) ? picked : sectors[0];
  useEffect(() => {
    try {
      const s = localStorage.getItem(SECTOR_KEY) as TicketSector | null;
      if (s && sectors.includes(s)) setPicked(s);
    } catch {}
  }, [sectors]);
  const pick = (v: TicketSector | '') => {
    if (!v) return;
    setPicked(v);
    try {
      localStorage.setItem(SECTOR_KEY, v);
    } catch {}
  };
  const { data, loading, error, reload } = useApi<Category[]>(sector ? `/tickets/admin/categories?setor=${sector}` : null);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);
  const [removing, setRemoving] = useState<{ cat: Category; to: string } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const inactive = data?.filter((c) => !c.active).length ?? 0;
  const rows = showInactive ? data : data?.filter((c) => c.active);

  const sla = draft ? Number(draft.slaHours) : 0;
  const errs = draft
    ? {
        name: !draft.name.trim() ? 'Informe o nome' : null,
        sla: !Number.isInteger(sla) || sla < 1 || sla > 720 ? 'Informe de 1 a 720 horas' : null,
      }
    : { name: null, sla: null };

  const save = async () => {
    if (!draft) return;
    setTried(true);
    if (errs.name || errs.sla) return;
    setSaving(true);
    try {
      const tips = draft.tips.split('\n').map((t) => t.trim()).filter(Boolean);
      if (tips.length > 8) {
        setSaving(false);
        return toast('Use no máximo 8 dicas.', 'error');
      }
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        slaHours: sla,
        active: draft.active,
        icon: draft.icon,
        imageId: draft.imageId,
        tips,
      };
      if (draft.id) await api(`/tickets/admin/categories/${draft.id}`, { method: 'PATCH', json: body });
      else await api('/tickets/admin/categories', { method: 'POST', json: { ...body, sector } });
      toast(draft.id ? 'Categoria atualizada' : 'Categoria criada');
      setDraft(null);
      reload();
      void reloadTicketsConfig();
    } catch (e: any) {
      toast(e.status >= 500 ? 'Não foi possível salvar. Verifique se já existe uma categoria com esse nome.' : e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Category) => {
    try {
      await api(`/tickets/admin/categories/${c.id}`, { method: 'PATCH', json: { name: c.name, description: c.description ?? undefined, slaHours: c.slaHours, active: !c.active } });
      toast(c.active ? 'Categoria desativada' : 'Categoria ativada');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const remove = async (c: Category) => {
    // em uso: pergunta para onde vão os chamados (ou só desativa)
    if (c._count?.tickets) return setRemoving({ cat: c, to: '' });
    if (!(await confirm(`Excluir a categoria "${c.name}"? Esta ação não pode ser desfeita.`))) return;
    await doRemove(c, '');
  };

  const doRemove = async (c: Category, to: string) => {
    setSaving(true);
    try {
      await api(`/tickets/admin/categories/${c.id}${to ? `?moverPara=${to}` : ''}`, { method: 'DELETE' });
      toast(c._count?.tickets && !to ? 'Categoria desativada' : 'Categoria excluída');
      setRemoving(null);
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const open = (c?: Category) => {
    setTried(false);
    setDraft(
      c
        ? { id: c.id, name: c.name, description: c.description ?? '', slaHours: String(c.slaHours), active: c.active, icon: c.icon ?? null, imageId: c.imageId ?? null, image: c.image ?? null, tips: (c.tips ?? []).join('\n') }
        : { name: '', description: '', slaHours: '24', active: true, icon: null, imageId: null, image: null, tips: '' },
    );
  };
  const SuggestedIcon = categoryIcon(draft?.name);

  return (
    <>
      <PageHeader
        icon={<Tags className="size-5" />}
        title={sector && sectors.length > 1 ? `Categorias e SLA · ${SECTOR_SHORT[sector]}` : 'Categorias e SLA'}
        description={`Tipos de chamado${sector ? ` de ${SECTOR_LABEL[sector]}` : ''} e o prazo de atendimento (SLA) de cada um. O prazo é calculado na abertura do chamado.`}
        actions={
          <>
            <HistoryButton entity="TicketCategory" label="Categorias" size="md" onRestored={reload} />
            <Link href="/chamados">
              <Button variant="secondary">
                <Headset className="size-4" /> Atendimento
              </Button>
            </Link>
            <Link href={sector ? `/chamados/relatorios?setor=${sector.toLowerCase()}` : '/chamados/relatorios'}>
              <Button variant="secondary">
                <BarChart3 className="size-4" /> Relatórios
              </Button>
            </Link>
            <Button onClick={() => open()} disabled={!sector}>
              <Plus className="size-4" /> Nova categoria
            </Button>
          </>
        }
      />

      {sector && sectors.length > 1 && (
        <div className="mb-4">
          <SectorTabs sectors={sectors} value={sector} onChange={pick} allowAll={false} label="Setor das categorias" className="w-fit max-w-full" />
        </div>
      )}

      {!sector ? (
        <Card>
          <EmptyState icon={<Tags className="size-7" />} title="Sem acesso" description="Seu perfil não atende nenhuma fila de chamados." />
        </Card>
      ) : loading && !data ? (
        <Loading />
      ) : error ? (
        <Card>
          <EmptyState title="Não foi possível carregar as categorias" description={error} action={<Button onClick={reload}>Tentar novamente</Button>} />
        </Card>
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<Tags className="size-7" />} title="Nenhuma categoria" description={EXAMPLES[sector]} action={<Button onClick={() => open()}>Criar categoria</Button>} />
        </Card>
      ) : (
        <Card>
          <Table head={['Categoria', 'SLA', 'Chamados', 'Status', '']}>
            {rows!.map((c) => (
              <tr key={c.id} className={clsx('hover:bg-slate-50 dark:hover:bg-slate-800/40', !c.active && 'opacity-60')}>
                <td className="px-4 py-3">
                  <button onClick={() => open(c)} className="flex max-w-full min-w-0 items-start gap-2.5 text-left">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {c.icon || c.image ? <DynamicIcon name={c.icon} image={c.image} className="size-4" /> : (() => { const I = categoryIcon(c.name); return <I className="size-4" aria-hidden />; })()}
                    </span>
                    <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere] hover:text-brand-600">{c.name}</span>
                    {c.description && <span className="block max-w-full truncate sm:max-w-md text-xs text-slate-500">{c.description}</span>}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Badge className={slaTone(c.slaHours)}>
                    <Clock className="size-3" /> {fmtSla(c.slaHours)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold tabular-nums">{c._count?.tickets ?? 0}</span>
                  <span className="ml-1 text-xs text-slate-500">chamado{(c._count?.tickets ?? 0) === 1 ? '' : 's'}</span>
                </td>
                <td className="px-4 py-3">
                  <Switch checked={c.active} onChange={() => toggle(c)} label={c.active ? 'Ativa' : 'Inativa'} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <IconButton label={`Editar ${c.name}`} onClick={() => open(c)}>
                      <Pencil />
                    </IconButton>
                    <IconButton label={`Excluir ${c.name}`} tone="danger" onClick={() => remove(c)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800">
            Categorias inativas não aparecem para quem abre chamados, mas continuam nos chamados antigos e nos relatórios.
            {inactive > 0 && (
              <button className="ml-2 font-medium text-brand-600 hover:underline" onClick={() => setShowInactive((v) => !v)}>
                {showInactive ? 'Esconder inativas' : `Mostrar inativas (${inactive})`}
              </button>
            )}
          </p>
        </Card>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar categoria' : `Nova categoria${sector ? ` · ${SECTOR_SHORT[sector]}` : ''}`}
        footer={
          <>
            {draft?.id && <span className="mr-auto"><HistoryButton entity="TicketCategory" entityId={draft.id} size="md" onRestored={() => (setDraft(null), reload())} /></span>}
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Salvar
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            {sector && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                Setor: <SectorBadge sector={sector} short={false} />
              </p>
            )}
            <Field label="Nome" hint="O nome não pode repetir o de outra categoria, nem de outro setor." error={tried ? errs.name ?? undefined : undefined}>
              <Input placeholder="Ex.: Impressora" value={draft.name} maxLength={80} autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Descrição" hint="Opcional. Ajuda o colaborador a escolher a categoria certa.">
              <Textarea placeholder="Ex.: Impressora não imprime, papel enroscado ou sem toner" value={draft.description} maxLength={300} className="min-h-16" onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="Prazo de atendimento (SLA) em horas" error={tried ? errs.sla ?? undefined : undefined} hint={!errs.sla ? `= ${fmtSla(sla)} corridos a partir da abertura` : undefined}>
              <Input placeholder="Ex.: 8" type="number" min={1} max={720} value={draft.slaHours} onChange={(e) => setDraft({ ...draft, slaHours: e.target.value })} className="max-w-40" />
            </Field>
            <div className="flex flex-wrap gap-1.5" aria-label="Prazos comuns">
              {SLA_PRESETS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDraft({ ...draft, slaHours: String(h) })}
                  className={clsx('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition', sla === h ? 'bg-brand-700 text-white ring-brand-700' : 'ring-slate-300 hover:bg-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800')}
                >
                  {fmtSla(h)}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Ícone</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {draft.icon || draft.image ? <DynamicIcon name={draft.icon} image={draft.image} className="size-6" /> : <SuggestedIcon className="size-6" aria-hidden />}
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => setPicker(true)}>
                  Escolher ícone
                </Button>
                {(draft.icon || draft.image) && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, icon: null, imageId: null, image: null })}>
                    Usar o sugerido pelo nome
                  </Button>
                )}
              </div>
              {!draft.icon && !draft.image && <p className="mt-1 text-xs text-slate-500">Sem escolha, o ícone é sugerido pelo nome da categoria.</p>}
            </div>
            <Field label="Dicas para agilizar" hint="Opcional. Uma por linha (até 8). Substituem as dicas do setor quando esta categoria é escolhida.">
              <Textarea placeholder="Ex.: Informe o número do patrimônio da impressora" value={draft.tips} rows={3} onChange={(e) => setDraft({ ...draft, tips: e.target.value })} />
            </Field>
            <Switch checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Disponível para novos chamados" />
            {draft.id && !draft.active && <StatusBadge active={false} labels={['', 'Não aparecerá na abertura de chamados']} />}
          </div>
        )}
      </Modal>
      {draft && (
        <IconPicker
          open={picker}
          value={{ icon: draft.icon ?? 'circle-help', imageId: draft.imageId, image: draft.image }}
          onClose={() => setPicker(false)}
          onChange={(v) => setDraft((d) => (d ? { ...d, icon: v.icon, imageId: v.imageId, image: v.image } : d))}
        />
      )}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={removing ? `Excluir "${removing.cat.name}"` : ''}
        footer={
          removing && (
            <>
              <Button variant="secondary" className="mr-auto" onClick={() => doRemove(removing.cat, '')} disabled={saving || !removing.cat.active}>
                Só desativar
              </Button>
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => doRemove(removing.cat, removing.to)} disabled={saving || !removing.to}>
                <Trash2 className="size-4" /> Mover e excluir
              </Button>
            </>
          )
        }
      >
        {removing && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Esta categoria tem {removing.cat._count?.tickets} chamado(s). Para excluí-la, escolha a categoria que vai receber esses chamados. Se preferir guardar o histórico como está, use “Só desativar”.
            </p>
            <Field label="Mover os chamados para">
              <Select value={removing.to} onChange={(e) => setRemoving({ ...removing, to: e.target.value })}>
                <option value="">Ex.: Outros</option>
                {data
                  ?.filter((c) => c.id !== removing.cat.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.active ? '' : ' (inativa)'}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
        )}
      </Modal>
      {dialog}
    </>
  );
}

const TABS: { key: 'categorias' | ConfigTab; label: string; icon: React.ReactNode; config?: boolean }[] = [
  { key: 'categorias', label: 'Categorias', icon: <Tags className="size-4" /> },
  { key: 'setores', label: 'Setores', icon: <Users className="size-4" />, config: true },
  { key: 'prioridades', label: 'Prioridades e SLA', icon: <SignalHigh className="size-4" />, config: true },
  { key: 'dicas', label: 'Dicas', icon: <Lightbulb className="size-4" />, config: true },
  { key: 'canais', label: 'Canais', icon: <Radio className="size-4" />, config: true },
];

const CONFIG_TEXT: Record<ConfigTab, string> = {
  setores: 'Nome, ícone, cor, descrição, dicas e exemplos de cada equipe que atende chamados.',
  prioridades: 'Rótulo e explicação de cada prioridade, multiplicador do prazo (SLA) e prazo padrão sem categoria.',
  dicas: 'Dicas mostradas ao abrir um chamado, inclusive as que dependem de palavras no nome da categoria.',
  canais: 'Para qual equipe vão os chamados do WhatsApp e do e-mail, o quadro de contatos do suporte e a tela de chamado aberto.',
};

const TAB_KEY = 'nr-chamados-config-aba';

/** Abas da página: Categorias (cada equipe) e a configuração geral dos chamados (perfil TI). */
function ChamadosConfigPage() {
  const { hasRole } = useAuth();
  const canConfig = hasRole('TI');
  const [tab, setTab] = useState<'categorias' | ConfigTab>('categorias');
  const [configOpened, setConfigOpened] = useState(false);
  useEffect(() => {
    try {
      const t = localStorage.getItem(TAB_KEY) as 'categorias' | ConfigTab | null;
      if (t && TABS.some((x) => x.key === t) && (t === 'categorias' || canConfig)) setTab(t);
    } catch {}
  }, [canConfig]);
  useEffect(() => {
    if (tab !== 'categorias') setConfigOpened(true);
  }, [tab]);
  const choose = (t: 'categorias' | ConfigTab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };
  const tabs = TABS.filter((t) => !t.config || canConfig);
  const label = TABS.find((t) => t.key === tab)?.label ?? '';

  return (
    <>
      {tabs.length > 1 && (
        <div className="mb-5">
          <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Seções de Categorias e SLA">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => choose(t.key)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-brand-500',
                  tab === t.key ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div hidden={tab !== 'categorias'}>
        <CategoriesAdmin />
      </div>
      {canConfig && configOpened && (
        <div hidden={tab === 'categorias'}>
          <PageHeader icon={<Settings2 className="size-5" />} title={`Chamados · ${label}`} description={tab !== 'categorias' ? CONFIG_TEXT[tab] : undefined} />
          {/* fica montado ao trocar de aba para não perder o que foi digitado */}
          <ChamadosConfigAdmin tab={tab === 'categorias' ? 'setores' : tab} />
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <RequireAuth roles={TICKET_STAFF_ROLES}>
      <ChamadosConfigPage />
    </RequireAuth>
  );
}
