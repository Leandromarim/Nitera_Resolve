'use client';

import { AlertCircle, ArrowRight, Clock, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button, Modal } from '@/components/ui';
import { dicasDaSenha, dicasDoLogin, sugerirDominio } from '@/lib/erros-campos';

type Campo = 'login' | 'senha' | 'codigo';
interface Dica {
  texto: string;
  campo?: Campo;
  acao?: { rotulo: string; aplicar: () => void };
}

export interface ErroLoginInfo {
  mensagem: string;
  status?: number;
}

/**
 * Pop-up do erro de login : diz em qual campo está o problema quando dá para ver pelo que foi
 * digitado (espaço, Caps Lock, e-mail incompleto, domínio com erro de digitação) e explica o resto.
 * Nunca diz se o usuário existe: a resposta do servidor é a mesma para usuário errado e senha errada.
 */
export function ErroLogin({
  erro,
  onClose,
  sistema,
  login,
  senha,
  caps,
  ids,
  esqueciHref,
  aceitaEmail = true,
  onCorrigirLogin,
}: {
  erro: ErroLoginInfo | null;
  onClose: () => void;
  sistema: string;
  login: string;
  senha: string;
  caps: boolean;
  /** id dos campos na tela, para levar a pessoa direto ao campo */
  ids: Partial<Record<Campo, string>>;
  esqueciHref: string;
  /** o login aceita e-mail?  */
  aceitaEmail?: boolean;
  onCorrigirLogin?: (novo: string) => void;
}) {
  if (!erro) return null;
  const m = erro.mensagem;
  const bloqueada = /bloquead/i.test(m);
  const codigo = /c[óo]digo/i.test(m);
  const credenciais = /usu[áa]rio ou senha/i.test(m);

  const dicas: Dica[] = [];
  let titulo = 'Não foi possível entrar';
  let Icone = AlertCircle;

  if (bloqueada) {
    titulo = 'Conta bloqueada por alguns minutos';
    Icone = Lock;
    dicas.push({ texto: 'Foram 5 tentativas erradas seguidas. Espere 15 minutos e tente de novo, com calma.' });
    dicas.push({ texto: 'Se não lembra a senha, use "Esqueci minha senha" em vez de continuar tentando.' });
  } else if (codigo) {
    titulo = 'Código não aceito';
    Icone = ShieldCheck;
    if (/hor[áa]rio/i.test(m)) dicas.push({ texto: 'O relógio do celular está adiantado ou atrasado. Em Ajustes › Data e hora, ligue "data e hora automáticas" e use o código novo.', campo: 'codigo' });
    else if (/recupera/i.test(m)) dicas.push({ texto: 'Cada código de recuperação vale uma vez só. Confira se não é um que você já usou e se digitou as 10 letras e números certos.', campo: 'codigo' });
    else {
      dicas.push({ texto: 'O código muda a cada 30 segundos. Digite o que aparece agora, antes de ele trocar.', campo: 'codigo' });
      dicas.push({ texto: `No aplicativo autenticador, use a linha com o nome "${sistema}". Se houver mais de uma, use a mais recente (as antigas deixam de valer quando a verificação é ativada de novo).` });
      dicas.push({ texto: 'O relógio do celular precisa estar em "data e hora automáticas".' });
    }
  } else if (credenciais) {
    for (const t of dicasDoLogin(login)) {
      const sug = /quis dizer/.test(t) ? sugerirDominio(login) : null;
      dicas.push({ texto: t, campo: 'login', acao: sug && onCorrigirLogin ? { rotulo: `Usar ${sug}`, aplicar: () => onCorrigirLogin(sug) } : undefined });
    }
    if (!aceitaEmail && login.includes('@')) dicas.unshift({ texto: `No ${sistema} você entra com o usuário (ex.: maria.silva), não com o e-mail.`, campo: 'login' });
    for (const t of dicasDaSenha(senha, caps)) dicas.push({ texto: t, campo: 'senha' });
    if (!dicas.length) {
      dicas.push({ texto: 'Confira se o usuário está escrito igual ao cadastro (ex.: maria.silva).', campo: 'login' });
      dicas.push({ texto: 'Digite a senha de novo com calma. Você pode tocar no olho para ver o que digitou.', campo: 'senha' });
    }
  } else {
    dicas.push({ texto: m });
  }

  const ir = (campo?: Campo) => {
    onClose();
    const id = campo && ids[campo];
    if (!id) return;
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (!el) return;
      el.setAttribute('aria-invalid', 'true');
      el.focus();
      el.select?.();
      const limpar = () => {
        el.removeAttribute('aria-invalid');
        el.removeEventListener('input', limpar);
      };
      el.addEventListener('input', limpar);
    }, 50);
  };
  const primeiro = dicas.find((d) => d.campo)?.campo ?? (codigo ? 'codigo' : credenciais ? 'senha' : undefined);

  return (
    <Modal open onClose={() => ir(primeiro)} size="sm" title={titulo} footer={<Button onClick={() => ir(primeiro)}>Tentar de novo</Button>}>
      <div data-popup-erros className="space-y-3">
        <p className="flex items-start gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
          <Icone className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{m}</span>
        </p>
        <ul className="space-y-2">
          {dicas
            .filter((d) => d.texto !== m)
            .map((d, i) => (
              <li key={i} className="rounded-xl bg-rose-50 p-3 text-sm dark:bg-rose-950/40">
                <button type="button" onClick={() => ir(d.campo)} disabled={!d.campo} className="flex w-full items-start gap-2 text-left">
                  <span className="min-w-0 flex-1 break-words text-slate-800 dark:text-slate-100">{d.texto}</span>
                  {d.campo && <ArrowRight className="mt-0.5 size-4 shrink-0 text-rose-400" aria-label="Ir para o campo" />}
                </button>
                {d.acao && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => {
                      d.acao!.aplicar();
                      ir('senha');
                    }}
                  >
                    {d.acao.rotulo}
                  </Button>
                )}
              </li>
            ))}
        </ul>
        {credenciais && (
          <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" />
            <span>Por segurança, o sistema não diz se o erro está no usuário ou na senha. Depois de 5 tentativas erradas a conta fica bloqueada por 15 minutos.</span>
          </p>
        )}
        {!codigo && (
          <Link href={esqueciHref} onClick={onClose} className="inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
            Esqueci minha senha
          </Link>
        )}
      </div>
    </Modal>
  );
}
