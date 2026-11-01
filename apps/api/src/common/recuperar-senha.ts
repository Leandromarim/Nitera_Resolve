import { Logger } from '@nestjs/common';
import type { MailService } from '../integrations/mail.service';
import { emailComMarca, marcaDoSistema } from './email-modelo';
import { renderMensagem } from '../mensagens/mensagens.service';
import type { PrismaService } from '../prisma/prisma.service';

/** "Esqueci minha senha": regras comuns e e-mails. */

/** Validade do link enviado por e-mail. */
export const RECUPERACAO_MINUTOS = 30;
/** Pedidos por conta em uma hora; acima disso o pedido é ignorado em silêncio (e fica na auditoria). */
export const RECUPERACAO_MAX_HORA = 3;

const log = new Logger('Recuperar senha');

const base = () => (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');

/** Só oferece a recuperação quando o servidor consegue mandar e-mail e montar o link. */
export const recuperacaoDisponivel = (mail: MailService) => mail.enabled && !!process.env.SMTP_HOST && /^https?:\/\//.test(base());

/**
 * O token vai depois do "#": o navegador não envia essa parte ao servidor, então ele não aparece
 * em logs de acesso nem no cabeçalho Referer.
 */
export const linkRecuperacao = (caminho: string, token: string) => `${base()}${caminho}#t=${token}`;

const quando = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export async function enviarLinkRecuperacao(prisma: PrismaService, mail: MailService, para: string, nome: string, sistema: string, link: string) {
  const vars = { nome: nome.split(/\s+/)[0], sistema, link, minutos: String(RECUPERACAO_MINUTOS) };
  const assunto = await renderMensagem(prisma, 'senha.recuperar.assunto', vars);
  const texto = await renderMensagem(prisma, 'senha.recuperar.texto', vars);
  const { html, inline } = emailComMarca({ marca: marcaDoSistema(sistema), texto, link, botao: 'Criar nova senha', titulo: assunto });
  await mail.send(para, assunto, texto, html, undefined, inline);
  log.log(`Link de recuperação enviado (${sistema})`);
}

/** Aviso depois da troca: se não foi a pessoa, ela fica sabendo na hora. */
export async function enviarAvisoSenhaAlterada(prisma: PrismaService, mail: MailService, para: string, nome: string, sistema: string) {
  const vars = { nome: nome.split(/\s+/)[0], sistema, quando: quando(new Date()) };
  const assunto = await renderMensagem(prisma, 'senha.alterada.assunto', vars);
  const texto = await renderMensagem(prisma, 'senha.alterada.texto', vars);
  const { html, inline } = emailComMarca({ marca: marcaDoSistema(sistema), texto, titulo: assunto });
  await mail.send(para, assunto, texto, html, undefined, inline);
}
