'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts';
import type { ReportingData } from '@/hooks/useReporting';
import { formatCurrency } from './formatters';

interface Props {
  data: ReportingData;
}

// Blue gradient shades for top clients
const BLUE_SHADES = [
  '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93bbfd',
  '#a5c4fd', '#b8d0fe', '#c9dbfe', '#dbeafe', '#e8f0fe',
];

export default function ClientsTab({ data }: Props) {
  const { offers } = data;
  const { topClients } = offers;

  // Chart data for horizontal bar
  const chartData = topClients.map((client, i) => ({
    name: client.name.length > 20 ? client.name.slice(0, 20) + '…' : client.name,
    fullName: client.name,
    'Obrat': client.revenue,
    'Nabídek': client.count,
    fill: BLUE_SHADES[Math.min(i, BLUE_SHADES.length - 1)],
  }));

  // Total revenue across all clients
  const totalClientRevenue = topClients.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Top klient</p>
            <p className="text-lg font-bold text-slate-900 mt-1 truncate">
              {topClients[0]?.name || '—'}
            </p>
            <p className="text-xs text-slate-500">
              {topClients[0] ? formatCurrency(topClients[0].revenue) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Obrat top 10</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalClientRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Průměr na klienta</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {topClients.length > 0 ? formatCurrency(Math.round(totalClientRevenue / topClients.length)) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Top klienti podle obratu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    width={160}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(label) => {
                      const item = chartData.find(d => d.name === label);
                      return item?.fullName || label;
                    }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="Obrat" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Přehled klientů</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-500">#</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">Klient</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">Nabídek</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">Obrat</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">Podíl</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((client, i) => {
                  const pct = totalClientRevenue > 0
                    ? Math.round((client.revenue / totalClientRevenue) * 100)
                    : 0;
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{client.name}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{client.count}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">{formatCurrency(client.revenue)}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-slate-500 text-xs w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {topClients.length === 0 && (
            <p className="text-center text-slate-400 py-8">Žádná data o klientech.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
