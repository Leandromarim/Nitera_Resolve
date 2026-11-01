/** Tela "Intranet em manutenção" servida pelo Caddy durante a atualização (deploy/Caddyfile, snippet manutencao). */

let recarregando = false;

/** Recarrega a página uma vez só (várias chamadas podem ver a manutenção ao mesmo tempo): o Caddy entrega a tela. */
export function entrarEmManutencao() {
  if (recarregando || typeof window === 'undefined') return;
  recarregando = true;
  window.location.reload();
}

/** A resposta veio da tela de manutenção? Então leva quem já estava na intranet para a tela. */
export function emManutencao(r: Response) {
  if (r.headers.get('x-resolve-manutencao') !== '1') return false;
  entrarEmManutencao();
  return true;
}
