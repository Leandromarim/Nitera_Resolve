'use client';

import Link from 'next/link';
import { useBranding } from '@/lib/branding';
import { arquivoUrl, TELA_LOGIN_PADRAO, type TelaLogin } from '@/lib/tela-login';
import { DynamicIcon } from './icons/dynamic-icon';
import type { TextoChave } from '@/lib/textos';
import { Logo } from './logo';
import { clsx } from './ui';

/* eslint-disable @next/next/no-img-element */

const ITEM_CHAVES = ['login.item-1', 'login.item-2', 'login.item-3', 'login.item-4', 'login.item-5', 'login.item-6', 'login.item-7'] as const;
/** cor padrão de cada ícone, com letras claras e com letras escuras */
const CORES_CLARO = ['text-chat-green', 'text-coral-400', 'text-amber-brand', 'text-sky-300', 'text-violet-300', 'text-teal-300', 'text-rose-300'];
const CORES_ESCURO = ['text-emerald-600', 'text-coral-600', 'text-amber-600', 'text-sky-600', 'text-violet-600', 'text-teal-600', 'text-rose-600'];

/** Painel ao lado do formulário de login, com fundo, logo e cores de Painel › Tela de login. */
export function LoginSide({ cfg, t }: { cfg: TelaLogin; t: (chave: TextoChave) => string }) {
  const { branding } = useBranding();
  const claro = cfg.textoLateral === 'claro';
  const itens = ITEM_CHAVES.map((chave, n) => {
    const it = cfg.itens?.[n] ?? TELA_LOGIN_PADRAO.itens[n]!;
    const cls = clsx('size-5 shrink-0', !it.cor && (claro ? CORES_CLARO[n] : CORES_ESCURO[n]));
    return {
      texto: t(chave),
      icon: <DynamicIcon name={it.icone} image={arquivoUrl(it.imagemId)} className={cls} />,
      cor: it.cor,
    };
  }).filter((i) => i.texto);
  const selo = t('login.selo');
  const aviso = t('login.aviso');
  const foto = cfg.fundo === 'imagem' ? arquivoUrl(cfg.imagemId) : null;
  const logo =
    cfg.logo === 'nenhuma' ? null : cfg.logo === 'enviada' && cfg.logoId ? (
      <img src={arquivoUrl(cfg.logoId)!} alt={branding.siteName} className="h-8 w-auto max-w-[11rem] object-contain sm:h-10 sm:max-w-[15rem]" />
    ) : claro ? (
      <Logo />
    ) : (
      <img src={branding.logoLightUrl} alt={branding.siteName} className="h-8 w-auto max-w-[11rem] object-contain sm:h-10 sm:max-w-[15rem]" />
    );
  return (
    <div
      className={clsx(
        'relative flex h-full flex-col justify-between overflow-hidden p-12',
        cfg.fundo === 'padrao' && 'bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950',
        claro ? 'text-white' : 'text-slate-900',
      )}
      style={cfg.fundo === 'cores' ? { background: `linear-gradient(135deg, ${cfg.corInicio}, ${cfg.corFim})` } : foto ? { background: `center / cover no-repeat url("${foto}")` } : undefined}
    >
      {foto && <div aria-hidden className="absolute inset-0" style={{ background: claro ? `rgba(10,14,30,${cfg.escurecer / 100})` : `rgba(255,255,255,${cfg.escurecer / 100})` }} />}
      <div className="relative">{logo}</div>
      <div className="relative">
        {selo && <p className={clsx('font-mono text-sm font-bold tracking-[0.3em] uppercase', claro ? 'text-brand-300' : 'text-brand-700')}>{selo}</p>}
        <h2 className="mt-3 text-4xl leading-tight font-bold whitespace-pre-line">{t('login.chamada')}</h2>
        {itens.length > 0 && (
          <ul className={clsx('mt-8 space-y-4', claro ? 'text-white/85' : 'text-slate-700')}>
            {itens.map((i, n) => (
              <li key={n} className="flex items-center gap-3">
                {cfg.icones && (
                  <span className="contents" style={i.cor ? { color: i.cor } : undefined}>
                    {i.icon}
                  </span>
                )}{' '}
                {i.texto}
              </li>
            ))}
          </ul>
        )}
      </div>
      {aviso ? <p className={clsx('relative text-xs whitespace-pre-line', claro ? 'text-white/50' : 'text-slate-500')}>{aviso}</p> : <span />}
    </div>
  );
}

/** Logo acima do formulário: só no celular (quando o painel lateral some), sempre ou nunca. */
export function LoginFormLogo({ cfg, preview }: { cfg: TelaLogin; preview?: 'celular' | 'computador' }) {
  const { branding } = useBranding();
  if (cfg.logo === 'nenhuma' || cfg.logoFormulario === 'nunca') return null;
  // sem painel lateral, a logo do formulário é a única: aparece em qualquer tela
  const soCelular = cfg.logoFormulario === 'celular' && cfg.lateral;
  if (soCelular && preview === 'computador') return null;
  const logo = cfg.logo === 'enviada' && cfg.logoId ? <img src={arquivoUrl(cfg.logoId)!} alt={branding.siteName} className="h-8 w-auto max-w-[11rem] object-contain sm:h-10 sm:max-w-[15rem]" /> : <Logo light={false} />;
  const cls = clsx('mb-10 inline-block', soCelular && !preview && 'lg:hidden');
  return preview ? (
    <span className={cls}>{logo}</span>
  ) : (
    <Link href="/" className={cls}>
      {logo}
    </Link>
  );
}
