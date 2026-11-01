import type { Role, TicketPriority, TicketSector } from '@prisma/client';
import { ICON_NAMES } from './icones';
import type { PrismaService } from '../prisma/prisma.service';
import { normalizar } from '../mensagens/registry';
import { staffSectors } from './sectors';

/**
 * Configuração dos chamados editável no painel (Categorias e SLA › Setores, Prioridades e SLA, Dicas, Canais).
 * Fica na tabela Setting:
 * - `chamados`: textos dos setores, prioridades, dicas, regras de SLA e canais (perfil TI);
 * - `chamadosCategorias`: ícone e dicas de cada categoria, indexados pelo id da categoria (equipe do setor da categoria).
 * Tudo que não estiver salvo cai no padrão abaixo, igual ao que existia fixo no código.
 */
export const CHAMADOS_KEY = 'chamados';
export const CHAMADOS_CATEGORIAS_KEY = 'chamadosCategorias';

const SECTOR_LIST: TicketSector[] = ['TI', 'INFRAESTRUTURA', 'MANUTENCAO', 'COMUNICACAO'];
const PRIORITY_LIST: TicketPriority[] = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

/** Paleta de cores dos setores (espelhada em apps/web/src/components/tickets/config.tsx). */
export const SECTOR_COLORS = ['ceu', 'ambar', 'fucsia', 'verde', 'roxo', 'coral', 'azul', 'cinza', 'vermelho', 'turquesa', 'laranja', 'rosa'] as const;

export interface SectorConfig {
  label: string;
  short: string;
  team: string;
  help: string;
  icon: string;
  imageId: string | null;
  color: string;
  tips: string[];
  titleExample: string;
  descriptionPlaceholder: string;
  /** outras equipes cujos chamados e planejamento esta equipe acompanha, só para leitura */
  acompanha: TicketSector[];
  /** quem acompanha: só quem tem a permissão GESTOR_AREA ou a equipe toda */
  acompanhaQuem: AcompanhaQuem;
}

export type AcompanhaQuem = 'gestor' | 'equipe';
export const ACOMPANHA_QUEM: AcompanhaQuem[] = ['gestor', 'equipe'];

export interface PriorityConfig {
  label: string;
  help: string;
}

export interface KeywordTip {
  id: string;
  /** setores em que a dica vale (vazio = todos) */
  sectors: TicketSector[];
  /** palavras procuradas no nome da categoria */
  words: string[];
  tips: string[];
}

export interface ChamadosRules {
  slaFactor: Record<TicketPriority, number>;
  defaultSlaHours: number;
  whatsappSector: TicketSector;
  emailSector: TicketSector;
  whatsappWindowDays: number;
  /** pergunta a área (menu numerado) antes de abrir o chamado pelo WhatsApp */
  whatsappAskSector: boolean;
  /** depois da área, pergunta a categoria (as ativas da área, cadastradas em Categorias e SLA) */
  whatsappAskCategory: boolean;
  /** áreas oferecidas no menu, na ordem mostrada */
  whatsappSectors: TicketSector[];
  /** encaminhamento automático: chamado de `from` cujo texto tem uma das palavras vai para `to` (WhatsApp e e-mail) */
  redirects: SectorRedirect[];
}

export interface SectorRedirect {
  id: string;
  from: TicketSector;
  to: TicketSector;
  /** palavras ou expressões procuradas no texto (sem acento e sem diferenciar maiúsculas) */
  words: string[];
}

export interface ChamadosConfig {
  sectors: Record<TicketSector, SectorConfig>;
  priorities: Record<TicketPriority, PriorityConfig>;
  keywordTips: KeywordTip[];
  /** dica mostrada antes de escolher a equipe */
  noSectorTip: string;
  /** dica que aparece sempre, no fim da lista */
  alwaysTip: string;
  rules: ChamadosRules;
  channels: { title: string; text: string; mailSubject: string };
  success: { title: string; subtitle: string; numberLabel: string; note: string };
}

export interface CategoryExtra {
  icon: string | null;
  imageId: string | null;
  tips: string[];
}

export const LIMITS = {
  label: 60,
  short: 30,
  team: 60,
  help: 200,
  tip: 200,
  tips: 8,
  titleExample: 120,
  placeholder: 300,
  keywordTips: 40,
  words: 12,
  word: 40,
  priorityLabel: 30,
  channelTitle: 80,
  channelText: 300,
  mailSubject: 120,
  successTitle: 80,
  successSubtitle: 200,
  numberLabel: 40,
  note: 300,
  redirects: 10,
  redirectWords: 60,
} as const;

export function defaultChamadosConfig(): ChamadosConfig {
  return {
    sectors: {
      TI: {
        label: 'Tecnologia da Informação',
        short: 'TI',
        team: 'equipe de TI',
        help: 'Computador, sistemas, impressora, internet, e-mail, senhas e acessos.',
        icon: 'monitor',
        imageId: null,
        color: 'ceu',
        tips: ['Descreva o que você estava fazendo quando o problema aconteceu.', 'Se possível, anexe um print da tela.'],
        titleExample: 'Impressora do posto 2 não imprime',
        descriptionPlaceholder: 'Conte com detalhes: o que aconteceu, desde quando, se aparece alguma mensagem de erro…',
        acompanha: ['INFRAESTRUTURA'],
        acompanhaQuem: 'equipe',
      },
      INFRAESTRUTURA: {
        label: 'Infraestrutura de TI',
        short: 'Infraestrutura',
        team: 'equipe de Infraestrutura de TI',
        help: 'Pontos de rede e cabeamento, telefonia (ramais e linhas) e sistemas de CFTV (câmeras de segurança).',
        icon: 'server',
        imageId: null,
        color: 'turquesa',
        tips: ['Informe o setor e, se souber, o número do ponto de rede, do ramal ou da câmera.', 'Diga se o problema é em um ponto só ou no setor todo.'],
        titleExample: 'Sem internet nos computadores do 2º andar',
        descriptionPlaceholder: 'Conte com detalhes: o que parou, desde quando, quantos computadores ou setores foram afetados…',
        acompanha: ['MANUTENCAO'],
        acompanhaQuem: 'gestor',
      },
      MANUTENCAO: {
        label: 'Manutenção',
        short: 'Manutenção',
        team: 'equipe de Manutenção',
        help: 'Elétrica, hidráulica, ar-condicionado, portas, mobiliário e equipamentos.',
        icon: 'wrench',
        imageId: null,
        color: 'ambar',
        tips: [
          'Informe o local exato: andar, ala, sala ou leito.',
          'Se houver risco (fio exposto, vazamento, cheiro de queimado), isole a área e marque a prioridade Crítica.',
          'Se possível, anexe uma foto do problema.',
        ],
        titleExample: 'Ar-condicionado da sala 3 não liga',
        descriptionPlaceholder: 'Conte com detalhes: o que está com defeito, desde quando, se há risco para pacientes ou colaboradores…',
        acompanha: ['INFRAESTRUTURA'],
        acompanhaQuem: 'equipe',
      },
      COMUNICACAO: {
        label: 'Comunicação',
        short: 'Comunicação',
        team: 'equipe de Comunicação',
        help: 'Artes, divulgação, publicações, eventos e comunicados.',
        icon: 'megaphone',
        imageId: null,
        color: 'fucsia',
        tips: [
          'Informe a data em que o material precisa estar pronto ou publicado.',
          'Anexe os textos, logotipos e fotos que devem ser usados.',
          'Diga onde será divulgado: site, murais, redes sociais, e-mail…',
        ],
        titleExample: 'Arte para a campanha de vacinação',
        descriptionPlaceholder: 'Conte com detalhes: o que precisa ser feito, para quem é, prazo e onde será divulgado…',
        acompanha: [],
        acompanhaQuem: 'gestor',
      },
    },
    priorities: {
      BAIXA: { label: 'Baixa', help: 'Dúvida, melhoria ou algo que não atrapalha o trabalho agora.' },
      MEDIA: { label: 'Média', help: 'Atrapalha o trabalho, mas existe uma alternativa por enquanto.' },
      ALTA: { label: 'Alta', help: 'Impede o trabalho de uma pessoa ou de um setor.' },
      CRITICA: { label: 'Crítica', help: 'Afeta o atendimento a pacientes ou vários setores ao mesmo tempo.' },
    },
    keywordTips: [
      { id: 'senha', sectors: ['TI'], words: ['senha', 'acesso'], tips: ['Informe o usuário/login afetado (nunca envie sua senha).', 'Diga em qual sistema o acesso falha.'] },
      { id: 'impressora', sectors: ['TI'], words: ['impressora'], tips: ['Informe o nome ou a etiqueta da impressora.', 'Diga se aparece alguma mensagem no visor.'] },
      { id: 'sistema', sectors: ['TI'], words: ['sistema', 'orbis'], tips: ['Diga em qual tela ou módulo ocorre o erro.', 'Anexe um print da mensagem de erro.'] },
      { id: 'rede', sectors: ['TI', 'INFRAESTRUTURA'], words: ['rede', 'internet'], tips: ['Diga se o problema é só no seu computador ou no setor todo.', 'Informe se é rede cabeada ou Wi-Fi.'] },
    ],
    noSectorTip: 'Escolha a equipe que cuida do assunto: TI, Infraestrutura de TI, Manutenção ou Comunicação.',
    alwaysTip: 'Um chamado por problema facilita o acompanhamento.',
    rules: {
      slaFactor: { CRITICA: 0.25, ALTA: 0.5, MEDIA: 1, BAIXA: 2 },
      defaultSlaHours: 24,
      whatsappSector: 'TI',
      emailSector: 'TI',
      whatsappWindowDays: 30,
      whatsappAskSector: true,
      whatsappAskCategory: true,
      whatsappSectors: [...SECTOR_LIST],
      redirects: [
        {
          id: 'ti-infra',
          from: 'TI',
          to: 'INFRAESTRUTURA',
          // "ramal" e "telefone" sozinhos ficam de fora: as pessoas escrevem o ramal para contato em quase todo chamado
          words: [
            'ponto de rede',
            'cabo de rede',
            'cabeamento',
            'tomada de rede',
            'ramal mudo',
            'ramal nao',
            'ramal sem',
            'ramal com defeito',
            'telefonia',
            'linha telefonica',
            'aparelho telefonico',
            'camera de seguranca',
            'cameras de seguranca',
            'cftv',
            'dvr',
            'nvr',
          ],
        },
      ],
    },
    channels: {
      title: 'Outras formas de falar com a TI',
      text: 'Sem acesso ao computador? Fale com a TI por aqui — o chamado de TI é criado automaticamente.',
      mailSubject: 'Chamado de TI',
    },
    success: {
      title: 'Chamado aberto com sucesso!',
      subtitle: 'A {equipe} já foi avisada.',
      numberLabel: 'Número do chamado',
      note: 'Guarde este número. Você receberá as atualizações por e-mail e pode acompanhar tudo por aqui.',
    },
  };
}

// ───────── leitura tolerante e validação estrita ─────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * Lê e valida. Com `errors`, cada problema vira uma mensagem em português (modo estrito, usado ao salvar);
 * sem `errors`, o que estiver malformado é trocado pelo padrão (modo tolerante, usado na leitura).
 */
export function parseChamadosConfig(raw: unknown, errors?: string[]): ChamadosConfig {
  const def = defaultChamadosConfig();
  const err = (m: string) => errors?.push(m);
  const r = isObj(raw) ? raw : {};
  if (errors && !isObj(raw)) err('Dados inválidos.');

  const text = (v: unknown, fallback: string, max: number, name: string, required = true): string => {
    if (v === undefined) {
      if (errors) err(`${name}: campo ausente.`);
      return fallback;
    }
    if (typeof v !== 'string') {
      err(`${name}: deve ser um texto.`);
      return fallback;
    }
    const t = v.trim();
    if (required && !t) {
      err(`${name}: preencha este campo.`);
      return fallback;
    }
    if (t.length > max) {
      err(`${name}: use no máximo ${max} caracteres.`);
      return errors ? t : t.slice(0, max);
    }
    return t;
  };

  const list = (v: unknown, fallback: string[], maxItems: number, maxLen: number, name: string): string[] => {
    if (!Array.isArray(v)) {
      err(`${name}: lista inválida.`);
      return fallback;
    }
    if (v.some((x) => typeof x !== 'string')) err(`${name}: há itens que não são texto.`);
    const items = v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
    if (items.length > maxItems) err(`${name}: use no máximo ${maxItems} itens.`);
    const long = items.find((x) => x.length > maxLen);
    if (long) err(`${name}: cada item pode ter no máximo ${maxLen} caracteres.`);
    return items.slice(0, maxItems).map((x) => x.slice(0, maxLen));
  };

  const num = (v: unknown, fallback: number, min: number, max: number, name: string, integer = false): number => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
      err(`${name}: informe ${integer ? 'um número inteiro' : 'um número'} de ${String(min).replace('.', ',')} a ${String(max).replace('.', ',')}.`);
      return fallback;
    }
    return n;
  };

  const sector = (v: unknown, fallback: TicketSector, name: string): TicketSector => {
    if (typeof v === 'string' && (SECTOR_LIST as string[]).includes(v)) return v as TicketSector;
    err(`${name}: setor inválido.`);
    return fallback;
  };

  // equipes acompanhadas: ausente = padrão; nunca a própria equipe
  const acompanha = (v: unknown, self: TicketSector, fallback: TicketSector[], p: string): TicketSector[] => {
    if (v === undefined) return fallback;
    if (!Array.isArray(v)) return (err(`${p} › equipes acompanhadas: lista inválida.`), fallback);
    if (v.some((x) => typeof x !== 'string' || !(SECTOR_LIST as string[]).includes(x))) err(`${p} › equipes acompanhadas: setor inválido.`);
    return SECTOR_LIST.filter((x) => x !== self && v.includes(x));
  };

  // setores
  const rs = isObj(r.sectors) ? r.sectors : {};
  if (errors && !isObj(r.sectors)) err('Setores: dados inválidos.');
  const sectors = {} as Record<TicketSector, SectorConfig>;
  for (const s of SECTOR_LIST) {
    const d = def.sectors[s];
    const x = isObj(rs[s]) ? rs[s] : {};
    if (errors && !isObj(rs[s])) err(`Setor ${d.label}: dados ausentes.`);
    const p = `Setor ${typeof x.label === 'string' && x.label.trim() ? x.label.trim() : d.label}`;
    const icon = typeof x.icon === 'string' && (ICON_NAMES as readonly string[]).includes(x.icon) ? x.icon : (err(`${p}: ícone inválido.`), d.icon);
    const color = typeof x.color === 'string' && (SECTOR_COLORS as readonly string[]).includes(x.color) ? x.color : (err(`${p}: cor inválida.`), d.color);
    let imageId: string | null = null;
    if (typeof x.imageId === 'string' && x.imageId) {
      if (UUID.test(x.imageId)) imageId = x.imageId;
      else err(`${p}: imagem do ícone inválida.`);
    }
    sectors[s] = {
      label: text(x.label, d.label, LIMITS.label, `${p} › nome`),
      short: text(x.short, d.short, LIMITS.short, `${p} › nome curto`),
      team: text(x.team, d.team, LIMITS.team, `${p} › "equipe de…"`),
      help: text(x.help, d.help, LIMITS.help, `${p} › descrição de ajuda`),
      icon,
      imageId,
      color,
      tips: x.tips === undefined && !errors ? d.tips : list(x.tips, d.tips, LIMITS.tips, LIMITS.tip, `${p} › dicas`),
      titleExample: text(x.titleExample, d.titleExample, LIMITS.titleExample, `${p} › exemplo de título`, false),
      descriptionPlaceholder: text(x.descriptionPlaceholder, d.descriptionPlaceholder, LIMITS.placeholder, `${p} › texto de exemplo da descrição`, false),
      acompanha: acompanha(x.acompanha, s, d.acompanha, p),
      acompanhaQuem:
        x.acompanhaQuem === undefined ? d.acompanhaQuem : (ACOMPANHA_QUEM as unknown[]).includes(x.acompanhaQuem) ? (x.acompanhaQuem as AcompanhaQuem) : (err(`${p} › quem acompanha: opção inválida.`), d.acompanhaQuem),
    };
  }

  // prioridades
  const rp = isObj(r.priorities) ? r.priorities : {};
  if (errors && !isObj(r.priorities)) err('Prioridades: dados inválidos.');
  const priorities = {} as Record<TicketPriority, PriorityConfig>;
  for (const k of PRIORITY_LIST) {
    const d = def.priorities[k];
    const x = isObj(rp[k]) ? rp[k] : {};
    priorities[k] = {
      label: text(x.label, d.label, LIMITS.priorityLabel, `Prioridade ${d.label} › rótulo`),
      help: text(x.help, d.help, LIMITS.help, `Prioridade ${d.label} › explicação`),
    };
  }

  // dicas por palavra-chave
  let keywordTips = def.keywordTips;
  if (Array.isArray(r.keywordTips)) {
    if (r.keywordTips.length > LIMITS.keywordTips) err(`Dicas por palavra-chave: use no máximo ${LIMITS.keywordTips} regras.`);
    keywordTips = r.keywordTips.slice(0, LIMITS.keywordTips).flatMap((k, i) => {
      const p = `Dica por palavra-chave ${i + 1}`;
      if (!isObj(k)) {
        err(`${p}: dados inválidos.`);
        return [];
      }
      const words = list(k.words, [], LIMITS.words, LIMITS.word, `${p} › palavras`).map((w) => w.toLowerCase());
      const tips = list(k.tips, [], LIMITS.tips, LIMITS.tip, `${p} › dicas`);
      const secs = Array.isArray(k.sectors) ? k.sectors.filter((s): s is TicketSector => typeof s === 'string' && (SECTOR_LIST as string[]).includes(s)) : [];
      if (Array.isArray(k.sectors) && secs.length !== k.sectors.length) err(`${p}: setor inválido.`);
      if (!words.length) err(`${p}: informe pelo menos uma palavra.`);
      if (!tips.length) err(`${p}: informe pelo menos uma dica.`);
      if (!words.length || !tips.length) return [];
      return [{ id: typeof k.id === 'string' && ID.test(k.id) ? k.id : `regra-${i + 1}`, sectors: [...new Set(secs)], words, tips }];
    });
  } else if (r.keywordTips !== undefined || errors) err('Dicas por palavra-chave: lista inválida.');

  // regras
  const rr = isObj(r.rules) ? r.rules : {};
  if (errors && !isObj(r.rules)) err('Regras: dados inválidos.');
  const rf = isObj(rr.slaFactor) ? rr.slaFactor : {};
  const slaFactor = {} as Record<TicketPriority, number>;
  for (const k of PRIORITY_LIST) slaFactor[k] = num(rf[k], def.rules.slaFactor[k], 0.05, 10, `Multiplicador do SLA (${def.priorities[k].label})`);

  return {
    sectors,
    priorities,
    keywordTips,
    noSectorTip: text(r.noSectorTip, def.noSectorTip, LIMITS.tip, 'Dica antes de escolher a equipe', false),
    alwaysTip: text(r.alwaysTip, def.alwaysTip, LIMITS.tip, 'Dica que aparece sempre', false),
    rules: {
      slaFactor,
      defaultSlaHours: num(rr.defaultSlaHours, def.rules.defaultSlaHours, 1, 720, 'SLA padrão sem categoria (horas)', true),
      whatsappSector: sector(rr.whatsappSector, def.rules.whatsappSector, 'Setor dos chamados vindos do WhatsApp'),
      emailSector: sector(rr.emailSector, def.rules.emailSector, 'Setor dos chamados vindos do e-mail'),
      whatsappWindowDays: num(rr.whatsappWindowDays, def.rules.whatsappWindowDays, 0, 365, 'Janela de continuação do WhatsApp (dias)', true),
      // campos novos (4.38.0): ausentes numa configuração salva antes valem o padrão, sem erro
      whatsappAskSector: rr.whatsappAskSector === undefined ? def.rules.whatsappAskSector : rr.whatsappAskSector === true,
      whatsappAskCategory: rr.whatsappAskCategory === undefined ? def.rules.whatsappAskCategory : rr.whatsappAskCategory === true,
      whatsappSectors: (() => {
        if (rr.whatsappSectors === undefined) return def.rules.whatsappSectors;
        if (!Array.isArray(rr.whatsappSectors)) return (err('Áreas do menu do WhatsApp: lista inválida.'), def.rules.whatsappSectors);
        if (rr.whatsappSectors.some((x) => typeof x !== 'string' || !(SECTOR_LIST as string[]).includes(x))) err('Áreas do menu do WhatsApp: setor inválido.');
        const v = [...new Set(rr.whatsappSectors.filter((x): x is TicketSector => (SECTOR_LIST as unknown[]).includes(x)))];
        if (rr.whatsappAskSector === true && !v.length) err('Áreas do menu do WhatsApp: marque pelo menos uma área.');
        return v.length ? v : def.rules.whatsappSectors;
      })(),
      redirects: (() => {
        if (rr.redirects === undefined) return def.rules.redirects;
        if (!Array.isArray(rr.redirects)) return (err('Encaminhamento automático: lista inválida.'), def.rules.redirects);
        if (rr.redirects.length > LIMITS.redirects) err(`Encaminhamento automático: use no máximo ${LIMITS.redirects} regras.`);
        return rr.redirects.slice(0, LIMITS.redirects).flatMap((x, i) => {
          const p = `Encaminhamento automático ${i + 1}`;
          if (!isObj(x)) return (err(`${p}: dados inválidos.`), []);
          const from = sector(x.from, 'TI', `${p} › de`);
          const to = sector(x.to, 'INFRAESTRUTURA', `${p} › para`);
          if (from === to) err(`${p}: escolha equipes diferentes.`);
          const words = list(x.words, [], LIMITS.redirectWords, LIMITS.word, `${p} › palavras`).map(normalizar);
          if (!words.length) err(`${p}: informe pelo menos uma palavra.`);
          if (from === to || !words.length) return [];
          return [{ id: typeof x.id === 'string' && ID.test(x.id) ? x.id : `regra-${i + 1}`, from, to, words: [...new Set(words)] }];
        });
      })(),
    },
    channels: (() => {
      const c = isObj(r.channels) ? r.channels : {};
      return {
        title: text(c.title, def.channels.title, LIMITS.channelTitle, 'Canais › título'),
        text: text(c.text, def.channels.text, LIMITS.channelText, 'Canais › texto', false),
        mailSubject: text(c.mailSubject, def.channels.mailSubject, LIMITS.mailSubject, 'Canais › assunto do e-mail', false),
      };
    })(),
    success: (() => {
      const c = isObj(r.success) ? r.success : {};
      return {
        title: text(c.title, def.success.title, LIMITS.successTitle, 'Chamado aberto › título'),
        subtitle: text(c.subtitle, def.success.subtitle, LIMITS.successSubtitle, 'Chamado aberto › subtítulo', false),
        numberLabel: text(c.numberLabel, def.success.numberLabel, LIMITS.numberLabel, 'Chamado aberto › rótulo do número'),
        note: text(c.note, def.success.note, LIMITS.note, 'Chamado aberto › orientação', false),
      };
    })(),
  };
}

/** Ícone e dicas das categorias (tolerante). */
export function parseCategoryExtras(raw: unknown): Record<string, CategoryExtra> {
  if (!isObj(raw)) return {};
  const out: Record<string, CategoryExtra> = {};
  for (const [id, v] of Object.entries(raw)) {
    if (!UUID.test(id) || !isObj(v)) continue;
    out[id] = {
      icon: typeof v.icon === 'string' && (ICON_NAMES as readonly string[]).includes(v.icon) ? v.icon : null,
      imageId: typeof v.imageId === 'string' && UUID.test(v.imageId) ? v.imageId : null,
      tips: Array.isArray(v.tips) ? v.tips.filter((t): t is string => typeof t === 'string' && !!t.trim()).slice(0, LIMITS.tips).map((t) => t.trim().slice(0, LIMITS.tip)) : [],
    };
  }
  return out;
}

/** Valida o ícone e as dicas enviados no cadastro de uma categoria. Devolve null quando não há nada a guardar. */
export function checkCategoryExtra(icon: unknown, imageId: unknown, tips: unknown, errors: string[]): CategoryExtra | null {
  const out: CategoryExtra = { icon: null, imageId: null, tips: [] };
  if (icon !== undefined && icon !== null && icon !== '') {
    if (typeof icon === 'string' && (ICON_NAMES as readonly string[]).includes(icon)) out.icon = icon;
    else errors.push('Ícone inválido.');
  }
  if (imageId !== undefined && imageId !== null && imageId !== '') {
    if (typeof imageId === 'string' && UUID.test(imageId)) out.imageId = imageId;
    else errors.push('Imagem do ícone inválida.');
  }
  if (tips !== undefined && tips !== null) {
    if (!Array.isArray(tips) || tips.some((t) => typeof t !== 'string')) errors.push('Dicas: lista inválida.');
    else {
      const t = tips.map((x: string) => x.trim()).filter(Boolean);
      if (t.length > LIMITS.tips) errors.push(`Dicas: use no máximo ${LIMITS.tips}.`);
      if (t.some((x) => x.length > LIMITS.tip)) errors.push(`Dicas: cada uma pode ter no máximo ${LIMITS.tip} caracteres.`);
      out.tips = t.slice(0, LIMITS.tips);
    }
  }
  return out.icon || out.imageId || out.tips.length ? out : null;
}

// ───────── cache para os cálculos do servidor ─────────

let cache: { at: number; value: ChamadosConfig } | null = null;
const TTL = 30_000;

/**
 * Encaminhamento automático: devolve a equipe final do chamado e a palavra que causou a troca.
 * Compara sem acento e sem diferenciar maiúsculas, só palavras inteiras ("dvr" não casa dentro de outra palavra).
 * Só a primeira regra que casar vale (não encadeia).
 */
export function encaminhar(rules: Pick<ChamadosRules, 'redirects'>, sector: TicketSector, texto: string): { sector: TicketSector; palavra?: string } {
  const t = ` ${normalizar(texto).replace(/[^a-z0-9]+/g, ' ')} `;
  for (const r of rules.redirects) {
    if (r.from !== sector) continue;
    const palavra = r.words.find((w) => {
      const n = normalizar(w).replace(/[^a-z0-9]+/g, ' ').trim();
      return n && t.includes(` ${n} `);
    });
    if (palavra) return { sector: r.to, palavra };
  }
  return { sector };
}

/** Configuração atual (com cache curto; o painel limpa o cache ao salvar). */
export async function loadChamadosConfig(prisma: PrismaService): Promise<ChamadosConfig> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const row = await prisma.setting.findUnique({ where: { key: CHAMADOS_KEY } });
  const value = parseChamadosConfig(row?.value);
  cache = { at: Date.now(), value };
  return value;
}

/** Regras de SLA e canais usadas no servidor (multiplicador, SLA padrão, setor padrão, janela do WhatsApp). */
export async function chamadosRules(prisma: PrismaService): Promise<ChamadosRules> {
  return (await loadChamadosConfig(prisma)).rules;
}

/** Nomes dos setores configurados (para mensagens do servidor que citam a equipe). */
export async function sectorTexts(prisma: PrismaService): Promise<Record<TicketSector, Pick<SectorConfig, 'label' | 'short' | 'team'>>> {
  return (await loadChamadosConfig(prisma)).sectors;
}

/**
 * Equipes que a pessoa acompanha só para leitura (configuradas em Categorias e SLA › Setores),
 * sem as que ela já atende. Cada equipe diz quem acompanha: a equipe toda ou só quem tem a
 * permissão "Gestor da área" no perfil. ADMIN atende todas, então não acompanha nenhuma.
 */
export async function acompanhadas(prisma: PrismaService, u?: { roles: Role[] | string[] } | null): Promise<TicketSector[]> {
  if (!u) return [];
  const mine = staffSectors(u);
  if (!mine.length) return [];
  const gestor = (u.roles as string[]).includes('GESTOR_AREA');
  const { sectors } = await loadChamadosConfig(prisma);
  const out = new Set<TicketSector>();
  for (const s of mine) {
    if (!gestor && sectors[s].acompanhaQuem !== 'equipe') continue;
    for (const o of sectors[s].acompanha) if (!mine.includes(o)) out.add(o);
  }
  return SECTOR_LIST.filter((s) => out.has(s));
}

export function clearChamadosCache() {
  cache = null;
}
