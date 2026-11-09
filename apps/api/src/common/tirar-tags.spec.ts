import { tirarTags } from './sanitize';

describe('tirarTags (auditoria COD-01)', () => {
  const casos = ['', 'texto', '<b>oi</b>', 'a<b', 'a>b<c>d', '<<x>img>', '<>', 'a<>b<', '<p>x</p><', 'x<y<z>w>', '<\n>', '<<<<>'];
  it('faz o mesmo que /<[^>]*>/g', () => {
    for (const c of casos) expect(tirarTags(c)).toBe(c.replace(/<[^>]*>/g, ''));
  });
  it('faz o mesmo que /<[^>]+>/g com troca por espaço', () => {
    for (const c of casos) expect(tirarTags(c, ' ', false)).toBe(c.replace(/<[^>]+>/g, ' '));
  });
  it('confere aleatoriamente com a expressão', () => {
    const al = 'ab<> \n';
    for (let n = 0; n < 3000; n++) {
      let s = '';
      for (let i = 0; i < 1 + (n % 25); i++) s += al[Math.floor(Math.random() * al.length)];
      expect(tirarTags(s)).toBe(s.replace(/<[^>]*>/g, ''));
      expect(tirarTags(s, ' ', false)).toBe(s.replace(/<[^>]+>/g, ' '));
    }
  });
  it('2 MB de "<" não travam (antes levava minutos)', () => {
    const grande = '<'.repeat(2_000_000);
    const t = Date.now();
    expect(tirarTags(grande)).toBe(grande);
    expect(tirarTags('<a'.repeat(1_000_000) + '>')).toBe('');
    expect(Date.now() - t).toBeLessThan(500);
  });
});
