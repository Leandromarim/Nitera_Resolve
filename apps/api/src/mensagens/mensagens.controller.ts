import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Module, Post, Put } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { AuthUser, ClientIp, CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { VersionsService } from '../versions/versions.service';
import { limparCacheMensagens, MensagensService, nomeDoSite } from './mensagens.service';
import { MENSAGENS, MENSAGENS_KEY, MENSAGENS_POR_CHAVE, MensagemDef, VARIAVEIS, lerPersonalizadas, validar } from './registry';

class SalvarMensagensDto {
  /** { chave: texto } para personalizar; { chave: null } para voltar ao padrão. Só as chaves enviadas mudam. */
  @IsObject({ message: 'Dados inválidos' }) valores: Record<string, unknown>;
}

/** TI (e ADMIN) edita todas; Comunicação edita só os avisos do sino. */
function podeEditar(def: MensagemDef, u: AuthUser) {
  if (u.roles.includes('ADMIN') || u.roles.includes('TI')) return true;
  return u.roles.includes('COMUNICACAO') && def.canais.every((c) => c === 'sino');
}

/** Painel › Mensagens automáticas: textos de WhatsApp, e-mail e avisos do sino com variáveis. */
@Controller('admin/mensagens')
@Roles('TI', 'COMUNICACAO')
export class MensagensController {
  constructor(private prisma: PrismaService, private audit: AuditService, private versions: VersionsService) {}

  private async atuais() {
    const row = await this.prisma.setting.findUnique({ where: { key: MENSAGENS_KEY } });
    return lerPersonalizadas(row?.value);
  }

  private async view(u: AuthUser) {
    const [valores, site] = await Promise.all([this.atuais(), nomeDoSite(this.prisma)]);
    return {
      site,
      itens: MENSAGENS.map((m) => ({
        chave: m.chave,
        modulo: m.modulo,
        canais: m.canais,
        rotulo: m.rotulo,
        ajuda: m.ajuda ?? null,
        tipo: m.tipo,
        max: m.max,
        padrao: m.padrao,
        valor: valores[m.chave] ?? m.padrao,
        personalizado: m.chave in valores,
        podeEditar: podeEditar(m, u),
        variaveis: m.variaveis.map((nome) => ({ nome, ...VARIAVEIS[nome] })),
      })),
    };
  }

  private async gravar(valores: Record<string, string>, chaves: string[], action: string, u: AuthUser, ip: string) {
    await this.prisma.setting.upsert({ where: { key: MENSAGENS_KEY }, create: { key: MENSAGENS_KEY, value: valores }, update: { value: valores } });
    limparCacheMensagens();
    // revisão só desta chave: restaurar uma versão não mexe nas demais configurações
    await this.versions.record('Setting', MENSAGENS_KEY, action, u, { [MENSAGENS_KEY]: valores });
    await this.audit.log(u.id, action, 'Setting', MENSAGENS_KEY, { chaves }, ip);
  }

  @Get()
  get(@CurrentUser() u: AuthUser) {
    return this.view(u);
  }

  @Put()
  async save(@Body() dto: SalvarMensagensDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const entradas = Object.entries(dto.valores ?? {});
    if (!entradas.length) throw new BadRequestException('Nenhuma mensagem foi alterada.');
    if (entradas.length > MENSAGENS.length) throw new BadRequestException('Dados inválidos');
    const erros: string[] = [];
    const atual = await this.atuais();
    const novo = { ...atual };
    for (const [chave, bruto] of entradas) {
      const def = MENSAGENS_POR_CHAVE[chave];
      if (!def) {
        erros.push(`Mensagem desconhecida: ${chave.slice(0, 80)}`);
        continue;
      }
      if (!podeEditar(def, u)) throw new ForbiddenException(`Seu perfil não pode alterar a mensagem "${def.rotulo}". Fale com a equipe de TI.`);
      if (bruto === null) {
        delete novo[chave];
        continue;
      }
      const { valor, erro } = validar(def, bruto);
      if (erro) erros.push(erro);
      else if (valor === def.padrao) delete novo[chave];
      else novo[chave] = valor!;
    }
    if (erros.length) throw new BadRequestException(erros);
    const p = novo['chamados.whatsapp.palavraStatus'] ?? MENSAGENS_POR_CHAVE['chamados.whatsapp.palavraStatus'].padrao;
    const n = novo['chamados.whatsapp.palavraNovo'] ?? MENSAGENS_POR_CHAVE['chamados.whatsapp.palavraNovo'].padrao;
    if (p.normalize('NFD').replace(/[̀-ͯ]/g, '') === n.normalize('NFD').replace(/[̀-ͯ]/g, ''))
      throw new BadRequestException('As palavras-chave de consulta e de novo chamado precisam ser diferentes.');
    const mudou = entradas.map(([k]) => k).filter((k) => (atual[k] ?? null) !== (novo[k] ?? null));
    if (mudou.length) await this.gravar(novo, mudou, 'editar', u, ip);
    return this.view(u);
  }

  /** Volta ao padrão todas as mensagens que o perfil pode editar. */
  @Post('restaurar')
  @HttpCode(200)
  async restore(@CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const atual = await this.atuais();
    const novo: Record<string, string> = {};
    const chaves: string[] = [];
    for (const [k, v] of Object.entries(atual)) {
      if (podeEditar(MENSAGENS_POR_CHAVE[k], u)) chaves.push(k);
      else novo[k] = v;
    }
    if (chaves.length) await this.gravar(novo, chaves, 'restaurar', u, ip);
    return this.view(u);
  }
}

@Module({ controllers: [MensagensController], providers: [MensagensService], exports: [MensagensService] })
export class MensagensModule {}
