'use client';

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui';
import { CATEGORIAS, Categoria, Resumo, fmtBytes } from '@/lib/armazenamento';
import { TOOLTIP_CURSOR } from '@/lib/graficos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const bytes = (v: unknown) => fmtBytes(Number(v));
/** Cor de cada categoria no gráfico, pela paleta --chart-* (mesmos tons de antes, agora com versão escura). */
const COR_CATEGORIA: Record<Categoria, string> = {
  office: 'var(--chart-1)',
  imagem: 'var(--chart-3)',
  audio: 'var(--chart-4)',
  video: 'var(--chart-5)',
  texto: 'var(--chart-6)',
  pdf: 'var(--chart-7)',
  outro: 'var(--chart-8)',
};

/** Gráficos do painel Armazenamento e otimização (carregados sob demanda: o recharts só baixa nesta tela). */
export default function ArmazenamentoGraficos({ dados }: { dados: Resumo }) {
  const pizza = dados.categorias.map((c) => ({ name: CATEGORIAS[c.categoria].nome, value: c.bytes, color: COR_CATEGORIA[c.categoria], arquivos: c.arquivos }));
  const total = pizza.reduce((s, d) => s + d.value, 0);
  const meses = dados.meses.map((m) => ({ mes: mesCurto(m.mes), Recebido: m.recebido, Guardado: m.guardado }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="font-semibold">Espaço por categoria</h3>
        {!total ? (
          <p className="py-12 text-center text-sm text-slate-500">Nenhum arquivo guardado.</p>
        ) : (
          <div className="mt-2 grid items-center gap-4 sm:grid-cols-[170px_1fr]">
            <div className="h-44">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pizza.filter((d) => d.value)} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2} isAnimationActive={false}>
                    {pizza
                      .filter((d) => d.value)
                      .map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                  </Pie>
                  <Tooltip formatter={bytes} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {pizza.map((d) => (
                <li key={d.name} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                  <span className="flex-1">
                    {d.name} <span className="text-xs text-slate-500">· {d.arquivos.toLocaleString('pt-BR')} arquivo{d.arquivos === 1 ? '' : 's'}</span>
                  </span>
                  <span className="font-medium tabular-nums">{fmtBytes(d.value)}</span>
                  <span className="w-10 text-right text-xs text-slate-500 tabular-nums">{Math.round((d.value / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold">Recebido × guardado por mês</h3>
        <p className="text-xs text-slate-500">Tamanho dos envios e o espaço que realmente ocupam depois da otimização e dos duplicados.</p>
        {!meses.length ? (
          <p className="py-12 text-center text-sm text-slate-500">Sem envios nos últimos 12 meses.</p>
        ) : (
          <div className="mt-3 h-56">
            <ResponsiveContainer>
              <BarChart data={meses} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={bytes} tick={{ fontSize: 11 }} width={64} />
                <Tooltip formatter={bytes} cursor={TOOLTIP_CURSOR} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Recebido" fill="var(--chart-8)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar dataKey="Guardado" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
