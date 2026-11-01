import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import * as nodemailer from 'nodemailer';

export interface InboundMail {
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  text: string;
  attachments: { filename: string; content: Buffer }[];
}

/** Envio (SMTP) e leitura (IMAP) da caixa de suporte. */
@Injectable()
export class MailService {
  private readonly log = new Logger('E-mail');
  private transporter?: nodemailer.Transporter;

  private oauth?: { token: string; expires: number };

  get enabled() {
    return process.env.EMAIL_ENABLED === 'true';
  }

  /** Microsoft 365 não aceita mais senha em IMAP/SMTP: usa OAuth2 (client credentials) quando configurado. */
  private get useOAuth() {
    return !!(process.env.MAIL_OAUTH_TENANT && process.env.MAIL_OAUTH_CLIENT_ID && process.env.MAIL_OAUTH_CLIENT_SECRET);
  }

  private async accessToken() {
    if (this.oauth && this.oauth.expires > Date.now() + 60_000) return this.oauth.token;
    const res = await fetch(`https://login.microsoftonline.com/${process.env.MAIL_OAUTH_TENANT}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.MAIL_OAUTH_CLIENT_ID!,
        client_secret: process.env.MAIL_OAUTH_CLIENT_SECRET!,
        scope: 'https://outlook.office365.com/.default',
      }),
    });
    if (!res.ok) throw new Error(`OAuth2 Microsoft: ${res.status}`);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    this.oauth = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }

  private async smtp() {
    const base = {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      requireTLS: Number(process.env.SMTP_PORT) !== 465,
    };
    if (this.useOAuth) {
      return nodemailer.createTransport({ ...base, auth: { type: 'OAuth2', user: process.env.SMTP_USER, accessToken: await this.accessToken() } });
    }
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({ ...base, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
    }
    return this.transporter;
  }

  /** `inline`: imagens embutidas no HTML (logos), referenciadas por "cid:" no próprio e-mail. */
  async send(to: string, subject: string, text: string, html?: string, inReplyTo?: string, inline?: { filename: string; path: string; cid: string }[]) {
    if (!this.enabled || !process.env.SMTP_HOST) {
      this.log.log(`[simulado] para ${to}: ${subject}`);
      return;
    }
    await (await this.smtp())
      .sendMail({ from: process.env.SMTP_FROM, to, subject, text, html, ...(inline?.length ? { attachments: inline } : {}), ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}) })
      .catch((e) => this.log.warn(`Falha ao enviar e-mail: ${e.message}`));
  }

  /** SMTP de verdade configurado (sem isso o envio seria só simulado). */
  get configured() {
    return this.enabled && !!process.env.SMTP_HOST;
  }

  /** Envio que confirma ou falha, sem modo simulado: usado onde o status precisa ser real (convites do NPS). */
  async sendStrict(to: string, subject: string, text: string, html?: string): Promise<string> {
    if (!this.configured) throw new Error('E-mail não configurado no servidor');
    const info = await (await this.smtp()).sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
    if (info.rejected?.length) throw new Error('Endereço recusado pelo servidor de e-mail');
    return String(info.messageId ?? '');
  }

  /** Busca e-mails não lidos, marca como lidos e devolve já interpretados. */
  async fetchUnseen(): Promise<InboundMail[]> {
    if (!this.enabled || !process.env.IMAP_HOST) return [];
    const out: InboundMail[] = [];
    let client: ImapFlow | undefined;
    try {
      const user = process.env.IMAP_USER ?? '';
      client = new ImapFlow({
        host: process.env.IMAP_HOST!,
        port: Number(process.env.IMAP_PORT ?? 993),
        secure: true,
        auth: this.useOAuth ? { user, accessToken: await this.accessToken() } : { user, pass: process.env.IMAP_PASSWORD ?? '' },
        logger: false,
      });
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = (await client.search({ seen: false }, { uid: true })) || [];
        for (const uid of uids.slice(0, 50)) {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const parsed: ParsedMail = await simpleParser(msg.source);
          const from = parsed.from?.value?.[0];
          if (!from?.address) continue;
          // ignora respostas automáticas para não criar laços
          if (parsed.headers.get('auto-submitted') && parsed.headers.get('auto-submitted') !== 'no') continue;
          out.push({
            messageId: parsed.messageId ?? `${uid}-${Date.now()}`,
            fromEmail: from.address.toLowerCase(),
            fromName: from.name || from.address,
            subject: (parsed.subject ?? '(sem assunto)').slice(0, 200),
            text: stripQuoted(parsed.text ?? '').slice(0, 20000),
            attachments: (parsed.attachments ?? []).filter((a) => a.size < 20 * 1024 * 1024).map((a) => ({ filename: a.filename ?? 'anexo', content: a.content })),
          });
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (e: any) {
      this.log.warn(`IMAP: ${e.message}`);
    }
    return out;
  }
}

/** Remove o histórico citado ("Em ... escreveu:") das respostas. */
function stripQuoted(text: string) {
  const markers = [/^Em .+ escreveu:$/m, /^On .+ wrote:$/m, /^-----Original Message-----$/m, /^De: .+$/m, /^From: .+$/m];
  let cut = text.length;
  for (const m of markers) {
    const i = text.search(m);
    if (i > 0 && i < cut) cut = i;
  }
  return text.slice(0, cut).trim();
}
