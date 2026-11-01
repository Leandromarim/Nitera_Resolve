/**
 * Registro dos textos da intranet editáveis em Painel › Textos da intranet.
 *
 * Cada texto tem uma chave estável, a página/grupo onde aparece, um rótulo para o painel e o texto padrão
 * (o que aparece enquanto ninguém personalizou). O servidor guarda só as substituições, no Setting `textos`,
 * e as entrega em `/api/portal` (campo `textos`) e em `/api/textos`.
 *
 * Variáveis entre chaves são trocadas na hora de exibir: {site} = nome do hospital e {tagline} = subtítulo
 * (Painel › Configurações). Para adicionar um texto novo: inclua-o aqui e use `useTexto('chave')` na tela.
 *
 * Este arquivo não tem 'use client' de propósito: o layout do servidor também o usa (título da aba).
 */

export interface TextoDef {
  chave: string;
  /** Página ou área onde o texto aparece (agrupa a lista no painel). */
  grupo: string;
  rotulo: string;
  padrao: string;
  multilinha?: boolean;
  /** Pode ficar em branco (o elemento some da tela). */
  opcional?: boolean;
  /** Variáveis aceitas, além de {site} e {tagline}. */
  vars?: readonly string[];
  ajuda?: string;
}

export const VARIAVEIS_GERAIS = ['site', 'tagline'] as const;
/** Valores usados só se a API não responder (iguais ao padrão de Configurações, em lib/branding.tsx). */
export const VALORES_PADRAO = { site: 'NITERA Resolve', tagline: 'Central de chamados' };
export const VARIAVEL_DESCRICAO: Record<string, string> = {
  site: 'nome da instituição (Configurações)',
  tagline: 'subtítulo (Configurações)',
  pagina: 'nome da página aberta',
};
export const MAX_TEXTO_LINHA = 200;
export const MAX_TEXTO_MULTILINHA = 1000;

type ChavePagina<P extends string> = `${P}.titulo` | `${P}.descricao` | `${P}.vazio-titulo` | `${P}.vazio-texto`;

/** Título, descrição e mensagens de lista vazia de uma página do portal. */
function pagina<P extends string>(
  grupo: string,
  prefixo: P,
  t: { titulo: string; descricao?: string; vazioTitulo?: string; vazioTexto?: string },
): (TextoDef & { chave: ChavePagina<P> })[] {
  const out: (TextoDef & { chave: ChavePagina<P> })[] = [{ chave: `${prefixo}.titulo`, grupo, rotulo: 'Título da página', padrao: t.titulo }];
  if (t.descricao !== undefined) out.push({ chave: `${prefixo}.descricao`, grupo, rotulo: 'Descrição abaixo do título', padrao: t.descricao, multilinha: true, opcional: true });
  if (t.vazioTitulo !== undefined) out.push({ chave: `${prefixo}.vazio-titulo`, grupo, rotulo: 'Lista vazia: título', padrao: t.vazioTitulo });
  if (t.vazioTexto !== undefined) out.push({ chave: `${prefixo}.vazio-texto`, grupo, rotulo: 'Lista vazia: explicação', padrao: t.vazioTexto, multilinha: true, opcional: true });
  return out;
}

export const TEXTOS = [
  // ───────── site ─────────
  { chave: 'site.titulo-aba', grupo: 'Site (aba do navegador)', rotulo: 'Título da aba na página inicial', padrao: 'Chamados · {site}' },
  {
    chave: 'site.titulo-aba-pagina',
    grupo: 'Site (aba do navegador)',
    rotulo: 'Título da aba nas demais páginas',
    padrao: '{pagina} · {site}',
    vars: ['pagina'],
    ajuda: 'Use {pagina} para o nome da página aberta (ex.: Chat, Painel administrativo).',
  },
  { chave: 'site.descricao', grupo: 'Site (aba do navegador)', rotulo: 'Descrição do site (buscadores e links compartilhados)', padrao: 'Central de chamados do {site}', multilinha: true },
  {
    chave: 'cabecalho.modo-escuro',
    grupo: 'Cabeçalho do portal',
    rotulo: 'Texto ao lado do seletor de tema',
    padrao: '{modo}',
    vars: ['modo'],
    opcional: true,
    ajuda: 'Use {modo} para o tema escolhido no momento (Modo claro, Modo escuro ou Modo automático). Deixe em branco para mostrar só os botões.',
  },

  // ───────── login ─────────
  { chave: 'login.titulo', grupo: 'Tela de login', rotulo: 'Título do formulário', padrao: 'Entrar' },
  { chave: 'login.subtitulo', grupo: 'Tela de login', rotulo: 'Texto abaixo do título', padrao: 'Use seu usuário e senha corporativos.', opcional: true },
  { chave: 'login.selo', grupo: 'Tela de login', rotulo: 'Painel lateral: selo acima da chamada', padrao: '{tagline}', opcional: true, ajuda: 'Aparece em letras maiúsculas.' },
  { chave: 'login.chamada', grupo: 'Tela de login', rotulo: 'Painel lateral: chamada principal', padrao: 'Seus chamados em um só lugar.', multilinha: true },
  { chave: 'login.item-1', grupo: 'Tela de login', rotulo: 'Painel lateral: 1º benefício', padrao: 'Abra chamados pelo site, WhatsApp ou e-mail', opcional: true },
  { chave: 'login.item-2', grupo: 'Tela de login', rotulo: 'Painel lateral: 2º benefício', padrao: 'Acompanhe cada etapa do atendimento', opcional: true },
  { chave: 'login.item-3', grupo: 'Tela de login', rotulo: 'Painel lateral: 3º benefício', padrao: 'Acesso protegido e auditado', opcional: true },
  { chave: 'login.item-4', grupo: 'Tela de login', rotulo: 'Painel lateral: 4º benefício', padrao: '', opcional: true },
  { chave: 'login.item-5', grupo: 'Tela de login', rotulo: 'Painel lateral: 5º benefício', padrao: '', opcional: true },
  { chave: 'login.item-6', grupo: 'Tela de login', rotulo: 'Painel lateral: 6º benefício', padrao: '', opcional: true },
  { chave: 'login.item-7', grupo: 'Tela de login', rotulo: 'Painel lateral: 7º benefício', padrao: '', opcional: true },
  { chave: 'login.aviso', grupo: 'Tela de login', rotulo: 'Painel lateral: aviso no rodapé', padrao: 'Uso exclusivo de colaboradores. Acessos são registrados conforme a LGPD.', multilinha: true, opcional: true },
  { chave: 'login.campo-usuario', grupo: 'Tela de login', rotulo: 'Formulário: nome do campo de usuário', padrao: 'Usuário ou e-mail', ajuda: 'Os textos do formulário também valem para o login da Central de Chamados.' },
  { chave: 'login.exemplo-usuario', grupo: 'Tela de login', rotulo: 'Formulário: exemplo dentro do campo de usuário', padrao: 'nome.sobrenome', opcional: true },
  { chave: 'login.campo-senha', grupo: 'Tela de login', rotulo: 'Formulário: nome do campo de senha', padrao: 'Senha' },
  { chave: 'login.manter-conectado', grupo: 'Tela de login', rotulo: 'Formulário: opção "manter conectado"', padrao: 'Manter conectado neste computador', opcional: true, ajuda: 'Deixe em branco para esconder a opção.' },
  { chave: 'login.botao', grupo: 'Tela de login', rotulo: 'Formulário: botão de entrar', padrao: 'Entrar' },
  {
    chave: 'login.esqueceu-senha',
    grupo: 'Tela de login',
    rotulo: 'Ajuda com a senha, abaixo do formulário',
    padrao: 'Não recebeu o e-mail ou não tem e-mail cadastrado? Abra um chamado pelo WhatsApp ou fale com o suporte.',
    multilinha: true,
    opcional: true,
    ajuda: 'Também aparece no login da Central de Chamados. O "Desenvolvido por" segue o bloco de Cabeçalho e rodapé.',
  },

  // ───────── login da central de chamados ─────────
  { chave: 'chamados-login.titulo', grupo: 'Login da Central de Chamados', rotulo: 'Título do formulário', padrao: 'Central de Chamados' },
  { chave: 'chamados-login.subtitulo', grupo: 'Login da Central de Chamados', rotulo: 'Texto abaixo do título', padrao: 'Entre para abrir e acompanhar seus chamados.', opcional: true },
  { chave: 'chamados-login.selo', grupo: 'Login da Central de Chamados', rotulo: 'Painel lateral: selo', padrao: 'Central de Chamados', opcional: true },
  { chave: 'chamados-login.chamada', grupo: 'Login da Central de Chamados', rotulo: 'Painel lateral: chamada principal', padrao: 'Precisa de ajuda? Abra um chamado para a equipe certa.', multilinha: true },
  { chave: 'chamados-login.texto', grupo: 'Login da Central de Chamados', rotulo: 'Painel lateral: texto', padrao: 'Abra um chamado pelo site e acompanhe cada etapa.', multilinha: true, opcional: true },
  {
    chave: 'chamados-login.texto-canais',
    grupo: 'Login da Central de Chamados',
    rotulo: 'Painel lateral: complemento quando há WhatsApp ou e-mail do suporte',
    padrao: 'Você também pode usar os canais abaixo.',
    multilinha: true,
    opcional: true,
  },
  { chave: 'chamados-login.rodape', grupo: 'Login da Central de Chamados', rotulo: 'Painel lateral: rodapé', padrao: '{site} · Central de chamados', opcional: true },

  // ───────── aviso de cookies ─────────
  { chave: 'cookies.destaque', grupo: 'Aviso de cookies', rotulo: 'Início do aviso (em negrito)', padrao: 'Usamos apenas cookies essenciais', opcional: true },
  {
    chave: 'cookies.texto',
    grupo: 'Aviso de cookies',
    rotulo: 'Restante do aviso',
    padrao:
      'para manter seu login e a segurança, e o armazenamento do navegador para guardar preferências (como tema e som dos chamados). Não usamos cookies de publicidade nem de rastreamento.',
    multilinha: true,
  },
  { chave: 'cookies.link', grupo: 'Aviso de cookies', rotulo: 'Texto do link da política de privacidade', padrao: 'Política de Privacidade', opcional: true, ajuda: 'O endereço do link vem de Configurações (política de privacidade).' },
  { chave: 'cookies.botao', grupo: 'Aviso de cookies', rotulo: 'Botão de aceite', padrao: 'Entendi' },

  // ───────── chat ─────────
  { chave: 'chat.titulo', grupo: 'Chat interno', rotulo: 'Tela inicial: título', padrao: 'Chat interno' },
  {
    chave: 'chat.descricao',
    grupo: 'Chat interno',
    rotulo: 'Tela inicial: descrição',
    padrao: 'Converse em tempo real com colegas do {site}. Envie mensagens, fotos e documentos, crie grupos por setor e acompanhe quando suas mensagens forem lidas.',
    multilinha: true,
    opcional: true,
  },
  { chave: 'chat.botao', grupo: 'Chat interno', rotulo: 'Tela inicial: botão', padrao: 'Nova conversa' },
  { chave: 'chat.rodape', grupo: 'Chat interno', rotulo: 'Tela inicial: aviso no rodapé', padrao: 'Mensagens restritas', opcional: true },
  { chave: 'chat.titulo-aba', grupo: 'Chat interno', rotulo: 'Título da aba do navegador', padrao: 'Chat · {site}' },

  // ───────── páginas do portal ─────────
  ...pagina('Mini Jornal', 'jornal', {
    titulo: 'Mini Jornal',
    descricao: 'Notícias, eventos e comunicados do {site}',
    vazioTitulo: 'Nenhuma matéria publicada',
    vazioTexto: 'As notícias do hospital aparecerão aqui.',
  }),
  ...pagina('Ramais', 'ramais', { titulo: 'Ramais', descricao: 'Lista de ramais do {site}', vazioTitulo: 'Nenhum ramal cadastrado', vazioTexto: 'A lista de ramais ainda não foi publicada.' }),
  { chave: 'ramais.diretorio-login-titulo', grupo: 'Ramais', rotulo: 'Diretório de pessoas para visitantes: título', padrao: 'Entre para ver o diretório de pessoas' },
  {
    chave: 'ramais.diretorio-login-texto',
    grupo: 'Ramais',
    rotulo: 'Diretório de pessoas para visitantes: explicação',
    padrao: 'O diretório com nome, cargo e ramal dos colaboradores é exclusivo para quem tem login na intranet.',
    multilinha: true,
    opcional: true,
  },
  ...pagina('E-mails e celulares', 'contatos', {
    titulo: 'E-mails e celulares corporativos',
    descricao: 'Contatos corporativos do {site}',
    vazioTitulo: 'Nenhum contato publicado',
    vazioTexto: 'A lista de e-mails e celulares corporativos ainda não foi cadastrada.',
  }),
  ...pagina('Ouvidoria', 'ouvidoria', {
    titulo: 'Ouvidoria',
    descricao: 'Elogios, sugestões e reclamações de pacientes e acompanhantes. Nos leitos, o paciente avalia pelo QR Code.',
  }),
  { chave: 'ouvidoria.aba-nova', grupo: 'Ouvidoria', rotulo: 'Aba de registro', padrao: 'Registrar manifestação' },
  { chave: 'ouvidoria.aba-consultar', grupo: 'Ouvidoria', rotulo: 'Aba de consulta', padrao: 'Consultar protocolo' },
  ...pagina('Segurança do Paciente', 'seguranca', {
    titulo: 'Segurança do Paciente',
    descricao:
      'Relatórios do Núcleo de Segurança do Paciente: notificações de eventos, metas internacionais, indicadores e protocolos. Documentos de uso interno: não compartilhe fora do hospital.',
    vazioTitulo: 'Nenhum relatório publicado',
    vazioTexto: 'Os relatórios publicados pela Qualidade aparecerão aqui.',
  }),
  ...pagina('Galeria de fotos', 'galeria', {
    titulo: 'Galeria de fotos',
    descricao: 'Registros dos eventos, campanhas e confraternizações do hospital.',
    vazioTitulo: 'Nenhum álbum publicado',
    vazioTexto: 'Os álbuns de fotos aparecerão aqui.',
  }),
  {
    chave: 'galeria.vazio-texto-visitante',
    grupo: 'Galeria de fotos',
    rotulo: 'Lista vazia: explicação para quem não entrou',
    padrao: 'Alguns álbuns são exclusivos para colaboradores. Entre para ver todos.',
    multilinha: true,
    opcional: true,
  },
  ...pagina('Colaboradores', 'colaboradores', {
    titulo: 'Colaboradores',
    descricao: 'Conheça as equipes do hospital: cargo, setor, ramal e formação.',
    vazioTitulo: 'Nenhum colaborador cadastrado ainda',
    vazioTexto: 'Assim que o RH cadastrar as equipes, elas aparecem aqui.',
  }),
  ...pagina('Corpo Clínico', 'corpo-clinico', {
    titulo: 'Corpo Clínico',
    vazioTitulo: 'Corpo clínico ainda não publicado',
    vazioTexto: 'Em breve você encontrará aqui os médicos do hospital.',
  }),
  ...pagina('Formulários', 'formularios', { titulo: 'FORMULÁRIOS', vazioTitulo: 'Nenhum formulário publicado', vazioTexto: 'Os formulários dos setores aparecerão aqui.' }),
  ...pagina('Avisos', 'avisos', {
    titulo: 'Avisos',
    descricao: 'Comunicados da intranet para você, seu setor e todo o hospital.',
    vazioTitulo: 'Nenhum aviso por enquanto',
    vazioTexto: 'Quando houver comunicados para você, eles aparecerão aqui.',
  }),
  ...pagina('Indicadores', 'indicadores', {
    titulo: 'Indicadores',
    descricao: 'Acompanhamento mensal dos indicadores institucionais e comparação com as metas.',
    vazioTitulo: 'Nenhum indicador publicado',
    vazioTexto: 'Quando a Qualidade publicar os indicadores, eles aparecerão aqui.',
  }),
  ...pagina('Aniversariantes', 'aniversariantes', { titulo: 'Aniversariantes', descricao: 'Quem faz aniversário no mês, com a campanha de saúde do período.' }),
  ...pagina('Versões e novidades', 'novidades', {
    titulo: 'Versões e novidades',
    descricao: 'Tudo o que mudou no sistema a cada atualização: novidades, melhorias, correções e segurança.',
    vazioTitulo: 'Nenhuma versão publicada ainda',
    vazioTexto: 'Quando o sistema for atualizado, as novidades aparecem aqui.',
  }),
  ...pagina('Usuários de chamados', 'usuarios-chamados', {
    titulo: 'Usuários de chamados gerais',
    descricao: 'Contas genéricas por setor para abrir chamados nos sistemas. A senha é informada pela equipe de TI.',
    vazioTitulo: 'Nenhum usuário cadastrado',
    vazioTexto: 'A equipe de TI ainda não cadastrou usuários de chamados.',
  }),
] as const satisfies readonly TextoDef[];

export type TextoChave = (typeof TEXTOS)[number]['chave'];

export const TEXTO_POR_CHAVE: Record<string, TextoDef> = Object.fromEntries((TEXTOS as readonly TextoDef[]).map((d) => [d.chave, d]));

/** Variáveis que o texto aceita. */
export const varsDoTexto = (d: TextoDef) => [...VARIAVEIS_GERAIS, ...(d.vars ?? [])];

/** Troca {variavel} pelos valores; variáveis desconhecidas ficam como estão. */
export function formatTexto(template: string, vars: Record<string, string | undefined>) {
  return template.replace(/\{([a-z]+)\}/g, (m, k: string) => (vars[k] !== undefined ? (vars[k] as string) : m));
}

/**
 * Texto final de uma chave: o personalizado (se houver e for válido) ou o padrão, com as variáveis trocadas.
 * Texto em branco só vale para os opcionais; nos demais, volta ao padrão.
 */
export function resolverTexto(chave: TextoChave, salvos: Record<string, string> | null | undefined, vars: Record<string, string | undefined>) {
  const def = TEXTO_POR_CHAVE[chave];
  const salvo = salvos?.[chave];
  const usar = typeof salvo === 'string' && (salvo.trim() || def?.opcional) ? salvo : (def?.padrao ?? '');
  return formatTexto(usar, vars).trim();
}
