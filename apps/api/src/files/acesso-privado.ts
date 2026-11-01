import { AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { acompanhadas } from '../tickets/config';
import { isStaffOf } from '../tickets/sectors';

const contem = (id: string) => ({ array_contains: [{ id }] });

/**
 * Arquivo privado pedido por quem entrou: confere o direito ao chamado dono do arquivo.
 * Anexo de chamado: quem vê o chamado (nota interna e evidência de prorrogação, só a equipe).
 * Arquivo que ainda não está em nenhum chamado: só quem enviou e o administrador.
 * O controller responde 404 para não confirmar que o arquivo existe.
 */
export async function podeVerPrivado(prisma: PrismaService, id: string, u: AuthUser): Promise<boolean> {
  const [comentarios, prorrogacoes, arquivo] = await Promise.all([
    prisma.ticketComment.findMany({ where: { fileId: id }, select: { internal: true, ticket: { select: { sector: true, requesterId: true } } }, take: 20 }),
    prisma.ticketProrrogacao.findMany({ where: { arquivos: contem(id) }, select: { ticket: { select: { sector: true } } }, take: 20 }),
    prisma.fileAsset.findUnique({ where: { id }, select: { uploadedById: true } }),
  ]);
  if (comentarios.length || prorrogacoes.length) {
    const seguidas = await acompanhadas(prisma, u);
    const equipe = (s: Parameters<typeof isStaffOf>[1]) => isStaffOf(u, s) || seguidas.includes(s);
    if (comentarios.some((c) => (c.internal ? isStaffOf(u, c.ticket.sector) : equipe(c.ticket.sector) || c.ticket.requesterId === u.id))) return true;
    return prorrogacoes.some((p) => equipe(p.ticket.sector));
  }
  return arquivo?.uploadedById === u.id || u.roles.includes('ADMIN');
}
