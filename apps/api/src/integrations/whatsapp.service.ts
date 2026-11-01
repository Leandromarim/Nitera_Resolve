import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * Integração com a WhatsApp Business Cloud API (Meta).
 * Envio de mensagens e download de mídias recebidas pelo webhook.
 */
@Injectable()
export class WhatsappService {
  private readonly log = new Logger('WhatsApp');

  get enabled() {
    return process.env.WHATSAPP_ENABLED === 'true' && !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  /** Valida o cabeçalho X-Hub-Signature-256 enviado pela Meta. */
  verifySignature(rawBody: Buffer | undefined, header: string | undefined) {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret || !rawBody || !header?.startsWith('sha256=')) return false;
    const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'));
    const given = Buffer.from(header);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async sendText(to: string, body: string) {
    if (!this.enabled) {
      this.log.log(`[simulado] para ${to}: ${body}`);
      return;
    }
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: body.slice(0, 4000), preview_url: true } }),
    });
    if (!res.ok) {
      const err = await res.text();
      // Fora da janela de 24h a Meta exige template aprovado.
      const template = process.env.WHATSAPP_TEMPLATE_UPDATE;
      if (template && err.includes('131047')) await this.sendTemplate(to, template, [body.slice(0, 900)]);
      else this.log.warn(`Falha ao enviar WhatsApp: ${res.status} ${err.slice(0, 300)}`);
    }
  }

  /**
   * Lista interativa: a pessoa toca no botão e escolhe uma opção (até 10 por lista, limite do WhatsApp).
   * Sem a API ligada, ou se a Meta recusar, manda `fallback` (as mesmas opções numeradas em texto).
   */
  async sendList(to: string, body: string, button: string, rows: { id: string; title: string; description?: string }[], fallback: string) {
    if (!this.enabled) {
      this.log.log(`[simulado] para ${to}: ${fallback}`);
      return;
    }
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body.slice(0, 1024) },
          action: {
            button: button.slice(0, 20),
            sections: [{ title: 'Opções', rows: rows.slice(0, 10).map((r) => ({ id: r.id.slice(0, 200), title: r.title.slice(0, 24), ...(r.description ? { description: r.description.slice(0, 72) } : {}) })) }],
          },
        },
      }),
    }).catch(() => null);
    if (!res?.ok) {
      this.log.warn(`Lista interativa recusada (${res?.status ?? 'sem resposta'}); enviando as opções em texto`);
      await this.sendText(to, fallback);
    }
  }

  /** Template aprovado, com confirmação: devolve o id da mensagem (wamid) ou lança o erro da Meta. */
  async sendTemplateStrict(to: string, name: string, params: string[], lang = 'pt_BR'): Promise<string> {
    if (!this.enabled) throw new Error('WhatsApp não configurado no servidor');
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name, language: { code: lang }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] },
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Meta ${res.status}: ${String(body?.error?.message ?? 'erro').slice(0, 200)}`);
    return String(body?.messages?.[0]?.id ?? '');
  }

  async sendTemplate(to: string, name: string, params: string[]) {
    await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name, language: { code: 'pt_BR' }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] },
      }),
    }).catch((e) => this.log.warn(e));
  }

  async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mime: string } | null> {
    if (!this.enabled) return null;
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
    if (!meta.ok) return null;
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    if (!url?.startsWith('https://')) return null;
    const file = await fetch(url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
    if (!file.ok) return null;
    return { buffer: Buffer.from(await file.arrayBuffer()), mime: mime_type };
  }
}
