/**
 * Erros de preenchimento com o campo exato: a API devolve `campos` nos erros de validação e o pop-up global
 * (components/erros/popup-erros.tsx) aponta, destaca e foca cada campo. O aviso pequeno (toast) com o mesmo
 * texto é suprimido para não repetir a mensagem.
 */

export interface CampoErro {
  campo: string;
  mensagens: string[];
}

export const EVENTO_ERRO_CAMPOS = 'nr:erro-campos';

let ultimo: { texto: string; em: number } | null = null;

/** Chamado pelos clientes da API quando o servidor recusa o preenchimento. */
export function avisarErroCampos(campos: CampoErro[], texto: string) {
  if (typeof window === 'undefined' || !campos.length) return;
  ultimo = { texto, em: Date.now() };
  window.dispatchEvent(new CustomEvent(EVENTO_ERRO_CAMPOS, { detail: { campos } }));
}

/** O pop-up já mostrou esta mensagem há instantes: o toast de erro com o mesmo texto não aparece. */
export function jaMostradoNoPopup(texto: string) {
  return !!ultimo && ultimo.texto === texto && Date.now() - ultimo.em < 3000;
}

/** Corpo de erro da API → lista de campos (quando houver). */
export function camposDoErro(body: unknown): CampoErro[] {
  const c = (body as { campos?: unknown })?.campos;
  return Array.isArray(c) ? c.filter((x): x is CampoErro => !!x && typeof x.campo === 'string' && Array.isArray(x.mensagens)) : [];
}

// ───────── dicas inteligentes para usuário, e-mail e senha ─────────

const DOMINIOS_COMUNS = ['gmail.com', 'hotmail.com', 'outlook.com', 'outlook.com.br', 'yahoo.com.br', 'yahoo.com', 'icloud.com', 'live.com', 'bol.com.br', 'uol.com.br'];

/** Distância de edição (quantas letras trocadas, faltando ou sobrando). */
function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Sugere o domínio certo quando o digitado está a poucas letras de um conhecido (ex.: hospitadeacidentados). */
export function sugerirDominio(email: string): string | null {
  const [antes, dominio] = email.trim().toLowerCase().split('@');
  if (!antes || !dominio) return null;
  let melhor: { d: string; n: number } | null = null;
  for (const d of DOMINIOS_COMUNS) {
    if (d === dominio) return null;
    const n = distancia(dominio, d);
    if (n <= Math.max(2, Math.floor(d.length / 6)) && (!melhor || n < melhor.n)) melhor = { d, n };
  }
  return melhor ? `${antes}@${melhor.d}` : null;
}

/** Problemas visíveis no que foi digitado no campo de usuário ou e-mail (sem consultar o servidor). */
export function dicasDoLogin(login: string): string[] {
  const dicas: string[] = [];
  const v = login;
  if (!v.trim()) return ['O usuário ou e-mail está vazio.'];
  if (/\s/.test(v.trim())) dicas.push('Há espaço no meio do usuário. Usuários não têm espaço (ex.: maria.silva).');
  if (v !== v.trim()) dicas.push('Há espaço no começo ou no fim do usuário.');
  if (v.includes('@')) {
    if (!emailValido(v)) dicas.push('O e-mail parece incompleto. Confira o que vem depois do @ (ex.: maria@suaempresa.com.br).');
    const s = sugerirDominio(v);
    if (s) dicas.push(`O endereço depois do @ parece ter erro de digitação. Você quis dizer ${s}?`);
  } else if (/[,;]/.test(v)) dicas.push('O usuário tem vírgula ou ponto e vírgula. O separador certo é o ponto (ex.: maria.silva).');
  return dicas;
}

export function dicasDaSenha(senha: string, caps: boolean): string[] {
  const dicas: string[] = [];
  if (!senha) return ['A senha está vazia.'];
  if (caps) dicas.push('O Caps Lock está ativado. A senha diferencia letras maiúsculas e minúsculas.');
  if (senha !== senha.trim()) dicas.push('A senha tem espaço no começo ou no fim. Confira se não copiou um espaço junto.');
  return dicas;
}
