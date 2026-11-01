/**
 * Mensagens automáticas (WhatsApp, e-mail e avisos do sino) editáveis em Painel › Mensagens automáticas.
 * Cada mensagem tem um texto padrão (o texto original do sistema) e variáveis entre chaves, ex.: {numero}.
 * O que a equipe personaliza fica na configuração (tabela Setting) com a chave MENSAGENS_KEY: { [chave]: texto }.
 * Este arquivo não depende do Nest nem do banco, para poder ser testado isoladamente.
 */

export const MENSAGENS_KEY = 'mensagens';

export type Canal = 'whatsapp' | 'email' | 'sino';
/** texto: várias linhas · linha: uma linha (assuntos e títulos) · palavra: palavra-chave · lista: palavras separadas por vírgula. */
export type TipoMensagem = 'texto' | 'linha' | 'palavra' | 'lista';

export interface Variavel {
  nome: string;
  descricao: string;
  exemplo: string;
}

export interface MensagemDef {
  chave: string;
  /** Módulo (seção da tela). */
  modulo: string;
  canais: Canal[];
  rotulo: string;
  ajuda?: string;
  tipo: TipoMensagem;
  variaveis: string[];
  padrao: string;
  max: number;
}

/** Catálogo das variáveis (descrição e valor de exemplo usado na prévia). */
export const VARIAVEIS: Record<string, Omit<Variavel, 'nome'>> = {
  site: { descricao: 'Nome da instituição (Instituição e aparência › Nome)', exemplo: 'Minha Instituição' },
  numero: { descricao: 'Número do chamado', exemplo: '1234' },
  titulo: { descricao: 'Título', exemplo: 'Impressora da recepção não imprime' },
  status: { descricao: 'Situação do chamado', exemplo: 'Em atendimento' },
  equipe: { descricao: 'Equipe do setor do chamado ("equipe de TI", "equipe de Manutenção"…)', exemplo: 'equipe de TI' },
  setor: { descricao: 'Nome do setor de destino', exemplo: 'Manutenção' },
  link: { descricao: 'Endereço para acompanhar', exemplo: 'https://chamados.suainstituicao.com.br/chamados' },
  nome: { descricao: 'Nome da pessoa', exemplo: 'Maria Souza' },
  mensagem: { descricao: 'Texto da resposta', exemplo: 'Já trocamos o cabo. Pode testar, por favor?' },
  assunto: { descricao: 'Assunto do aviso (mudança de status, nova resposta…)', exemplo: 'Chamado #1234 — Em atendimento' },
  texto: { descricao: 'Texto do aviso (mudança de status, nova resposta…)', exemplo: 'O status do seu chamado "Impressora da recepção não imprime" mudou para: Em atendimento.' },
  palavraStatus: { descricao: 'Palavra-chave de consulta configurada abaixo', exemplo: 'status' },
  palavraNovo: { descricao: 'Palavra-chave para abrir outro chamado (em maiúsculas)', exemplo: 'NOVO' },
  versao: { descricao: 'Número da revisão ou versão', exemplo: '2' },
  sistema: { descricao: 'Nome do sistema', exemplo: 'NITERA Resolve' },
  minutos: { descricao: 'Minutos de validade do link', exemplo: '30' },
  quando: { descricao: 'Data e hora da alteração', exemplo: '19/10/2026, 13:05' },
};

const CH = 'Chamados';
const T = (chave: string, modulo: string, canais: Canal[], rotulo: string, variaveis: string[], padrao: string, extra: Partial<MensagemDef> = {}): MensagemDef => ({
  chave,
  modulo,
  canais,
  rotulo,
  tipo: 'texto',
  variaveis,
  padrao,
  max: 2000,
  ...extra,
});
const L = (chave: string, modulo: string, canais: Canal[], rotulo: string, variaveis: string[], padrao: string, extra: Partial<MensagemDef> = {}) =>
  T(chave, modulo, canais, rotulo, variaveis, padrao, { tipo: 'linha', max: 200, ...extra });

const PREFIXO_EMAIL = 'O assunto sempre começa com [Chamado #número], para que as respostas por e-mail entrem no chamado certo.';

export const MENSAGENS: MensagemDef[] = [
  // ───────── Chamados: WhatsApp ─────────
  T(
    'chamados.whatsapp.saudacao',
    CH,
    ['whatsapp'],
    'Saudação (abre a lista das áreas)',
    ['site', 'palavraStatus'],
    '👋 Olá! Esta é a *Central de Chamados do {site}*.\n\nEscolha a área do seu chamado na lista.\n\nPara consultar um chamado, envie: *{palavraStatus} 123*',
    { ajuda: 'Enviada com a lista das áreas quando a pessoa manda só uma saudação, uma mensagem curta ou NOVO. *texto* fica em negrito no WhatsApp.', max: 900 },
  ),
  T('chamados.whatsapp.aberto', CH, ['whatsapp'], 'Chamado aberto', ['numero', 'titulo', 'equipe', 'link', 'site'], '✅ Chamado *#{numero}* aberto!\n\nA {equipe} já foi avisada. Você receberá as atualizações por aqui.\nAcompanhe também em {link}', {
    ajuda: '{link} é o endereço da Central de Chamados.',
  }),
  T('chamados.whatsapp.escolherArea', CH, ['whatsapp'], 'Pergunta da área', ['site'], 'Para qual área é este chamado?', {
    ajuda: 'Enviada com a lista das áreas quando a primeira mensagem já descreve o problema (Categorias e SLA › Canais). As opções entram sozinhas abaixo do texto.',
    max: 900,
  }),
  T('chamados.whatsapp.escolherCategoria', CH, ['whatsapp'], 'Pergunta da categoria', ['setor', 'site'], 'Sobre o que é o chamado para *{setor}*?', {
    ajuda: 'Enviada depois da área, com as categorias ativas daquela área (Categorias e SLA). As opções entram sozinhas abaixo do texto, com "Não sei / Outro" no fim.',
    max: 900,
  }),
  T('chamados.whatsapp.pedirDescricao', CH, ['whatsapp'], 'Pedido da descrição', [], 'Agora descreva o problema em uma mensagem: setor, ramal e o que está acontecendo. Se ajudar, mande uma foto.', {
    ajuda: 'Enviada depois da área e da categoria quando a conversa começou com uma saudação. A próxima mensagem vira a descrição e o chamado é aberto.',
    max: 900,
  }),
  T('chamados.whatsapp.continuar', CH, ['whatsapp'], 'Continuar no chamado aberto', ['numero'], 'Certo! Pode escrever: sua mensagem entra no chamado #{numero}.', { max: 500 }),
  T('chamados.whatsapp.opcaoInvalida', CH, ['whatsapp'], 'Resposta fora das opções', [], 'Não entendi. Escolha uma das opções da lista ou responda com o número.', {
    ajuda: 'Enviada quando a resposta não é uma das opções; a lista é mandada de novo. O que a pessoa escreveu entra na descrição do chamado.',
    max: 500,
  }),
  L('chamados.whatsapp.botaoOpcoes', CH, ['whatsapp'], 'Botão que abre a lista de opções', [], 'Ver opções', { max: 20, ajuda: 'Até 20 caracteres (limite do WhatsApp).' }),
  T('chamados.whatsapp.adicionada', CH, ['whatsapp'], 'Mensagem adicionada a um chamado aberto', ['numero', 'titulo', 'palavraNovo'], 'Mensagem adicionada ao chamado #{numero}. Para abrir outro chamado, comece a mensagem com *{palavraNovo}*.'),
  T('chamados.whatsapp.consulta', CH, ['whatsapp'], 'Resposta da consulta de status', ['numero', 'titulo', 'status'], 'Chamado #{numero}: *{status}*\n{titulo}'),
  L('chamados.whatsapp.naoEncontrado', CH, ['whatsapp'], 'Consulta de status: chamado não encontrado', [], 'Não encontrei esse chamado para o seu número.', { max: 500 }),
  T('chamados.whatsapp.atualizacao', CH, ['whatsapp'], 'Formato dos avisos ao solicitante', ['assunto', 'texto', 'equipe', 'numero', 'titulo', 'link'], '*{assunto}*\n\n{texto}\n\nResponda esta mensagem para falar com a {equipe}.', {
    ajuda: 'Envolve os avisos de mudança de status, nova resposta e encaminhamento quando o chamado veio pelo WhatsApp. {link} é o endereço do chamado.',
  }),
  {
    chave: 'chamados.whatsapp.palavraStatus',
    modulo: CH,
    canais: ['whatsapp'],
    rotulo: 'Palavra-chave para consultar um chamado',
    ajuda: 'A pessoa envia esta palavra seguida do número (ex.: status 123). Maiúsculas e acentos são ignorados.',
    tipo: 'palavra',
    variaveis: [],
    padrao: 'status',
    max: 20,
  },
  {
    chave: 'chamados.whatsapp.palavraNovo',
    modulo: CH,
    canais: ['whatsapp'],
    rotulo: 'Palavra-chave para abrir outro chamado',
    ajuda: 'Com um chamado em aberto, as mensagens entram nele; começando com esta palavra, abre-se um chamado novo.',
    tipo: 'palavra',
    variaveis: [],
    padrao: 'novo',
    max: 20,
  },
  {
    chave: 'chamados.whatsapp.saudacoes',
    modulo: CH,
    canais: ['whatsapp'],
    rotulo: 'Saudações reconhecidas',
    ajuda: 'Separadas por vírgula. Quando a mensagem é só uma destas palavras, o sistema manda a saudação com a lista de áreas, mesmo se a pessoa já tiver um chamado aberto.',
    tipo: 'lista',
    variaveis: [],
    padrao: 'oi, olá, bom dia, boa tarde, boa noite, menu, ajuda, início',
    max: 500,
  },

  // ───────── Chamados: e-mail ─────────
  L('chamados.email.confirmacaoAssunto', CH, ['email'], 'Confirmação de abertura: assunto', ['numero', 'titulo'], '{titulo}', { ajuda: PREFIXO_EMAIL }),
  T(
    'chamados.email.confirmacaoCorpo',
    CH,
    ['email'],
    'Confirmação de abertura: texto',
    ['nome', 'numero', 'titulo', 'equipe', 'link', 'site'],
    'Olá, {nome}!\n\nRecebemos sua solicitação e abrimos o chamado #{numero}.\nAcompanhe em: {link}\n\nPara adicionar informações, responda este e-mail mantendo o assunto.\n\n{Equipe} — {site}',
    { ajuda: 'Escreva a variável com inicial maiúscula, como {Equipe}, para que ela comece com letra maiúscula.' },
  ),
  T('chamados.email.atualizacao', CH, ['email'], 'Formato dos avisos ao solicitante', ['assunto', 'texto', 'equipe', 'numero', 'titulo', 'link'], '{texto}\n\nAcompanhe em: {link}\n\nResponda este e-mail mantendo o assunto para adicionar uma mensagem ao chamado.', {
    ajuda: `Envolve os avisos de mudança de status, nova resposta e encaminhamento quando o chamado veio por e-mail. O assunto do e-mail é o assunto do aviso. ${PREFIXO_EMAIL}`,
  }),

  // ───────── Chamados: avisos ao solicitante (WhatsApp ou e-mail, conforme o canal do chamado) ─────────
  L('chamados.status.assunto', CH, ['whatsapp', 'email'], 'Mudança de status: assunto', ['numero', 'titulo', 'status', 'equipe'], 'Chamado #{numero} — {status}'),
  T('chamados.status.texto', CH, ['whatsapp', 'email'], 'Mudança de status: texto', ['numero', 'titulo', 'status', 'equipe'], 'O status do seu chamado "{titulo}" mudou para: {status}.'),
  L('chamados.resposta.assunto', CH, ['whatsapp', 'email'], 'Nova resposta: assunto', ['numero', 'titulo', 'equipe', 'nome'], 'Chamado #{numero} — nova resposta da {equipe}'),
  T('chamados.resposta.texto', CH, ['whatsapp', 'email'], 'Nova resposta: texto', ['numero', 'titulo', 'equipe', 'nome', 'mensagem'], '{nome} respondeu ao seu chamado "{titulo}":\n\n{mensagem}', {
    ajuda: '{nome} é quem respondeu e {mensagem} é o texto da resposta.',
  }),
  L('chamados.encaminhado.assunto', CH, ['whatsapp', 'email'], 'Encaminhado para outro setor: assunto', ['numero', 'titulo', 'setor', 'equipe'], 'Chamado #{numero} — encaminhado para {setor}'),
  T('chamados.encaminhado.texto', CH, ['whatsapp', 'email'], 'Encaminhado para outro setor: texto', ['numero', 'titulo', 'setor', 'equipe'], 'Seu chamado "{titulo}" foi encaminhado para a {equipe}, que vai continuar o atendimento.', {
    ajuda: '{equipe} e {setor} são os do novo setor.',
  }),
  L('chamados.prazo.assunto', CH, ['whatsapp', 'email'], 'Prazo aumentado: assunto', ['numero', 'titulo', 'prazo', 'equipe'], 'Chamado #{numero} — novo prazo: {prazo}'),
  T('chamados.prazo.texto', CH, ['whatsapp', 'email'], 'Prazo aumentado: texto', ['numero', 'titulo', 'prazo', 'equipe'], 'A {equipe} precisou de mais tempo para o seu chamado "{titulo}". O novo prazo é {prazo}.', {
    ajuda: 'Enviado só quando quem aumenta o prazo marca "Avisar o solicitante". A justificativa não vai para o solicitante.',
  }),

  // ───────── Esqueci minha senha (e-mail) ─────────
  L('senha.recuperar.assunto', 'Esqueci minha senha', ['email'], 'Link para criar nova senha: assunto', ['sistema'], 'Redefinição de senha: {sistema}'),
  T(
    'senha.recuperar.texto',
    'Esqueci minha senha',
    ['email'],
    'Link para criar nova senha: texto',
    ['nome', 'sistema', 'link', 'minutos'],
    'Olá, {nome}!\n\nRecebemos um pedido de nova senha para a sua conta ({sistema}).\n\nPara criar a nova senha, abra o link abaixo. Ele vale por {minutos} minutos e só pode ser usado uma vez:\n{link}\n\nSe você não pediu, ignore este e-mail: a sua senha continua a mesma.\n\n{site}',
    { ajuda: 'Mantenha {link} no texto: sem ele a pessoa não consegue criar a nova senha.' },
  ),
  L('senha.alterada.assunto', 'Esqueci minha senha', ['email'], 'Aviso de senha alterada: assunto', ['sistema'], 'Sua senha foi alterada: {sistema}'),
  T(
    'senha.alterada.texto',
    'Esqueci minha senha',
    ['email'],
    'Aviso de senha alterada: texto',
    ['nome', 'sistema', 'quando'],
    'Olá, {nome}!\n\nA senha da sua conta ({sistema}) foi alterada em {quando} pelo "Esqueci minha senha". Por segurança, a conta saiu de todos os aparelhos.\n\nSe foi você, não precisa fazer nada. Se não foi, avise a TI imediatamente.\n\n{site}',
  ),

  // ───────── Versões e novidades (sino) ─────────
  L('novidades.publicada.titulo', 'Versões e novidades', ['sino'], 'Nova versão publicada: título', ['versao', 'titulo', 'site'], 'NITERA Resolve atualizado para a versão {versao}'),
  T('novidades.publicada.texto', 'Versões e novidades', ['sino'], 'Nova versão publicada: texto', ['versao', 'titulo', 'site'], '{titulo}', { max: 1000, ajuda: '{titulo} é o título da versão.' }),
];

export const MENSAGENS_POR_CHAVE: Record<string, MensagemDef> = Object.fromEntries(MENSAGENS.map((m) => [m.chave, m]));

export type ChaveMensagem = (typeof MENSAGENS)[number]['chave'];
export type Vars = Record<string, string | number | null | undefined>;

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

const capitalizar = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1) : s);

/**
 * Troca as variáveis do modelo pelos valores. {Nome} (inicial maiúscula) usa o valor de {nome} com a primeira letra maiúscula.
 * Variáveis desconhecidas ficam como estão, para o erro ficar visível em vez de sumir.
 */
export function aplicar(modelo: string, vars: Vars): string {
  return modelo.replace(PLACEHOLDER, (todo, nome: string) => {
    if (nome in vars) return String(vars[nome] ?? '');
    const minusc = nome.charAt(0).toLowerCase() + nome.slice(1);
    if (minusc !== nome && minusc in vars) return capitalizar(String(vars[minusc] ?? ''));
    return todo;
  });
}

/** Variáveis usadas no modelo que a mensagem não oferece (aceita a forma com inicial maiúscula). */
export function variaveisInvalidas(def: MensagemDef, modelo: string): string[] {
  const ok = new Set(def.variaveis);
  const ruins = new Set<string>();
  for (const [, nome] of modelo.matchAll(PLACEHOLDER)) {
    const minusc = nome.charAt(0).toLowerCase() + nome.slice(1);
    if (!ok.has(nome) && !ok.has(minusc)) ruins.add(nome);
  }
  return [...ruins];
}

/** Valida e normaliza um texto enviado pelo painel. Devolve a mensagem de erro, se houver. */
export function validar(def: MensagemDef, bruto: unknown): { valor?: string; erro?: string } {
  if (typeof bruto !== 'string') return { erro: `${def.rotulo}: o texto é inválido.` };
  let v = bruto.replace(/\r\n?/g, '\n');
  if (def.tipo === 'texto') v = v.replace(/[ \t]+$/gm, '').trim();
  else v = v.replace(/\s+/g, ' ').trim();
  if (!v) return { erro: `${def.rotulo}: o texto não pode ficar vazio. Use "Voltar ao padrão" para restaurar o original.` };
  if (v.length > def.max) return { erro: `${def.rotulo}: use no máximo ${def.max} caracteres.` };
  if (def.tipo === 'palavra') {
    if (!/^[\p{L}\d]{2,20}$/u.test(v)) return { erro: `${def.rotulo}: use uma única palavra, só com letras ou números (de 2 a 20).` };
    return { valor: v.toLocaleLowerCase('pt-BR') };
  }
  if (def.tipo === 'lista') {
    const itens = [...new Set(v.split(',').map((x) => x.trim().toLocaleLowerCase('pt-BR')).filter(Boolean))];
    if (!itens.length) return { erro: `${def.rotulo}: informe pelo menos uma palavra.` };
    if (itens.some((x) => x.length > 40 || !/^[\p{L}\d ]+$/u.test(x))) return { erro: `${def.rotulo}: use só letras, números e espaços em cada item (até 40 caracteres).` };
    return { valor: itens.join(', ') };
  }
  const ruins = variaveisInvalidas(def, v);
  if (ruins.length) {
    const disp = def.variaveis.length ? `Disponíveis: ${def.variaveis.map((x) => `{${x}}`).join(', ')}.` : 'Esta mensagem não tem variáveis.';
    return { erro: `${def.rotulo}: a variável ${ruins.map((x) => `{${x}}`).join(', ')} não existe nesta mensagem. ${disp}` };
  }
  return { valor: v };
}

/** Lê o valor salvo na Setting, descartando chaves desconhecidas e valores que não sejam texto. */
export function lerPersonalizadas(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (MENSAGENS_POR_CHAVE[k] && typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}

/** Texto final da mensagem: modelo personalizado (ou o padrão) com as variáveis aplicadas. */
export function renderizar(personalizadas: Record<string, string>, chave: string, vars: Vars = {}): string {
  const def = MENSAGENS_POR_CHAVE[chave];
  if (!def) throw new Error(`Mensagem automática desconhecida: ${chave}`);
  return aplicar(personalizadas[chave] ?? def.padrao, vars);
}

/** Tira acentos e deixa em minúsculas, para comparar palavras-chave. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
