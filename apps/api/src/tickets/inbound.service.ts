import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { FilesService } from '../files/files.service';
import { MailService } from '../integrations/mail.service';
import { WhatsappService } from '../integrations/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizar } from '../mensagens/registry';
import { palavrasWhatsapp, renderMensagem } from '../mensagens/mensagens.service';
import { OPEN_STATUSES, STATUS_LABEL, TicketsService } from './tickets.service';
import type { TicketSector } from '@prisma/client';
import { chamadosRules, encaminhar, sectorTexts } from './config';

/** Tempo para escolher a área no menu do WhatsApp; depois disso a mensagem guardada é descartada. */
const PENDENTE_MS = 2 * 3_600_000;
/** Categorias por página na lista do WhatsApp (o limite é 10 linhas; sobram 2 para "Mais opções" e "Não sei / Outro"). */
const POR_PAGINA = 8;
type Anexo = { id: string; name: string };
type Pendente = { phone: string; name: string | null; description: string; files: Anexo[] };
type Categoria = { id: string; name: string; description: string | null };
/** Título da linha da lista: o WhatsApp aceita até 24 caracteres. */
const curto = (s: string) => (s.length > 24 ? `${s.slice(0, 23)}…` : s);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Abertura e atualização de chamados a partir do WhatsApp e do e-mail de suporte. */
@Injectable()
export class InboundService {
  private readonly log = new Logger('Chamados/entrada');
  private polling = false;

  constructor(
    private prisma: PrismaService,
    private tickets: TicketsService,
    private whatsapp: WhatsappService,
    private mail: MailService,
    private files: FilesService,
  ) {}

  /** Evita processar a mesma mensagem duas vezes (a Meta reenvia webhooks). */
  private async firstTime(id: string, channel: 'WHATSAPP' | 'EMAIL') {
    try {
      await this.prisma.inboundMessage.create({ data: { id: id.slice(0, 250), channel } });
      return true;
    } catch {
      return false;
    }
  }

  async handleWhatsapp(msg: { id: string; from: string; name?: string; text?: string; mediaId?: string; mediaName?: string; choiceId?: string }) {
    if (!(await this.firstTime(msg.id, 'WHATSAPP'))) return;
    const text = (msg.text ?? '').trim();
    const phone = msg.from;

    // palavras-chave configuráveis em Painel › Mensagens automáticas (comparadas sem acento e sem diferenciar maiúsculas)
    const kw = await palavrasWhatsapp(this.prisma);
    const plain = normalizar(text);
    const statusMatch = plain.match(new RegExp(`^${escapeRe(kw.status)}\\s*#?(\\d+)$`));
    if (statusMatch) {
      const t = await this.prisma.ticket.findUnique({ where: { number: Number(statusMatch[1]) } });
      const owns = t && t.requesterPhone && t.requesterPhone.replace(/\D/g, '').slice(-8) === phone.replace(/\D/g, '').slice(-8);
      await this.whatsapp.sendText(
        phone,
        owns
          ? await renderMensagem(this.prisma, 'chamados.whatsapp.consulta', { numero: t!.number, titulo: t!.title, status: STATUS_LABEL[t!.status] })
          : await renderMensagem(this.prisma, 'chamados.whatsapp.naoEncontrado'),
      );
      return;
    }

    let file: { id: string; name: string } | undefined;
    if (msg.mediaId) {
      const media = await this.whatsapp.downloadMedia(msg.mediaId);
      if (media) {
        const stored = await this.files.store(media.buffer, msg.mediaName ?? 'anexo-whatsapp', false, undefined, false, 'CHAMADO').catch(() => null);
        if (stored) file = { id: stored.id, name: stored.originalName };
      }
    }

    const rules = await chamadosRules(this.prisma);
    const isGreeting = kw.saudacoes.includes(plain.replace(/[!.,? ]+$/, ''));
    const open = await this.prisma.ticket.findFirst({
      where: { channel: 'WHATSAPP', requesterPhone: phone, status: { in: OPEN_STATUSES }, createdAt: { gte: new Date(Date.now() - rules.whatsappWindowDays * 86_400_000) } },
      orderBy: { createdAt: 'desc' },
    });

    const novoRe = new RegExp(`^${escapeRe(kw.novo)}(?![\\p{L}\\d])`, 'u');
    const wantsNew = novoRe.test(plain);

    // a pessoa está no meio da conversa (área, categoria ou descrição); "oi" ou NOVO recomeça do menu de áreas
    let pend = await this.pendente(phone);
    if (pend && !file && (isGreeting || wantsNew)) {
      await this.prisma.whatsappPendente.delete({ where: { phone } }).catch(() => undefined);
      pend = null;
    }
    if (pend) {
      const files = (Array.isArray(pend.files) ? pend.files : []) as Anexo[];
      const todos = file ? [...files, file].slice(0, 10) : files;
      const dados: Pendente = { phone, name: pend.name ?? msg.name ?? null, description: pend.description, files: todos };

      if (pend.aguardaDescricao) {
        if (!file && !text) return this.pedirDescricao(phone);
        const description = (text || '(enviado sem texto)').slice(0, 5000);
        const escolhida = pend.escolhida ?? pend.sector ?? rules.whatsappSector;
        // o encaminhamento automático olha a descrição; se mudar a equipe, a categoria (da outra equipe) fica em branco
        const destino = encaminhar(rules, escolhida, description);
        await this.prisma.whatsappPendente.delete({ where: { phone } }).catch(() => undefined);
        return this.abrir({ ...dados, description }, destino.sector, destino.sector === pend.sector ? pend.categoryId : null, escolhida, destino.palavra ?? null);
      }

      if (!pend.sector) {
        const areas = rules.whatsappSectors;
        if (open && (msg.choiceId === 'continuar' || plain === String(areas.length + 1))) return this.continuar(phone, open.number);
        const sectors = await sectorTexts(this.prisma);
        const id = msg.choiceId?.startsWith('area:') ? (msg.choiceId.slice(5) as TicketSector) : null;
        const escolha = id && areas.includes(id) ? id : escolherArea(plain, areas, sectors);
        if (escolha) return this.seguir(dados, escolha);
      } else {
        const cats = await this.categorias(pend.sector);
        const r = escolherCategoria(msg.choiceId, plain, cats);
        if (r === 'mais') {
          const page = (pend.page + 1) * POR_PAGINA < cats.length ? pend.page + 1 : 0;
          await this.prisma.whatsappPendente.update({ where: { phone }, data: { page, files: todos as object[] } });
          return this.perguntarCategoria(phone, pend.sector, cats, page);
        }
        if (r) {
          const categoryId = r === 'outro' ? null : r;
          if (!pend.description) {
            // começou com "oi": depois da categoria vem a descrição
            await this.prisma.whatsappPendente.update({ where: { phone }, data: { categoryId, aguardaDescricao: true, files: todos as object[] } });
            return this.pedirDescricao(phone);
          }
          await this.prisma.whatsappPendente.delete({ where: { phone } }).catch(() => undefined);
          return this.abrir(dados, pend.sector, categoryId, pend.escolhida ?? pend.sector, pend.palavra);
        }
      }
      // não é uma das opções: o texto completa a descrição e o menu se repete
      const extra = text && !isGreeting && !msg.choiceId ? text : '';
      await this.prisma.whatsappPendente.update({
        where: { phone },
        data: { description: extra ? `${pend.description}\n${extra}`.trim().slice(0, 5000) : pend.description, files: todos as object[] },
      });
      await this.whatsapp.sendText(phone, await renderMensagem(this.prisma, 'chamados.whatsapp.opcaoInvalida'));
      if (!pend.sector) return this.perguntarArea(phone, rules.whatsappSectors, 'chamados.whatsapp.escolherArea', open);
      return this.perguntarCategoria(phone, pend.sector, await this.categorias(pend.sector), pend.page);
    }

    // com chamado aberto, a mensagem entra nele (resposta à equipe); saudação e NOVO abrem as opções
    if (open && !wantsNew && !isGreeting) {
      await this.tickets.externalComment(open, text, 'WHATSAPP', msg.name ?? phone, file);
      await this.whatsapp.sendText(phone, await renderMensagem(this.prisma, 'chamados.whatsapp.adicionada', { numero: open.number, titulo: open.title, palavraNovo: kw.novoExibir }));
      return;
    }
    // tira a palavra-chave do começo, preservando os acentos do restante do texto
    const texto = (wantsNew ? stripKeyword(text, kw.novo) : text).trim();
    // descrição de verdade já na primeira mensagem: não é perguntada de novo no fim
    const temDescricao = !!file || (!isGreeting && texto.length >= 10);
    const dados: Pendente = { phone, name: msg.name ?? null, description: temDescricao ? (texto || '(enviado sem texto)').slice(0, 5000) : '', files: file ? [file] : [] };
    const areas = rules.whatsappAskSector ? rules.whatsappSectors : [];
    if (areas.length > 1) {
      await this.guardar(dados, { sector: null, escolhida: null, palavra: null, page: 0, categoryId: null, aguardaDescricao: false });
      return this.perguntarArea(phone, areas, temDescricao ? 'chamados.whatsapp.escolherArea' : 'chamados.whatsapp.saudacao', wantsNew ? null : open, kw.statusExibir);
    }
    return this.seguir(dados, areas[0] ?? rules.whatsappSector);
  }

  /** Com a área escolhida: aplica o encaminhamento automático e segue para a categoria, a descrição ou a abertura. */
  private async seguir(dados: Pendente, escolhida: TicketSector) {
    const rules = await chamadosRules(this.prisma);
    const destino = dados.description ? encaminhar(rules, escolhida, dados.description) : { sector: escolhida, palavra: undefined };
    const cats = rules.whatsappAskCategory ? await this.categorias(destino.sector) : [];
    if (cats.length) {
      await this.guardar(dados, { sector: destino.sector, escolhida, palavra: destino.palavra ?? null, page: 0, categoryId: null, aguardaDescricao: false });
      return this.perguntarCategoria(dados.phone, destino.sector, cats, 0);
    }
    if (!dados.description) {
      await this.guardar(dados, { sector: escolhida, escolhida, palavra: null, page: 0, categoryId: null, aguardaDescricao: true });
      return this.pedirDescricao(dados.phone);
    }
    await this.prisma.whatsappPendente.delete({ where: { phone: dados.phone } }).catch(() => undefined);
    return this.abrir(dados, destino.sector, null, escolhida, destino.palavra ?? null);
  }

  private async guardar(
    d: Pendente,
    etapa: { sector: TicketSector | null; escolhida: TicketSector | null; palavra: string | null; page: number; categoryId: string | null; aguardaDescricao: boolean },
  ) {
    const data = { name: d.name, description: d.description, files: d.files as object[], ...etapa };
    await this.prisma.whatsappPendente.upsert({ where: { phone: d.phone }, create: { phone: d.phone, ...data }, update: { ...data, createdAt: new Date() } });
  }

  private async pedirDescricao(phone: string) {
    await this.whatsapp.sendText(phone, await renderMensagem(this.prisma, 'chamados.whatsapp.pedirDescricao'));
  }

  /** "Continuar no chamado #N": tira o menu e a próxima mensagem entra no chamado aberto. */
  private async continuar(phone: string, numero: number) {
    await this.prisma.whatsappPendente.delete({ where: { phone } }).catch(() => undefined);
    await this.whatsapp.sendText(phone, await renderMensagem(this.prisma, 'chamados.whatsapp.continuar', { numero }));
  }

  /** Categorias ativas da área, como estão cadastradas agora em Categorias e SLA (o que for criado ou desativado vale na hora). */
  private categorias(sector: TicketSector) {
    return this.prisma.ticketCategory.findMany({ where: { active: true, sector }, select: { id: true, name: true, description: true }, orderBy: { name: 'asc' } });
  }

  /** Lista das áreas; com chamado aberto, a última opção é continuar nele. */
  private async perguntarArea(phone: string, areas: TicketSector[], chave: string, open: { number: number } | null, palavraStatus?: string) {
    const sectors = await sectorTexts(this.prisma);
    const corpo = await renderMensagem(this.prisma, chave, { palavraStatus: palavraStatus ?? (await palavrasWhatsapp(this.prisma)).statusExibir });
    const rows = [
      ...areas.map((s) => ({ id: `area:${s}`, title: sectors[s].short, description: sectors[s].label === sectors[s].short ? undefined : sectors[s].label })),
      ...(open ? [{ id: 'continuar', title: `Chamado #${open.number}`, description: 'Continuar falando do chamado aberto' }] : []),
    ];
    const linhas = [...areas.map((s, i) => `${i + 1}. ${sectors[s].label}`), ...(open ? [`${areas.length + 1}. Continuar no chamado #${open.number}`] : [])];
    const texto = `${corpo}\n\n${linhas.join('\n')}\n\nResponda com o *número*.`;
    await this.whatsapp.sendList(phone, corpo, await renderMensagem(this.prisma, 'chamados.whatsapp.botaoOpcoes'), rows, texto);
  }

  /** Lista de categorias em páginas de 8, com "Mais opções" e "Não sei / Outro" em todas as páginas. */
  private async perguntarCategoria(phone: string, sector: TicketSector, cats: Categoria[], page: number) {
    const sectors = await sectorTexts(this.prisma);
    const corpo = await renderMensagem(this.prisma, 'chamados.whatsapp.escolherCategoria', { setor: sectors[sector].label });
    const pagina = cats.slice(page * POR_PAGINA, (page + 1) * POR_PAGINA);
    const rows = [
      ...pagina.map((c) => ({ id: `cat:${c.id}`, title: curto(c.name), description: (c.name.length > 24 ? c.name : (c.description ?? '')).slice(0, 72) || undefined })),
      ...(cats.length > POR_PAGINA ? [{ id: 'mais', title: 'Mais opções ›', description: `Página ${page + 1} de ${Math.ceil(cats.length / POR_PAGINA)}` }] : []),
      { id: 'outro', title: 'Não sei / Outro', description: 'A equipe escolhe a categoria' },
    ];
    const texto = `${corpo}\n\n${cats.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}\n${cats.length + 1}. Não sei / Outro\n\nResponda com o *número*.`;
    await this.whatsapp.sendList(phone, corpo, await renderMensagem(this.prisma, 'chamados.whatsapp.botaoOpcoes'), rows, texto);
  }

  /** Mensagem guardada esperando as respostas; a vencida é apagada e ignorada. */
  private async pendente(phone: string) {
    const p = await this.prisma.whatsappPendente.findUnique({ where: { phone } });
    if (p && Date.now() - p.createdAt.getTime() > PENDENTE_MS) {
      await this.prisma.whatsappPendente.delete({ where: { phone } }).catch(() => undefined);
      return null;
    }
    return p;
  }

  /** Abre o chamado do WhatsApp e confirma para a pessoa. */
  private async abrir(d: Pendente, sector: TicketSector, categoryId: string | null, escolhida: TicketSector, palavra: string | null) {
    const ticket = await this.tickets.create(
      { title: d.description.split('\n')[0].slice(0, 100), description: d.description, sector, ...(categoryId ? { categoryId } : {}) },
      null,
      'WHATSAPP',
      { phone: d.phone, name: d.name ?? undefined },
    );
    const sectors = await sectorTexts(this.prisma);
    if (palavra && escolhida !== sector) await this.notaEncaminhamento(ticket.id, sectors[escolhida].label, sectors[sector].label, palavra);
    for (const f of d.files) await this.tickets.externalComment(ticket, 'Anexo enviado pelo WhatsApp', 'WHATSAPP', d.name ?? d.phone, f);
    await this.whatsapp.sendText(
      d.phone,
      await renderMensagem(this.prisma, 'chamados.whatsapp.aberto', {
        numero: ticket.number,
        titulo: ticket.title,
        equipe: sectors[ticket.sector].team,
        link: `${process.env.PUBLIC_URL}/chamados`,
      }),
    );
  }

  /** Nota interna explicando o encaminhamento automático (a equipe vê por que o chamado chegou nela). */
  private async notaEncaminhamento(ticketId: string, de: string, para: string, palavra: string) {
    await this.prisma.ticketComment.create({
      data: { ticketId, authorName: 'Sistema', internal: true, body: `Aberto para ${de} e encaminhado automaticamente para ${para} pela palavra "${palavra}" (Categorias e SLA › Canais › Encaminhamento automático).` },
    });
  }

  @Interval(60_000)
  async pollMailbox() {
    if (this.polling || !this.mail.enabled) return;
    this.polling = true;
    try {
      for (const m of await this.mail.fetchUnseen()) await this.handleEmail(m).catch((e) => this.log.warn(e.message));
    } finally {
      this.polling = false;
    }
  }

  async handleEmail(m: { messageId: string; fromEmail: string; fromName: string; subject: string; text: string; attachments: { filename: string; content: Buffer }[] }) {
    if (!(await this.firstTime(m.messageId, 'EMAIL'))) return;
    const files: { id: string; name: string }[] = [];
    for (const a of m.attachments.slice(0, 10)) {
      const stored = await this.files.store(a.content, a.filename, false, undefined, false, 'CHAMADO').catch(() => null);
      if (stored) files.push({ id: stored.id, name: stored.originalName });
    }
    const ref = m.subject.match(/\[Chamado #(\d+)\]/i);
    if (ref) {
      const t = await this.prisma.ticket.findUnique({ where: { number: Number(ref[1]) } });
      if (t && t.requesterEmail?.toLowerCase() === m.fromEmail) {
        await this.tickets.externalComment(t, m.text, 'EMAIL', m.fromName);
        for (const f of files) await this.tickets.externalComment(t, 'Anexo enviado por e-mail', 'EMAIL', m.fromName, f);
        return;
      }
    }
    const rules = await chamadosRules(this.prisma);
    const title = m.subject.replace(/^(re|fw|fwd|enc|res):\s*/i, '').slice(0, 160) || 'Chamado por e-mail';
    const destino = encaminhar(rules, rules.emailSector, `${title}\n${m.text}`);
    const ticket = await this.tickets.create({ title, description: m.text || '(sem texto)', sector: destino.sector }, null, 'EMAIL', { email: m.fromEmail, name: m.fromName });
    if (destino.palavra) {
      const sectors = await sectorTexts(this.prisma);
      await this.notaEncaminhamento(ticket.id, sectors[rules.emailSector].label, sectors[destino.sector].label, destino.palavra);
    }
    for (const f of files) await this.tickets.externalComment(ticket, 'Anexo enviado por e-mail', 'EMAIL', m.fromName, f);
    const vars = { nome: m.fromName, numero: ticket.number, titulo: ticket.title, equipe: (await sectorTexts(this.prisma))[ticket.sector].team, link: `${process.env.PUBLIC_URL}/chamados` };
    // o prefixo [Chamado #N] é fixo: é por ele que as respostas por e-mail voltam para o chamado
    await this.mail.send(
      m.fromEmail,
      `[Chamado #${ticket.number}] ${await renderMensagem(this.prisma, 'chamados.email.confirmacaoAssunto', vars)}`,
      await renderMensagem(this.prisma, 'chamados.email.confirmacaoCorpo', vars),
      undefined,
      m.messageId,
    );
  }
}

/** Reconhece a resposta ao menu: o número ("2", "2.", "opção 2") ou o nome da área. */
export function escolherArea(plain: string, areas: TicketSector[], sectors: Record<TicketSector, { label: string; short: string }>): TicketSector | null {
  const n = plain.match(/^(?:opcao\s*)?(\d{1,2})\s*[.)-]?$/);
  if (n) return areas[Number(n[1]) - 1] ?? null;
  const t = plain.replace(/[!.,? ]+$/, '');
  return areas.find((s) => normalizar(sectors[s].label) === t || normalizar(sectors[s].short) === t) ?? null;
}

/** Reconhece a resposta ao menu de categorias: toque na lista, número, nome da categoria ou "não sei"/"outro". */
export function escolherCategoria(choiceId: string | undefined, plain: string, cats: { id: string; name: string }[]): string | 'mais' | 'outro' | null {
  if (choiceId === 'mais' || choiceId === 'outro') return choiceId;
  if (choiceId?.startsWith('cat:')) return cats.find((c) => c.id === choiceId.slice(4))?.id ?? null;
  const t = plain.replace(/[!.,? ]+$/, '');
  const n = t.match(/^(?:opcao\s*)?(\d{1,3})\s*[.)-]?$/);
  if (n) {
    const i = Number(n[1]);
    if (i === cats.length + 1) return 'outro';
    return cats[i - 1]?.id ?? null;
  }
  if (['nao sei', 'outro', 'outros', 'nao sei / outro'].includes(t)) return 'outro';
  if (['mais', 'mais opcoes'].includes(t)) return 'mais';
  return cats.find((c) => normalizar(c.name) === t)?.id ?? null;
}

/** Remove a palavra-chave (comparada sem acento) e separadores do começo da mensagem. */
function stripKeyword(text: string, keyword: string) {
  const t = text.trimStart();
  let i = 0;
  let consumed = '';
  while (i < t.length && normalizar(consumed).length < keyword.length) consumed += t[i++];
  return t.slice(i).replace(/^[:\s-]*/, '');
}
