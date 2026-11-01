'use client';

import { Check, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/admin/common';
import { ROLES, ROLE_COLOR, ROLE_HINT } from '@/components/admin/permissoes';
import { AccessProfile } from '@/components/admin/types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Switch, Textarea, clsx, useConfirm, useToast } from '@/components/ui';
import type { Role } from '@/lib/api';
import { api } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/format';

const erro = 'ring-2! ring-rose-500!';
const msgErro = (e: any) => (e.status === 409 ? e.message || 'Já existe um cadastro com esse nome' : e.message);

// ---------------- Perfis ----------------

interface PerfilDraft {
  id?: string;
  name: string;
  description: string;
  roles: Role[];
  isDefault: boolean;
}

function PerfilModal({ draft, setDraft, onSaved, meuPerfil }: { draft: PerfilDraft; setDraft: (d: PerfilDraft | null) => void; onSaved: () => void; meuPerfil: boolean }) {
  const toast = useToast();
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<PerfilDraft>) => setDraft({ ...draft, ...p });
  const errs = {
    name: draft.name.trim().length < 2 ? 'Informe o nome do perfil (mín. 2 letras).' : undefined,
    roles: !draft.roles.length ? 'Escolha ao menos uma permissão.' : undefined,
  };
  const toggle = (r: Role) => set({ roles: draft.roles.includes(r) ? draft.roles.filter((x) => x !== r) : [...draft.roles, r] });
  const save = async () => {
    setTried(true);
    if (errs.name || errs.roles) return;
    setSaving(true);
    try {
      const body = { name: draft.name.trim(), description: draft.description.trim() || null, roles: draft.roles, isDefault: draft.isDefault };
      const r = draft.id ? await api<{ usuariosAtualizados?: number }>(`/admin/perfis/${draft.id}`, { method: 'PATCH', json: body }) : await api('/admin/perfis', { method: 'POST', json: body });
      const n = (r as { usuariosAtualizados?: number })?.usuariosAtualizados;
      toast(draft.id ? `Perfil atualizado${n ? `; ${n} usuário(s) com as novas permissões` : ''}` : 'Perfil criado');
      onSaved();
    } catch (e: any) {
      toast(msgErro(e), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={() => setDraft(null)}
      title={draft.id ? 'Editar perfil' : 'Novo perfil'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => setDraft(null)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            {draft.id ? 'Salvar perfil' : 'Criar perfil'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field required label="Nome do perfil" error={tried ? errs.name : undefined} hint="Como o perfil aparece no cadastro (ex.: Técnico TI, Usuário padrão, Supervisor).">
          <Input placeholder="Ex.: Técnico TI" value={draft.name} maxLength={60} autoFocus onChange={(e) => set({ name: e.target.value })} className={clsx(tried && errs.name && erro)} />
        </Field>
        <Field label="Descrição" hint="Para quem é este perfil (ex.: técnicos que atendem chamados de TI).">
          <Textarea placeholder="Ex.: Técnicos que atendem chamados de TI" value={draft.description} maxLength={300} rows={2} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Permissões<span className="ml-0.5 text-rose-600">*</span>
          </span>
          <div className={clsx('grid gap-2 rounded-xl sm:grid-cols-2', tried && errs.roles && 'p-1 ring-2 ring-rose-500')} role="group" aria-label="Permissões">
            {ROLES.map((r) => {
              const on = draft.roles.includes(r);
              const trava = meuPerfil && r === 'ADMIN' && on;
              return (
                <button
                  key={r}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={trava}
                  onClick={() => toggle(r)}
                  className={clsx('flex items-start gap-3 rounded-xl p-3 text-left ring-1 transition disabled:cursor-not-allowed', on ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-900/30' : 'ring-slate-200 hover:ring-slate-300 dark:ring-slate-700')}
                >
                  <span className={clsx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600')}>{on && <Check className="size-3.5" />}</span>
                  <span>
                    <span className="block text-sm font-medium">{ROLE_LABEL[r]}</span>
                    <span className="block text-xs text-slate-500">{trava ? 'É o seu perfil: você não pode tirar o próprio acesso de administrador' : ROLE_HINT[r]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {tried && errs.roles ? <p className="text-xs text-rose-600">{errs.roles}</p> : <p className="text-xs text-slate-500">Marque o que quem tem este perfil pode fazer. Mudar aqui muda na hora para todos os usuários do perfil.</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <Switch checked={draft.isDefault} onChange={(isDefault) => set({ isDefault })} label="Perfil padrão para usuários novos" />
          <p className="mt-1 text-xs text-slate-500">Já vem escolhido no cadastro de usuário novo. Só um perfil pode ser o padrão.</p>
        </div>
      </div>
    </Modal>
  );
}

export function PerfisTab({ perfis, reload, meuPerfilId }: { perfis: AccessProfile[]; reload: () => void; meuPerfilId?: string | null }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<PerfilDraft | null>(null);
  const remove = async (p: AccessProfile) => {
    if (p._count?.users) {
      toast(`Há ${p._count.users} usuário(s) com este perfil. Troque o perfil deles antes de excluir.`, 'error');
      return;
    }
    if (!(await confirm(`Excluir o perfil "${p.name}"?`))) return;
    try {
      await api(`/admin/perfis/${p.id}`, { method: 'DELETE' });
      toast('Perfil excluído');
      reload();
    } catch (e: any) {
      toast(msgErro(e), 'error');
    }
  };
  return (
    <Card>
      <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center dark:border-slate-800">
        <p className="flex-1 text-sm text-slate-500">Cada perfil reúne as permissões de quem o usa. No cadastro, o usuário recebe um perfil.</p>
        <Button onClick={() => setDraft({ name: '', description: '', roles: ['COLABORADOR'], isDefault: false })}>
          <Plus className="size-4" /> Novo perfil
        </Button>
      </div>
      {!perfis.length ? (
        <EmptyState title="Nenhum perfil cadastrado" />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {perfis.map((p) => (
            <li key={p.id} className="flex items-start gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {p.name}
                  {p.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      <Star className="size-3" /> Padrão
                    </span>
                  )}
                </span>
                {p.description && <span className="block text-xs text-slate-500">{p.description}</span>}
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {p.roles.map((r) => (
                    <Badge key={r} className={ROLE_COLOR[r]}>
                      {ROLE_LABEL[r] ?? r}
                    </Badge>
                  ))}
                </span>
              </span>
              <span className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-slate-500">{p._count?.users ?? 0} usuário(s)</span>
              <IconButton label={`Editar perfil ${p.name}`} onClick={() => setDraft({ id: p.id, name: p.name, description: p.description ?? '', roles: p.roles, isDefault: p.isDefault })}>
                <Pencil />
              </IconButton>
              <IconButton label={`Excluir perfil ${p.name}`} tone="danger" onClick={() => remove(p)}>
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {draft && (
        <PerfilModal
          draft={draft}
          setDraft={setDraft}
          meuPerfil={!!draft.id && draft.id === meuPerfilId}
          onSaved={() => {
            setDraft(null);
            reload();
          }}
        />
      )}
      {dialog}
    </Card>
  );
}

// ---------------- Categorias e grupos ----------------

interface Item {
  id: string;
  name: string;
  description: string | null;
  email?: string | null;
  _count?: { users: number };
}

interface ItemDraft {
  id?: string;
  name: string;
  description: string;
  email: string;
}

/** Lista simples com nome, descrição e (nos grupos) e-mail. */
export function ListaCadastroTab({
  itens,
  reload,
  rota,
  nome,
  exemplo,
  ajuda,
  comEmail,
  bloqueiaEmUso,
}: {
  itens: Item[];
  reload: () => void;
  rota: string;
  nome: { um: string; novo: string };
  exemplo: string;
  ajuda: string;
  comEmail?: boolean;
  bloqueiaEmUso?: boolean;
}) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const errs = {
    name: draft && draft.name.trim().length < 2 ? 'Informe o nome (mín. 2 letras).' : undefined,
    email: draft && comEmail && draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) ? 'E-mail inválido.' : undefined,
  };
  const abrir = (d: ItemDraft) => {
    setTried(false);
    setDraft(d);
  };
  const save = async () => {
    if (!draft) return;
    setTried(true);
    if (errs.name || errs.email) return;
    setSaving(true);
    try {
      const body = { name: draft.name.trim(), description: draft.description.trim() || null, ...(comEmail ? { email: draft.email.trim() || null } : {}) };
      await api(draft.id ? `${rota}/${draft.id}` : rota, { method: draft.id ? 'PATCH' : 'POST', json: body });
      toast(draft.id ? 'Salvo' : `${nome.um} criado(a)`);
      setDraft(null);
      reload();
    } catch (e: any) {
      toast(msgErro(e), 'error');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (i: Item) => {
    const n = i._count?.users ?? 0;
    if (bloqueiaEmUso && n) {
      toast(`Há ${n} usuário(s) nesta ${nome.um.toLowerCase()}. Troque antes de excluir.`, 'error');
      return;
    }
    if (!(await confirm(n ? `Excluir "${i.name}"? ${n} usuário(s) deixam de estar nele (o cadastro deles continua).` : `Excluir "${i.name}"?`))) return;
    try {
      await api(`${rota}/${i.id}`, { method: 'DELETE' });
      toast('Excluído');
      reload();
    } catch (e: any) {
      toast(msgErro(e), 'error');
    }
  };
  return (
    <Card>
      <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center dark:border-slate-800">
        <p className="flex-1 text-sm text-slate-500">{ajuda}</p>
        <Button onClick={() => abrir({ name: '', description: '', email: '' })}>
          <Plus className="size-4" /> {nome.novo}
        </Button>
      </div>
      {!itens.length ? (
        <EmptyState title="Nada cadastrado ainda" />
      ) : (
        <ul className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 dark:divide-slate-800">
          {itens.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3 sm:border-b sm:border-slate-100 dark:sm:border-slate-800">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{i.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {[i.description, i.email, `${i._count?.users ?? 0} usuário(s)`].filter(Boolean).join(' · ')}
                </span>
              </span>
              <IconButton label={`Editar ${i.name}`} onClick={() => abrir({ id: i.id, name: i.name, description: i.description ?? '', email: i.email ?? '' })}>
                <Pencil />
              </IconButton>
              <IconButton label={`Excluir ${i.name}`} tone="danger" onClick={() => remove(i)}>
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {draft && (
        <Modal
          open
          onClose={() => setDraft(null)}
          title={draft.id ? `Editar ${nome.um.toLowerCase()}` : nome.novo}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button onClick={save} loading={saving}>
                Salvar
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field required label="Nome" error={tried ? errs.name : undefined} hint={`Ex.: ${exemplo}.`}>
              <Input placeholder={`Ex.: ${exemplo}`} value={draft.name} maxLength={comEmail ? 80 : 60} autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={clsx(tried && errs.name && erro)} />
            </Field>
            <Field label="Descrição" hint="Opcional. Ajuda quem cadastra a escolher certo.">
              <Textarea placeholder="Ex.: Equipe responsável pelos chamados de TI" value={draft.description} maxLength={300} rows={2} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            {comEmail && (
              <Field label="E-mail do grupo" error={tried ? errs.email : undefined} hint="Opcional. Caixa da equipe (ex.: ti@suaempresa.com.br).">
                <Input placeholder="Ex.: ti@suaempresa.com.br" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={clsx(tried && errs.email && erro)} />
              </Field>
            )}
          </div>
        </Modal>
      )}
      {dialog}
    </Card>
  );
}
