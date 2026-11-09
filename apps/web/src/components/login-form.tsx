'use client';

import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, clsx } from './ui';
import { LoginFormLogo } from './login-visual';
import { ErroLogin, type ErroLoginInfo } from './erros/erro-login';
import { NITERA_LOGO, NITERA_LOGO_LIGHT, type FooterCredit } from '@/lib/layout';
import { useTextos } from '@/lib/textos-context';
import { TELA_LOGIN_PADRAO, type TelaLogin } from '@/lib/tela-login';
import { destinoSeguro } from '@/lib/destino';

/**
 * "Desenvolvido por" abaixo do login: mesmo bloco de Painel › Cabeçalho e rodapé, adaptado ao fundo claro.
 * O logo padrão (versão clara, feita para o rodapé escuro) troca pela versão escura no tema claro.
 */
function LoginCredit({ credit }: { credit: FooterCredit }) {
  if (!credit.enabled) return null;
  const padrao = credit.logoUrl === NITERA_LOGO_LIGHT || credit.logoUrl === NITERA_LOGO;
  /* eslint-disable @next/next/no-img-element */
  const logo = padrao ? (
    <>
      <img src={NITERA_LOGO} alt={credit.logoAlt} className="h-7 w-auto dark:hidden" />
      <img src={NITERA_LOGO_LIGHT} alt={credit.logoAlt} className="hidden h-5 w-auto dark:block" />
    </>
  ) : credit.badge ? (
    <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 shadow-sm ring-1 ring-black/5">
      <img src={credit.logoUrl} alt={credit.logoAlt} className="h-5 w-auto max-w-28 object-contain" />
    </span>
  ) : (
    <img src={credit.logoUrl} alt={credit.logoAlt} className="h-6 w-auto max-w-32 object-contain" />
  );
  /* eslint-enable @next/next/no-img-element */
  const content = (
    <>
      {credit.text && <span>{credit.text}</span>}
      {logo}
    </>
  );
  return (
    <p className="mt-10 flex items-center justify-center gap-2 border-t border-slate-200 pt-5 text-[11px] tracking-wide text-slate-400 uppercase dark:border-slate-800 dark:text-slate-500">
      {credit.url ? (
        <a
          href={credit.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${credit.logoAlt} (abre em nova aba)`}
          className="inline-flex items-center gap-2 rounded-lg hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </p>
  );
}

export function LoginScreen({
  title,
  subtitle,
  defaultNext = '/',
  side,
  aparencia = TELA_LOGIN_PADRAO,
}: {
  title: string;
  subtitle: string;
  defaultNext?: string;
  side: React.ReactNode;
  /** aparência de Painel › Tela de login (só o login da intranet usa; os demais ficam no padrão) */
  aparencia?: TelaLogin;
}) {
  const { login, user, ready } = useAuth();
  const { t: texto, credito } = useTextos();
  const esqueceu = texto('login.esqueceu-senha');
  const lembrar = texto('login.manter-conectado');
  const router = useRouter();
  const params = useSearchParams();
  const next = destinoSeguro(params.get('next'), defaultNext); // evita redirecionamento aberto
  const [form, setForm] = useState({ login: '', password: '', totp: '', remember: false });
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState<ErroLoginInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // senha provisória: primeiro troca a senha, depois segue para onde ia
    if (ready && user) router.replace(
        user.mustChangePassword
          ? `/perfil?trocar=1&next=${encodeURIComponent(next)}`
          : user.duasEtapasPendente
            ? `/perfil?duas-etapas=1&next=${encodeURIComponent(next)}`
            : next,
      );
  }, [ready, user, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await login(form.login, form.password, step === 'totp' ? form.totp : undefined, form.remember);
      if (r.requiresTotp) setStep('totp');
    } catch (err: any) {
      setError({ mensagem: err.message, status: err.status });
      if (step === 'totp') setForm((f) => ({ ...f, totp: '' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={clsx('grid min-h-dvh', aparencia.lateral && 'lg:grid-cols-2')}>
      {aparencia.lateral && <div className={clsx('relative hidden overflow-hidden bg-brand-800 lg:block', aparencia.lado === 'direita' && 'lg:order-2')}>{side}</div>}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <LoginFormLogo cfg={aparencia} />
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            {step === 'password' ? (
              <>
                <Field label={texto('login.campo-usuario')}>
                  <Input id="login-usuario" autoFocus autoComplete="username" required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder={texto('login.exemplo-usuario') || undefined} />
                </Field>
                <Field label={texto('login.campo-senha')} error={caps ? 'Caps Lock está ativado' : undefined}>
                  <div className="relative">
                    <Input
                      id="login-senha"
                      placeholder="Digite sua senha"
                      type={show ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={form.password}
                      onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
                      onKeyDown={(e) => setCaps(e.getModifierState('CapsLock'))}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="pr-11"
                    />
                    <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-600" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {lembrar ? (
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input type="checkbox" className="size-4 rounded accent-brand-600" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} />
                      {lembrar}
                    </label>
                  ) : (
                    <span />
                  )}
                  <Link href="/esqueci-senha" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
                    Esqueci minha senha
                  </Link>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                  Digite o código de 6 dígitos do seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator…).
                </div>
                <Field label="Código de verificação">
                  <Input
                    id="login-codigo"
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={form.totp}
                    onChange={(e) => setForm({ ...form, totp: e.target.value.replace(/\D/g, '') })}
                    className="text-center font-mono text-2xl tracking-[0.5em]"
                    placeholder="000000"
                  />
                </Field>
              </div>
            )}

            <ErroLogin
              erro={error}
              onClose={() => setError(null)}
              sistema="NITERA Resolve"
              login={form.login}
              senha={form.password}
              caps={caps}
              ids={{ login: 'login-usuario', senha: 'login-senha', codigo: 'login-codigo' }}
              esqueciHref="/esqueci-senha"
              onCorrigirLogin={(novo) => setForm((f) => ({ ...f, login: novo }))}
            />

            <Button
              type="submit"
              size="lg"
              className={clsx('w-full', aparencia.corBotao && 'hover:brightness-110 dark:hover:brightness-110')}
              style={aparencia.corBotao ? { background: aparencia.corBotao } : undefined}
              loading={loading} disabled={step === 'totp' ? form.totp.length !== 6 : !form.login || !form.password}>
              <KeyRound className="size-4" /> {step === 'totp' ? 'Verificar' : texto('login.botao')}
            </Button>
            {step === 'totp' && (
              <button type="button" className="w-full text-sm text-slate-500 hover:underline" onClick={() => setStep('password')}>
                Voltar
              </button>
            )}
          </form>
          {esqueceu && <p className="mt-8 text-center text-xs whitespace-pre-line text-slate-500">{esqueceu}</p>}
          <LoginCredit credit={credito} />
        </div>
      </div>
    </div>
  );
}
