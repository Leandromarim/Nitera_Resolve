import sanitize from 'sanitize-html';

/**
 * Sanitização de HTML por lista branca.
 * Mantém só tags e atributos seguros usados pelo editor de páginas.
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'img',
  'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'iframe',
]);
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'], // rel é sempre trocado pelo sanitizador
  img: ['src', 'alt', 'width', 'height'],
  iframe: ['src', 'width', 'height', 'allowfullscreen'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};
// caminho relativo começa com uma barra só: "//" e "/\\" levam a outro site
const SAFE_URL = /^(https?:|mailto:|tel:|\/(?![/\\])|#)/i;
const IFRAME_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//i;

/**
 * O HTML passa por um analisador de verdade (sanitize-html/htmlparser2), não por expressões regulares:
 * texto vira texto escapado e só sobra o que está na lista branca.
 */
export function sanitizeHtml(html: string): string {
  return sanitize(html, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'title', 'template', 'xmp', 'noembed', 'noframes'],
    exclusiveFilter: (frame) => (frame.tag === 'iframe' && !IFRAME_HOSTS.test((frame.attribs.src ?? '').trim())) || false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...semUrlInsegura(attribs, 'href'), rel: 'noopener noreferrer' } }),
      img: (tagName, attribs) => ({ tagName, attribs: semUrlInsegura(attribs, 'src') }),
      iframe: (tagName, attribs) => ({ tagName, attribs: semUrlInsegura(attribs, 'src') }),
    },
  });
}

/** Endereço relativo só com uma barra; nada de "javascript:", "data:" nem "/\\outro-site". */
function semUrlInsegura(attribs: sanitize.Attributes, nome: string): sanitize.Attributes {
  const v = attribs[nome];
  if (v === undefined || SAFE_URL.test(v.trim())) return attribs;
  const { [nome]: _fora, ...resto } = attribs;
  return resto;
}

/**
 * Tira as marcações `<...>` de um texto em tempo linear. Faz o mesmo que `v.replace(/<[^>]*>/g, troca)`
 * (ou `/<[^>]+>/g` com `vazia = false`), mas sem a lentidão quadrática dessa expressão com muitos `<`
 * sem `>`: 100 mil caracteres levavam quase 7 s e travavam a API (auditoria COD-01, CWE-1333).
 */
export function tirarTags(v: string, troca = '', vazia = true): string {
  let out = '';
  let i = 0;
  for (;;) {
    const abre = v.indexOf('<', i);
    if (abre < 0) break;
    const fecha = v.indexOf('>', abre + 1);
    // sem nenhum '>' depois daqui, nenhuma marcação adiante pode fechar: o resto fica como está
    if (fecha < 0) break;
    if (!vazia && fecha === abre + 1) {
      out += v.slice(i, abre + 1);
      i = abre + 1;
      continue;
    }
    out += v.slice(i, abre) + troca;
    i = fecha + 1;
  }
  return out + v.slice(i);
}

/** Remove qualquer marcação — usado em textos simples (chamados). */
export const stripTags = (v: string) => tirarTags(v).trim();
