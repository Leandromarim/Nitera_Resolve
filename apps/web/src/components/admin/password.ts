/** Mesma regra da API: 6+ caracteres com maiúscula, minúscula, número e símbolo. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,128}$/;

/** Senha provisória simples (mesma regra da API: SENHA_PROVISORIA_MIN / SENHA_PROVISORIA_DIAS). */
export const SENHA_SIMPLES_MIN = 4;
export const SENHA_SIMPLES_DIAS = 7;

export function passwordChecks(p: string) {
  return [
    { ok: p.length >= 6, label: '6 ou mais caracteres' },
    { ok: /[A-Z]/.test(p), label: 'Letra maiúscula' },
    { ok: /[a-z]/.test(p), label: 'Letra minúscula' },
    { ok: /\d/.test(p), label: 'Número' },
    { ok: /[^A-Za-z0-9]/.test(p), label: 'Símbolo' },
  ];
}

/** Gera senha forte com crypto.getRandomValues (sem caracteres ambíguos como l, 1, O, 0). */
export function generatePassword(length = 14) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?-_+='];
  const all = sets.join('');
  const rnd = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]! % n;
  };
  const chars = sets.map((s) => s[rnd(s.length)]!);
  while (chars.length < length) chars.push(all[rnd(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
