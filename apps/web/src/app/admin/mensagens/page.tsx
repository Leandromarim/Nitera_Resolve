'use client';

import { AlertTriangle, Bell, Eye, Lock, Mail, MessageCircle, MessageSquareText, RotateCcw, Save, Search, Undo2 } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { RequireAuth } from '@/components/require-auth';
import { Badge, Button, Card, EmptyState, Input, Loading, PageHeader, Textarea, clsx, useConfirm, useToast } from '@/components/ui';
import { HistoryButton } from '@/components/versions/history';

type Canal = 'whatsapp' | 'email' | 'sino';
type Tipo = 'texto' | 'linha' | 'palavra' | 'lista';

interface Variavel {
  nome: string;
  descricao: string;
  exemplo: string;
}

interface Item {
  chave: string;
  modulo: string;
  canais: Canal[];
  rotulo: string;
  ajuda: string | null;
  tipo: Tipo;
  max: number;
  padrao: string;
  valor: string;
  personalizado: boolean;
  podeEditar: boolean;
  variaveis: Variavel[];
}

interface Payload {
  site: string;
  itens: Item[];
}

const CANAIS: Record<Canal, { label: string; icon: React.ReactNode; cls: string }> = {
  whatsapp: { label: 'WhatsApp', icon: <MessageCircle className="size-3.5" />, cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  email: { label: 'E-mail', icon: <Mail className="size-3.5" />, cls: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  sino: { label: 'Sino do sistema', icon: <Bell className="size-3.5" />, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

const FILTROS: { id: 'todos' | Canal; label: string }[] = [
  { id: 'todos', label: 'Todas' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'E-mail' },
  { id: 'sino', label: 'Sino' },
];

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
const minusc = (n: string) => n.charAt(0).toLowerCase() + n.slice(1);
const capitalizar = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1) : s);

/** Mesma regra da API: {nome} vira o valor; {Nome} vira o valor com inicial maiúscula. */
function aplicar(modelo: string, vars: Record<string, string>) {
  return modelo.replace(PLACEHOLDER, (todo, nome: string) => {
    if (nome in vars) return vars[nome];
    const m = minusc(nome);
    if (m !== nome && m in vars) return capitalizar(vars[m]);
    return todo;
  });
}

function invalidas(item: Item, texto: string) {
  if (item.tipo === 'palavra' || item.tipo === 'lista') return [];
  const ok = new Set(item.variaveis.map((v) => v.nome));
  const ruins = new Set<string>();
  for (const [, nome] of texto.matchAll(PLACEHOLDER)) if (!ok.has(nome) && !ok.has(minusc(nome))) ruins.add(nome);
  return [...ruins];
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Prévia: no WhatsApp, *texto* aparece em negrito (sem interpretar HTML). */
function PreviewText({ text, whatsapp }: { text: string; whatsapp: boolean }) {
  if (!whatsapp) return <>{text}</>;
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*[^*\n]+\*$/.test(p) ? <strong key={i}>{p.slice(1, -1)}</strong> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

function Editor({
  item,
  value,
  onChange,
  exemplos,
}: {
  item: Item;
  value: string;
  onChange: (v: string) => void;
  exemplos: Record<string, string>;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const id = `msg-${item.chave.replace(/\W/g, '-')}`;
  const ruins = invalidas(item, value);
  const multiline = item.tipo === 'texto';
  const isModel = item.tipo === 'texto' || item.tipo === 'linha';
  const changed = value !== item.padrao;

  const insert = (nome: string) => {
    const el = ref.current;
    const token = `{${nome}}`;
    if (!el) return onChange(value + token);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    if (next.length > item.max) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const preview = isModel ? aplicar(value, exemplos) : '';

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block font-medium text-slate-900 dark:text-slate-100">
            {item.rotulo}
          </label>
          {item.ajuda && <p className="mt-0.5 text-xs text-slate-500">{item.ajuda}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.canais.map((c) => (
            <Badge key={c} className={CANAIS[c].cls}>
              {CANAIS[c].icon} {CANAIS[c].label}
            </Badge>
          ))}
          {changed && <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Personalizada</Badge>}
        </div>
      </div>

      <div className={clsx('grid gap-4', isModel && 'lg:grid-cols-2')}>
        <div className="min-w-0 space-y-2">
          {multiline ? (
            <Textarea
              placeholder={`Ex.: ${item.padrao}`}
              ref={ref}
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={item.max}
              rows={Math.min(10, Math.max(3, value.split('\n').length + 1))}
              disabled={!item.podeEditar}
              aria-invalid={ruins.length > 0 || !value.trim()}
              aria-describedby={`${id}-info`}
              className="font-mono text-[13px] leading-relaxed"
            />
          ) : (
            <Input
              placeholder={`Ex.: ${item.padrao}`}
              ref={ref}
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={item.max}
              disabled={!item.podeEditar}
              aria-invalid={ruins.length > 0 || !value.trim()}
              aria-describedby={`${id}-info`}
              className={clsx(isModel && 'font-mono text-[13px]')}
            />
          )}

          {item.podeEditar && item.variaveis.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Inserir variável">
              <span className="text-xs text-slate-500">Inserir:</span>
              {item.variaveis.map((v) => (
                <button
                  key={v.nome}
                  type="button"
                  onClick={() => insert(v.nome)}
                  title={v.descricao}
                  aria-label={`Inserir {${v.nome}}: ${v.descricao}`}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-700 transition-colors hover:bg-brand-100 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-900/50 dark:hover:text-brand-200"
                >
                  {`{${v.nome}}`}
                </button>
              ))}
            </div>
          )}

          <div id={`${id}-info`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              {!item.podeEditar ? (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Lock className="size-3.5" /> Somente a equipe de TI pode alterar esta mensagem.
                </span>
              ) : !value.trim() ? (
                <span className="text-rose-600">O texto não pode ficar vazio.</span>
              ) : ruins.length ? (
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <AlertTriangle className="size-3.5" /> {ruins.map((r) => `{${r}}`).join(', ')} não existe nesta mensagem.
                </span>
              ) : (
                <span className="text-slate-400">
                  {value.length}/{item.max}
                </span>
              )}
            </div>
            {item.podeEditar && changed && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(item.padrao)}>
                <Undo2 className="size-3.5" /> Voltar ao padrão
              </Button>
            )}
          </div>
        </div>

        {isModel && (
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Eye className="size-3.5" /> Prévia com valores de exemplo
            </p>
            <div
              className={clsx(
                'rounded-2xl px-4 py-3 text-sm break-words whitespace-pre-wrap',
                item.canais.includes('whatsapp') && !item.canais.includes('email')
                  ? 'bg-emerald-50 text-slate-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-slate-100 dark:ring-emerald-900/50'
                  : 'bg-slate-50 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-100 dark:ring-slate-700',
              )}
              aria-live="polite"
            >
              {preview.trim() ? <PreviewText text={preview} whatsapp={item.canais.includes('whatsapp')} /> : <span className="text-slate-400">(vazio)</span>}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function MensagensPage() {
  const { data, error, loading, reload, setData } = useApi<Payload>('/admin/mensagens');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['id']>('todos');
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const itens = useMemo(() => data?.itens ?? [], [data]);
  const valor = (i: Item) => drafts[i.chave] ?? i.valor;
  const dirty = itens.filter((i) => drafts[i.chave] !== undefined && drafts[i.chave] !== i.valor);
  const temErro = dirty.some((i) => !valor(i).trim() || invalidas(i, valor(i)).length > 0);

  useEffect(() => {
    if (!dirty.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty.length]);

  // valores de exemplo da prévia: nome do hospital real e palavras-chave atuais (inclusive as ainda não salvas)
  const exemplos = useMemo(() => {
    const ex: Record<string, string> = {};
    for (const i of itens) for (const v of i.variaveis) ex[v.nome] = v.exemplo;
    const pal = (k: string) => {
      const it = itens.find((i) => i.chave === k);
      return it ? (drafts[k] ?? it.valor).trim() : '';
    };
    if (data?.site) ex.site = data.site;
    const ps = pal('chamados.whatsapp.palavraStatus');
    const pn = pal('chamados.whatsapp.palavraNovo');
    if (ps) ex.palavraStatus = ps.toLowerCase();
    if (pn) ex.palavraNovo = pn.toLocaleUpperCase('pt-BR');
    return ex;
  }, [itens, drafts, data?.site]);

  const visiveis = useMemo(() => {
    const q = norm(busca.trim());
    return itens.filter(
      (i) => (filtro === 'todos' || i.canais.includes(filtro)) && (!q || norm(`${i.rotulo} ${i.modulo} ${i.ajuda ?? ''} ${drafts[i.chave] ?? i.valor}`).includes(q)),
    );
  }, [itens, filtro, busca, drafts]);

  const modulos = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of visiveis) m.set(i.modulo, [...(m.get(i.modulo) ?? []), i]);
    return [...m.entries()];
  }, [visiveis]);

  const podeAlgo = itens.some((i) => i.podeEditar);
  const personalizadas = itens.filter((i) => i.personalizado && i.podeEditar).length;

  const save = async () => {
    if (temErro) {
      toast('Corrija as mensagens marcadas em vermelho antes de salvar.', 'error');
      return;
    }
    setSaving(true);
    try {
      const valores = Object.fromEntries(dirty.map((i) => [i.chave, valor(i)]));
      const r = await api<Payload>('/admin/mensagens', { method: 'PUT', json: { valores } });
      setData(r);
      setDrafts({});
      toast(dirty.length === 1 ? 'Mensagem salva.' : `${dirty.length} mensagens salvas.`);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const restoreAll = async () => {
    if (!(await confirm('Voltar todas as mensagens que você pode editar ao texto original do sistema? A versão atual fica no histórico.'))) return;
    try {
      const r = await api<Payload>('/admin/mensagens/restaurar', { method: 'POST' });
      setData(r);
      setDrafts({});
      toast('Mensagens restauradas para o padrão.');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="pb-24">
      {dialog}
      <PageHeader
        title="Mensagens automáticas"
        description="Textos enviados por WhatsApp, e-mail e no sino do sistema. Use as variáveis entre chaves para incluir número do chamado, nomes, datas…"
        icon={<MessageSquareText className="size-5" />}
        actions={
          <>
            <HistoryButton entity="Setting" entityId="mensagens" label="Mensagens automáticas" size="md" onRestored={() => { setDrafts({}); reload(); }} />
            {podeAlgo && (
              <Button variant="secondary" onClick={restoreAll} disabled={!personalizadas}>
                <RotateCcw className="size-4" /> Restaurar padrão
              </Button>
            )}
          </>
        }
      />

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle className="size-7" />}
            title="Não foi possível carregar as mensagens"
            description={error}
            action={<Button onClick={reload}>Tentar novamente</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por canal">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f.id}
                  onClick={() => setFiltro(f.id)}
                  className={clsx(
                    'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    filtro === f.id ? 'bg-brand-700 text-white dark:bg-brand-500' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar mensagem…" aria-label="Buscar mensagem" className="pl-9" />
            </div>
          </div>

          {!podeAlgo && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Seu perfil pode ver estas mensagens, mas não alterá-las.</p>
          )}

          {modulos.length === 0 ? (
            <Card>
              <EmptyState icon={<Search className="size-7" />} title="Nenhuma mensagem encontrada" description="Tente outro termo de busca ou outro canal." />
            </Card>
          ) : (
            <div className="space-y-8">
              {modulos.map(([modulo, lista]) => (
                <section key={modulo} aria-labelledby={`mod-${norm(modulo).replace(/\W+/g, '-')}`}>
                  <h2 id={`mod-${norm(modulo).replace(/\W+/g, '-')}`} className="mb-3 text-lg font-semibold">
                    {modulo}
                  </h2>
                  <div className="space-y-3">
                    {lista.map((i) => (
                      <Editor key={i.chave} item={i} value={valor(i)} exemplos={exemplos} onChange={(v) => setDrafts((d) => ({ ...d, [i.chave]: v }))} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {dirty.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {dirty.length === 1 ? '1 mensagem alterada' : `${dirty.length} mensagens alteradas`} sem salvar
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDrafts({})} disabled={saving}>
                Descartar
              </Button>
              <Button onClick={save} loading={saving} disabled={temErro}>
                <Save className="size-4" /> Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth roles={['TI', 'COMUNICACAO']}>
      <MensagensPage />
    </RequireAuth>
  );
}
