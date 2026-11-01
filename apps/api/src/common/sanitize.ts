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

/** Remove qualquer marcação — usado em textos simples (chat, chamados, ouvidoria). */
export const stripTags = (v: string) => v.replace(/<[^>]*>/g, '').trim();
