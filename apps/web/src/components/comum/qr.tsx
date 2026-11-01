'use client';

import { Download, ExternalLink, Printer } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

/** URL do gerador de QR Code da API para um destino (link absoluto ou caminho do portal). */
export const qrSrc = (href: string, size = 256) => `/api/qr?size=${size}&data=${encodeURIComponent(href)}`;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'qrcode';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Modal com o QR Code em tamanho grande, para baixar em PNG ou imprimir. */
/** `image`: QR Code enviado como imagem (substitui o gerado a partir do link). */
export function QrModal({ open, onClose, title, subtitle, href, image, linkLabel = 'Abrir o formulário' }: { open: boolean; onClose: () => void; title: string; subtitle?: string | null; href: string | null; image?: string | null; linkLabel?: string }) {
  if (!href && !image) return null;
  const big = image || qrSrc(href!, 1024);

  const print = () => {
    const w = window.open('', '_blank', 'width=700,height=800');
    if (!w) return;
    const abs = new URL(big, window.location.origin).href;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;margin:40px;color:#1f2a4d}h1{font-size:22px;margin:0 0 6px}p{margin:0 0 24px;color:#475569}img{width:360px;height:360px}</style>
</head><body>${subtitle ? `<p style="text-transform:uppercase;letter-spacing:.08em;font-weight:600">${esc(subtitle)}</p>` : ''}<h1>${esc(title)}</h1><p></p>
<img src="${esc(abs)}" alt="QR Code" onload="setTimeout(function(){window.print();window.close()},150)"></body></html>`);
    w.document.close();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="QR Code"
      size="sm"
      footer={
        <>
          <a
            href={big}
            download={`${slug(title)}.png`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700"
          >
            <Download className="size-4" /> Baixar PNG
          </a>
          <Button type="button" onClick={print}>
            <Printer className="size-4" /> Imprimir
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-center">
        {subtitle && <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-300">{subtitle}</p>}
        <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image || qrSrc(href!, 512)} alt={`QR Code de ${title}`} width={256} height={256} className="size-64" />
        </div>
{href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm break-all text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-brand-300">
          <ExternalLink className="size-4 shrink-0" /> {linkLabel}
        </a>
        )}
      </div>
    </Modal>
  );
}
