'use client';

import { Check, KeyRound, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { IconePonto } from '@/lib/icones';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/require-auth';
import { AvatarPicker } from '@/components/avatar-picker';
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, useToast } from '@/components/ui';
import { api, refreshSession } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/format';
import { destinoSeguro } from '@/lib/destino';

const RULES = [
  { test: (p: string) => p.length >= 6, label: 'Pelo menos 6 caracteres' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Uma letra maiúscula' },
  { test: (p: string) => /[a-z]/.test(p), label: 'Uma letra minúscula' },
  { test: (p: string) => /\d/.test(p), label: 'Um número' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Um símbolo (!@#$…)' },
];

function PasswordCard({ forced }: { forced: boolean }) {
  const toast = useToast();
  const { reload } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const passed = RULES.filter((r) => r.test(f.next)).length;
  const ok = passed === RULES.length && f.next === f.confirm && !!f.current;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/auth/change-password', { method: 'POST', json: { currentPassword: f.current, newPassword: f.next } });
      toast('Senha alterada. As outras sessões foram encerradas.');
      setF({ current: '', next: '', confirm: '' });
      // novo token: o anterior podia ser de senha provisória (só servia para esta troca)
      await refreshSession();
      await reload();
      // senha trocada: segue direto para a intranet (ou para onde a pessoa ia antes do login)
      const next = destinoSeguro(params.get('next'), '/');
      router.replace(next.startsWith('/perfil') ? '/' : next);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound className="size-5 text-brand-600" /> Alterar senha
      </h2>
      {forced && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Por segurança, defina uma nova senha antes de continuar.</p>}
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Senha atual">
          <Input placeholder="Digite sua senha atual" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        </Field>
        <Field label="Nova senha">
          <Input placeholder="Digite a nova senha" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        </Field>
        <div className="flex gap-1">
          {RULES.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < passed ? (passed < 3 ? 'bg-rose-500' : passed < 5 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200 dark:bg-slate-700'}`} />
          ))}
        </div>
        <ul className="grid gap-1 text-xs sm:grid-cols-2">
          {RULES.map((r) => (
            <li key={r.label} className={`flex items-center gap-1.5 ${r.test(f.next) ? 'text-emerald-600' : 'text-slate-500'}`}>
              {r.test(f.next) ? <Check className="size-3.5" /> : <X className="size-3.5" />} {r.label}
            </li>
          ))}
        </ul>
        <Field label="Confirmar nova senha" error={f.confirm && f.confirm !== f.next ? 'As senhas não conferem' : undefined}>
          <Input placeholder="Repita a nova senha" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        </Field>
        <Button type="submit" disabled={!ok} loading={loading}>
          Salvar nova senha
        </Button>
      </form>
    </Card>
  );
}

function TwoFactorCard() {
  const { user, reload } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [disable, setDisable] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      setSetup(await api('/auth/2fa/setup', { method: 'POST' }));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  const confirm = async (path: '/auth/2fa/enable' | '/auth/2fa/disable') => {
    setLoading(true);
    try {
      await api(path, { method: 'POST', json: { code } });
      toast(path.endsWith('enable') ? 'Verificação em duas etapas ativada' : 'Verificação em duas etapas desativada');
      setSetup(null);
      setDisable(false);
      setCode('');
      if (user?.duasEtapasPendente && path.endsWith('enable')) {
        // perfil obrigado a usar duas etapas: pega um token novo, já liberado, e volta para onde a pessoa ia
        await refreshSession();
        router.replace(destinoSeguro(params.get('next'), '/'));
        return;
      }
      await reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-5 text-emerald-600" /> Verificação em duas etapas
          </h2>
          <p className="mt-1 text-sm text-slate-500">Além da senha, pede um código do aplicativo autenticador do seu celular. Recomendado para todos e essencial para administradores.</p>
        </div>
        <Badge className={user?.totpEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}>
          {user?.totpEnabled ? 'Ativa' : 'Desativada'}
        </Badge>
      </div>
      <div className="mt-5">
        {user?.duasEtapasPendente && (
          <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            Seu perfil exige a verificação em duas etapas. Ative agora para continuar usando o sistema.
          </p>
        )}
        {user?.totpEnabled ? (
          <Button variant="secondary" onClick={() => setDisable(true)}>
            <ShieldOff className="size-4" /> Desativar
          </Button>
        ) : (
          <Button onClick={start} loading={loading}>
            <ShieldCheck className="size-4" /> Ativar agora
          </Button>
        )}
      </div>

      <Modal
        open={!!setup}
        onClose={() => setSetup(null)}
        title="Ativar verificação em duas etapas"
        footer={
          <Button disabled={code.length !== 6} loading={loading} onClick={() => confirm('/auth/2fa/enable')}>
            Confirmar e ativar
          </Button>
        }
      >
        <ol className="space-y-4 text-sm">
          <li>
            <b>1.</b> Instale o Google Authenticator ou Microsoft Authenticator no celular.
          </li>
          <li>
            <b>2.</b> Escaneie o QR Code:
            {setup && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={setup.qrCode} alt="QR Code para o aplicativo autenticador" className="mx-auto mt-3 size-48 rounded-xl bg-white p-2 ring-1 ring-slate-200" />
            )}
            <p className="mt-2 text-center text-xs text-slate-500">
              Ou digite a chave: <code className="font-mono select-all">{setup?.secret}</code>
            </p>
          </li>
          <li>
            <b>3.</b> Digite o código de 6 dígitos que aparece no aplicativo:
            <Input
              className="mt-2 text-center font-mono text-2xl tracking-[0.5em]"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </li>
        </ol>
      </Modal>

      <Modal
        open={disable}
        onClose={() => setDisable(false)}
        size="sm"
        title="Desativar verificação em duas etapas"
        footer={
          <Button variant="danger" disabled={code.length !== 6} loading={loading} onClick={() => confirm('/auth/2fa/disable')}>
            Desativar
          </Button>
        }
      >
        <Field label="Código atual do aplicativo">
          <Input placeholder="Ex.: 123456" className="text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </Modal>
    </Card>
  );
}

function Profile() {
  const { user, reload } = useAuth();
  const toast = useToast();
  const saveAvatar = async (avatarUrl: string | null) => {
    try {
      await api('/me/avatar', { method: 'PATCH', json: { avatarUrl } });
      await reload();
      toast(avatarUrl ? 'Foto atualizada' : 'Foto removida');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const forced = useSearchParams().get('trocar') === '1' || !!user?.mustChangePassword;
  const pendente = !!user?.duasEtapasPendente && !user?.mustChangePassword;
  if (!user) return null;
  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader icon={<IconePonto ponto="pagina.perfil" className="size-5" />} title="Meu perfil e segurança" />
      <Card className="mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        {user.mustChangePassword || pendente ? <Avatar name={user.name} src={user.avatarUrl} size={80} /> : <AvatarPicker name={user.name} value={user.avatarUrl ?? null} onChange={saveAvatar} size={80} />}
        <div className="sm:ml-2 sm:border-l sm:border-slate-200 sm:pl-6 dark:sm:border-slate-700">
          <p className="text-xl font-semibold">{user.name}</p>
          <p className="text-sm text-slate-500">
            {user.email} · @{user.username}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <Badge key={r} className="bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                {ROLE_LABEL[r]}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
      {user.mustChangePassword ? (
        // antes da primeira troca só a senha importa (com senha provisória o resto nem abre)
        <div className="mx-auto max-w-xl">
          <PasswordCard forced={forced} />
        </div>
      ) : pendente ? (
        // perfil obrigado a usar duas etapas: só o autenticador importa até ativar
        <div className="mx-auto max-w-xl">
          <TwoFactorCard />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <PasswordCard forced={forced} />
          <TwoFactorCard />
        </div>
      )}
    </div>
  );
}

export default function PerfilPage() {
  return (
    <RequireAuth>
      <Suspense>
        <Profile />
      </Suspense>
    </RequireAuth>
  );
}
