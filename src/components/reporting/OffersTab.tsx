'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  CartesianGrid,
} from 'recharts';
import type { ReportingData } from '@/hooks/useReporting';
import { formatCurrency, formatMonth, STATUS_LABELS, STATUS_COLORS } from './formatters';

interface Props {
  data: ReportingData;
}

export default function OffersTab({ data }: Props) {
  const { offers } = data;

  // Status breakdown for pie chart
  const statusPieData = Object.entries(offers.byStatus).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    color: STATUS_COLORS[status] || '#94a3b8',
  }));

  // Revenue by status for bar chart
  const revenueByStatusData = Object.entries(offers.revenueByStatus)
    .filter(([, v]) => v > 0)
    .map(([status, revenue]) => ({
      name: STATUS_LABELS[status] || status,
      value: revenue,
      fill: STATUS_COLORS[status] || '#94a3b8',
    }))
    .sort((a, b) => b.value - a.value);

  // Monthly offer count + revenue
  const monthlyData = offers.monthlyRevenue.map(m => ({
    name: formatMonth(m.month),
    'Obrat': m.revenue,
    'Počet': m.count,
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Celkem nabídek</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{offers.total}</p>
            <p className="text-xs text-slate-500">{offers.thisYear} letos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Konverze</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{offers.conversionRate} %</p>
            <p className="text-xs text-slate-500">přijatých vs odmítnutých</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Celkový obrat</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(offers.totalRevenue)}</p>
            <p className="text-xs text-slate-500">přijaté nabídky</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Průměrná hodnota</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(offers.avgOfferValue)}</p>
            <p className="text-xs text-slate-500">na přijatou nabídku</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Nabídky podle stavu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Obrat podle stavu nabídky</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByStatusData} layout="vertical">
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
                    width={80}
                  />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {revenueByStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Měsíční přehled nabídek</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'Obrat' ? formatCurrency(Number(value)) : String(value)
                  }
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="Obrat" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="Počet" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Struktura obratu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-500">Kategorie</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">Hodnota</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">Podíl</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Technika', value: offers.revenueByCategory.equipment, color: 'bg-blue-500' },
                  { label: 'Personál', value: offers.revenueByCategory.personnel, color: 'bg-red-500' },
                  { label: 'Doprava', value: offers.revenueByCategory.transport, color: 'bg-emerald-500' },
                  { label: 'Slevy', value: -offers.revenueByCategory.discounts, color: 'bg-amber-500' },
                ].map((row) => {
                  const total = offers.totalRevenue || 1;
                  const pct = Math.round((Math.abs(row.value) / (offers.revenueByCategory.equipment + offers.revenueByCategory.personnel + offers.revenueByCategory.transport)) * 100);
                  return (
                    <tr key={row.label} className="border-b border-slate-100">
                      <td className="py-2 px-3 flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${row.color}`} />
                        {row.label}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">{formatCurrency(row.value)}</td>
                      <td className="py-2 px-3 text-right text-slate-500">{row.label === 'Slevy' ? '—' : `${pct} %`}</td>
                    </tr>
                  );
                })}
                <tr className="font-medium">
                  <td className="py-2 px-3">Celkem po slevě</td>
                  <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(offers.totalRevenue)}</td>
                  <td className="py-2 px-3 text-right">100 %</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
