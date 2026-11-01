'use client';

import { Copy, ExternalLink, KeyRound, MonitorPlay, Play, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { RequireAuth } from '@/components/require-auth';
import { Button, Card, Field, Input, Loading, PageHeader, Select, Switch, Textarea, clsx, useConfirm, useToast } from '@/components/ui';
import { Section } from '@/components/admin/common';
import { ChimeTone, VOICE_TEXT, playTicketChime, speakTicketAlert } from '@/components/tickets/new-ticket-alert';
import { SECTOR_LABEL, SECTOR_SHORT, SECTOR_TEAM, SectorTabs, TICKET_STAFF_ROLES, useStaffSectors } from '@/components/tickets/sectors';
import type { TicketSector } from '@/components/tickets/types';

type Status = 'NOVO' | 'EM_ATENDIMENTO' | 'AGUARDANDO_USUARIO';

interface TvSettings {
  key: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  refreshSec: number;
  soundEnabled: boolean;
  soundTone: ChimeTone;
  voiceEnabled: boolean;
  voiceText: string;
  soundVolume: number;
  criticalRepeat: number;
  reminderMin: number;
  newHighlightSec: number;
  statuses: Status[];
  categoryIds: string[];
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

const STATUSES: { id: Status; label: string }[] = [
  { id: 'NOVO', label: 'Novos' },
  { id: 'EM_ATENDIMENTO', label: 'Em atendimento' },
  { id: 'AGUARDANDO_USUARIO', label: 'Aguardando usuário' },
];
const TONES: { id: ChimeTone; label: string }[] = [
  { id: 'sino', label: 'Sino (três notas)' },
  { id: 'campainha', label: 'Campainha' },
  { id: 'alerta', label: 'Alerta (mais forte)' },
  { id: 'suave', label: 'Suave' },
];

function NumberField({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const bad = !Number.isInteger(value) || value < min || value > max;
  return (
    <Field label={label} hint={hint} error={bad ? `Use de ${min} a ${max}` : undefined}>
      <Input placeholder={`Ex.: ${min}`} type="number" min={min} max={max} value={Number.isNaN(value) ? '' : value} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
    </Field>
  );
}

function TvPanelAdmin() {
  const sectors = useStaffSectors();
  const [picked, setPicked] = useState<TicketSector | ''>('');
  const sector: TicketSector | undefined = picked && sectors.includes(picked) ? picked : sectors[0];
  const { data, loading, error, reload } = useApi<{ sector: TicketSector; settings: TvSettings; categories: { id: string; name: string }[] }>(
    sector ? `/admin/painel-tv?setor=${sector}` : null,
  );
  const [form, setForm] = useState<TvSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  const dirty = !!form && !!data && JSON.stringify(form) !== JSON.stringify(data.settings);
  const changeSector = async (v: TicketSector | '') => {
    if (!v || v === sector) return;
    if (dirty && !(await confirm('Há mudanças não salvas neste painel. Trocar de setor e descartar as mudanças?'))) return;
    setForm(null);
    setPicked(v);
  };
  const tabs = sector && sectors.length > 1 && (
    <div>
      <SectorTabs sectors={sectors} value={sector} onChange={changeSector} allowAll={false} label="Painel de qual equipe" className="w-fit max-w-full" />
    </div>
  );

  if (!sector) return <Card className="p-6 text-slate-500">Seu perfil não atende nenhuma fila de chamados.</Card>;
  if (error && (!form || data?.sector !== sector))
    return (
      <div className="space-y-4">
        {dialog}
        {tabs}
        <Card className="p-6 text-rose-600">Não foi possível carregar a configuração do painel da TV: {error}</Card>
      </div>
    );
  if (!form || !data || data.sector !== sector)
    return (
      <div className="space-y-4">
        {dialog}
        {tabs}
        {loading ? <Loading /> : null}
      </div>
    );

  const set = <K extends keyof TvSettings>(k: K, v: TvSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const url = typeof window !== 'undefined' ? `${window.location.origin}/painel-tv?chave=${form.key}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Endereço copiado. Abra-o no navegador da TV.');
    } catch {
      toast('Não foi possível copiar. Selecione o endereço e copie manualmente.', 'error');
    }
  };

  const save = async () => {
    if (!form.statuses.length) return toast('Escolha pelo menos uma coluna.', 'error');
    setSaving(true);
    try {
      const { key: _k, ...body } = form;
      await api(`/admin/painel-tv?setor=${sector}`, { method: 'PUT', json: body });
      toast('Painel da TV atualizado. A TV aplica as mudanças na próxima atualização.');
      reload();
    } catch (e: any) {
      toast(e?.message ?? 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    const ok = await confirm('Gerar uma nova chave? O endereço atual deixa de funcionar e a TV mostra "acesso negado" até você abrir o endereço novo nela.');
    if (!ok) return;
    try {
      await api(`/admin/painel-tv/chave?setor=${sector}`, { method: 'POST' });
      toast('Nova chave gerada. Atualize o endereço na TV.');
      reload();
    } catch (e: any) {
      toast(e?.message ?? 'Não foi possível gerar a chave.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader
        icon={<MonitorPlay />}
        title={sectors.length > 1 ? `Painel da TV · ${SECTOR_SHORT[sector]}` : 'Painel da TV'}
        description={`Tela de chamados para a TV da ${SECTOR_TEAM[sector]}, com aviso sonoro quando chega chamado novo. Cada equipe tem o seu painel e o seu endereço.`}
        actions={
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save className="size-4" /> Salvar
          </Button>
        }
      />

      {tabs}

      <Card className="space-y-4 p-5">
        <Section title={`Endereço para a TV · ${SECTOR_LABEL[sector]}`} description="Abra este endereço no navegador da TV. Ele não pede login; quem tiver o endereço vê os chamados, então não o divulgue.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Endereço do painel" />
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={copy}>
                <Copy className="size-4" /> Copiar
              </Button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">
                <ExternalLink className="size-4" /> Abrir
              </a>
              <Button variant="danger" onClick={rotate}>
                <KeyRound className="size-4" /> Nova chave
              </Button>
            </div>
          </div>
          <Switch checked={form.enabled} onChange={(v) => set('enabled', v)} label="Painel ativo (desligado, a TV mostra que o painel está desativado)" />
          <p className="text-xs text-slate-500">
            Na primeira abertura, toque na tela uma vez para liberar o som. Para começar sozinho, sem toque, abra o Chrome da TV com a opção <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">--autoplay-policy=no-user-gesture-required</code>.
          </p>
        </Section>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <Section title="Som" description="O aviso toca na TV quando chega um chamado novo.">
            <Switch checked={form.soundEnabled} onChange={(v) => set('soundEnabled', v)} label="Tocar som para chamado novo" />
            <div className={clsx('grid gap-4 sm:grid-cols-2', !form.soundEnabled && 'pointer-events-none opacity-50')}>
              <Field label="Tipo de som">
                <Select value={form.soundTone} onChange={(e) => set('soundTone', e.target.value as ChimeTone)}>
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Volume: ${form.soundVolume}%`}>
                <input type="range" min={0} max={100} step={5} value={form.soundVolume} onChange={(e) => set('soundVolume', Number(e.target.value))} className="w-full accent-brand-600" />
              </Field>
              <Field label="Frase falada" hint="A TV fala esta frase depois do toque. Deixe em branco para usar a padrão.">
                <Input value={form.voiceText} maxLength={120} placeholder={VOICE_TEXT} disabled={!form.voiceEnabled} onChange={(e) => set('voiceText', e.target.value)} />
              </Field>
              <div className="flex items-end pb-2">
                <Switch checked={form.voiceEnabled} onChange={(v) => set('voiceEnabled', v)} label="Falar em voz alta" />
              </div>
              <NumberField label="Repetições para prioridade crítica" value={form.criticalRepeat} min={1} max={5} onChange={(v) => set('criticalRepeat', v)} />
              <NumberField label="Lembrete (minutos)" hint="Toca de novo enquanto houver chamado novo sem responsável. 0 desliga." value={form.reminderMin} min={0} max={120} onChange={(v) => set('reminderMin', v)} />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                playTicketChime(1, form.soundTone, form.soundVolume);
                if (form.voiceEnabled) speakTicketAlert(form.voiceText || VOICE_TEXT, form.soundVolume, 1250);
              }}
            >
              <Play className="size-4" /> Ouvir o som
            </Button>
          </Section>
        </Card>

        <Card className="space-y-4 p-5">
          <Section title="Aparência">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título">
                <Input placeholder="Ex.: Chamados da TI" value={form.title} maxLength={80} onChange={(e) => set('title', e.target.value)} />
              </Field>
              <Field label="Subtítulo">
                <Input placeholder="Ex.: Clínica Exemplo" value={form.subtitle} maxLength={80} onChange={(e) => set('subtitle', e.target.value)} />
              </Field>
              <Field label="Tema">
                <Select value={form.theme} onChange={(e) => set('theme', e.target.value as TvSettings['theme'])}>
                  <option value="escuro">Escuro (recomendado para TV)</option>
                  <option value="claro">Claro</option>
                </Select>
              </Field>
              <NumberField label="Atualizar a cada (segundos)" value={form.refreshSec} min={5} max={300} onChange={(v) => set('refreshSec', v)} />
            </div>
            <Field label="Recado no rodapé" hint="Texto que passa no rodapé da TV. Deixe vazio para não mostrar.">
              <Textarea placeholder="Ex.: Abra chamados pelo site ou pelo ramal 2045." rows={2} maxLength={300} value={form.ticker} onChange={(e) => set('ticker', e.target.value)} />
            </Field>
          </Section>
        </Card>

        <Card className="space-y-4 p-5">
          <Section title="Chamados exibidos">
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Colunas</span>
              <div className="flex flex-wrap gap-4">
                {STATUSES.map((st) => (
                  <label key={st.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={form.statuses.includes(st.id)}
                      onChange={(e) => set('statuses', e.target.checked ? [...form.statuses, st.id] : form.statuses.filter((x) => x !== st.id))}
                    />
                    {st.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Categorias</span>
              <p className="text-xs text-slate-500">Nenhuma marcada mostra todas.</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {data.categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={form.categoryIds.includes(c.id)}
                      onChange={(e) => set('categoryIds', e.target.checked ? [...form.categoryIds, c.id] : form.categoryIds.filter((x) => x !== c.id))}
                    />
                    {c.name}
                  </label>
                ))}
                {!data.categories.length && <span className="text-sm text-slate-500">Nenhuma categoria cadastrada.</span>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Máximo de chamados por coluna" value={form.maxPerColumn} min={3} max={50} onChange={(v) => set('maxPerColumn', v)} />
              <NumberField label="Destaque de chamado novo (segundos)" value={form.newHighlightSec} min={5} max={600} onChange={(v) => set('newHighlightSec', v)} />
            </div>
          </Section>
        </Card>

        <Card className="space-y-4 p-5">
          <Section title="O que mostrar">
            <div className="grid gap-3 sm:grid-cols-2">
              <Switch checked={form.showClock} onChange={(v) => set('showClock', v)} label="Relógio e data" />
              <Switch checked={form.showStats} onChange={(v) => set('showStats', v)} label="Números do dia" />
              <Switch checked={form.showTechnicians} onChange={(v) => set('showTechnicians', v)} label="Técnicos e carga" />
              <Switch checked={form.showRequester} onChange={(v) => set('showRequester', v)} label="Nome do solicitante" />
              <Switch checked={form.showLocation} onChange={(v) => set('showLocation', v)} label="Local do chamado" />
              <Switch checked={form.blinkCritical} onChange={(v) => set('blinkCritical', v)} label="Piscar prioridade crítica" />
              <Switch checked={form.highlightOverdue} onChange={(v) => set('highlightOverdue', v)} label="Destacar atrasados em vermelho" />
            </div>
          </Section>
        </Card>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth roles={TICKET_STAFF_ROLES}>
      <TvPanelAdmin />
    </RequireAuth>
  );
}
