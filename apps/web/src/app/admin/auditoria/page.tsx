'use client';

import { ChevronRight, History, RefreshCw, Search } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { RequireAuth } from '@/components/require-auth';
import { Avatar, Badge, Button, Card, EmptyState, Input, Loading, PageHeader, Select, clsx } from '@/components/ui';
import { AuditEntry } from '@/components/admin/types';

const ENTITIES: Record<string, string> = {
  User: 'Usuário',
  AccessProfile: 'Perfil',
  UserCategory: 'Categoria de usuário',
  OrgGroup: 'Grupo',
  Department: 'Setor',
  Setting: 'Configurações',
  TicketCategory: 'Categoria de chamado',
  Release: 'Versão',
  ReleaseItem: 'Item da versão',
  PainelTV: 'Painel da TV',
  FileAsset: 'Arquivo',
  Armazenamento: 'Armazenamento',
  Relatorio: 'Relatório',
  Revision: 'Revisão',
};

const ACTIONS: Record<string, { label: string; cls: string }> = {
  criar: { label: 'Criou', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  editar: { label: 'Editou', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  excluir: { label: 'Excluiu', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
  desativar: { label: 'Desativou', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  reordenar: { label: 'Reordenou', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  login: { label: 'Entrou', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  'login.falhou': { label: 'Falha de login', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' },
  'senha.alterada': { label: 'Trocou a senha', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  '2fa.ativado': { label: 'Ativou 2FA', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  '2fa.desativado': { label: 'Desativou 2FA', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  '2fa.redefinido': { label: 'Redefiniu 2FA', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  'sessao.reuso_detectado': { label: 'Reuso de sessão', cls: 'bg-red-600 text-white' },
  tratar: { label: 'Tratou', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  exportar: { label: 'Exportou', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  restaurar_revisao: { label: 'Restaurou revisão', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
};
const actionOf = (a: string) => ACTIONS[a] ?? { label: a, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };

function AuditAdmin() {
  const [entity, setEntity] = useState('');
  const [take, setTake] = useState(200);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const qs = new URLSearchParams({ take: String(take), ...(entity ? { entity } : {}) });
  const { data, loading, error, reload } = useApi<AuditEntry[]>(`/admin/audit?${qs}`);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data ?? [];
    return (data ?? []).filter((e) =>
      [e.user?.name ?? 'sistema', e.action, actionOf(e.action).label, e.entity, ENTITIES[e.entity] ?? '', e.entityId ?? '', e.ip ?? '', e.data ? JSON.stringify(e.data) : ''].some((f) => f.toLowerCase().includes(t)),
    );
  }, [data, q]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader
        icon={<History className="size-5" />}
        title="Auditoria"
        description="Registro de quem fez o quê, quando e de onde. Os registros não podem ser alterados."
        actions={
          <Button variant="secondary" onClick={reload} loading={loading && !!data}>
            <RefreshCw className="size-4" /> Atualizar
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por pessoa, ação, IP ou conteúdo…" className="pl-9" aria-label="Filtrar registros" />
          </div>
          <Select value={entity} onChange={(e) => (setEntity(e.target.value), setOpen(new Set()))} className="sm:w-60" aria-label="Filtrar por entidade">
            <option value="">Todas as entidades</option>
            {Object.entries(ENTITIES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {loading && !data ? (
          <Loading />
        ) : error ? (
          <EmptyState title="Não foi possível carregar a auditoria" description={error} action={<Button onClick={reload}>Tentar novamente</Button>} />
        ) : list.length === 0 ? (
          <EmptyState icon={<History className="size-7" />} title="Nenhum registro" description={q || entity ? 'Nada encontrado com esses filtros.' : 'Ainda não há ações registradas.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase dark:border-slate-800">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-3 py-3 font-semibold">Quem</th>
                  <th className="px-3 py-3 font-semibold">Ação</th>
                  <th className="px-3 py-3 font-semibold">Entidade</th>
                  <th className="px-3 py-3 font-semibold">Data</th>
                  <th className="px-3 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.map((e) => {
                  const a = actionOf(e.action);
                  const hasData = e.data != null && !(typeof e.data === 'object' && Object.keys(e.data as object).length === 0);
                  const isOpen = open.has(e.id);
                  return (
                    <Fragment key={e.id}>
                      <tr className={clsx('hover:bg-slate-50 dark:hover:bg-slate-800/40', hasData && 'cursor-pointer')} onClick={() => hasData && toggle(e.id)}>
                        <td className="px-2 py-2.5 text-center">
                          {hasData && (
                            <button
                              onClick={(ev) => (ev.stopPropagation(), toggle(e.id))}
                              aria-expanded={isOpen}
                              aria-label={isOpen ? 'Ocultar detalhes' : 'Ver detalhes'}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
                            >
                              <ChevronRight className={clsx('size-4 transition', isOpen && 'rotate-90')} />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <Avatar name={e.user?.name ?? '?'} size={26} />
                            {e.user?.name ?? <span className="text-slate-400 italic">Sistema / anônimo</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={a.cls}>{a.label}</Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="block whitespace-nowrap">{ENTITIES[e.entity] ?? e.entity}</span>
                          {e.entityId && <span className="block max-w-[160px] truncate font-mono text-[11px] text-slate-400" title={e.entityId}>{e.entityId}</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap" title={fmtDateTime(e.createdAt)}>
                          <span className="block">{fmtDateTime(e.createdAt)}</span>
                          <span className="block text-xs text-slate-400">{fmtRelative(e.createdAt)}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-slate-500">{e.ip ?? '—'}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50 dark:bg-slate-950/50">
                          <td />
                          <td colSpan={5} className="px-3 pb-3">
                            <pre className="max-h-80 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-emerald-200 dark:bg-black/60">{JSON.stringify(e.data, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row dark:border-slate-800">
            <span>
              Mostrando {list.length} de {data.length} registro(s) carregados{data.length >= take ? ` (os ${take} mais recentes)` : ''}.
            </span>
            {data.length >= take && take < 1000 && (
              <Button variant="secondary" size="sm" onClick={() => setTake(Math.min(take + 300, 1000))} loading={loading}>
                Carregar mais
              </Button>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

export default function Page() {
  return (
    <RequireAuth roles={['ADMIN']}>
      <AuditAdmin />
    </RequireAuth>
  );
}
