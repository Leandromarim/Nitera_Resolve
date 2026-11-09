'use client';

import { ImageUp, Info, Link2, MessageCircle, Palette, RotateCcw, Save, Settings, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, uploadFile, type Role } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/format';
import { DEFAULT_BRANDING, useBranding, type Branding } from '@/lib/branding';
import { useApi } from '@/lib/use-api';
import { RequireAuth } from '@/components/require-auth';
import { Button, Card, EmptyState, Field, Input, Select, Loading, PageHeader, Switch, clsx, useConfirm, useToast } from '@/components/ui';
import { QrModal, qrSrc } from '@/components/comum/qr';
import { HistoryButton } from '@/components/versions/history';
import { linkWhatsapp, numeroWhatsapp } from '@/lib/whatsapp';

interface SettingsValues {
  siteName: string;
  siteTagline: string;
  logoUrl: string;
  logoLightUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  headerColor: string;
  footerColor: string;
  sidebarColor: string;
  backgroundColor: string;
  uiFonte: Branding['uiFonte'];
  uiDensidade: Branding['uiDensidade'];
  uiCantos: Branding['uiCantos'];
  uiAnimacoes: Branding['uiAnimacoes'];
  uiLarguraPainel: number;
  privacyPolicyUrl: string;
  ticketsWhatsappNumber: string;
  ticketsWhatsappQr: boolean;
  ticketsEmail: string;
  [k: string]: unknown;
}

/** Campos de aparência: aplicados ao vivo enquanto edita e restauráveis ao padrão. */
const APPEARANCE_KEYS = ['logoUrl', 'logoLightUrl', 'faviconUrl', 'primaryColor', 'accentColor', 'headerColor', 'footerColor', 'sidebarColor', 'backgroundColor', 'uiFonte', 'uiDensidade', 'uiCantos', 'uiAnimacoes', 'uiLarguraPainel'] as const;
type AppearanceKey = (typeof APPEARANCE_KEYS)[number];
const COLOR_FIELDS: { key: AppearanceKey; label: string; hint: string }[] = [
  { key: 'primaryColor', label: 'Cor principal', hint: 'Botões, links, ícones e títulos' },
  { key: 'accentColor', label: 'Cor de destaque', hint: 'Avisos e realces' },
  { key: 'headerColor', label: 'Cabeçalho', hint: 'Barra do topo (texto branco: prefira tons escuros)' },
  { key: 'footerColor', label: 'Rodapé', hint: 'Faixa do rodapé (texto branco: prefira tons escuros)' },
  { key: 'sidebarColor', label: 'Menu lateral do painel', hint: 'Fundo do menu do painel administrativo' },
  { key: 'backgroundColor', label: 'Fundo das páginas', hint: 'Cor atrás dos cards e conteúdos' },
];

/** Estilo: cada escolha muda o sistema inteiro na hora (prévia) e só vale para todos ao salvar. */
const ESTILO: { key: 'uiFonte' | 'uiDensidade' | 'uiCantos' | 'uiAnimacoes'; label: string; hint: string; opcoes: [string, string][] }[] = [
  { key: 'uiFonte', label: 'Fonte', hint: 'A do sistema carrega mais rápido em computadores antigos', opcoes: [['inter', 'Inter (padrão)'], ['sistema', 'Do sistema']] },
  { key: 'uiDensidade', label: 'Densidade das tabelas', hint: 'Compacta mostra mais linhas na tela', opcoes: [['confortavel', 'Confortável (padrão)'], ['compacta', 'Compacta']] },
  { key: 'uiCantos', label: 'Cantos', hint: 'Arredondamento de cartões, botões e campos', opcoes: [['padrao', 'Padrão'], ['retos', 'Mais retos'], ['arredondados', 'Mais arredondados']] },
  { key: 'uiAnimacoes', label: 'Animações', hint: 'Quem ativa "reduzir movimento" no sistema já não vê animações', opcoes: [['completas', 'Ligadas (padrão)'], ['desligadas', 'Desligadas para todos']] },
];

/** Larguras máximas: 0 = tela inteira; os demais em px. Personalizada aceita de 960 a 3840. */
const LARGURAS: { key: 'uiLarguraPainel'; label: string; hint: string }[] = [
  { key: 'uiLarguraPainel', label: 'Área das telas', hint: 'Até onde as telas se estendem ao lado do menu lateral' },
];
const LARGURA_PRESETS = [0, 1024, 1280, 1366, 1440, 1536, 1600, 1920];
const LARGURA_MIN = 960;
const LARGURA_MAX = 3840;

function LarguraField({ label, hint, value, onChange, error }: { label: string; hint: string; value: number; onChange: (n: number) => void; error?: string }) {
  const [custom, setCustom] = useState(!LARGURA_PRESETS.includes(value));
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex flex-wrap gap-2">
        <Select
          value={custom ? 'custom' : String(value)}
          onChange={(e) => {
            if (e.target.value === 'custom') return setCustom(true);
            setCustom(false);
            onChange(Number(e.target.value));
          }}
          className="min-w-0 flex-1"
        >
          {LARGURA_PRESETS.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? 'Tela inteira' : `${n} px`}
            </option>
          ))}
          <option value="custom">Personalizada…</option>
        </Select>
        {custom && (
          <Input type="number" inputMode="numeric" min={LARGURA_MIN} max={LARGURA_MAX} step={10} value={value || ''} placeholder="Ex.: 1700" aria-label={`${label} em pixels`} onChange={(e) => onChange(Math.round(Number(e.target.value) || 0))} className="w-32" />
        )}
      </div>
    </Field>
  );
}

const URL_RE = /^(https?:\/\/|\/(?!\/))/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;

function normalize(v: Record<string, any>): SettingsValues {
  return {
    ...v,
    siteName: v.siteName ?? '',
    siteTagline: v.siteTagline ?? '',
    ...Object.fromEntries(APPEARANCE_KEYS.map((k) => [k, v[k] || v[k] === 0 ? v[k] : DEFAULT_BRANDING[k]])),
    privacyPolicyUrl: v.privacyPolicyUrl ?? '',
    ticketsWhatsappNumber: v.ticketsWhatsappNumber ?? '',
    ticketsWhatsappQr: v.ticketsWhatsappQr === true,
    ticketsEmail: v.ticketsEmail ?? '',
  } as SettingsValues;
}

/** Opção de mostrar o QR Code do WhatsApp do suporte junto com o link, com prévia para baixar ou imprimir. */
function WhatsappQr({ number, enabled, onChange }: { number: string; enabled: boolean; onChange: (on: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const href = number.length >= 10 ? linkWhatsapp(number) : null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl p-4 ring-1 ring-slate-200 dark:ring-slate-800">
      <div className="min-w-60 flex-1 space-y-1">
        <Switch checked={enabled} onChange={onChange} label="Mostrar QR Code do WhatsApp" />
        <p className="text-xs text-slate-500">Aparece no login dos chamados e em Meus chamados. Quem está no computador aponta a câmera do celular e a conversa com o suporte já abre.</p>
      </div>
      {href ? (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-3 rounded-xl p-1.5 text-left text-sm text-brand-700 hover:bg-slate-50 dark:text-brand-300 dark:hover:bg-slate-800" title="Ampliar, baixar ou imprimir">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc(href, 192)} alt="QR Code do WhatsApp do suporte" width={80} height={80} className="size-20 rounded-lg bg-white p-1 ring-1 ring-slate-200" />
          <span className="font-medium">Baixar ou imprimir</span>
        </button>
      ) : (
        <p className="text-xs text-slate-500">Preencha o número para ver o QR Code.</p>
      )}
      <QrModal open={open} onClose={() => setOpen(false)} title="WhatsApp do suporte" subtitle="Abra um chamado" href={href} linkLabel="Abrir a conversa" />
    </div>
  );
}

/** Perfis que só entram com a verificação em duas etapas (auditoria AUT-01): quem não ativou cai no Meu perfil até ativar. Vale na hora. */
function AcessoPanel() {
  const { data, reload } = useApi<{ duasEtapas: Role[]; perfisPossiveis: Role[] }>('/admin/acesso');
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [salvando, setSalvando] = useState(false);
  if (!data) return <Loading />;
  const perfis = data.duasEtapas;
  const alternar = async (r: Role) => {
    const tirar = perfis.includes(r);
    if (tirar && (r === 'ADMIN' || r === 'TI') && !(await confirm(`Deixar ${ROLE_LABEL[r]} entrar sem a verificação em duas etapas? Uma senha vazada passa a bastar para controlar o sistema.`))) return;
    setSalvando(true);
    try {
      await api('/admin/acesso/duas-etapas', { method: 'PUT', json: { perfis: tirar ? perfis.filter((x) => x !== r) : [...perfis, r] } });
      toast(tirar ? `${ROLE_LABEL[r]}: duas etapas opcional` : `${ROLE_LABEL[r]}: duas etapas obrigatória`);
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSalvando(false);
    }
  };
  return (
    <div className={clsx(salvando && 'pointer-events-none opacity-60')}>
      {dialog}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Quem tem um destes perfis e ainda não ativou o código do celular só consegue abrir o Meu perfil até ativar. Recomendado: Administrador e TI.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.perfisPossiveis.map((r) => {
          const on = perfis.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => alternar(r)}
              className={clsx(
                'rounded-full border px-3 py-1 text-sm transition',
                on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800',
              )}
            >
              {ROLE_LABEL[r]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ icon, title, description, children, wide }: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Card className={clsx('p-5 sm:p-6', wide && 'xl:col-span-2')}>
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 [&_svg]:size-[18px]">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function ColorField({ label, hint, value, onChange, error }: { label: string; hint?: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <input type="color" value={HEX_RE.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={`${label} (seletor)`} />
        <Input placeholder="Ex.: #1E3A8A" value={value} onChange={(e) => onChange(e.target.value)} className="font-mono uppercase" maxLength={7} />
      </div>
    </Field>
  );
}

function LogoField({ label, hint, value, onChange, onReset, dark, square }: { label: string; hint: string; value: string; onChange: (url: string) => void; onReset: () => void; dark?: boolean; square?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const toast = useToast();
  const send = async (file?: File) => {
    if (!file) return;
    setProgress(0);
    try {
      const f = await uploadFile(file, { public: true, images: true }, setProgress);
      onChange(f.url);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => (e.preventDefault(), send(e.dataTransfer.files[0]))}
        className={clsx(
          'group relative grid h-32 place-items-center overflow-hidden rounded-2xl border-2 border-dashed p-4 transition hover:border-brand-400',
          dark ? 'border-transparent bg-[var(--ha-header)]' : 'border-slate-300 bg-white dark:border-slate-700',
        )}
        aria-label={`Trocar ${label.toLowerCase()}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className={clsx('max-h-full max-w-full object-contain', square && 'size-20')} />
        <span className="absolute inset-0 grid place-items-center bg-slate-900/55 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="flex items-center gap-2">
            <ImageUp className="size-5" /> Enviar nova imagem
          </span>
        </span>
        {progress !== null && <span className="absolute inset-x-0 bottom-0 h-1 bg-coral-500 transition-all" style={{ width: `${progress}%` }} />}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => send(e.target.files?.[0])} />
      <p className="text-xs text-slate-500">{hint}</p>
      <Button variant="ghost" size="sm" className="self-start" onClick={onReset}>
        <RotateCcw className="size-3.5" /> Usar a original
      </Button>
    </div>
  );
}

function SettingsAdmin() {
  const { data, loading, error, reload } = useApi<Record<string, any>>('/admin/settings');
  const toast = useToast();
  const [v, setV] = useState<SettingsValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const branding = useBranding();

  useEffect(() => {
    if (data) setV(normalize(data));
  }, [data]);

  // prévia ao vivo: o sistema inteiro (inclusive este painel) muda enquanto você edita
  const appearance = v ? JSON.stringify(APPEARANCE_KEYS.map((k) => v[k])) : '';
  useEffect(() => {
    if (!v) return;
    const valid = Object.fromEntries(APPEARANCE_KEYS.filter((k) => !k.endsWith('Color') || HEX_RE.test(String(v[k]))).map((k) => [k, v[k]]));
    branding.preview(valid as Partial<Branding>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance]);
  const previewRef = useRef(branding.preview);
  previewRef.current = branding.preview;
  useEffect(() => () => previewRef.current(null), []); // ao sair sem salvar, volta ao que está salvo

  const original = data ? JSON.stringify(normalize(data)) : '';
  const dirty = !!v && JSON.stringify(v) !== original;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (loading && !v) return <Loading />;
  if (error || !v)
    return (
      <Card>
        <EmptyState title="Não foi possível carregar as configurações" description={error ?? undefined} action={<Button onClick={reload}>Tentar novamente</Button>} />
      </Card>
    );

  const set = (p: Partial<SettingsValues>) => setV({ ...v, ...p });
  const errs: Record<string, string | null> = {
    siteName: !v.siteName.trim() ? 'Informe o nome' : null,
    ...Object.fromEntries(COLOR_FIELDS.map((c) => [c.key, !HEX_RE.test(String(v[c.key])) ? 'Use o formato #RRGGBB' : null])),
    ...Object.fromEntries(LARGURAS.map((l) => [l.key, v[l.key] !== 0 && !(v[l.key] >= LARGURA_MIN && v[l.key] <= LARGURA_MAX) ? `Use de ${LARGURA_MIN} a ${LARGURA_MAX} px` : null])),
    privacyPolicyUrl: v.privacyPolicyUrl && !URL_RE.test(v.privacyPolicyUrl) ? 'Use https://… ou /caminho' : null,
    ticketsEmail: v.ticketsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.ticketsEmail) ? 'E-mail inválido' : null,
    ticketsWhatsappNumber: v.ticketsWhatsappNumber && !/^\d{10,15}$/.test(v.ticketsWhatsappNumber) ? 'Somente números, com DDI e DDD (ex.: 5562999990000)' : null,
  };
  const err = (k: string) => (tried ? errs[k] ?? undefined : undefined);

  const save = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return toast('Confira os campos destacados', 'error');
    setSaving(true);
    try {
      const values = { ...v, siteName: v.siteName.trim(), siteTagline: v.siteTagline.trim() };
      await api('/admin/settings', { method: 'PUT', json: { values } });
      toast('Configurações salvas');
      setTried(false);
      reload();
      branding.reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <PageHeader icon={<Settings className="size-5" />} title="Configurações" description="Nome, aparência (logo, ícone da aba e cores) e canais de atendimento." actions={<HistoryButton entity="Setting" entityId="settings" label="Configurações" size="md" onRestored={() => location.reload()} />} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={<Palette />} title="Aparência" description="Logo, ícone da aba, cores e estilo do sistema. As mudanças aparecem na hora para você conferir; só valem para todos depois de salvar." wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do site" error={err('siteName')} hint="Nome da instituição, usado nos e-mails e como texto alternativo da logo">
              <Input placeholder="Ex.: Clínica Exemplo" value={v.siteName} maxLength={80} onChange={(e) => set({ siteName: e.target.value })} />
            </Field>
            <Field label="Subtítulo" hint="Frase curta exibida abaixo do nome">
              <Input placeholder="Ex.: Central de atendimento" value={v.siteTagline} maxLength={40} onChange={(e) => set({ siteTagline: e.target.value })} />
            </Field>
          </div>

          <h3 className="mt-6 mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Logo e ícone da aba</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <LogoField label="Logo sobre fundo escuro" hint="Topo e menu lateral. Prefira PNG com fundo transparente e letras claras." value={v.logoUrl} dark onChange={(logoUrl) => set({ logoUrl })} onReset={() => set({ logoUrl: DEFAULT_BRANDING.logoUrl })} />
            <LogoField label="Logo sobre fundo claro" hint="Tela de login e e-mails. PNG com fundo transparente e letras escuras." value={v.logoLightUrl} onChange={(logoLightUrl) => set({ logoLightUrl })} onReset={() => set({ logoLightUrl: DEFAULT_BRANDING.logoLightUrl })} />
            <LogoField label="Ícone da aba do navegador" hint="Imagem quadrada (PNG, 512×512 de preferência). Também aparece no menu do painel recolhido." value={v.faviconUrl} square onChange={(faviconUrl) => set({ faviconUrl })} onReset={() => set({ faviconUrl: DEFAULT_BRANDING.faviconUrl })} />
          </div>

          <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cores</h3>
            <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(COLOR_FIELDS.map((c) => [c.key, DEFAULT_BRANDING[c.key as keyof Branding]])) as Partial<SettingsValues>)}>
              <RotateCcw className="size-4" /> Voltar às cores originais
            </Button>
          </div>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {COLOR_FIELDS.map((c) => (
              <ColorField key={c.key} label={c.label} hint={c.hint} value={String(v[c.key])} onChange={(val) => set({ [c.key]: val } as Partial<SettingsValues>)} error={err(c.key)} />
            ))}
          </div>

          <h3 className="mt-6 mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Estilo</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ESTILO.map((e) => (
              <Field key={e.key} label={e.label} hint={e.hint}>
                <Select value={v[e.key]} onChange={(ev) => set({ [e.key]: ev.target.value } as Partial<SettingsValues>)}>
                  {e.opcoes.map(([val, rot]) => (
                    <option key={val} value={val}>
                      {rot}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>

          <h3 className="mt-6 mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Larguras</h3>
          <p className="mb-3 text-xs text-slate-500">Até onde o conteúdo se estende em telas grandes. No celular tudo ocupa a tela, e nada rola para o lado em nenhuma largura.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {LARGURAS.map((l) => (
              <LarguraField key={l.key} label={l.label} hint={l.hint} value={v[l.key]} onChange={(n) => set({ [l.key]: n } as Partial<SettingsValues>)} error={err(l.key)} />
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(APPEARANCE_KEYS.map((k) => [k, DEFAULT_BRANDING[k]])) as Partial<SettingsValues>)}>
              <RotateCcw className="size-4" /> Voltar toda a aparência ao padrão
            </Button>
          </div>
        </Panel>

        <Panel icon={<Link2 />} title="Política de privacidade" description="Link mostrado na tela de login.">
          <Field label="Endereço da política" hint="Link externo (https://…) ou página interna (/caminho)" error={err('privacyPolicyUrl')}>
            <Input value={v.privacyPolicyUrl} inputMode="url" onChange={(e) => set({ privacyPolicyUrl: e.target.value })} placeholder="Ex.: https://www.suaempresa.com.br/privacidade" />
          </Field>
        </Panel>

        <Panel icon={<MessageCircle />} title="Canais de atendimento" description="Divulgados para abertura de chamados.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número do WhatsApp" error={err('ticketsWhatsappNumber')} hint="Somente números, com DDI e DDD. Ex.: 5562999990000. Se faltar o 55, ele é completado ao sair do campo.">
              <Input value={v.ticketsWhatsappNumber} inputMode="numeric" onChange={(e) => set({ ticketsWhatsappNumber: e.target.value.replace(/\D/g, '') })}
                onBlur={(e) => e.target.value && set({ ticketsWhatsappNumber: numeroWhatsapp(e.target.value) })} placeholder="5562999990000" />
            </Field>
            <Field label="E-mail do suporte" error={err('ticketsEmail')} hint="E-mails recebidos aqui viram chamados.">
              <Input placeholder="Ex.: suporte@suaempresa.com.br" type="email" value={v.ticketsEmail} onChange={(e) => set({ ticketsEmail: e.target.value })} />
            </Field>
          </div>
          <WhatsappQr number={v.ticketsWhatsappNumber} enabled={v.ticketsWhatsappQr} onChange={(on) => set({ ticketsWhatsappQr: on })} />
          <div className="mt-4 flex gap-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-900">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
            <div className="space-y-1">
              <p className="font-medium">Onde ficam as senhas e tokens das integrações?</p>
              <p className="text-sky-800/90 dark:text-sky-200/80">
                Por segurança, as credenciais da API do WhatsApp (token, ID do número, chave do webhook) e do servidor de e-mail (SMTP/IMAP, usuário e senha) <b>não</b> são editadas por aqui: elas ficam no arquivo{' '}
                <code className="rounded bg-sky-100 px-1 py-0.5 font-mono text-xs dark:bg-sky-900">.env</code> do servidor e só podem ser alteradas por quem tem acesso ao servidor. Assim elas nunca aparecem no navegador nem no log de auditoria.
              </p>
            </div>
          </div>
        </Panel>

        <Panel icon={<ShieldCheck />} title="Acesso" description="Quem só entra com a verificação em duas etapas (código do celular).">
          <AcessoPanel />
        </Panel>
      </div>

      <div
        className={clsx(
          'fixed right-4 bottom-4 left-4 z-30 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-slate-200 transition-all sm:left-auto sm:w-auto dark:bg-slate-900 dark:ring-slate-700',
          dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0',
        )}
        aria-hidden={!dirty}
      >
        <Info className="ml-1 size-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-sm font-medium">Alterações não salvas</span>
        <Button variant="ghost" size="sm" onClick={() => data && (setV(normalize(data)), setTried(false), branding.preview(null))} tabIndex={dirty ? 0 : -1}>
          <RotateCcw className="size-4" /> Descartar
        </Button>
        <Button size="sm" onClick={save} loading={saving} tabIndex={dirty ? 0 : -1}>
          <Save className="size-4" /> Salvar
        </Button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth roles={['ADMIN']}>
      <SettingsAdmin />
    </RequireAuth>
  );
}
