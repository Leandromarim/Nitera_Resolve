import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Modelo visual dos e-mails do sistema (HTML com as logos embutidas no próprio e-mail, por "cid").
 * Logos embutidas aparecem mesmo quando o Outlook bloqueia imagens da internet, e não dependem de login.
 * O texto continua vindo das mensagens editáveis no painel; aqui só muda a apresentação.
 */

export type MarcaEmail = 'resolve';
export interface AnexoInline {
  filename: string;
  path: string;
  cid: string;
}

const PASTAS = [path.resolve(process.cwd(), 'assets/email'), path.resolve(__dirname, '../../assets/email')];
function arquivo(nome: string) {
  for (const p of PASTAS) {
    const f = path.join(p, nome);
    if (existsSync(f)) return f;
  }
  return null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Marca do serviço nos e-mails (um sistema só). */
export const marcaDoSistema = (_sistema?: string): MarcaEmail => 'resolve';

/**
 * Monta o HTML do e-mail a partir do texto simples: parágrafos separados por linha em branco, e o `link`
 * (quando houver) vira um botão, com o endereço por extenso logo abaixo para quem não consegue clicar.
 */
export function emailComMarca(opts: { marca: MarcaEmail; texto: string; link?: string; botao?: string; titulo?: string }) {
  const { marca, texto, link, botao = 'Abrir', titulo } = opts;
  const logoServico = arquivo(`${marca}.png`);
  const logoNitera = arquivo('nitera.png');
  const inline: AnexoInline[] = [];
  if (logoServico) inline.push({ filename: `${marca}.png`, path: logoServico, cid: 'logo-servico@resolve' });
  if (logoNitera) inline.push({ filename: 'nitera.png', path: logoNitera, cid: 'logo-nitera@resolve' });

  const blocos = texto
    .trim()
    .split(/\n{2,}/)
    .map((par) => {
      if (link && par.includes(link)) {
        const antes = par.replace(link, '').trim();
        return `${antes ? `<p style="margin:0 0 16px">${esc(antes).replace(/\n/g, '<br>')}</p>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 12px"><tr><td style="border-radius:12px;background:#45598e">
<a href="${esc(link)}" style="display:inline-block;padding:13px 26px;font-weight:700;font-size:15px;color:#ffffff;text-decoration:none;border-radius:12px">${esc(botao)}</a>
</td></tr></table>
<p style="margin:0 0 18px;font-size:12px;color:#64748b;word-break:break-all">Se o botão não abrir, copie este endereço no navegador:<br><a href="${esc(link)}" style="color:#45598e">${esc(link)}</a></p>`;
      }
      return `<p style="margin:0 0 16px">${esc(par).replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  const nomeServico = 'NITERA Resolve';
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(titulo ?? nomeServico)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td align="center" style="padding:26px 24px 18px;border-bottom:1px solid #eef2f7">
${logoServico ? `<img src="cid:logo-servico@resolve" alt="${esc(nomeServico)}" height="52" style="display:block;height:52px;width:auto;border:0">` : `<b style="font-size:20px;color:#1f2a4d">${esc(nomeServico)}</b>`}
</td></tr>
<tr><td style="padding:26px 28px 10px;font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b">
${blocos}
</td></tr>
<tr><td align="center" style="padding:16px 24px 22px;background:#f8fafc;border-top:1px solid #eef2f7;font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8">
<div style="margin-bottom:8px">E-mail automático. Não responda a esta mensagem.</div>
${logoNitera ? `<div style="margin-bottom:4px">Desenvolvido por</div><img src="cid:logo-nitera@resolve" alt="NITERA Tecnologia" height="26" style="display:inline-block;height:26px;width:auto;border:0">` : 'Desenvolvido por NITERA Tecnologia'}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { html, inline };
}
