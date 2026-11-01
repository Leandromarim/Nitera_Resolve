'use client';

import { Suspense } from 'react';
import { LoginScreen } from '@/components/login-form';
import { Logo } from '@/components/logo';
import { Headset, Mail, MessageCircle } from 'lucide-react';
import { usePortalSettingsLite } from '@/lib/canais-suporte';
import { qrSrc } from '@/components/comum/qr';
import { linkWhatsapp } from '@/lib/whatsapp';
import { useTextos } from '@/lib/textos-context';

function Side() {
  const s = usePortalSettingsLite();
  const { t: texto } = useTextos();
  const canais = !!(s?.ticketsWhatsappNumber || s?.ticketsEmail);
  const selo = texto('chamados-login.selo');
  const paragrafo = [texto('chamados-login.texto'), canais ? texto('chamados-login.texto-canais') : ''].filter(Boolean).join(' ');
  const rodape = texto('chamados-login.rodape');
  return (
    <div className="flex h-full flex-col justify-between bg-gradient-to-br from-coral-500 via-rose-600 to-brand-800 p-12 text-white">
      <Logo />
      <div>
        {selo && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
            <Headset className="size-4" /> {selo}
          </span>
        )}
        <h2 className="mt-4 text-4xl leading-tight font-bold whitespace-pre-line">{texto('chamados-login.chamada')}</h2>
        {paragrafo && <p className="mt-4 whitespace-pre-line text-white/85">{paragrafo}</p>}
        <div className="mt-8 grid gap-3">
          {s?.ticketsWhatsappNumber && (
            <a href={linkWhatsapp(s.ticketsWhatsappNumber)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 hover:bg-white/20">
              <MessageCircle className="size-5 text-chat-green" /> WhatsApp: {s.ticketsWhatsappNumber}
            </a>
          )}
          {s?.ticketsWhatsappNumber && s.ticketsWhatsappQr && (
            <div className="flex items-center gap-4 rounded-2xl bg-white/10 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc(linkWhatsapp(s.ticketsWhatsappNumber), 256)} alt="QR Code do WhatsApp do suporte" width={112} height={112} className="size-28 shrink-0 rounded-xl bg-white p-1.5" />
              <p className="text-sm text-white/85">Aponte a câmera do celular para abrir a conversa com o suporte no WhatsApp.</p>
            </div>
          )}
          {s?.ticketsEmail && (
            <a href={`mailto:${s.ticketsEmail}`} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 hover:bg-white/20">
              <Mail className="size-5 text-amber-brand" /> {s.ticketsEmail}
            </a>
          )}
        </div>
      </div>
      {rodape ? <p className="text-xs text-white/60">{rodape}</p> : <span />}
    </div>
  );
}

export default function LoginPage() {
  const { t: texto } = useTextos();
  return (
    <Suspense>
      <LoginScreen title={texto('chamados-login.titulo')} subtitle={texto('chamados-login.subtitulo')} defaultNext="/chamados" side={<Side />} />
    </Suspense>
  );
}
