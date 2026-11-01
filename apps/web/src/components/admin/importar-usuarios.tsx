'use client';

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { AccessProfile, UserCategory } from '@/components/admin/types';
import { Button, Field, Modal, Select, Table, clsx, useToast } from '@/components/ui';
import { api } from '@/lib/api';

interface Pronto {
  linha: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketEmail: string | null;
  semEmail: boolean;
  perfil: string;
  categoria: string;
  validUntil: string | null;
  active: boolean;
  avisos: string[];
}

interface Resultado {
  arquivo: string;
  colunasIgnoradas: string[];
  prontos: Pronto[];
  ignorados: { linha: number; usuario: string; motivo: string }[];
  criados: number;
}

const erro = 'ring-2! ring-rose-500!';

/** Importa usuários do CSV do GLPI ("Todas páginas em CSV") ou da exportação da intranet: prévia primeiro, depois confirma. */
export function ImportarUsuarios({ profiles, categories, onClose, onDone }: { profiles: AccessProfile[]; categories: UserCategory[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const semAdmin = profiles.filter((p) => !p.roles.includes('ADMIN'));
  const [file, setFile] = useState<File | null>(null);
  const [profileId, setProfileId] = useState(semAdmin.find((p) => p.isDefault)?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previa, setPrevia] = useState<Resultado | null>(null);
  const [feito, setFeito] = useState<Resultado | null>(null);

  const enviar = async (confirmar: boolean) => {
    setTried(true);
    if (!file || !profileId || !categoryId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('categoryId', categoryId);
      fd.append('profileId', profileId);
      fd.append('file', file);
      const r = await api<Resultado>(`/admin/users/importar${confirmar ? '?confirmar=1' : ''}`, { method: 'POST', body: fd });
      if (confirmar) {
        setFeito(r);
        toast(`${r.criados} usuário(s) importado(s)`);
        onDone();
      } else setPrevia(r);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const r = feito ?? previa;
  return (
    <Modal
      open
      onClose={onClose}
      title="Importar usuários"
      size="xl"
      footer={
        feito ? (
          <Button onClick={onClose}>Fechar</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {previa ? (
              <Button onClick={() => enviar(true)} loading={busy} disabled={!previa.prontos.length}>
                <Upload className="size-4" /> Importar {previa.prontos.length} usuário(s)
              </Button>
            ) : (
              <Button onClick={() => enviar(false)} loading={busy}>
                Ver prévia
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-5">
        {!r && (
          <>
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              <p>
                No GLPI, abra <b>Administração › Usuários</b>, mostre todos os itens e escolha <b>Todas páginas em CSV</b>. Também serve o arquivo do botão <b>Exportar</b> daqui.
              </p>
              <p className="mt-1.5">
                Só os campos obrigatórios são lidos: usuário, nome, sobrenome (Último nome), e-mail, categoria, perfil, válido até e ativo. As outras colunas são ignoradas. Senhas não vêm do GLPI: cada pessoa cria a sua pelo <b>Esqueci minha senha</b>, ou o administrador define uma.
              </p>
            </div>
            <Field required label="Arquivo .csv" error={tried && !file ? 'Escolha o arquivo exportado do GLPI.' : undefined} hint="Até 2 MB e 5.000 usuários.">
              <div className={clsx('flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700', tried && !file && erro)}>
                <FileSpreadsheet className="size-6 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-sm">{file ? file.name : 'Nenhum arquivo escolhido'}</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()}>
                  Escolher
                </Button>
                <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field required label="Perfil padrão" error={tried && !profileId ? 'Escolha o perfil.' : undefined} hint="Usado quando o perfil do arquivo não existe aqui. Perfis com permissão de administrador não aparecem: dê esse acesso depois, um a um.">
                <Select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={clsx(tried && !profileId && erro)}>
                  <option value="">Selecione…</option>
                  {semAdmin.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field required label="Categoria padrão" error={tried && !categoryId ? 'Escolha a categoria.' : undefined} hint="Usada quando a categoria do arquivo não existe aqui.">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={clsx(tried && !categoryId && erro)}>
                  <option value="">Selecione…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </>
        )}

        {r && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{feito ? feito.criados : r.prontos.length}</p>
                <p className="text-xs text-emerald-800 dark:text-emerald-200">{feito ? 'importados' : 'prontos para importar'}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
                <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">{r.ignorados.length}</p>
                <p className="text-xs text-amber-800 dark:text-amber-200">não importados</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-2xl font-semibold">{r.prontos.filter((p) => p.semEmail).length}</p>
                <p className="text-xs text-slate-500">sem e-mail próprio</p>
              </div>
            </div>
            {!!r.colunasIgnoradas.length && <p className="text-xs text-slate-500">Colunas ignoradas: {r.colunasIgnoradas.join(', ')}.</p>}
            {feito && (
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Pronto. Quem tem e-mail próprio cria a senha pelo Esqueci minha senha; para os demais, defina a senha editando o usuário.
              </p>
            )}
            {!!r.ignorados.length && (
              <details className="rounded-xl ring-1 ring-amber-200 dark:ring-amber-900" open={!r.prontos.length}>
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="size-4" /> Não importados ({r.ignorados.length})
                </summary>
                <div className="max-h-60 overflow-auto">
                  <Table head={['Linha', 'Usuário', 'Motivo']}>
                    {r.ignorados.map((i) => (
                      <tr key={`${i.linha}-${i.usuario}`}>
                        <td className="px-4 py-2 text-slate-500">{i.linha}</td>
                        <td className="px-4 py-2 font-mono">{i.usuario || '—'}</td>
                        <td className="px-4 py-2">{i.motivo}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </details>
            )}
            {!feito && !!r.prontos.length && (
              <div className="max-h-96 overflow-auto rounded-xl ring-1 ring-slate-200 dark:ring-slate-800">
                <Table head={['Usuário', 'Nome', 'E-mail', 'Perfil', 'Categoria', 'Avisos']}>
                  {r.prontos.map((p) => (
                    <tr key={p.username}>
                      <td className="px-4 py-2 font-mono whitespace-nowrap">{p.username}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {p.firstName} {p.lastName}
                        {!p.active && <span className="ml-1 text-xs text-slate-400">(inativo)</span>}
                      </td>
                      <td className="px-4 py-2">{p.semEmail ? <span className="text-slate-400">{p.ticketEmail ? `só chamados: ${p.ticketEmail}` : 'sem e-mail'}</span> : p.email}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{p.perfil}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{p.categoria}</td>
                      <td className="px-4 py-2 text-xs text-amber-700 dark:text-amber-300">{p.avisos.join(' · ')}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
            {previa && !feito && (
              <Button variant="ghost" size="sm" onClick={() => setPrevia(null)}>
                Trocar arquivo ou padrões
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
