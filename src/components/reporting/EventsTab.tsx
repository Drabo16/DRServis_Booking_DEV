'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts';
import type { ReportingData } from '@/hooks/useReporting';
import { formatMonth, formatPercent } from './formatters';

interface Props {
  data: ReportingData;
}

const ATTENDANCE_COLORS: Record<string, string> = {
  accepted: '#10b981',
  declined: '#ef4444',
  pending: '#f59e0b',
};

const ATTENDANCE_LABELS: Record<string, string> = {
  accepted: 'Přijato',
  declined: 'Odmítnuto',
  pending: 'Čeká',
};

export default function EventsTab({ data }: Props) {
  const { events, technicians } = data;

  // Attendance pie data
  const totalAccepted = technicians.utilizationByTech.reduce((s, t) => s + t.accepted, 0);
  const totalDeclined = technicians.utilizationByTech.reduce((s, t) => s + t.declined, 0);
  const totalPending = technicians.utilizationByTech.reduce((s, t) => s + t.pending, 0);

  const attendancePieData = [
    { name: 'Přijato', value: totalAccepted, color: ATTENDANCE_COLORS.accepted },
    { name: 'Odmítnuto', value: totalDeclined, color: ATTENDANCE_COLORS.declined },
    { name: 'Čeká', value: totalPending, color: ATTENDANCE_COLORS.pending },
  ].filter(d => d.value > 0);

  // Events by month chart data
  const eventsMonthlyData = events.byMonth.map(m => ({
    name: formatMonth(m.month),
    'Akce celkem': m.count,
    'Potvrzené': m.confirmed,
  }));

  // Top technicians by assignment count
  const topTechs = [...technicians.utilizationByTech]
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
    .map((t, i) => ({
      name: `Technik ${i + 1}`,
      technicianId: t.technicianId,
      'Přijato': t.accepted,
      'Odmítnuto': t.declined,
      'Čeká': t.pending,
    }));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Celkem akcí</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{events.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nadcházející</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{events.upcoming}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Potvrzené</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{events.confirmed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Akceptace techniků</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatPercent(technicians.acceptanceRate)}</p>
            <p className="text-xs text-slate-500">{technicians.totalAssignments} přiřazení celkem</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Events by month */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Akce po měsících</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventsMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="Akce celkem" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Potvrzené" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Odpovědi techniků</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendancePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {attendancePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technician utilization */}
      {topTechs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Vytížení techniků (top 15)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTechs} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="Přijato" stackId="a" fill="#10b981" />
                  <Bar dataKey="Odmítnuto" stackId="a" fill="#ef4444" />
                  <Bar dataKey="Čeká" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
