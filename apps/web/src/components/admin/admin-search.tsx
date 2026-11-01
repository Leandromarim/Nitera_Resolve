'use client';

import { LayoutGrid, Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Paleta, normBusca, useAtalhoBusca, type PaletaGroup, type PaletaHit } from '@/components/ui/paleta';
import type { NavGroup } from './shell';

/** Busca do painel: telas e ações rápidas. */
/** Palavras que também levam a cada tela (o que a pessoa costuma procurar com outro nome). */
const KEYWORDS: Record<string, string> = {
  '/admin/versoes': 'historico restaurar backup voltar',
  '/admin/novidades': 'versao changelog o que ha de novo',
  '/chamados': 'suporte atendimento ti manutencao fila',
  '/chamados/relatorios': 'relatorio chamados sla graficos',
  '/admin/chamados-config': 'categorias sla prioridade prazos',
  '/admin/painel-tv': 'tv monitor fila chave',
  '/admin/usuarios': 'pessoas login senha perfil acesso setores departamentos',
  '/admin/configuracoes': 'logo cores aparencia whatsapp email smtp seguranca',
  '/admin/mensagens': 'whatsapp email modelos automaticas',
  '/admin/auditoria': 'log registro quem alterou',
  '/admin/armazenamento': 'arquivos espaco disco anexos fotos otimizar',
  '/chamados/novo': 'abrir chamado novo pedido problema',
};

const ICONES = { 'Telas do painel': <LayoutGrid className="size-4" /> };

export function AdminSearch({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  useAtalhoBusca(useCallback(() => setOpen(true), []));

  // telas do painel: filtra na hora pelo nome, grupo e palavras-chave
  const locais = useCallback(
    (termos: string[]): PaletaGroup | null => {
      const items: PaletaHit[] = [];
      for (const g of groups) {
        for (const it of g.items) {
          const text = normBusca(`${it.label} ${g.title} ${it.hint ?? ''} ${KEYWORDS[it.href] ?? ''}`);
          if (termos.every((t) => text.includes(t))) items.push({ title: it.label, subtitle: g.title, href: it.href });
        }
      }
      return items.length ? { group: 'Telas do painel', items: items.slice(0, 8) } : null;
    },
    [groups],
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white xl:w-64 xl:px-3 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Buscar no painel"
        aria-keyshortcuts="Control+K"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left xl:inline">Buscar no painel…</span>
        <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-400 xl:inline dark:border-slate-600 dark:bg-slate-900">Ctrl K</kbd>
      </button>
      {open && (
        <Paleta
          label="Buscar no painel"
          placeholder="Buscar telas e ações… Ex.: usuários, relatórios, tema escuro"
          vazio="Digite o nome de uma tela ou de uma ação, como tema escuro. Para achar um chamado, use a busca da lista de chamados."
          locais={locais}
          icones={ICONES}
          storageKey="nr-painel-busca"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
