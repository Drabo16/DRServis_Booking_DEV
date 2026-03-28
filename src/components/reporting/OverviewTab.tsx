'use client';

import { DollarSign, TrendingUp, FileText, Calendar, CheckCircle2, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import type { ReportingData } from '@/hooks/useReporting';
import KPICard from './KPICard';
import { formatCurrency, formatMonth, formatPercent } from './formatters';

interface Props {
  data: ReportingData;
}

const CATEGORY_COLORS = {
  equipment: '#3b82f6',
  personnel: '#ef4444',
  transport: '#10b981',
  discounts: '#f59e0b',
};

const CATEGORY_LABELS: Record<string, string> = {
  equipment: 'Technika',
  personnel: 'Personál',
  transport: 'Doprava',
  discounts: 'Slevy',
};

export default function OverviewTab({ data }: Props) {
  const { offers, events, warehouse } = data;

  // Revenue chart data
  const revenueChartData = offers.monthlyRevenue.map(m => ({
    name: formatMonth(m.month),
    'Příjmy': m.revenue,
    'Počet nabídek': m.count,
  }));

  // Category pie data
  const categoryPieData = Object.entries(offers.revenueByCategory)
    .filter(([key]) => key !== 'discounts')
    .map(([key, value]) => ({
      name: CATEGORY_LABELS[key] || key,
      value,
      color: CATEGORY_COLORS[key as keyof typeof CATEGORY_COLORS],
    }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard
          title="Celkový obrat"
          value={formatCurrency(offers.totalRevenue)}
          subtitle="přijaté nabídky"
          icon={DollarSign}
          color="green"
        />
        <KPICard
          title="Průměrná nabídka"
          value={formatCurrency(offers.avgOfferValue)}
          icon={TrendingUp}
          color="blue"
        />
        <KPICard
          title="Konverze"
          value={formatPercent(offers.conversionRate)}
          subtitle={`${offers.byStatus.accepted || 0} přijatých`}
          icon={CheckCircle2}
          color={offers.conversionRate >= 50 ? 'green' : 'amber'}
        />
        <KPICard
          title="Nabídky letos"
          value={String(offers.thisYear)}
          subtitle={`${offers.total} celkem`}
          icon={FileText}
          color="blue"
        />
        <KPICard
          title="Nadcházející akce"
          value={String(events.upcoming)}
          subtitle={`${events.confirmed} potvrzených`}
          icon={Calendar}
          color="amber"
        />
        <KPICard
          title="Sklad"
          value={String(warehouse.totalItems)}
          subtitle={`${warehouse.ownedItems} vlastních, ${warehouse.rentItems} pronájem`}
          icon={Package}
          color="slate"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend - 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Vývoj obratu (posledních 12 měsíců)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    labelStyle={{ fontWeight: 600 }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Příjmy"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Category Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Struktura obratu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events by Month */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Počet akcí po měsících</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={events.byMonth.map(m => ({
                name: formatMonth(m.month),
                'Celkem': m.count,
                'Potvrzené': m.confirmed,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend />
                <Bar dataKey="Celkem" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Potvrzené" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
