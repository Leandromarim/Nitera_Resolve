import { sanitizeHtml, stripTags } from './sanitize';

describe('sanitizeHtml', () => {
  it('remove scripts, estilos e manipuladores de evento', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">Oi</p><script>alert(1)</script><style>*{}</style><img src="x" onerror="alert(1)">');
    expect(out).not.toMatch(/script|onclick|onerror|style/i);
    expect(out).toContain('<p>Oi</p>');
  });

  it('bloqueia links javascript: e data:', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a rel="noopener noreferrer">x</a>');
    expect(sanitizeHtml('<img src="data:text/html;base64,AAAA">')).toBe('<img />');
  });

  it('mantém links seguros e adiciona rel', () => {
    expect(sanitizeHtml('<a href="https://hospital.com.br" target="_blank">x</a>')).toBe('<a href="https://hospital.com.br" target="_blank" rel="noopener noreferrer">x</a>');
  });

  it('só aceita iframes do YouTube/Vimeo', () => {
    expect(sanitizeHtml('<iframe src="https://evil.com"></iframe>')).not.toContain('evil');
    expect(sanitizeHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>')).toContain('youtube.com/embed/abc');
  });

  it('não se deixa enganar por tags quebradas ou aninhadas (auditoria 30/10/2026, A-01)', () => {
    const ataques = [
      '<<x>img src=x onerror=alert(1)>',
      '<scr<script>ipt>alert(1)</script>',
      '<a href="java&#x09;script:alert(1)">x</a>',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
      '<!--><img src=x onerror=alert(1)>-->',
      '<svg><script>alert(1)</script></svg>',
    ];
    for (const a of ataques) {
      const out = sanitizeHtml(a);
      // o que sobra como texto escapado (&lt;...&gt;) não executa; tag de verdade com evento, nunca
      expect(out.replace(/&lt;[\s\S]*?&gt;/g, '')).not.toMatch(/on\w+\s*=|javascript:|<script|<svg|<style/i);
    }
  });

  it('não aceita link relativo que leva a outro site', () => {
    expect(sanitizeHtml('<a href="/\\evil.com">x</a>')).not.toContain('evil');
    expect(sanitizeHtml('<a href="//evil.com">x</a>')).not.toContain('evil');
    expect(sanitizeHtml('<a href="/p/politica">x</a>')).toContain('href="/p/politica"');
  });

  it('remove tags desconhecidas mantendo o texto', () => {
    expect(sanitizeHtml('<marquee>texto</marquee>')).toBe('texto');
  });
});

describe('stripTags', () => {
  it('remove toda a marcação', () => {
    expect(stripTags(' <b>Olá</b> <i>mundo</i> ')).toBe('Olá mundo');
  });
});
