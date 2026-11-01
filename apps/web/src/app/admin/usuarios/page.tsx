'use client';

import { Building2, Clock3, Download, KeyRound, Pencil, Plus, Search, ShieldCheck, ShieldOff, Tags, Trash2, Upload, UserCheck, UserPlus, Users, UsersRound, UserX } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { api, downloadAuthenticated, Role } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, fmtRelative, ROLE_LABEL } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { RequireAuth } from '@/components/require-auth';
import { Avatar, Badge, Button, Card, EmptyState, Input, Loading, PageHeader, Select, Skeleton, SortHead, StatCard, Table, Tabs, clsx, useConfirm, useSort, useToast } from '@/components/ui';
import { IconButton, StatusBadge, useOpenOnNew } from '@/components/admin/common';
import { AccessProfile, AdminUser, Department, OrgGroup, UserCategory } from '@/components/admin/types';
import { ROLES, ROLE_COLOR } from '@/components/admin/permissoes';
import { Draft, UserModal, emptyDraft, toDraft } from '@/components/admin/usuario-form';
import { ListaCadastroTab, PerfisTab } from '@/components/admin/cadastros-usuario';
import { ImportarUsuarios } from '@/components/admin/importar-usuarios';

function DepartmentsTab({ departments, reload, counts }: { departments: Department[]; reload: () => void; counts: Map<string, number> }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [name, setName] = useState('');
  const [local, setLocal] = useState('');
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<{ id: string; name: string; location: string } | null>(null);
  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!edit || !edit.name.trim()) return;
    try {
      await api(`/departments/${edit.id}`, { method: 'PATCH', json: { name: edit.name.trim(), location: edit.location.trim() } });
      toast('Setor atualizado');
      setEdit(null);
      reload();
    } catch (e: any) {
      toast(e.status === 409 || e.status >= 500 ? 'Já existe um setor com esse nome' : e.message, 'error');
    }
  };
  const add = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api('/departments', { method: 'POST', json: { name: name.trim(), location: local.trim() || undefined } });
      toast('Setor criado');
      setName('');
      setLocal('');
      reload();
    } catch (e: any) {
      toast(e.status === 409 || e.status >= 500 ? 'Já existe um setor com esse nome' : e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (d: Department) => {
    const n = counts.get(d.id) ?? 0;
    if (!(await confirm(n ? `Excluir o setor "${d.name}"? ${n} usuário(s) ficarão sem setor.` : `Excluir o setor "${d.name}"?`))) return;
    try {
      await api(`/departments/${d.id}`, { method: 'DELETE' });
      toast('Setor excluído');
      reload();
    } catch (e: any) {
      toast(e.status === 409 || e.status === 500 ? 'Não foi possível excluir: o setor ainda está em uso.' : e.message, 'error');
    }
  };
  return (
    <Card>
      <form onSubmit={add} className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row dark:border-slate-800">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo setor" maxLength={80} aria-label="Nome do novo setor" className="sm:max-w-sm" />
        <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Local (ex.: Subsolo)" maxLength={90} aria-label="Local do setor" className="sm:max-w-xs" />
        <Button type="submit" loading={saving} disabled={!name.trim()}>
          <Plus className="size-4" /> Adicionar setor
        </Button>
      </form>
      {departments.length === 0 ? (
        <EmptyState icon={<Building2 className="size-7" />} title="Nenhum setor cadastrado" />
      ) : (
        <ul className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3 dark:divide-slate-800">
          {departments.map((d) => (
            edit?.id === d.id ? (
              <li key={d.id} className="px-4 py-3 sm:border-b sm:border-slate-100 dark:sm:border-slate-800">
                <form onSubmit={salvar} className="grid gap-2">
                  <Input placeholder="Ex.: Recepção de emergência" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={80} aria-label="Nome do setor" autoFocus />
                  <Input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} maxLength={90} placeholder="Local (ex.: Subsolo)" aria-label="Local do setor" />
                  <p className="text-xs text-slate-500">O local é preenchido sozinho no chamado quando alguém escolhe este setor.</p>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={!edit.name.trim()}>Salvar</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
                  </div>
                </form>
              </li>
            ) : (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3 sm:border-b sm:border-slate-100 dark:sm:border-slate-800">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {d.location ? <>Local: {d.location} · </> : <span className="text-amber-600">Sem local · </span>}
                  {counts.get(d.id) ?? 0} usuário(s)
                </span>
              </span>
              <IconButton label={`Editar setor ${d.name}`} onClick={() => setEdit({ id: d.id, name: d.name, location: d.location ?? '' })}>
                <Pencil />
              </IconButton>
              <IconButton label={`Excluir setor ${d.name}`} tone="danger" onClick={() => remove(d)}>
                <Trash2 />
              </IconButton>
            </li>
            )
          ))}
        </ul>
      )}
      {dialog}
    </Card>
  );
}

const TRINTA_DIAS = 30 * 86_400_000;

function UsersAdmin() {
  const { user: me } = useAuth();
  const users = useApi<AdminUser[]>('/admin/users');
  const deps = useApi<Department[]>('/departments');
  const perfis = useApi<AccessProfile[]>('/admin/perfis');
  const categorias = useApi<UserCategory[]>('/admin/categorias-usuario');
  const grupos = useApi<OrgGroup[]>('/admin/grupos');
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<'users' | 'perfis' | 'categorias' | 'grupos' | 'deps'>('users');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importando, setImportando] = useState(false);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  // filtro rápido vindo dos indicadores do topo
  const [acesso, setAcesso] = useState<'' | 'nunca' | 'recente'>('');
  const ordem = useSort<'nome' | 'perfil' | 'setor' | 'acesso'>('nome');

  const openNew = useCallback(() => setDraft(emptyDraft(perfis.data ?? [])), [perfis.data]);
  useOpenOnNew(openNew);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    users.data?.forEach((u) => u.departmentId && m.set(u.departmentId, (m.get(u.departmentId) ?? 0) + 1));
    return m;
  }, [users.data]);

  const list = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const t = norm(q.trim());
    return (users.data ?? []).filter(
      (u) =>
        (!t || [u.name, u.email, u.username, u.jobTitle ?? '', u.department?.name ?? '', u.extension ?? '', u.profile?.name ?? '', u.category?.name ?? '', ...(u.groups ?? []).map((g) => g.name)].some((f) => norm(f).includes(t))) &&
        (!role || u.roles.includes(role as Role)) &&
        (!status || (status === 'ativo' ? u.active : !u.active)) &&
        (!acesso || (acesso === 'nunca' ? !u.lastLoginAt : !!u.lastLoginAt && Date.now() - new Date(u.lastLoginAt).getTime() <= TRINTA_DIAS)),
    );
  }, [users.data, q, role, status, acesso]);
  const ordenada = useMemo(
    () =>
      ordem.apply(list, {
        nome: (u) => u.name,
        perfil: (u) => u.profile?.name,
        setor: (u) => u.department?.name,
        // mais recente primeiro quando "crescente" não faz sentido para datas: invertido de propósito
        acesso: (u) => (u.lastLoginAt ? -new Date(u.lastLoginAt).getTime() : null),
      }),
    [list, ordem],
  );

  const reset2fa = async (u: AdminUser) => {
    if (!(await confirm(`Redefinir a verificação em duas etapas de ${u.name}? O usuário poderá entrar só com a senha e deverá configurar o 2FA novamente.`))) return;
    try {
      await api(`/admin/users/${u.id}/reset-2fa`, { method: 'POST' });
      toast('2FA redefinido');
      users.reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const total = users.data?.length ?? 0;
  const active = users.data?.filter((u) => u.active).length ?? 0;
  const with2fa = users.data?.filter((u) => u.totpEnabled).length ?? 0;
  const ativos = users.data?.filter((u) => u.active) ?? [];
  const recentes = ativos.filter((u) => u.lastLoginAt && Date.now() - new Date(u.lastLoginAt).getTime() <= TRINTA_DIAS).length;
  const nunca = ativos.filter((u) => !u.lastLoginAt).length;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const filtrar = (s: string, a: '' | 'nunca' | 'recente') => {
    setStatus(s);
    setAcesso(a);
    setRole('');
    setQ('');
  };

  return (
    <>
      <PageHeader
        icon={<Users className="size-5" />}
        title="Usuários"
        description={users.data ? `${active} ativos de ${total} · ${with2fa} com verificação em duas etapas` : 'Cadastro de usuários, perfis, categorias, grupos e setores.'}
        actions={
          tab === 'users' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => downloadAuthenticated('/admin/users/exportar', 'usuarios.csv').catch((e) => toast(e.message, 'error'))}>
                <Download className="size-4" /> Exportar
              </Button>
              <Button variant="secondary" onClick={() => setImportando(true)}>
                <Upload className="size-4" /> Importar do GLPI
              </Button>
              <Button onClick={openNew}>
                <UserPlus className="size-4" /> Novo usuário
              </Button>
            </div>
          )
        }
      />

      <Tabs
        label="Seções"
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'users', label: 'Usuários', icon: <Users className="size-4" />, count: total },
          { key: 'perfis', label: 'Perfis', icon: <ShieldCheck className="size-4" />, count: perfis.data?.length ?? 0 },
          { key: 'categorias', label: 'Categorias', icon: <Tags className="size-4" />, count: categorias.data?.length ?? 0 },
          { key: 'grupos', label: 'Grupos', icon: <UsersRound className="size-4" />, count: grupos.data?.length ?? 0 },
          { key: 'deps', label: 'Setores', icon: <Building2 className="size-4" />, count: deps.data?.length ?? 0 },
        ]}
      />

      {tab === 'users' && (
        <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {users.data ? (
            <>
              <StatCard icon={<UserCheck className="size-5" />} tone="brand" label="Usuários ativos" value={active} hint={`de ${total} cadastrados`} onClick={() => filtrar('ativo', '')} />
              <StatCard icon={<ShieldCheck className="size-5" />} tone="emerald" label="Verificação em duas etapas" value={`${pct(with2fa, active)}%`} hint={`${with2fa} de ${active} ativos`} />
              <StatCard icon={<Clock3 className="size-5" />} tone="violet" label="Entraram nos últimos 30 dias" value={recentes} hint={`${pct(recentes, active)}% dos ativos`} onClick={() => filtrar('ativo', 'recente')} />
              <StatCard icon={<UserX className="size-5" />} tone={nunca ? 'amber' : 'emerald'} label="Nunca entraram" value={nunca} hint={nunca ? 'Toque para ver quem' : 'Todos já acessaram'} onClick={nunca ? () => filtrar('ativo', 'nunca') : undefined} />
            </>
          ) : (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)
          )}
        </div>
      )}

      {tab === 'deps' ? (
        deps.loading && !deps.data ? <Loading /> : <DepartmentsTab departments={deps.data ?? []} reload={() => (deps.reload(), users.reload())} counts={counts} />
      ) : tab === 'perfis' ? (
        perfis.loading && !perfis.data ? <Loading /> : <PerfisTab perfis={perfis.data ?? []} reload={() => (perfis.reload(), users.reload())} meuPerfilId={users.data?.find((u) => u.id === me?.id)?.profileId} />
      ) : tab === 'categorias' ? (
        categorias.loading && !categorias.data ? (
          <Loading />
        ) : (
          <ListaCadastroTab
            itens={categorias.data ?? []}
            reload={() => (categorias.reload(), users.reload())}
            rota="/admin/categorias-usuario"
            nome={{ um: 'Categoria', novo: 'Nova categoria' }}
            exemplo="Assistencial, Administrativo, Terceirizado"
            ajuda="Tipo de vínculo da pessoa com a instituição. Obrigatória no cadastro de usuário."
            bloqueiaEmUso
          />
        )
      ) : tab === 'grupos' ? (
        grupos.loading && !grupos.data ? (
          <Loading />
        ) : (
          <ListaCadastroTab
            itens={grupos.data ?? []}
            reload={() => (grupos.reload(), users.reload())}
            rota="/admin/grupos"
            nome={{ um: 'Grupo', novo: 'Novo grupo' }}
            exemplo="TI, Recepção de Consultas, Faturamento"
            ajuda="Grupos da organização. Um usuário pode estar em vários; escolha no cadastro dele."
            comEmail
          />
        )
      ) : users.loading && !users.data ? (
        <Loading />
      ) : users.error ? (
        <Card>
          <EmptyState title="Não foi possível carregar os usuários" description={users.error} action={<Button onClick={users.reload}>Tentar novamente</Button>} />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail, usuário, setor ou ramal…" className="pl-9" aria-label="Buscar usuários" />
            </div>
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-48" aria-label="Filtrar por perfil">
              <option value="">Todos os perfis</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40" aria-label="Filtrar por status">
              <option value="">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </Select>
          </div>
          {(q || role || status || acesso) && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/[0.06] px-4 py-2 text-xs text-slate-500 dark:border-white/[0.06]" aria-live="polite">
              <span>
                {list.length} de {total} {total === 1 ? 'usuário' : 'usuários'}
              </span>
              {acesso && <Badge className="bg-brand-50 text-brand-800 dark:bg-brand-500/20 dark:text-brand-100">{acesso === 'nunca' ? 'Nunca entraram' : 'Entraram nos últimos 30 dias'}</Badge>}
              <button type="button" onClick={() => filtrar('', '')} className="ml-auto rounded-md px-2 py-1 font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/10">
                Limpar filtros
              </button>
            </div>
          )}
          {list.length === 0 ? (
            <EmptyState icon={<Search className="size-7" />} title="Nenhum usuário encontrado" description="Ajuste a busca ou os filtros." />
          ) : (
            <Table
              head={[
                <SortHead key="n" label="Usuário" dir={ordem.dirOf('nome')} onClick={() => ordem.toggle('nome')} />,
                <SortHead key="p" label="Perfil" dir={ordem.dirOf('perfil')} onClick={() => ordem.toggle('perfil')} />,
                <SortHead key="s" label="Setor e grupos" dir={ordem.dirOf('setor')} onClick={() => ordem.toggle('setor')} />,
                'Status',
                '2FA',
                <SortHead key="a" label="Último acesso" dir={ordem.dirOf('acesso')} onClick={() => ordem.toggle('acesso')} />,
                '',
              ]}
            >
              {ordenada.map((u) => (
                <tr key={u.id} className={clsx('transition-colors hover:bg-brand-50/40 dark:hover:bg-white/[0.03]', !u.active && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setDraft(toDraft(u))}>
                      <Avatar name={u.name} src={u.avatarUrl} size={36} />
                      <span className="min-w-0">
                        <span className="block font-medium [overflow-wrap:anywhere] hover:text-brand-600 md:whitespace-nowrap">
                          {u.name}
                          {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(você)</span>}
                        </span>
                        <span className="block text-xs [overflow-wrap:anywhere] text-slate-500">
                          {u.email.endsWith('@sem-email.invalid') ? <span className="text-amber-600">sem e-mail próprio</span> : u.email} · <span className="font-mono">{u.username}</span>
                          {u.extension && <> · ramal {u.extension}</>}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="mb-1 block text-sm font-medium">{u.profile?.name ?? <span className="text-amber-600">Sem perfil</span>}</span>
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} className={ROLE_COLOR[r]}>
                          {ROLE_LABEL[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="block">{u.department?.name ?? '—'}</span>
                    {u.jobTitle && <span className="block text-xs text-slate-500">{u.jobTitle}</span>}
                    {u.category && <span className="block text-xs text-slate-500">{u.category.name}</span>}
                    {!!u.groups?.length && <span className="block max-w-[200px] truncate text-xs text-slate-500" title={u.groups.map((g) => g.name).join(', ')}>Grupos: {u.groups.map((g) => g.name).join(', ')}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={u.active && !(u.validUntil && new Date(u.validUntil) <= new Date())} />
                    {u.validUntil && (
                      <span className={clsx('mt-1 block text-xs whitespace-nowrap', new Date(u.validUntil) <= new Date() ? 'text-rose-600' : 'text-slate-500')}>
                        {new Date(u.validUntil) <= new Date() ? 'Venceu em ' : 'Até '}
                        {new Date(u.validUntil).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.totpEnabled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400" title="Verificação em duas etapas ativa">
                        <ShieldCheck className="size-4" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="Sem verificação em duas etapas">
                        <ShieldOff className="size-4" /> Não
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500" title={u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : undefined}>
                    {u.lastLoginAt ? fmtRelative(u.lastLoginAt) : 'Nunca'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <IconButton label={`Editar ${u.name}`} onClick={() => setDraft(toDraft(u))}>
                        <Pencil />
                      </IconButton>
                      <IconButton label={`Redefinir 2FA de ${u.name}`} disabled={!u.totpEnabled} onClick={() => reset2fa(u)}>
                        <KeyRound />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {draft && (
        <UserModal
          key={draft.id ?? 'new'}
          draft={draft}
          setDraft={setDraft}
          departments={deps.data ?? []}
          profiles={perfis.data ?? []}
          categories={categorias.data ?? []}
          groups={grupos.data ?? []}
          isSelf={draft.id === me?.id}
          onSaved={() => {
            setDraft(null);
            users.reload();
            perfis.reload();
            categorias.reload();
            grupos.reload();
          }}
        />
      )}
      {importando && <ImportarUsuarios profiles={perfis.data ?? []} categories={categorias.data ?? []} onClose={() => setImportando(false)} onDone={() => (users.reload(), perfis.reload(), categorias.reload())} />}
      {dialog}
    </>
  );
}

export default function Page() {
  return (
    <RequireAuth roles={['ADMIN']}>
      <UsersAdmin />
    </RequireAuth>
  );
}
