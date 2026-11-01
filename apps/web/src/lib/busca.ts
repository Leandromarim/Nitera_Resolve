/**
 * Busca de texto da intranet (lupas das páginas e busca geral do topo). Mesma regra da API (apps/api/src/common/busca-texto.ts):
 * - sem acento e sem diferença de maiúsculas;
 * - termos curtos (até 3 letras, como "TI", "DP", "UTI") só valem no começo de uma palavra, para "TI" não achar "Estatística";
 * - siglas do hospital valem pelos nomes por extenso e vice-versa ("TI" acha "Tecnologia da Informação", "pessoal" acha "DP").
 */
export const SIGLAS: [string, string][] = [
  ['ti', 'tecnologia da informacao'],
  ['dp', 'departamento pessoal'],
  ['rh', 'recursos humanos'],
  ['uti', 'unidade de terapia intensiva'],
  ['ps', 'pronto socorro'],
  ['cc', 'centro cirurgico'],
  ['cme', 'central de material e esterilizacao'],
  ['ccih', 'controle de infeccao hospitalar'],
  ['scih', 'controle de infeccao hospitalar'],
  ['snd', 'nutricao e dietetica'],
  ['sesmt', 'seguranca do trabalho'],
  ['same', 'arquivo medico'],
  ['nsp', 'nucleo de seguranca do paciente'],
  ['sac', 'atendimento ao cliente'],
];

export const normBusca = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** "ti" no começo de uma palavra (TI, Tisiologia), não no meio (Estatística). */
const inicioDePalavra = (texto: string, termo: string) => new RegExp(`(^|[^a-z0-9])${escape(termo)}`).test(texto);
const palavraInteira = (texto: string, termo: string) => new RegExp(`(^|[^a-z0-9])${escape(termo)}([^a-z0-9]|$)`).test(texto);

function contem(texto: string, termo: string) {
  return termo.length <= 3 ? inicioDePalavra(texto, termo) : texto.includes(termo);
}

/** O termo e o que ele quer dizer: a sigla por extenso, ou a sigla de um nome por extenso. */
export function sentidos(termo: string): { termo: string; sigla: boolean }[] {
  const t = normBusca(termo);
  const out: { termo: string; sigla: boolean }[] = [{ termo: t, sigla: false }];
  for (const [sigla, extenso] of SIGLAS) {
    if (t === sigla) out.push({ termo: extenso, sigla: false });
    else if ((t.length >= 3 && extenso.startsWith(t)) || (t.length >= 4 && extenso.split(' ').some((p) => p.length >= 4 && p.startsWith(t)))) out.push({ termo: sigla, sigla: true });
  }
  return out;
}

/** O texto combina com o que a pessoa digitou? Várias palavras: todas precisam aparecer. */
export function combina(texto: string | null | undefined | (string | null | undefined)[], consulta: string): boolean {
  const q = normBusca(consulta);
  if (!q) return true;
  const bruto = normBusca(Array.isArray(texto) ? texto.filter(Boolean).join(' · ') : (texto ?? ''));
  // "D.P.T Pessoal" também como "DPT Pessoal"
  const alvo = bruto.includes('.') ? `${bruto} · ${bruto.replace(/\./g, '')}` : bruto;
  const um = (termo: string) => sentidos(termo).some((s) => (s.sigla ? palavraInteira(alvo, s.termo) : contem(alvo, s.termo)));
  if (um(q)) return true;
  const partes = q.split(' ').filter((p) => p.length > 1 || /\d/.test(p));
  return partes.length > 1 && partes.every(um);
}
