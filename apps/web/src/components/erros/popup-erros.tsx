'use client';

import { AlertCircle, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { CampoErro, EVENTO_ERRO_CAMPOS } from '@/lib/erros-campos';

type Controle = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
interface Item {
  rotulo: string;
  motivo: string;
  el: Controle | null;
}

/** Nomes usados nos dados (em inglês ou juntos) → palavras que aparecem no rótulo do campo na tela. */
const SINONIMOS: Record<string, string[]> = {
  title: ['titulo'],
  titulo: ['titulo'],
  description: ['descricao'],
  name: ['nome'],
  nome: ['nome'],
  email: ['e-mail', 'email'],
  phone: ['celular', 'telefone'],
  username: ['usuario'],
  usuario: ['usuario'],
  password: ['senha'],
  senha: ['senha'],
  sector: ['setor'],
  category: ['categoria'],
  priority: ['prioridade'],
  extension: ['ramal'],
  location: ['local'],
  reason: ['motivo'],
  url: ['link', 'endereco'],
  content: ['conteudo', 'texto'],
  summary: ['resumo'],
  start: ['inicio'],
  end: ['fim', 'termino'],
  date: ['data'],
  job: ['cargo', 'funcao'],
  room: ['sala'],
  hora: ['hora'],
  data: ['data'],
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** "pacienteNome" → ["paciente", "nome"]; "startAt" → ["start"] (Id/At do fim saem). */
function palavras(campo: string) {
  const ultimo = campo.split('.').filter((p) => !/^\d+$/.test(p)).pop() ?? campo;
  return ultimo
    .replace(/(Id|Ids|At|Em)$/, '')
    .split(/(?=[A-Z])|_/)
    .map((w) => norm(w))
    .filter((w) => w.length > 1);
}

/** Texto do rótulo do controle: o título do Field, aria-label, <label for> ou o exemplo do campo. */
function rotuloDe(el: Controle): string {
  const lab = el.closest('label');
  const titulo = lab?.querySelector(':scope > span')?.childNodes[0]?.textContent?.trim();
  if (titulo) return titulo;
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label')!;
  if (el.id) {
    const f = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
    if (f?.textContent?.trim()) return f.textContent.trim();
  }
  const leg = el.closest('fieldset')?.querySelector('legend')?.textContent?.trim();
  if (leg) return leg;
  if (lab?.textContent?.trim()) return lab.textContent.trim().slice(0, 80);
  return ((el as HTMLInputElement).placeholder || el.name || 'Campo').replace(/^Ex\.:\s*/, '');
}

/** Onde procurar o campo: o pop-up (diálogo) aberto por cima, senão a página toda. */
function escopo(): ParentNode {
  const dialogos = [...document.querySelectorAll('[role="dialog"]')].filter((d) => !d.querySelector('[data-popup-erros]'));
  return dialogos.at(-1) ?? document;
}

function visivel(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
}

/** Acha o controle da tela que corresponde ao campo do servidor: pelo name/id, senão pelas palavras do rótulo. */
function acharControle(campo: string): Controle | null {
  const raiz = escopo();
  const ultimo = campo.split('.').pop()!;
  for (const sel of [`[name="${campo}"]`, `[data-campo="${campo}"]`, `[name="${ultimo}"]`, `[data-campo="${ultimo}"]`]) {
    const el = raiz.querySelector<Controle>(sel);
    if (el && visivel(el)) return el;
  }
  const ws = palavras(campo);
  if (!ws.length) return null;
  const controles = [...raiz.querySelectorAll<Controle>('input:not([type=hidden]):not([type=file]), select, textarea')].filter(visivel);
  const casa = (rot: string) => ws.every((w) => (SINONIMOS[w] ?? [w]).some((s) => rot.includes(s)));
  return controles.find((el) => casa(norm(rotuloDe(el)))) ?? null;
}

/** Quando não acha o campo na tela, mostra o nome dele de um jeito legível. */
function nomeLegivel(campo: string) {
  const ws = palavras(campo).map((w) => SINONIMOS[w]?.[0] ?? w);
  const t = ws.join(' ') || campo;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Motivo de um campo inválido segundo o navegador, em português. */
function motivoNativo(el: Controle): string {
  const v = el.validity;
  const i = el as HTMLInputElement;
  if (v.valueMissing) return el instanceof HTMLSelectElement ? 'escolha uma opção' : el.type === 'checkbox' ? 'marque esta opção' : 'preencha este campo';
  if (v.typeMismatch) return i.type === 'email' ? 'e-mail em formato inválido (ex.: maria@suaempresa.com.br)' : i.type === 'url' ? 'endereço (link) inválido, comece com https://' : 'formato inválido';
  if (v.tooShort) return `mínimo de ${i.minLength} caracteres (agora tem ${i.value.length})`;
  if (v.tooLong) return `máximo de ${i.maxLength} caracteres`;
  if (v.rangeUnderflow) return i.type.startsWith('date') ? `a data não pode ser antes de ${fmt(i.min)}` : `o mínimo é ${i.min}`;
  if (v.rangeOverflow) return i.type.startsWith('date') ? `a data não pode ser depois de ${fmt(i.max)}` : `o máximo é ${i.max}`;
  if (v.patternMismatch) return i.title || 'formato inválido';
  if (v.stepMismatch) return 'valor fora do intervalo permitido';
  if (v.badInput) return 'valor inválido';
  return el.validationMessage || 'valor inválido';
}
function fmt(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}` : ''}` : v;
}

/** Destaca o campo em vermelho até a pessoa mexer nele. */
function marcar(el: Controle) {
  el.setAttribute('aria-invalid', 'true');
  el.classList.add('campo-com-erro');
  const limpar = () => {
    el.removeAttribute('aria-invalid');
    el.classList.remove('campo-com-erro');
    el.removeEventListener('input', limpar);
    el.removeEventListener('change', limpar);
  };
  el.addEventListener('input', limpar);
  el.addEventListener('change', limpar);
}

function focar(el: Controle | null) {
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => el.focus({ preventScroll: true }), 250);
}

/**
 * Pop-up global de erros de preenchimento, na intranet e no Qualis:
 * - quando o servidor recusa (erro 400 com `campos`), lista cada campo com o motivo;
 * - quando o navegador barra o envio (campo obrigatório, e-mail, tamanho, data), faz o mesmo.
 * Cada campo com problema fica com borda vermelha até ser corrigido; clicar no item leva ao campo.
 */
export function PopupErros() {
  const [itens, setItens] = useState<Item[] | null>(null);
  const pendente = useRef<Set<Controle> | null>(null);

  const mostrar = useCallback((lista: Item[]) => {
    if (!lista.length) return;
    lista.forEach((i) => i.el && marcar(i.el));
    setItens(lista);
  }, []);

  useEffect(() => {
    const doServidor = (e: Event) => {
      const campos = (e as CustomEvent<{ campos: CampoErro[] }>).detail.campos;
      mostrar(
        campos.map((c) => {
          const el = acharControle(c.campo);
          return { el, rotulo: el ? rotuloDe(el) : nomeLegivel(c.campo), motivo: c.mensagens.join('; ') };
        }),
      );
    };
    // o evento "invalid" vem um por campo: junta os do mesmo envio e mostra uma vez
    const doNavegador = (e: Event) => {
      const el = e.target as Controle;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return;
      e.preventDefault();
      if (!pendente.current) {
        pendente.current = new Set();
        setTimeout(() => {
          const lista = [...(pendente.current ?? [])];
          pendente.current = null;
          mostrar(lista.map((c) => ({ el: c, rotulo: rotuloDe(c), motivo: motivoNativo(c) })));
        }, 0);
      }
      pendente.current.add(el);
    };
    window.addEventListener(EVENTO_ERRO_CAMPOS, doServidor);
    document.addEventListener('invalid', doNavegador, true);
    return () => {
      window.removeEventListener(EVENTO_ERRO_CAMPOS, doServidor);
      document.removeEventListener('invalid', doNavegador, true);
    };
  }, [mostrar]);

  const fechar = (el?: Controle | null) => {
    const primeiro = el ?? itens?.find((i) => i.el)?.el ?? null;
    setItens(null);
    focar(primeiro);
  };

  return (
    <Modal
      open={!!itens}
      onClose={() => fechar()}
      size="sm"
      title={itens && itens.length > 1 ? `Confira ${itens.length} campos` : 'Confira este campo'}
      footer={<Button onClick={() => fechar()}>Corrigir</Button>}
    >
      <div data-popup-erros className="space-y-2">
        {itens?.map((i, n) => (
          <button
            key={n}
            type="button"
            onClick={() => fechar(i.el)}
            disabled={!i.el}
            className="flex w-full items-start gap-3 rounded-xl bg-rose-50 p-3 text-left text-sm transition enabled:hover:bg-rose-100 dark:bg-rose-950/40 dark:enabled:hover:bg-rose-950/70"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="min-w-0 flex-1">
              <b className="block break-words text-slate-900 dark:text-slate-100">{i.rotulo}</b>
              <span className="break-words text-rose-800 dark:text-rose-200">{i.motivo.charAt(0).toUpperCase() + i.motivo.slice(1)}</span>
            </span>
            {i.el && <ArrowRight className="mt-0.5 size-4 shrink-0 text-rose-400" aria-label="Ir para o campo" />}
          </button>
        ))}
      </div>
    </Modal>
  );
}
