'use client';

import { ArrowLeft, ExternalLink, Eye, EyeOff, ImageOff, Megaphone, Pencil, Plus, Rocket, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { RequireAuth } from '@/components/require-auth';
import { Badge, Button, Card, EmptyState, Field, ImageUpload, Input, Loading, Modal, PageHeader, Select, Switch, Table, Textarea, clsx, useConfirm, useToast } from '@/components/ui';
import { DragHandle, IconButton, MoveControls, StatusBadge, useOpenOnNew } from '@/components/admin/common';
import { RichEditor } from '@/components/admin/rich-editor';
import { useSortable } from '@/components/admin/sortable';
import { KindBadge, KindSummary, ReleaseBody } from '@/components/novidades/release-view';
import { AdminRelease, KIND_META, KINDS, ReleaseItem, ReleaseKind, SEMVER, fmtReleaseDate } from '@/components/novidades/types';

/** Sugere a próxima versão (aumenta o número do meio: 4.2.0 → 4.3.0). */
function nextVersion(list: AdminRelease[]) {
  const top = list.map((r) => r.version.split('.').map(Number)).sort((a, b) => b[0]! - a[0]! || b[1]! - a[1]! || b[2]! - a[2]!)[0];
  return top ? `${top[0]}.${top[1]! + 1}.0` : '1.0.0';
}

/** Versões do NITERA Resolve. */
type Sistema = 'resolve';
const paginaPublica = (_sistema: Sistema) => '/novidades';

// ───────── item ─────────

interface ItemDraft {
  id?: string;
  kind: ReleaseKind;
  title: string;
  description: string;
  reason?: string | null;
  imageId: string | null;
  image: string | null;
}

function ItemModal({ releaseId, initial, onClose, onSaved }: { releaseId: string; initial: ItemDraft; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [d, setD] = useState(initial);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<ItemDraft>) => setD((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const titleErr = d.title.trim().length < 3 ? 'Informe um título com ao menos 3 caracteres' : undefined;
  const plain = d.description.replace(/<[^>]*>/g, '').trim();
  const descErr = plain.length < 3 && !/<img\s/i.test(d.description) ? 'Descreva o que mudou e onde encontrar' : undefined;

  const cancel = async () => {
    if (dirty && !(await confirm('Descartar as alterações deste item?'))) return;
    onClose();
  };

  const save = async () => {
    setTried(true);
    if (titleErr || descErr) return toast('Confira os campos destacados', 'error');
    setSaving(true);
    try {
      const json = { kind: d.kind, title: d.title.trim(), description: d.description, reason: d.reason?.trim() || null, imageId: d.imageId };
      if (d.id) await api(`/admin/novidades/${releaseId}/itens/${d.id}`, { method: 'PATCH', json });
      else await api(`/admin/novidades/${releaseId}/itens`, { method: 'POST', json });
      toast(d.id ? 'Item salvo' : 'Item adicionado');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={cancel}
      size="lg"
      title={d.id ? 'Editar item' : 'Novo item'}
      footer={
        <>
          <Button variant="secondary" onClick={cancel}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar item
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de melhoria</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KINDS.map((k) => {
              const m = KIND_META[k];
              const Icon = m.icon;
              const active = d.kind === k;
              return (
                <label
                  key={k}
                  className={clsx(
                    'flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition focus-within:ring-2 focus-within:ring-brand-500',
                    active ? `${m.badge} ring-current` : 'ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800',
                  )}
                >
                  <input type="radio" name="kind" value={k} checked={active} onChange={() => set({ kind: k })} className="sr-only" />
                  <Icon className="size-4" aria-hidden /> {m.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label="Título" error={tried ? titleErr : undefined} hint="Curto e direto. Ex.: Abrir chamado pelo WhatsApp">
          <Input placeholder="Ex.: Abrir chamado pelo WhatsApp" value={d.title} maxLength={160} autoFocus={!d.id} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <div className="space-y-1.5">
          <RichEditor label="Descrição" value={d.description} onChange={(html) => set({ description: html })} />
          {tried && descErr ? <p className="text-xs text-rose-600">{descErr}</p> : <p className="text-xs text-slate-500">Explique o que mudou, para quem serve e onde encontrar no sistema.</p>}
        </div>
        <Field label="Por que mudou (opcional)" hint="O motivo da mudança: o problema que resolve ou o pedido que atende.">
          <Textarea placeholder="Ex.: Antes a reserva era feita por telefone e gerava conflitos de horário." rows={2} maxLength={1000} value={d.reason ?? ''} onChange={(e) => set({ reason: e.target.value })} />
        </Field>
        <ImageUpload label="Imagem (opcional)" value={d.image} onChange={(f) => set({ imageId: f?.id ?? null, image: f?.url ?? null })} />
        <p className="text-xs text-slate-500">Use uma captura de tela da funcionalidade. O colaborador pode clicar para ampliar.</p>
      </div>
      {dialog}
    </Modal>
  );
}

// ───────── editor da versão ─────────

interface ReleaseDraft {
  version: string;
  title: string;
  summary: string;
  announce: boolean;
}

function ReleaseEditor({ id: initialId, suggested, sistema, onBack }: { id: string | null; suggested: string; sistema: Sistema; onBack: () => void }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [id, setId] = useState<string | null>(initialId);
  const { data, loading, error, reload, setData } = useApi<AdminRelease>(id ? `/admin/novidades/${id}` : null);
  const empty: ReleaseDraft = { version: suggested, title: '', summary: '', announce: true };
  const [saved, setSaved] = useState<ReleaseDraft>(empty);
  const [d, setD] = useState<ReleaseDraft>(empty);
  const [items, setItems] = useState<ReleaseItem[]>([]);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDraft | null>(null);
  const [preview, setPreview] = useState(false);
  const set = (p: Partial<ReleaseDraft>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (!data) return;
    const v = { version: data.version, title: data.title, summary: data.summary ?? '', announce: data.announce };
    setSaved(v);
    setD(v);
    setItems(data.items);
  }, [data]);

  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const versionErr = !SEMVER.test(d.version.trim()) ? 'Use o formato 4.2.0 (três números separados por ponto)' : undefined;
  const titleErr = d.title.trim().length < 3 ? 'Informe um título com ao menos 3 caracteres' : undefined;

  const sortable = useSortable(items, setItems, async (next) => {
    if (!id) return;
    try {
      const r = await api<AdminRelease>(`/admin/novidades/${id}/itens/ordem`, { method: 'PUT', json: { ids: next.map((i) => i.id) } });
      setItems(r.items);
    } catch (e: any) {
      toast(e.message, 'error');
      reload();
    }
  });

  const back = async () => {
    if (dirty && !(await confirm('Descartar as alterações não salvas desta versão?'))) return;
    onBack();
  };

  const save = async () => {
    setTried(true);
    if (versionErr || titleErr) return toast('Confira os campos destacados', 'error');
    setSaving(true);
    try {
      const json = { version: d.version.trim(), title: d.title.trim(), summary: d.summary.trim() || null, announce: d.announce, ...(id ? {} : { sistema }) };
      const r = await api<AdminRelease>(id ? `/admin/novidades/${id}` : '/admin/novidades', { method: id ? 'PATCH' : 'POST', json });
      toast(id ? 'Versão salva' : 'Versão criada. Agora adicione os itens.');
      if (!id) setId(r.id);
      else setData(r);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!data) return;
    if (dirty) return toast('Salve as alterações antes de publicar', 'error');
    const first = !data.publishedAt;
    const msg = data.published
      ? `Despublicar a versão ${data.version}? Ela some da página de novidades e do rodapé até ser publicada de novo.`
        : `Publicar a versão ${data.version}? Ela aparece para todos em Novidades${first ? ', todos recebem um aviso no sino' : ''}${data.announce ? ' e quem ainda não viu verá a janela "O que há de novo"' : ''}.`;
    if (!(await confirm(msg))) return;
    setPublishing(true);
    try {
      const r = await api<AdminRelease>(`/admin/novidades/${data.id}/publicacao`, { method: 'POST', json: { published: !data.published } });
      setData(r);
      toast(r.published ? 'Versão publicada' : 'Versão despublicada');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const removeItem = async (it: ReleaseItem) => {
    if (!id || !(await confirm(`Excluir o item "${it.title}"?`))) return;
    try {
      await api(`/admin/novidades/${id}/itens/${it.id}`, { method: 'DELETE' });
      setItems((x) => x.filter((i) => i.id !== it.id));
      toast('Item excluído');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (id && loading && !data) return <Loading />;
  if (id && error && !data)
    return (
      <Card>
        <EmptyState title="Não foi possível carregar a versão" description={error} action={<Button onClick={reload}>Tentar novamente</Button>} />
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={back}>
            <ArrowLeft className="size-4" /> Versões
          </Button>
          <h1 className="text-xl font-bold tracking-tight">
            {id ? `Versão ${saved.version}` : 'Nova versão'}
            
          </h1>
          {data && <StatusBadge active={data.published} labels={['Publicada', 'Rascunho']} />}
          {dirty && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Não salva</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {id && (
            <Button variant="secondary" onClick={() => setPreview(true)}>
              <Eye className="size-4" /> Pré-visualizar
            </Button>
          )}
          {data?.published && (
            <a href={`${paginaPublica(sistema)}/${data.version}`} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">
                <ExternalLink className="size-4" /> Ver página de novidades
              </Button>
            </a>
          )}
          {data && (
            <Button variant={data.published ? 'secondary' : 'success'} onClick={togglePublish} loading={publishing}>
              {data.published ? <EyeOff className="size-4" /> : <Megaphone className="size-4" />}
              {data.published ? 'Despublicar' : 'Publicar'}
            </Button>
          )}
          <Button onClick={save} loading={saving}>
            {id ? 'Salvar versão' : 'Criar versão'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="space-y-4 self-start p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold">Dados da versão</h2>
          <Field label="Número da versão" error={tried ? versionErr : undefined} hint="Ex.: 1.1.0 para novidades, 1.0.1 para correções.">
            <Input placeholder="Ex.: 1.1.0" value={d.version} maxLength={14} inputMode="decimal" onChange={(e) => set({ version: e.target.value })} className="font-mono" />
          </Field>
          <Field label="Título" error={tried ? titleErr : undefined}>
            <Input value={d.title} maxLength={160} autoFocus={!id} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Reservas e treinamentos" />
          </Field>
          <Field label="Resumo" hint={`Aparece no topo da versão e na janela de novidades. ${d.summary.length}/600`}>
            <Textarea placeholder="Ex.: Agora dá para acompanhar os chamados de duas equipes numa tela só." value={d.summary} rows={4} maxLength={600} onChange={(e) => set({ summary: e.target.value })} />
          </Field>
          {(
            <>
              <Switch checked={d.announce} onChange={(v) => set({ announce: v })} label='Avisar com a janela "O que há de novo"' />
              <p className="text-xs text-slate-500">
                {d.announce ? 'Cada colaborador verá a janela uma vez, no próximo acesso depois da publicação.' : 'A versão aparece só na página de novidades e no rodapé, sem janela.'}
              </p>
            </>
          )}
          {data && (
            <dl className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
              <dt className="text-slate-500">Publicada em</dt>
              <dd className="text-right">{data.publishedAt ? fmtDateTime(data.publishedAt) : '—'}</dd>
              {(
                <>
                  <dt className="text-slate-500">Viram a janela</dt>
                  <dd className="text-right">{data.views} {data.views === 1 ? 'pessoa' : 'pessoas'}</dd>
                </>
              )}
            </dl>
          )}
        </Card>

        <Card className="min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">O que mudou ({items.length})</h2>
              <p className="text-xs text-slate-500">No portal, os itens aparecem agrupados por tipo, nesta ordem. Arraste para reordenar.</p>
            </div>
            <Button size="sm" disabled={!id} onClick={() => setEditingItem({ kind: 'NOVIDADE', title: '', description: '', imageId: null, image: null })}>
              <Plus className="size-4" /> Adicionar item
            </Button>
          </div>
          {!id ? (
            <EmptyState icon={<Rocket className="size-7" />} title="Crie a versão primeiro" description="Preencha o número e o título e clique em Criar versão. Depois adicione os itens." />
          ) : !items.length ? (
            <EmptyState
              icon={<Plus className="size-7" />}
              title="Nenhum item ainda"
              description="Descreva cada novidade, melhoria, correção ou ajuste de segurança, com imagem."
              action={<Button onClick={() => setEditingItem({ kind: 'NOVIDADE', title: '', description: '', imageId: null, image: null })}>Adicionar item</Button>}
            />
          ) : (
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li
                  key={it.id}
                  {...sortable.itemProps(it.id)}
                  className={clsx(
                    'flex items-center gap-3 rounded-xl bg-slate-50 p-2 pr-1 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:ring-slate-700',
                    sortable.dragId === it.id && 'opacity-50',
                  )}
                >
                  <DragHandle />
                  <MoveControls label={it.title} first={i === 0} last={i === items.length - 1} onUp={() => sortable.move(it.id, -1)} onDown={() => sortable.move(it.id, 1)} />
                  <div className="hidden h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200 sm:grid sm:place-items-center dark:bg-slate-700">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" decoding="async" src={it.image} alt="" className="size-full object-cover object-top" />
                    ) : (
                      <ImageOff className="size-4 text-slate-400" aria-label="Sem imagem" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <KindBadge kind={it.kind} />
                    <button
                      type="button"
                      onClick={() => setEditingItem({ id: it.id, kind: it.kind, title: it.title, description: it.description, reason: it.reason, imageId: it.imageId, image: it.image })}
                      className="mt-0.5 block w-full truncate text-left text-sm font-medium hover:text-brand-700 dark:hover:text-brand-300"
                    >
                      {it.title}
                    </button>
                  </div>
                  <IconButton label={`Editar "${it.title}"`} onClick={() => setEditingItem({ id: it.id, kind: it.kind, title: it.title, description: it.description, reason: it.reason, imageId: it.imageId, image: it.image })}>
                    <Pencil />
                  </IconButton>
                  <IconButton label={`Excluir "${it.title}"`} tone="danger" onClick={() => removeItem(it)}>
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {editingItem && id && (
        <ItemModal
          key={editingItem.id ?? 'novo'}
          releaseId={id}
          initial={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            reload();
          }}
        />
      )}
      {preview && (
        <Modal open onClose={() => setPreview(false)} title="Pré-visualização" size="xl">
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white">
              <p className="text-sm text-white/80 first-letter:uppercase">{data?.publishedAt ? fmtReleaseDate(data.publishedAt) : 'Data da publicação'}</p>
              <h2 className="mt-1 text-3xl font-black">Versão {d.version || '—'}</h2>
              <p className="mt-2 text-lg font-semibold">{d.title || 'Título da versão'}</p>
              {d.summary && <p className="mt-2 text-white/85">{d.summary}</p>}
            </div>
            <KindSummary items={items} />
            <ReleaseBody items={items} />
          </div>
        </Modal>
      )}
      {dialog}
    </div>
  );
}

// ───────── lista ─────────

function NovidadesAdmin() {
  const sistema: Sistema = 'resolve';
  const { data, loading, error, reload, setData } = useApi<AdminRelease[]>('/admin/novidades');
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);

  const openNew = useCallback(() => setEditing({ id: null }), []);
  useOpenOnNew(openNew, !!data);

  const togglePublish = async (r: AdminRelease) => {
    const msg = r.published
      ? `Despublicar a versão ${r.version}? Ela some da página de novidades e do rodapé.`
        : `Publicar a versão ${r.version}?${!r.publishedAt ? ' Todos recebem um aviso no sino.' : ''}${r.announce ? ' Quem ainda não viu verá a janela "O que há de novo".' : ''}`;
    if (!(await confirm(msg))) return;
    try {
      const x = await api<AdminRelease>(`/admin/novidades/${r.id}/publicacao`, { method: 'POST', json: { published: !r.published } });
      setData((data ?? []).map((y) => (y.id === r.id ? x : y)));
      toast(x.published ? 'Versão publicada' : 'Versão despublicada');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const remove = async (r: AdminRelease) => {
    if (!(await confirm(`Excluir a versão ${r.version} e todos os seus itens? Essa ação não pode ser desfeita.`))) return;
    try {
      await api(`/admin/novidades/${r.id}`, { method: 'DELETE' });
      setData((data ?? []).filter((y) => y.id !== r.id));
      toast('Versão excluída');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const currentId = data?.find((r) => r.published)?.id;

  if (editing)
    return (
      <ReleaseEditor
        key={editing.id ?? 'nova'}
        id={editing.id}
        sistema={sistema}
        suggested={nextVersion(data ?? [])}
        onBack={() => {
          setEditing(null);
          reload();
        }}
      />
    );

  return (
    <>
      <PageHeader
        icon={<Rocket className="size-5" />}
        title="Versões e novidades"
        description="Registre cada atualização do sistema e divulgue o que mudou, com texto e imagens."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={paginaPublica(sistema)} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">
                <ExternalLink className="size-4" /> Ver página de novidades
              </Button>
            </a>
            <Button onClick={openNew}>
              <Plus className="size-4" /> Nova versão
            </Button>
          </div>
        }
      />


      {loading && !data ? (
        <Loading />
      ) : error ? (
        <Card>
          <EmptyState title="Não foi possível carregar as versões" description={error} action={<Button onClick={reload}>Tentar novamente</Button>} />
        </Card>
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<Rocket className="size-7" />} title="Nenhuma versão registrada" description="Crie a primeira versão e descreva o que mudou." action={<Button onClick={openNew}>Criar versão</Button>} />
        </Card>
      ) : (
        <Card>
          <Table head={['Versão', 'Itens', 'Status', 'Publicada em', 'Janela', '']}>
            {data.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setEditing({ id: r.id })} className="text-left hover:text-brand-700 dark:hover:text-brand-300">
                    <span className="font-mono font-bold">{r.version}</span>
                    {r.id === currentId && <Badge className="ml-2 bg-coral-500 text-white">Atual</Badge>}
                    <span className="block text-sm text-slate-600 dark:text-slate-300">{r.title}</span>
                  </button>
                </td>
                <td className="px-4 py-3">{r.items.length ? <KindSummary items={r.items} /> : <span className="text-slate-400">Nenhum</span>}</td>
                <td className="px-4 py-3">
                  <StatusBadge active={r.published} labels={['Publicada', 'Rascunho']} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{r.publishedAt ? fmtDateTime(r.publishedAt) : '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{r.announce ? `Sim · ${r.views} ${r.views === 1 ? 'viu' : 'viram'}` : 'Não'}</td>
                <td className="px-2 py-3">
                  <div className="flex justify-end">
                    {r.published && (
                      <a href={`${paginaPublica(sistema)}/${r.version}`} target="_blank" rel="noopener noreferrer" aria-label={`Ver versão ${r.version}`} title="Ver página de novidades" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    <IconButton label={r.published ? `Despublicar ${r.version}` : `Publicar ${r.version}`} onClick={() => togglePublish(r)}>
                      {r.published ? <EyeOff /> : <Megaphone />}
                    </IconButton>
                    <IconButton label={`Editar ${r.version}`} onClick={() => setEditing({ id: r.id })}>
                      <Pencil />
                    </IconButton>
                    <IconButton label={`Excluir ${r.version}`} tone="danger" onClick={() => remove(r)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {dialog}
    </>
  );
}

export default function Page() {
  return (
    <RequireAuth roles={['TI', 'COMUNICACAO']}>
      <NovidadesAdmin />
    </RequireAuth>
  );
}
