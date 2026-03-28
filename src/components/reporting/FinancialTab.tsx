'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, X, TrendingUp, TrendingDown, DollarSign, Percent, ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
  ComposedChart, Area, Line,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  processExcelData,
  calculateSummary,
  calculateMonthlyPerformance,
  calculateEventSummaries,
  filterTransactions,
} from '@/lib/financial-processing';
import type { Transaction, FinancialSummary, MonthlySummary, EventSummary, DateRangeOption } from '@/types/reporting';
import { formatCurrency, formatMonth } from './formatters';

const EXPENSE_COLORS: Record<string, string> = {
  'Personál': '#ef4444',
  'Doprava': '#10b981',
  'Provize': '#f59e0b',
  'Rent Sýkora': '#3b82f6',
  'Rent Elsea': '#0891b2',
  'Rent Ostatní': '#4f46e5',
  'Provoz': '#8b5cf6',
  'Režie': '#6366f1',
};

const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'thisYear', label: 'Tento rok' },
  { value: 'last90Days', label: 'Posledních 90 dní' },
  { value: 'last30Days', label: 'Posledních 30 dní' },
];

export default function FinancialTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', raw: true });

        let allTransactions: Transaction[] = [];

        // Process all sheets
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
          const sheetTransactions = processExcelData(rows);
          allTransactions = allTransactions.concat(sheetTransactions);
        }

        setTransactions(allTransactions);
        setFileName(file.name);
      } catch {
        console.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      handleFile(file);
    }
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Apply filters
  const filtered = filterTransactions(transactions, dateRange, 'all', searchQuery);
  const summary = calculateSummary(filtered);
  const monthly = calculateMonthlyPerformance(filtered);
  const eventSummaries = calculateEventSummaries(filtered);

  // Build chart data
  const categoryExpenses: Record<string, number> = {};
  filtered.filter(t => t.type === 'expense').forEach(t => {
    categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
  });
  const categoryPieData = Object.entries(categoryExpenses)
    .map(([name, value]) => ({ name, value, color: EXPENSE_COLORS[name] || '#94a3b8' }))
    .sort((a, b) => b.value - a.value);

  const monthlyChartData = [...monthly].reverse().map(m => ({
    name: m.monthName.split(' ')[0]?.slice(0, 3) || m.id,
    'Příjmy': m.revenue,
    'Náklady': m.expenses,
    'Zisk': m.profit,
  }));

  // If no data loaded, show upload zone
  if (transactions.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Nahrajte finanční tabulku</h3>
              <p className="text-sm text-slate-500 mb-6">
                Přetáhněte .xlsx soubor sem, nebo klikněte pro výběr
              </p>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Vybrat soubor
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onFileSelect}
                className="hidden"
              />
              <p className="text-xs text-slate-400 mt-4">
                Podporované formáty: .xlsx, .xls, .csv — Struktura: List &quot;Akce&quot; (sloupce A-V) + List &quot;Provoz&quot; (sloupce A-D)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span className="text-slate-700 font-medium">{fileName}</span>
          <span className="text-slate-400">({transactions.length} záznamů)</span>
          <button onClick={() => { setTransactions([]); setFileName(null); }} className="ml-1 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Hledat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-48"
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 ml-auto">
          <Upload className="w-4 h-4" />
          Nahrát jiný
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPIFinancial
          title="Obrat"
          value={summary.totalRevenue}
          icon={<DollarSign className="w-5 h-5" />}
          color="emerald"
        />
        <KPIFinancial
          title="Čistý zisk"
          value={summary.netProfit}
          icon={summary.netProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          color={summary.netProfit >= 0 ? 'emerald' : 'red'}
        />
        <KPIFinancial
          title="Hrubá marže"
          value={summary.grossMargin}
          suffix="%"
          icon={<Percent className="w-5 h-5" />}
          color="blue"
        />
        <KPIFinancial
          title="Čistá marže"
          value={summary.profitMargin}
          suffix="%"
          icon={<Percent className="w-5 h-5" />}
          color={summary.profitMargin >= 20 ? 'emerald' : summary.profitMargin >= 0 ? 'amber' : 'red'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Costs timeline */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Příjmy vs Náklady</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Area type="monotone" dataKey="Příjmy" stroke="#10b981" strokeWidth={2} fill="url(#colorIncome)" />
                  <Bar dataKey="Náklady" fill="#ef4444" opacity={0.7} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Zisk" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost Structure Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Struktura nákladů</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Profitability Table */}
      {eventSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Zakázky — profitabilita</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Akce</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Datum</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Příjmy</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Náklady</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Zisk</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Marže</th>
                  </tr>
                </thead>
                <tbody>
                  {eventSummaries.map((ev) => (
                    <tr key={ev.name} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-900">{ev.name}</td>
                      <td className="py-2 px-3 text-slate-500">
                        {new Date(ev.date).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(ev.revenue)}</td>
                      <td className="py-2 px-3 text-right text-red-500">{formatCurrency(ev.expenses)}</td>
                      <td className="py-2 px-3 text-right font-medium">
                        <span className={ev.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {formatCurrency(ev.profit)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${
                          ev.margin >= 30 ? 'bg-emerald-50 text-emerald-700' :
                          ev.margin >= 10 ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {ev.margin >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {ev.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Performance Table */}
      {monthly.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Měsíční přehled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Měsíc</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Příjmy</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Náklady</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Zisk</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Marže</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Transakcí</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-900">{m.monthName}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(m.revenue)}</td>
                      <td className="py-2 px-3 text-right text-red-500">{formatCurrency(m.expenses)}</td>
                      <td className="py-2 px-3 text-right font-medium">
                        <span className={m.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {formatCurrency(m.profit)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">{m.margin.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right text-slate-400">{m.transactionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Internal KPI card for financial values
function KPIFinancial({ title, value, suffix, icon, color }: {
  title: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'red' | 'blue' | 'amber';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {suffix ? `${value.toFixed(1)}${suffix}` : formatCurrency(value)}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
