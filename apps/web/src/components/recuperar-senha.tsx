'use client';

import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, KeyRound, MailCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { Button, Card, Field, Input, Loading, clsx } from '@/components/ui';
import { avisarErroCampos, emailValido, sugerirDominio } from '@/lib/erros-campos';

/** Telas de "Esqueci minha senha", iguais na intranet e no NITERA Qualis (cada um passa as próprias chamadas à API). */

export type Regra = { ok: boolean; label: string };

function Moldura({ titulo, subtitulo, children, rodape }: { titulo: string; subtitulo?: string; children: React.ReactNode; rodape?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="rounded-2xl bg-[var(--ha-sidebar)] px-5 py-3 shadow-sm">
            <Logo className="max-h-10!" />
          </span>
          <div>
            <h1 className="text-xl font-bold">{titulo}</h1>
            {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
          </div>
        </div>
        <Card className="p-6">{children}</Card>
        {rodape && <div className="mt-4 text-center text-xs text-slate-500">{rodape}</div>}
      </div>
    </div>
  );
}

function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
      {texto}
    </p>
  );
}

function Voltar({ href, children = 'Voltar para o login' }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:underline">
      <ArrowLeft className="size-4" /> {children}
    </Link>
  );
}

export function EsqueciSenha({
  sistema,
  login,
  campo,
  status,
  pedir,
}: {
  sistema: string;
  /** endereço do login, para voltar */
  login: string;
  campo: string;
  status: () => Promise<{ disponivel: boolean }>;
  pedir: (login: string) => Promise<unknown>;
}) {
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [valor, setValor] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    status()
      .then((r) => setDisponivel(r.disponivel))
      .catch(() => setDisponivel(false));
  }, [status]);

  const v = valor.trim();
  const sugestao = v.includes('@') ? sugerirDominio(v) : null;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    // erro que dá para ver sem perguntar ao servidor: aponta o campo e não envia
    const problemas = [
      ...(/\s/.test(v) ? ['Tem espaço no meio. Usuários e e-mails não têm espaço (ex.: maria.silva).'] : []),
      ...(v.includes('@') && !emailValido(v) ? ['O e-mail parece incompleto. Confira o que vem depois do @ (ex.: maria@suaempresa.com.br).'] : []),
    ];
    if (problemas.length) return avisarErroCampos([{ campo: 'login', mensagens: problemas }], '');
    setEnviando(true);
    try {
      await pedir(v);
      setEnviado(true);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (disponivel === null) return <Loading label="Carregando…" />;

  return (
    <Moldura titulo="Esqueci minha senha" subtitulo={sistema}>
      {!disponivel ? (
        <div className="space-y-4 text-sm">
          <p>O envio de e-mail ainda não está ligado neste servidor, então a nova senha precisa ser criada pela TI.</p>
          <p className="text-slate-500">Abra um chamado ou ligue para a TI e peça para redefinir a sua senha.</p>
          <Voltar href={login} />
        </div>
      ) : enviado ? (
        <div className="space-y-4 text-sm">
          <div className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            <MailCheck className="mt-0.5 size-5 shrink-0" />
            <p>Se existir uma conta com esses dados e um e-mail cadastrado, enviamos para esse e-mail um link para criar a nova senha.</p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
            <li>O link vale por 30 minutos e só pode ser usado uma vez.</li>
            <li>Confira também a caixa de spam ou lixo eletrônico.</li>
            <li>Não chegou? Talvez a conta não tenha e-mail cadastrado. Nesse caso, fale com a TI.</li>
          </ul>
          <Voltar href={login} />
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Informe o seu usuário ou e-mail. Vamos mandar um link para criar uma nova senha no e-mail cadastrado na sua conta.</p>
          <Field label={campo}>
            <Input name="login" placeholder="Ex.: maria.silva" autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} value={valor} maxLength={160} onChange={(e) => setValor(e.target.value)} required />
          </Field>
          {sugestao && (
            <p className="-mt-2 flex flex-wrap items-center gap-x-2 text-sm text-amber-800 dark:text-amber-200">
              O endereço depois do @ parece ter erro de digitação.
              <button type="button" className="font-semibold underline" onClick={() => setValor(sugestao)}>
                Usar {sugestao}
              </button>
            </p>
          )}
          <Erro texto={erro} />
          <Button type="submit" className="w-full" loading={enviando} disabled={!valor.trim()}>
            <KeyRound className="size-4" /> Enviar link por e-mail
          </Button>
          <Voltar href={login} />
        </form>
      )}
    </Moldura>
  );
}

/** Lê o token do endereço (#t=…) e já o apaga da barra, para ele não ficar no histórico. */
function useTokenDoLink() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get('t');
    setToken(t);
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return token;
}

export function RedefinirSenha({
  sistema,
  login,
  esqueci,
  regras,
  aviso,
  validar,
  salvar,
}: {
  sistema: string;
  login: string;
  esqueci: string;
  regras: (s: string) => Regra[];
  aviso?: string;
  validar: (token: string) => Promise<{ valido: boolean; nome?: string }>;
  salvar: (token: string, senha: string) => Promise<unknown>;
}) {
  const token = useTokenDoLink();
  const [estado, setEstado] = useState<{ valido: boolean; nome?: string } | null>(null);
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [ver, setVer] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (token === undefined) return;
    if (!token) return setEstado({ valido: false });
    validar(token)
      .then(setEstado)
      .catch(() => setEstado({ valido: false }));
  }, [token, validar]);

  const lista = regras(senha);
  const ok = lista.every((r) => r.ok) && senha === confirma;
  const diferente = confirma.length > 0 && confirma !== senha;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErro(null);
    setEnviando(true);
    try {
      await salvar(token, senha);
      setPronto(true);
      setSenha('');
      setConfirma('');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!estado) return <Loading label="Conferindo o link…" />;

  return (
    <Moldura titulo="Criar nova senha" subtitulo={sistema}>
      {pronto ? (
        <div className="space-y-4 text-sm">
          <div className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <p>Pronto, a sua nova senha foi salva. Por segurança, a conta saiu de todos os aparelhos: entre de novo com a nova senha.</p>
          </div>
          <Link href={login} className="block">
            <Button className="w-full">Ir para o login</Button>
          </Link>
        </div>
      ) : !estado.valido ? (
        <div className="space-y-4 text-sm">
          <p>Este link não vale mais. Ele expira em 30 minutos, só pode ser usado uma vez, e um pedido novo cancela os anteriores.</p>
          <Link href={esqueci} className="block">
            <Button className="w-full">Pedir um novo link</Button>
          </Link>
          <Voltar href={login} />
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Olá, {estado.nome}. Crie a sua nova senha.</p>
          <Field label="Nova senha">
            <div className="relative">
              <Input placeholder="Digite a nova senha" type={ver ? 'text' : 'password'} autoFocus autoComplete="new-password" value={senha} maxLength={128} onChange={(e) => setSenha(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setVer((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600" aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}>
                {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {lista.map((r) => (
              <li key={r.label} className={clsx('flex items-center gap-1.5', r.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500')}>
                {r.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />} {r.label}
              </li>
            ))}
            {aviso && <li className="text-slate-500 sm:col-span-2">{aviso}</li>}
          </ul>
          <Field label="Repita a nova senha" error={diferente ? 'As senhas não são iguais' : undefined}>
            <Input placeholder="Digite a nova senha de novo" type={ver ? 'text' : 'password'} autoComplete="new-password" value={confirma} maxLength={128} onChange={(e) => setConfirma(e.target.value)} />
          </Field>
          <Erro texto={erro} />
          <Button type="submit" className="w-full" loading={enviando} disabled={!ok}>
            Salvar a nova senha
          </Button>
        </form>
      )}
    </Moldura>
  );
}
