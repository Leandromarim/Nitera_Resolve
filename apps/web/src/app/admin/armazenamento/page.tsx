'use client';

import { CopyX, Database, FileWarning, Gauge, HardDrive, History, Layers, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { Badge, Button, Card, EmptyState, Field, Input, Loading, PageHeader, StatCard, Switch, Table, clsx, useConfirm, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { ACOES, CATEGORIAS, ConfigArmazenamento, LogItem, OptStatus, Resumo, STATUS, fmtBytes, pct } from '@/lib/armazenamento';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { useApi } from '@/lib/use-api';

// gráficos sob demanda: o recharts só é baixado quando esta tela abre
const Graficos = dynamic(() => import('@/components/admin/armazenamento-graficos'), { ssr: false, loading: () => <Card className="h-72 animate-pulse" /> });

const ORDEM_STATUS: OptStatus[] = ['OTIMIZADO', 'MANTIDO', 'PROTEGIDO', 'IGNORADO', 'PENDENTE', 'ERRO', 'NAO_ANALISADO'];

function Barra({ usado, total }: { usado: number; total: number }) {
  const p = total ? Math.min(1, usado / total) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={clsx('h-full rounded-full', p > 0.9 ? 'bg-rose-600' : p > 0.75 ? 'bg-amber-500' : 'bg-brand-600')} style={{ width: `${p * 100}%` }} />
    </div>
  );
}

function Configuracao({ config, podeEditar, onSalvo }: { config: ConfigArmazenamento; podeEditar: boolean; onSalvo: () => void }) {
  const toast = useToast();
  const [c, setC] = useState(config);
  const [busy, setBusy] = useState(false);
  useEffect(() => setC(config), [config]);
  const mudou = JSON.stringify(c) !== JSON.stringify(config);
  const salvar = async () => {
    setBusy(true);
    try {
      await api('/admin/armazenamento/config', { method: 'PUT', json: c });
      toast('Configuração salva', 'success');
      onSalvo();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-5 p-5">
      <div>
        <h3 className="font-semibold">Política de otimização e retenção</h3>
        <p className="text-sm text-slate-500">Documentos da gestão de documentos, anexos de formulários e chamados, e PDFs assinados nunca são alterados.</p>
      </div>
      <div className="space-y-1">
        <Switch checked={c.pdfSemPerdas} onChange={(v) => podeEditar && setC({ ...c, pdfSemPerdas: v })} label="Reduzir sem perdas os PDFs públicos do portal" />
        <p className="pl-14 text-xs text-slate-500">Reorganiza a estrutura interna do PDF (sem mexer em imagens, textos ou fontes). Só troca o arquivo se as páginas, o texto e o visual ficarem idênticos.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guardar o PDF original por (dias)" hint="0 = guardar para sempre">
          <Input placeholder="Ex.: 90" type="number" min={0} max={3650} value={c.manterOriginalDias} disabled={!podeEditar} onChange={(e) => setC({ ...c, manterOriginalDias: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
        <Field label="Apagar páginas convertidas sem acesso há (dias)" hint="Visualização protegida de documentos; são refeitas quando alguém abrir. 0 = nunca">
          <Input placeholder="Ex.: 30" type="number" min={0} max={3650} value={c.cachePaginasDias} disabled={!podeEditar} onChange={(e) => setC({ ...c, cachePaginasDias: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
      </div>
      {podeEditar && (
        <div className="flex justify-end">
          <Button onClick={salvar} loading={busy} disabled={!mudou}>
            Salvar política
          </Button>
        </div>
      )}
    </Card>
  );
}

function Historico() {
  const [filtro, setFiltro] = useState<'' | 'erros'>('');
  const [take, setTake] = useState(25);
  const { data, loading } = useApi<LogItem[]>(`/admin/armazenamento/historico?take=${take}${filtro ? `&status=${filtro}` : ''}`);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <h3 className="flex items-center gap-2 font-semibold">
          <History className="size-4" /> Histórico de processamento
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant={filtro === '' ? 'primary' : 'secondary'} onClick={() => setFiltro('')}>
            Tudo
          </Button>
          <Button size="sm" variant={filtro === 'erros' ? 'primary' : 'secondary'} onClick={() => setFiltro('erros')}>
            Só falhas
          </Button>
        </div>
      </div>
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <EmptyState icon={<History />} title="Nada por aqui" description="Os envios e o trabalho da fila aparecem nesta lista." />
      ) : (
        <Table head={['Quando', 'Arquivo', 'Etapa', 'Antes', 'Depois', 'Detalhe']}>
          {data.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800/60">
              <td className="px-4 py-2.5 whitespace-nowrap text-slate-500" title={fmtDateTime(l.createdAt)}>
                {fmtRelative(l.createdAt)}
              </td>
              <td className="max-w-56 truncate px-4 py-2.5" title={l.file.originalName}>
                {l.file.originalName}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <Badge className={l.ok ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'}>{ACOES[l.action] ?? l.action}</Badge>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{l.bytesBefore != null ? fmtBytes(l.bytesBefore) : '—'}</td>
              <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{l.bytesAfter != null ? fmtBytes(l.bytesAfter) : '—'}</td>
              <td className="px-4 py-2.5 text-slate-500">{l.detail}</td>
            </tr>
          ))}
        </Table>
      )}
      {data && data.length >= take && take < 500 && (
        <div className="border-t border-slate-200 p-3 text-center dark:border-slate-800">
          <Button size="sm" variant="ghost" onClick={() => setTake((t) => Math.min(500, t * 4))} loading={loading}>
            Mostrar mais
          </Button>
        </div>
      )}
    </Card>
  );
}

function Painel() {
  const { hasRole } = useAuth();
  const admin = hasRole('ADMIN');
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [atualizar, setAtualizar] = useState(0);
  const { data, loading, error, reload } = useApi<Resumo>(`/admin/armazenamento${atualizar ? '?atualizar=1' : ''}`);
  const [busy, setBusy] = useState<string | null>(null);

  // enquanto houver fila, atualiza sozinho
  const pendentes = (data?.status.PENDENTE ?? 0) + (data?.status.NAO_ANALISADO ?? 0);
  useEffect(() => {
    if (!pendentes) return;
    const t = setTimeout(() => setAtualizar((n) => n + 1), 10_000);
    return () => clearTimeout(t);
  }, [pendentes, data]);

  const acao = async (chave: string, url: string, pergunta: string, sucesso: (r: any) => string) => {
    if (!(await confirm(pergunta))) return;
    setBusy(chave);
    try {
      const r = await api(url, { method: 'POST' });
      toast(sucesso(r), 'success');
      setAtualizar((n) => n + 1);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) return <Loading />;
  if (!data) return <Card className="p-5 text-sm text-slate-500">Não foi possível carregar: {error}</Card>;

  const t = data.totais;
  const economia = t.economiaOtimizacao + t.economiaDuplicados;
  const usadoDisco = data.disco ? data.disco.total - data.disco.livre : 0;
  const caches = data.uploads.pastas;
  const pdfsAntigos = data.pdfsGrandes.filter((p) => p.public && !p.origin).length;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<HardDrive className="size-5" />}
        title="Armazenamento e otimização"
        description="Espaço usado pelos arquivos do sistema, o que a compressão economizou e o trabalho da fila em segundo plano."
        actions={
          <Button variant="secondary" onClick={() => (setAtualizar((n) => n + 1), reload())} loading={loading}>
            <RefreshCw className="size-4" /> Atualizar
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Arquivos guardados" value={t.arquivos.toLocaleString('pt-BR')} hint={`${fmtBytes(t.guardado)} em disco`} icon={<Database className="size-5" />} tone="brand" />
        <StatCard label="Tamanho enviado" value={fmtBytes(t.recebido)} hint="Soma dos arquivos como chegaram" icon={<Layers className="size-5" />} tone="violet" />
        <StatCard label="Espaço economizado" value={fmtBytes(economia)} hint={`${fmtBytes(t.economiaOtimizacao)} na compressão · ${fmtBytes(t.economiaDuplicados)} em duplicados`} icon={<Sparkles className="size-5" />} tone="emerald" />
        <StatCard label="Redução" value={pct(t.reducao)} hint="Em relação ao tamanho enviado" icon={<Gauge className="size-5" />} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-5 lg:col-span-1">
          <h3 className="font-semibold">Disco do servidor</h3>
          {data.disco ? (
            <>
              <Barra usado={usadoDisco} total={data.disco.total} />
              <p className="text-sm">
                <strong>{fmtBytes(usadoDisco)}</strong> usados de {fmtBytes(data.disco.total)} · <span className="text-slate-500">{fmtBytes(data.disco.livre)} livres</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Não foi possível ler o disco.</p>
          )}
          <ul className="space-y-1.5 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
            <li className="flex justify-between gap-2">
              <span>Arquivos enviados</span>
              <span className="tabular-nums">{fmtBytes(data.uploads.bytes)}</span>
            </li>
            <li className="flex justify-between gap-2" title="Fotos reduzidas e miniaturas; podem ser refeitas a qualquer momento">
              <span>Cópias reduzidas e miniaturas</span>
              <span className="tabular-nums">{fmtBytes(caches.variantes.bytes)}</span>
            </li>
            <li className="flex justify-between gap-2" title="Páginas da visualização protegida de documentos">
              <span>Páginas convertidas (documentos)</span>
              <span className="tabular-nums">{fmtBytes(caches['.doc-cache'].bytes)}</span>
            </li>
            <li className="flex justify-between gap-2" title="PDFs originais guardados depois da otimização">
              <span>PDFs originais guardados</span>
              <span className="tabular-nums">{fmtBytes(caches.originais.bytes)}</span>
            </li>
          </ul>
          {data.ultimaLimpeza && (
            <p className="text-xs text-slate-500">
              Última limpeza {fmtRelative(data.ultimaLimpeza.em)}: {data.ultimaLimpeza.temporarios} temporários, {data.ultimaLimpeza.paginas} páginas e {data.ultimaLimpeza.originais} originais ({fmtBytes(data.ultimaLimpeza.bytes)}).
            </p>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Situação dos arquivos</h3>
            {pendentes > 0 && <span className="text-xs text-amber-700 dark:text-amber-300">Fila trabalhando: {pendentes} arquivo(s). A tela atualiza sozinha.</span>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ORDEM_STATUS.filter((s) => data.status[s] || s === 'OTIMIZADO' || s === 'ERRO' || s === 'PENDENTE').map((s) => (
              <div key={s} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', STATUS[s].cls)}>{STATUS[s].nome}</span>
                  <span className="text-lg font-bold tabular-nums">{(data.status[s] ?? 0).toLocaleString('pt-BR')}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{STATUS[s].descricao}</p>
              </div>
            ))}
          </div>
          {!data.ferramentas.qpdf && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              O qpdf não está instalado no servidor: os PDFs ficam como vieram. A imagem Docker da versão 4.8.0 já traz o qpdf.
            </p>
          )}
        </Card>
      </div>

      <Graficos dados={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col p-5">
          <CopyX className="size-6 text-brand-600" />
          <h3 className="mt-2 font-semibold">Arquivos duplicados</h3>
          <p className="mt-1 flex-1 text-sm text-slate-500">
            {data.duplicados.bytesLiberaveis > 0
              ? `${data.duplicados.arquivos} arquivos idênticos em ${data.duplicados.grupos} grupos. Unificar libera ${fmtBytes(data.duplicados.bytesLiberaveis)} sem mudar o conteúdo nem as permissões de cada um.`
              : data.duplicados.grupos
                ? `${data.duplicados.arquivos} arquivos idênticos já dividem o mesmo espaço em disco.`
                : 'Nenhum arquivo duplicado encontrado.'}
          </p>
          {admin && data.duplicados.bytesLiberaveis > 0 && (
            <Button
              className="mt-4 self-start"
              loading={busy === 'dup'}
              onClick={() =>
                acao('dup', '/admin/armazenamento/duplicados/unificar', 'Unificar os arquivos duplicados? Cada arquivo continua com o mesmo conteúdo, endereço e permissão; só o espaço em disco passa a ser dividido.', (r) => `${r.unificados} arquivos unificados (${fmtBytes(r.liberados)} liberados)`)
              }
            >
              Unificar duplicados
            </Button>
          )}
        </Card>
        <Card className="flex flex-col p-5">
          <ShieldCheck className="size-6 text-brand-600" />
          <h3 className="mt-2 font-semibold">PDFs públicos antigos</h3>
          <p className="mt-1 flex-1 text-sm text-slate-500">
            Os PDFs enviados antes desta versão não foram alterados. Você pode colocar os PDFs <strong>públicos</strong> do portal na fila de redução sem perdas; o original fica guardado pelo prazo da política.
          </p>
          {admin && (
            <Button
              className="mt-4 h-auto! min-h-10 max-w-full self-start py-2 text-center whitespace-normal!"
              variant="secondary"
              loading={busy === 'pdf'}
              disabled={!data.config.pdfSemPerdas || !data.ferramentas.qpdf}
              onClick={() =>
                acao('pdf', '/admin/armazenamento/pdfs-antigos/otimizar', 'Colocar os PDFs públicos antigos na fila de redução sem perdas? PDFs assinados, da gestão de documentos ou privados ficam de fora.', (r) => `${r.agendados} PDFs na fila`)
              }
            >
              Otimizar PDFs antigos{pdfsAntigos ? ` (${pdfsAntigos})` : ''}
            </Button>
          )}
        </Card>
        <Card className="flex flex-col p-5">
          <Trash2 className="size-6 text-brand-600" />
          <h3 className="mt-2 font-semibold">Limpeza de temporários</h3>
          <p className="mt-1 flex-1 text-sm text-slate-500">Roda sozinha todo dia às 3h30. Apaga só cópias temporárias, páginas convertidas sem acesso e originais de PDF fora do prazo. Nunca apaga documentos, versões ou arquivos em uso.</p>
          {admin && (
            <Button className="mt-4 self-start" variant="secondary" loading={busy === 'limpeza'} onClick={() => acao('limpeza', '/admin/armazenamento/limpeza', 'Rodar a limpeza agora?', (r) => `Limpeza feita: ${fmtBytes(r.bytes)} liberados`)}>
              Limpar agora
            </Button>
          )}
        </Card>
      </div>

      {data.pdfsGrandes.length > 0 && (
        <Card>
          <h3 className="flex items-center gap-2 border-b border-slate-200 p-4 font-semibold dark:border-slate-800">
            <FileWarning className="size-4" /> PDFs grandes (acima de 10 MB)
          </h3>
          <Table head={['Arquivo', 'Tamanho', 'Acesso', 'Situação', admin ? '' : null].filter((h) => h !== null)}>
            {data.pdfsGrandes.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                <td className="max-w-72 truncate px-4 py-2.5" title={p.originalName}>
                  {p.originalName}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                  {fmtBytes(p.size)}
                  {p.originalSize && p.originalSize > p.size ? <span className="text-xs text-emerald-700 dark:text-emerald-300"> (era {fmtBytes(p.originalSize)})</span> : null}
                </td>
                <td className="px-4 py-2.5">{p.public ? 'Público' : 'Privado'}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.optNote ?? (p.optStatus ? STATUS[p.optStatus].nome : '—')}</td>
                {admin && (
                  <td className="px-4 py-2.5 text-right">
                    {p.optStatus === 'OTIMIZADO' && (
                      <Button size="sm" variant="ghost" loading={busy === p.id} onClick={() => acao(p.id, `/admin/armazenamento/arquivos/${p.id}/restaurar-original`, 'Voltar este PDF para o arquivo original enviado?', () => 'Original restaurado')}>
                        <RotateCcw className="size-4" /> Restaurar original
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {data.erros.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-semibold text-rose-700 dark:text-rose-300">Arquivos com erro ({data.erros.length})</h3>
            {admin && (
              <Button size="sm" variant="secondary" loading={busy === 'erros'} onClick={() => acao('erros', '/admin/armazenamento/erros/reprocessar', 'Tentar processar de novo os arquivos com erro?', (r) => `${r.agendados} arquivos de volta à fila`)}>
                Tentar de novo
              </Button>
            )}
          </div>
          <Table head={['Arquivo', 'Tipo', 'Erro', 'Quando']}>
            {data.erros.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                <td className="max-w-72 truncate px-4 py-2.5">{e.originalName}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{e.mimeType}</td>
                <td className="px-4 py-2.5">{e.optNote}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{e.optAt ? fmtRelative(e.optAt) : '—'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Configuracao config={data.config} podeEditar={admin} onSalvo={() => setAtualizar((n) => n + 1)} />

      <Historico />

      <p className="text-xs text-slate-500">
        Categorias: {Object.values(CATEGORIAS).map((c) => c.nome).join(', ')}. Números atualizados {fmtRelative(data.geradoEm)}. Cada ação desta tela fica registrada na auditoria.
      </p>
      {dialog}
    </div>
  );
}

export default function ArmazenamentoPage() {
  return (
    <RequireAuth roles={['ADMIN', 'TI']}>
      <Painel />
    </RequireAuth>
  );
}
