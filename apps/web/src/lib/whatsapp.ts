/**
 * Número no formato que o WhatsApp entende (DDI + DDD + número, só dígitos).
 * Sem o 55 (10 ou 11 dígitos: DDD + número), completa com o do Brasil; sem isso,
 * "62 99999-0000" vira +62, que é o código da Indonésia.
 */
export function numeroWhatsapp(v: string | null | undefined): string {
  const d = (v ?? '').replace(/\D/g, '');
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

/** Link wa.me para o número (vazio quando não há número). */
export const linkWhatsapp = (v: string | null | undefined) => {
  const n = numeroWhatsapp(v);
  return n ? `https://wa.me/${n}` : '';
};
