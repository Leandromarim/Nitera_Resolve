'use client';

import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Headset, LifeBuoy, Lightbulb, PhoneCall, Plus, Send } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, clsx, Field, Input, PageHeader, Select, Switch, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TICKET_CHANNEL, TICKET_PRIORITY } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { AttachmentDrop, useAttachment } from './attachment';
import { fillTeam, sectorTone, tipsFor, useTicketsConfig } from './config';
import { CategoryIcon, categoryTone, fmtHours, PRIORITY_ICON } from './meta';
import { OtherChannels } from './my-tickets';
import { parseSector, SECTORS, SectorBadge, SectorIcon, useStaffSectors } from './sectors';
import type { Department, Ticket, TicketCategory, TicketChannel, TicketPriority, TicketSector } from './types';

const STEPS = ['Equipe', 'Categoria', 'Detalhes', 'Revisão'];
const PRIORITIES: TicketPriority[] = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
const PRIORITY_RING: Record<TicketPriority, string> = {
  BAIXA: 'peer-checked:ring-slate-500 peer-checked:bg-slate-50 dark:peer-checked:bg-slate-800',
  MEDIA: 'peer-checked:ring-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/30',
  ALTA: 'peer-checked:ring-orange-500 peer-checked:bg-orange-50 dark:peer-checked:bg-orange-900/30',
  CRITICA: 'peer-checked:ring-red-600 peer-checked:bg-red-50 dark:peer-checked:bg-red-900/30',
};
export function NewTicket() {
  // quem atende alguma fila pode registrar chamados em nome de outra pessoa
  const staff = useStaffSectors().length > 0;
  const { user } = useAuth();
  const cfg = useTicketsConfig();
  const toast = useToast();
  const params = useSearchParams();
  const preset = parseSector(params.get('setor'));
  const [sector, setSector] = useState<TicketSector | ''>(preset ?? '');
  const { data: categories, loading: catLoading, error: catError } = useApi<TicketCategory[]>(sector ? `/tickets/categories?setor=${sector}` : null);
  const { data: departments } = useApi<Department[]>('/departments');
  const attachment = useAttachment();

  const [step, setStep] = useState(preset ? 1 : 0);
  const [categoryId, setCategoryId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIA');
  const [departmentId, setDepartmentId] = useState('');
  const [place, setPlace] = useState('');
  const [extension, setExtension] = useState('');
  const [onBehalf, setOnBehalf] = useState(false);
  const [channel, setChannel] = useState<TicketChannel>('TELEFONE');
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Ticket | null>(null);
  const top = useRef<HTMLDivElement>(null);
  // ramal já vem do cadastro; a pessoa pode trocar se estiver em outro lugar
  const meuRamal = user?.extension ?? '';
  useEffect(() => {
    if (meuRamal) setExtension((v) => v || meuRamal);
  }, [meuRamal]);
  // setor: começa no do cadastro; o local vem do setor (Painel › Usuários › Setores) e pode ser ajustado
  const meuSetor = user?.departmentId ?? '';
  const localDo = (id: string) => departments?.find((d) => d.id === id)?.location ?? '';
  useEffect(() => {
    if (meuSetor && departments) {
      setDepartmentId((v) => v || meuSetor);
      setPlace((v) => v || localDo(meuSetor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuSetor, departments]);
  const trocarSetor = (id: string) => {
    // troca o local junto, a não ser que a pessoa já tenha escrito outro
    setPlace((v) => (!v.trim() || v === localDo(departmentId) ? localDo(id) : v));
    setDepartmentId(id);
  };

  const category = categories?.find((c) => c.id === categoryId);
  const noCategories = !!sector && !!categories && categories.length === 0;

  // link com outro ?setor= (ex.: item de menu) já seleciona a equipe
  useEffect(() => {
    if (preset && preset !== sector) {
      setSector(preset);
      setCategoryId('');
      setStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const chooseSector = (s: TicketSector) => {
    if (s !== sector) setCategoryId('');
    setSector(s);
    setStep(1);
  };

  useEffect(() => {
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step, created]);

  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 5) e.title = 'Escreva um título com pelo menos 5 caracteres.';
    if (description.trim().length < 10) e.description = 'Descreva o problema com um pouco mais de detalhe (mín. 10 caracteres).';
    if (!departmentId) e.departmentId = 'Escolha o setor.';
    if (place.trim().length < 2) e.place = 'Informe o local (sala, posto, andar).';
    if (!/^\s*\d/.test(extension)) e.extension = 'Informe o ramal.';
    if (staff && onBehalf && !requesterName.trim()) e.requesterName = 'Informe o nome de quem está pedindo.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = () => {
    if (step === 0 && !sector) return toast('Escolha a equipe que vai atender.', 'info');
    if (step === 1 && !categoryId && !noCategories) return toast('Escolha uma categoria para continuar.', 'info');
    if (step === 2 && !validateDetails()) return;
    setStep((s) => Math.min(s + 1, 3));
  };

  const submit = async () => {
    if (!sector) return setStep(0);
    if (!validateDetails()) return setStep(2);
    if (attachment.uploading) return toast('Aguarde o envio do anexo terminar.', 'info');
    setSaving(true);
    try {
      const t = await api<Ticket>('/tickets', {
        method: 'POST',
        json: {
          title: title.trim(),
          description: description.trim(),
          sector,
          categoryId: categoryId || undefined,
          priority,
          departmentId: departmentId || undefined,
          location: place.trim() || undefined,
          extension: extension.trim() || undefined,
          fileId: attachment.fileId,
          ...(staff && onBehalf ? { channel, requesterName: requesterName.trim(), requesterPhone: requesterPhone.trim() || undefined } : {}),
        },
      });
      setCreated(t);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setStep(sector ? 1 : 0);
    setCategoryId('');
    setTitle('');
    setDescription('');
    setPriority('MEDIA');
    setDepartmentId(meuSetor);
    setPlace(localDo(meuSetor));
    setExtension(meuRamal);
    setRequesterName('');
    setRequesterPhone('');
    setOnBehalf(false);
    attachment.clear();
  };

  if (created) return <Success t={created} onAnother={reset} anchor={top} />;

  // mesmo cálculo do servidor: SLA da categoria (ou o padrão, sem categoria) × multiplicador da prioridade
  const baseSla = category ? category.slaHours : noCategories ? cfg.rules.defaultSlaHours : null;
  const slaHours = baseSla != null ? baseSla * (cfg.rules.slaFactor[priority] ?? 1) : null;
  const sc = sector ? cfg.sectors[sector] : null;

  return (
    <div ref={top} className="mx-auto max-w-[var(--largura-pagina)] w-full scroll-mt-24 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <Link href="/chamados" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700 dark:hover:text-brand-300">
        <ArrowLeft className="size-4" /> Voltar aos chamados
      </Link>
      <PageHeader
        icon={<LifeBuoy className="size-6" />}
        title={sc ? `Abrir chamado · ${sc.short}` : 'Abrir chamado'}
        description={sc ? `Conte o que você precisa — a ${sc.team} recebe na hora.` : 'Escolha a equipe que vai atender e conte o que você precisa.'}
      />

      <ol className="mb-6 flex items-center gap-2" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={clsx(
                'flex items-center gap-2 text-sm font-medium whitespace-nowrap disabled:cursor-default',
                i === step ? 'text-brand-700 dark:text-brand-300' : i < step ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400',
              )}
            >
              <span
                className={clsx(
                  'grid size-8 place-items-center rounded-full text-sm font-semibold transition',
                  i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-700 text-white ring-4 ring-brand-100 dark:bg-brand-500 dark:ring-brand-900' : 'bg-slate-200 text-slate-500 dark:bg-slate-800',
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={clsx(i !== step && 'hidden sm:inline')}>{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className={clsx('h-0.5 flex-1 rounded-full', i < step ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-800')} />}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          {step === 0 && (
            <Card className="p-5 sm:p-6">
              <h2 id="setor-titulo" className="text-lg font-semibold">
                Para qual equipe é o chamado?
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">Escolha quem cuida do assunto. Na próxima etapa você escolhe o tipo de pedido.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4" role="radiogroup" aria-labelledby="setor-titulo">
                {SECTORS.map((s) => {
                  const c = cfg.sectors[s];
                  const sel = sector === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      onClick={() => chooseSector(s)}
                      className={clsx(
                        'group relative flex flex-row items-start gap-4 rounded-2xl p-5 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:flex-col',
                        sel ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-900/30' : 'bg-white ring-slate-200 hover:ring-brand-300 dark:bg-slate-900 dark:ring-slate-800',
                      )}
                    >
                      <span className={clsx('grid size-14 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105', sectorTone(c.color))}>
                        <SectorIcon sector={s} className="size-7" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base leading-snug font-semibold">{c.label}</span>
                        <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{c.help}</span>
                      </span>
                      {sel && <CheckCircle2 className="absolute top-3 right-3 size-5 text-brand-600 dark:text-brand-300" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {step === 1 && sector && (
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <SectorBadge sector={sector} short={false} />
                <span className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
                  Trocar equipe
                </Button>
              </div>
              <h2 className="text-lg font-semibold">Qual é o assunto?</h2>
              <p className="mt-0.5 text-sm text-slate-500">Escolha a opção que mais se parece com o seu pedido.</p>
              {catError && !categories && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">Não foi possível carregar as categorias: {catError}</p>}
              {noCategories && (
                <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                  Esta equipe ainda não cadastrou categorias. Clique em <b>Continuar</b> para descrever o seu pedido.
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Categoria">
                {catLoading && !categories
                  ? Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)
                  : categories?.map((c) => {
                      const sel = categoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          onClick={() => {
                            setCategoryId(c.id);
                            setStep(2);
                          }}
                          className={clsx(
                            'group relative flex flex-col items-start gap-3 rounded-2xl p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md',
                            sel ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-900/30' : 'bg-white ring-slate-200 hover:ring-brand-300 dark:bg-slate-900 dark:ring-slate-800',
                          )}
                        >
                          <span className={clsx('grid size-11 place-items-center rounded-xl transition group-hover:scale-105', categoryTone(c.name))}>
                            <CategoryIcon category={c} className="size-6" />
                          </span>
                          <span className="text-sm leading-snug font-semibold">{c.name}</span>
                          {c.description && <span className="-mt-2 text-xs text-slate-500">{c.description}</span>}
                          {sel && <CheckCircle2 className="absolute top-3 right-3 size-5 text-brand-600 dark:text-brand-300" aria-hidden />}
                        </button>
                      );
                    })}
              </div>
            </Card>
          )}

          {step === 2 && sector && (
            <Card className="space-y-5 p-5 sm:p-6">
              {category && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <span className={clsx('grid size-9 place-items-center rounded-lg', categoryTone(category.name))}>
                    <CategoryIcon category={category} className="size-5" />
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="block text-xs text-slate-500">{sc?.label} · categoria</span>
                    <b>{category.name}</b>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                    Trocar
                  </Button>
                </div>
              )}

              {staff && (
                <div className={clsx('rounded-2xl p-4 ring-1 transition', onBehalf ? 'bg-orange-50/60 ring-orange-200 dark:bg-orange-900/10 dark:ring-orange-900' : 'ring-slate-200 dark:ring-slate-800')}>
                  <div className="flex items-center gap-3">
                    <PhoneCall className="size-5 text-coral-600" aria-hidden />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Abrir em nome de outra pessoa</p>
                      <p className="text-xs text-slate-500">Para pedidos recebidos por telefone, WhatsApp ou e-mail.</p>
                    </div>
                    <Switch
                      checked={onBehalf}
                      onChange={(v) => {
                        setOnBehalf(v);
                        // em nome de outra pessoa, o ramal do atendente não serve
                        setExtension((r) => (v ? (r === meuRamal ? '' : r) : r || meuRamal));
                      }}
                    />
                  </div>
                  {onBehalf && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Field label="Canal de origem">
                        <Select value={channel} onChange={(e) => setChannel(e.target.value as TicketChannel)}>
                          {Object.entries(TICKET_CHANNEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Nome do solicitante" error={errors.requesterName}>
                        <Input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} maxLength={120} placeholder="Ex.: Maria Souza" />
                      </Field>
                      <Field label="Telefone" hint="Para retorno">
                        <Input value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} maxLength={30} inputMode="tel" placeholder="(62) 99999-0000" />
                      </Field>
                    </div>
                  )}
                </div>
              )}

              <Field required label="Título" error={errors.title} hint={sc?.titleExample ? `Resuma o problema em poucas palavras (mín. 5 letras). Ex.: “${sc.titleExample}”` : 'Resuma o problema em poucas palavras (mín. 5 letras).'}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoFocus placeholder="O que está acontecendo?" className={clsx(errors.title && 'ring-2! ring-rose-500!')} />
              </Field>
              <Field
                required
                label="Descrição"
                error={errors.description}
                hint={`Conte o que aconteceu, desde quando, em qual equipamento ou sistema e qual mensagem aparece (mín. 10 letras). ${description.length}/20000`}
              >
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  maxLength={20000}
                  placeholder={sc?.descriptionPlaceholder || undefined}
                  className={clsx(errors.description && 'ring-2! ring-rose-500!')}
                />
              </Field>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Prioridade
                  <span className="ml-0.5 text-rose-600 dark:text-rose-400" title="Preenchimento obrigatório" aria-label="obrigatório">
                    *
                  </span>
                  <span className="ml-2 font-normal text-slate-500">Escolha pelo impacto no atendimento, não pela pressa.</span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PRIORITIES.map((p) => {
                    const Icon = PRIORITY_ICON[p];
                    return (
                      <label key={p} className="relative cursor-pointer">
                        <input type="radio" name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} className="peer sr-only" />
                        <span
                          className={clsx(
                            'flex h-full items-start gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition peer-focus-visible:outline-2 peer-focus-visible:outline-brand-500 peer-checked:ring-2 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800/50',
                            PRIORITY_RING[p],
                          )}
                        >
                          <span className={clsx('grid size-8 shrink-0 place-items-center rounded-lg', TICKET_PRIORITY[p].color)}>
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{cfg.priorities[p]?.label ?? TICKET_PRIORITY[p].label}</span>
                            <span className="block text-xs text-slate-500">{cfg.priorities[p]?.help}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {slaHours != null && (
                  <p className="mt-2 text-xs text-slate-500">
                    Prazo de atendimento previsto: <b className="text-slate-700 dark:text-slate-300">até {fmtHours(slaHours)}</b>
                  </p>
                )}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field required label="Setor" error={errors.departmentId} hint="Setor de quem precisa do atendimento. Vem do cadastro.">
                  <Select value={departmentId} onChange={(e) => trocarSetor(e.target.value)} className={clsx(errors.departmentId && 'ring-2! ring-rose-500!')}>
                    <option value="">Selecione…</option>
                    {departments?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field required label="Local" error={errors.place} hint="Onde a equipe deve ir: sala, posto ou andar. Vem do setor; ajuste se for outro lugar.">
                  <Input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={90} placeholder="Ex.: Subsolo" className={clsx(errors.place && 'ring-2! ring-rose-500!')} />
                </Field>
                <Field required label="Ramal" error={errors.extension} hint="Para a equipe ligar de volta. Vem do seu cadastro; troque se estiver em outro lugar.">
                  <Input
                    value={extension}
                    onChange={(e) => setExtension(e.target.value.replace(/[^\d\s/-]/g, ''))}
                    maxLength={20}
                    inputMode="numeric"
                    placeholder="Ex.: 2210"
                    className={clsx(errors.extension && 'ring-2! ring-rose-500!')}
                  />
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Anexo <span className="font-normal text-slate-400">(opcional)</span>
                </p>
                <AttachmentDrop state={attachment} />
              </div>
            </Card>
          )}

          {step === 3 && sector && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Confira antes de enviar</h2>
              <dl className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {[
                  ['Equipe', sc?.label ?? sector],
                  ['Categoria', category?.name ?? '—'],
                  ['Título', title],
                  ['Prioridade', cfg.priorities[priority]?.label ?? TICKET_PRIORITY[priority].label],
                  ['Setor', departments?.find((d) => d.id === departmentId)?.name ?? '—'],
                  ['Local', place || '—'],
                  ['Ramal', extension || '—'],
                  ...(staff && onBehalf ? [['Solicitante', `${requesterName}${requesterPhone ? ` · ${requesterPhone}` : ''} (via ${TICKET_CHANNEL[channel]})`]] : []),
                  ['Anexo', attachment.att ? attachment.att.file.name : 'Nenhum'],
                ].map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[140px_1fr]">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium break-words">{v}</dd>
                  </div>
                ))}
                <div className="py-2.5">
                  <dt className="text-slate-500">Descrição</dt>
                  <dd className="mt-1 rounded-xl bg-slate-50 p-3 whitespace-pre-wrap dark:bg-slate-800/50">{description}</dd>
                </div>
              </dl>
            </Card>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="size-4" /> Voltar
              </Button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <Button onClick={next} disabled={(step === 0 && !sector) || (step === 1 && !categoryId && !noCategories)}>
                Continuar <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button variant="coral" size="lg" onClick={submit} loading={saving} disabled={attachment.uploading}>
                <Send className="size-4" /> Enviar chamado
              </Button>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4 text-amber-500" aria-hidden /> Dicas para agilizar
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {[...tipsFor(cfg, sector, category), ...(cfg.alwaysTip ? [cfg.alwaysTip] : [])].map((t, i) => (
                <li key={`${i}-${t}`} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </Card>
          {!staff && (!sector || sector === cfg.rules.whatsappSector || sector === cfg.rules.emailSector) && <OtherChannels />}
        </aside>
      </div>
    </div>
  );
}

function Success({ t, onAnother, anchor }: { t: Ticket; onAnother: () => void; anchor: React.RefObject<HTMLDivElement | null> }) {
  const toast = useToast();
  const { success, sectors } = useTicketsConfig();
  const team = sectors[t.sector]?.team ?? 'equipe responsável';
  const link = typeof window !== 'undefined' ? `${window.location.origin}/chamados/${t.id}` : '';
  return (
    <div ref={anchor} className="mx-auto max-w-xl scroll-mt-24 px-4 py-10 sm:py-16">
      <Card className="overflow-hidden text-center">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-10 text-white">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/20 animate-slide-up">
            <CheckCircle2 className="size-9" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-bold">{success.title}</h1>
          {success.subtitle && <p className="mt-1 text-white/85">{fillTeam(success.subtitle, team)}</p>}
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-500">{success.numberLabel}</p>
          <p className="mt-1 font-mono text-5xl font-bold tracking-tight text-brand-700 dark:text-brand-300">#{t.number}</p>
          {success.note && <p className="mx-auto mt-3 max-w-sm text-sm text-slate-600 dark:text-slate-300">{fillTeam(success.note, team)}</p>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/chamados/${t.id}`}>
              <Button className="w-full">
                <Headset className="size-4" /> Acompanhar chamado
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copiado'), () => toast('Não foi possível copiar', 'error'))}
            >
              <Copy className="size-4" /> Copiar link
            </Button>
            <Button variant="ghost" onClick={onAnother}>
              <Plus className="size-4" /> Abrir outro
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
