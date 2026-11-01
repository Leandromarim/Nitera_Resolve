'use client';

import { Check, Copy, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { AvatarPicker } from '@/components/avatar-picker';
import { Section } from '@/components/admin/common';
import { PASSWORD_RULE, SENHA_SIMPLES_DIAS, SENHA_SIMPLES_MIN, generatePassword, passwordChecks } from '@/components/admin/password';
import { ROLE_COLOR, ROLE_HINT } from '@/components/admin/permissoes';
import { AccessProfile, AdminUser, Department, OrgGroup, UserCategory } from '@/components/admin/types';
import { Badge, Button, Field, Input, Modal, Select, Switch, clsx, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/format';

export interface Draft {
  id?: string;
  username: string;
  lastName: string;
  firstName: string;
  password: string;
  password2: string;
  /** senha provisória simples: aceita senha fácil, só serve para o primeiro acesso */
  senhaSimples: boolean;
  email: string;
  ticketEmail: string;
  ticketEmailOn: boolean;
  phone: string;
  extension: string;
  jobTitle: string;
  departmentId: string;
  categoryId: string;
  groupIds: string[];
  profileId: string;
  /** '' = ainda não escolhido (cadastro novo), 'data' = tem data, 'sem' = sem validade */
  validade: '' | 'data' | 'sem';
  validUntil: string;
  active: boolean;
  avatarUrl: string | null;
}

export const emptyDraft = (profiles: AccessProfile[] = []): Draft => ({
  username: '',
  lastName: '',
  firstName: '',
  password: '',
  password2: '',
  senhaSimples: false,
  email: '',
  ticketEmail: '',
  ticketEmailOn: true,
  phone: '',
  extension: '',
  jobTitle: '',
  departmentId: '',
  categoryId: '',
  groupIds: [],
  profileId: profiles.find((p) => p.isDefault)?.id ?? '',
  validade: '',
  validUntil: '',
  active: true,
  avatarUrl: null,
});

/** yyyy-mm-dd no fuso do navegador */
const diaLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const toDraft = (u: AdminUser): Draft => {
  const [first, ...rest] = u.name.trim().split(/\s+/);
  return {
    id: u.id,
    username: u.username,
    firstName: u.firstName ?? first ?? '',
    lastName: u.lastName ?? rest.join(' '),
    password: '',
    password2: '',
    senhaSimples: false,
    email: u.email,
    ticketEmail: u.ticketEmail ?? '',
    ticketEmailOn: u.ticketEmailOn ?? true,
    phone: u.phone ?? '',
    extension: u.extension ?? '',
    jobTitle: u.jobTitle ?? '',
    departmentId: u.departmentId ?? '',
    categoryId: u.categoryId ?? '',
    groupIds: (u.groups ?? []).map((g) => g.id),
    profileId: u.profileId ?? '',
    validade: u.validUntil ? 'data' : 'sem',
    validUntil: u.validUntil ? diaLocal(u.validUntil) : '',
    active: u.active,
    avatarUrl: u.avatarUrl ?? null,
  };
};

function suggestUsername(first: string, last: string) {
  const parts = `${first} ${last}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  return (parts.length > 1 ? `${parts[0]}.${parts.at(-1)}` : parts[0]!).slice(0, 40);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const erro = 'ring-2! ring-rose-500!';

function PasswordInput({ value, onChange, label, invalid }: { value: string; onChange: (v: string) => void; label: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="relative">
      <Input placeholder="Digite a senha" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className={clsx('pr-20 font-mono', invalid && erro)} aria-label={label} />
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2">
        {value && (
          <button type="button" onClick={copy} className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Copiar senha">
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          </button>
        )}
        <button type="button" onClick={() => setShow((s) => !s)} className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export function UserModal({
  draft,
  setDraft,
  departments,
  profiles,
  categories,
  groups,
  onSaved,
  isSelf,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  departments: Department[];
  profiles: AccessProfile[];
  categories: UserCategory[];
  groups: OrgGroup[];
  onSaved: () => void;
  isSelf: boolean;
}) {
  const toast = useToast();
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userTouched, setUserTouched] = useState(!!draft.id);
  const set = (p: Partial<Draft>) => {
    const next = { ...draft, ...p };
    if (!userTouched && ('firstName' in p || 'lastName' in p)) next.username = suggestUsername(next.firstName, next.lastName);
    setDraft(next);
  };
  const novo = !draft.id;
  const hoje = diaLocal(new Date().toISOString());
  const perfil = profiles.find((p) => p.id === draft.profileId);

  const errs: Record<string, string | null> = {
    username: !/^[a-z0-9._-]{3,40}$/.test(draft.username) ? 'Use 3 a 40 caracteres: minúsculas, números, ponto, hífen ou sublinhado.' : null,
    lastName: !draft.lastName.trim() ? 'Informe o sobrenome.' : null,
    firstName: !draft.firstName.trim() ? 'Informe o nome.' : null,
    password: !(novo || draft.password) ? null : draft.senhaSimples ? (draft.password.length < SENHA_SIMPLES_MIN ? `Use ao menos ${SENHA_SIMPLES_MIN} caracteres.` : null) : !PASSWORD_RULE.test(draft.password) ? 'A senha não atende aos requisitos abaixo.' : null,
    password2: (novo || draft.password) && draft.password2 !== draft.password ? 'As duas senhas precisam ser iguais.' : null,
    email: !EMAIL_RE.test(draft.email.trim()) ? 'Informe um e-mail válido (ex.: maria.silva@suaempresa.com.br).' : null,
    ticketEmail: draft.ticketEmail.trim() && !EMAIL_RE.test(draft.ticketEmail.trim()) ? 'E-mail inválido. Deixe vazio para usar o e-mail acima.' : null,
    validUntil: !draft.validade
      ? 'Escolha uma data ou marque "Sem data de validade".'
      : draft.validade === 'data' && !draft.validUntil
        ? 'Informe a data.'
        : draft.validade === 'data' && novo && draft.validUntil < hoje
          ? 'A data não pode estar no passado.'
          : null,
    categoryId: !draft.categoryId ? 'Escolha a categoria.' : null,
    profileId: !draft.profileId ? 'Escolha o perfil.' : isSelf && perfil && !perfil.roles.includes('ADMIN') ? 'Você não pode tirar o seu próprio acesso de administrador.' : null,
  };
  const e = (k: string) => (tried ? errs[k] ?? undefined : undefined);

  const toggleGroup = (id: string) => set({ groupIds: draft.groupIds.includes(id) ? draft.groupIds.filter((g) => g !== id) : [...draft.groupIds, id] });

  const save = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) {
      toast('Preencha os campos marcados em vermelho.', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        username: draft.username,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim().toLowerCase(),
        ticketEmail: draft.ticketEmail.trim().toLowerCase() || null,
        ticketEmailOn: draft.ticketEmailOn,
        phone: draft.phone.trim() || null,
        extension: draft.extension.trim() || null,
        jobTitle: draft.jobTitle.trim() || null,
        departmentId: draft.departmentId || null,
        categoryId: draft.categoryId,
        groupIds: draft.groupIds,
        profileId: draft.profileId,
        // vale até o fim do dia escolhido, no horário local
        validUntil: draft.validade === 'data' ? new Date(`${draft.validUntil}T23:59:59`).toISOString() : null,
        active: draft.active,
        avatarUrl: draft.avatarUrl,
        ...(draft.password ? { password: draft.password, senhaSimples: draft.senhaSimples } : {}),
      };
      if (draft.id) await api(`/admin/users/${draft.id}`, { method: 'PATCH', json: body });
      else await api('/admin/users', { method: 'POST', json: body });
      toast(draft.id ? (draft.password ? 'Usuário atualizado e senha redefinida' : 'Usuário atualizado') : 'Usuário criado');
      onSaved();
    } catch (err: any) {
      toast(err.status === 409 || err.status >= 500 ? 'Não foi possível salvar. Verifique se o e-mail ou o usuário já estão em uso.' : err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const checks = passwordChecks(draft.password);

  return (
    <Modal
      open
      onClose={() => setDraft(null)}
      title={draft.id ? 'Editar usuário' : 'Novo usuário'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => setDraft(null)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            {draft.id ? 'Salvar alterações' : 'Criar usuário'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          Campos com <span className="font-semibold text-rose-600">*</span> são obrigatórios. Embaixo de cada campo está como preencher.
        </p>

        <Section title="Identificação">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <AvatarPicker name={`${draft.firstName} ${draft.lastName}`.trim() || 'Novo usuário'} value={draft.avatarUrl} onChange={(avatarUrl) => set({ avatarUrl })} />
            </div>
            <Field required label="Nome" error={e('firstName')} hint="Primeiro nome, como no documento (ex.: Maria).">
              <Input placeholder="Ex.: Maria" value={draft.firstName} maxLength={60} autoFocus onChange={(ev) => set({ firstName: ev.target.value })} className={clsx(e('firstName') && erro)} />
            </Field>
            <Field required label="Sobrenome" error={e('lastName')} hint="Os demais nomes (ex.: Silva Santos).">
              <Input placeholder="Ex.: Silva Santos" value={draft.lastName} maxLength={60} onChange={(ev) => set({ lastName: ev.target.value })} className={clsx(e('lastName') && erro)} />
            </Field>
            <Field required label="Usuário (login)" error={e('username')} hint="Usado para entrar. Minúsculas, sem acento nem espaço (ex.: maria.silva). Sugerido a partir do nome." className="sm:col-span-2">
              <Input placeholder="Ex.: maria.silva" value={draft.username} onChange={(ev) => (setUserTouched(true), set({ username: ev.target.value.toLowerCase() }))} autoComplete="off" className={clsx('font-mono', e('username') && erro)} />
            </Field>
          </div>
        </Section>

        <Section title="Senha" description={novo ? 'A pessoa troca a senha no primeiro acesso. Envie por um canal seguro.' : 'Deixe em branco para manter a senha atual.'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:col-span-2 dark:bg-slate-800/40 dark:ring-slate-700">
              <Switch checked={draft.senhaSimples} onChange={(senhaSimples) => set({ senhaSimples })} label="Senha provisória simples" />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Aceita uma senha fácil (ex.: 1234) só para o primeiro acesso. Ao entrar, a pessoa só consegue criar a própria senha, com maiúscula, minúscula, número e símbolo; o resto do sistema fica fechado até a troca. A senha provisória vence em {SENHA_SIMPLES_DIAS} dias.
              </p>
            </div>
            <Field required={novo} label={novo ? 'Senha' : 'Nova senha'} error={e('password')} hint={draft.senhaSimples ? `Senha provisória: mínimo ${SENHA_SIMPLES_MIN} caracteres, qualquer combinação.` : 'Mínimo 6 caracteres, com maiúscula, minúscula, número e símbolo. Use Gerar para criar uma forte.'}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <PasswordInput value={draft.password} onChange={(password) => set({ password })} label={novo ? 'Senha' : 'Nova senha'} invalid={!!e('password')} />
                </div>
                <Button type="button" variant="secondary" onClick={() => {
                  const p = generatePassword();
                  set({ password: p, password2: p });
                }}>
                  <RefreshCw className="size-4" /> Gerar
                </Button>
              </div>
            </Field>
            <Field required={novo || !!draft.password} label="Confirmação da senha" error={e('password2')} hint="Digite a mesma senha de novo.">
              <PasswordInput value={draft.password2} onChange={(password2) => set({ password2 })} label="Confirmação da senha" invalid={!!e('password2')} />
            </Field>
          </div>
          {(draft.password || novo) && !draft.senhaSimples && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Requisitos da senha">
              {checks.map((c) => (
                <li key={c.label} className={clsx('inline-flex items-center gap-1 text-xs', c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500')}>
                  {c.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />} {c.label}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Contato e chamados">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field required label="E-mail" error={e('email')} hint={draft.email.endsWith('@sem-email.invalid') ? 'Veio do GLPI sem e-mail próprio. Troque pelo e-mail da pessoa quando tiver; enquanto isso ela não usa o Esqueci minha senha.' : 'E-mail institucional da pessoa. Também serve para entrar e para o Esqueci minha senha.'} className="sm:col-span-2">
              <Input placeholder="Ex.: maria.silva@suaempresa.com.br" type="email" value={draft.email} onChange={(ev) => set({ email: ev.target.value })} autoComplete="off" className={clsx(e('email') && erro)} />
            </Field>
            <Field label="E-mail para receber os chamados" error={e('ticketEmail')} hint="Para onde vão os avisos dos chamados desta pessoa. Deixe vazio para usar o e-mail acima." className="sm:col-span-2">
              <Input type="email" value={draft.ticketEmail} placeholder={draft.email || 'Igual ao e-mail acima'} onChange={(ev) => set({ ticketEmail: ev.target.value })} autoComplete="off" className={clsx(e('ticketEmail') && erro)} />
            </Field>
            <div className="sm:col-span-2">
              <Switch checked={draft.ticketEmailOn} onChange={(ticketEmailOn) => set({ ticketEmailOn })} label="Receber os avisos dos chamados por e-mail" />
              <p className="mt-1 text-xs text-slate-500">Desligado, a pessoa acompanha os chamados só pelo sistema.</p>
            </div>
            <Field label="Telefone / WhatsApp" hint="Com DDD (ex.: 62 99999-0000). Usado para avisos de chamados.">
              <Input placeholder="Ex.: (62) 99999-0000" value={draft.phone} maxLength={30} inputMode="tel" onChange={(ev) => set({ phone: ev.target.value })} />
            </Field>
            <Field label="Ramal" hint="Só números (ex.: 2210). Já vai preenchido quando a pessoa abre chamado.">
              <Input placeholder="Ex.: 2045" value={draft.extension} maxLength={20} inputMode="numeric" onChange={(ev) => set({ extension: ev.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Organização">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Setor" hint="Onde a pessoa trabalha. O local do setor vai preenchido nos chamados.">
              <Select value={draft.departmentId} onChange={(ev) => set({ departmentId: ev.target.value })}>
                <option value="">Sem setor</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cargo" hint="Ex.: Enfermeira, Analista de Suporte.">
              <Input placeholder="Ex.: Enfermeira" value={draft.jobTitle} maxLength={80} onChange={(ev) => set({ jobTitle: ev.target.value })} />
            </Field>
            <Field required label="Categoria" error={e('categoryId')} hint="Tipo de vínculo (ex.: Assistencial, Terceirizado). Cadastre novas na aba Categorias." className="sm:col-span-2">
              <Select value={draft.categoryId} onChange={(ev) => set({ categoryId: ev.target.value })} className={clsx(e('categoryId') && erro)}>
                <option value="">Selecione…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Grupos</span>
            {groups.length ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Grupos">
                {groups.map((g) => {
                  const on = draft.groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleGroup(g.id)}
                      className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition', on ? 'bg-brand-50 font-medium text-brand-800 ring-2 ring-brand-500 dark:bg-brand-900/30 dark:text-brand-200' : 'ring-slate-200 hover:ring-slate-300 dark:ring-slate-700')}
                    >
                      {on && <Check className="size-3.5" />}
                      {g.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-amber-600">Nenhum grupo cadastrado. Crie na aba Grupos.</p>
            )}
            <span className="block text-xs text-slate-500">Grupos da organização a que a pessoa pertence (ex.: TI, Recepção de Consultas). Pode marcar mais de um.</span>
          </div>
        </Section>

        <Section title="Acesso">
          <Field required label="Perfil" error={e('profileId')} hint="Define o que a pessoa pode fazer no sistema. As permissões do perfil aparecem abaixo; para mudá-las, use a aba Perfis.">
            <Select value={draft.profileId} onChange={(ev) => set({ profileId: ev.target.value })} className={clsx(e('profileId') && erro)}>
              <option value="">Selecione…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          {perfil && (
            <ul className="grid gap-1.5 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/50" aria-label="Permissões do perfil">
              {perfil.roles.map((r) => (
                <li key={r} className="text-xs">
                  <Badge className={ROLE_COLOR[r]}>{ROLE_LABEL[r] ?? r}</Badge>
                  <span className="mt-0.5 block text-slate-500">{ROLE_HINT[r]}</span>
                </li>
              ))}
            </ul>
          )}
          <Field required label="Válido até" error={e('validUntil')} hint="Último dia em que a conta pode entrar (ex.: fim do contrato ou do estágio). Depois dessa data o login é recusado.">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="date"
                value={draft.validUntil}
                min={novo ? hoje : undefined}
                disabled={draft.validade === 'sem'}
                onChange={(ev) => set({ validUntil: ev.target.value, validade: ev.target.value ? 'data' : '' })}
                className={clsx('w-auto', e('validUntil') && erro)}
                aria-label="Válido até"
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={draft.validade === 'sem'}
                  onChange={(ev) => set(ev.target.checked ? { validade: 'sem', validUntil: '' } : { validade: '' })}
                />
                Sem data de validade
              </label>
            </div>
          </Field>
          {draft.validade === 'data' && draft.validUntil && draft.validUntil < hoje && <p className="text-xs text-amber-600">Essa data já passou: a conta não consegue entrar.</p>}
          {!isSelf && (
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <Switch checked={draft.active} onChange={(active) => set({ active })} label="Usuário ativo" />
              {!draft.active && <p className="mt-2 text-xs text-amber-600">Usuários inativos não conseguem entrar e são desconectados imediatamente.</p>}
            </div>
          )}
        </Section>
      </div>
    </Modal>
  );
}
