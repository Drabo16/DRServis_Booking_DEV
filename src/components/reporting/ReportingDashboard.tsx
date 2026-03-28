'use client';

import { Loader2, BarChart3, FileText, Calendar, Users2, FileSpreadsheet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReporting } from '@/hooks/useReporting';
import OverviewTab from './OverviewTab';
import OffersTab from './OffersTab';
import EventsTab from './EventsTab';
import ClientsTab from './ClientsTab';
import FinancialTab from './FinancialTab';

export default function ReportingDashboard() {
  const { data, isLoading, error } = useReporting();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Nepodařilo se načíst data pro reporting.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kontroling</h1>
        <p className="text-sm text-slate-500 mt-1">Přehled výkonnosti a finanční analýzy</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Přehled</span>
          </TabsTrigger>
          <TabsTrigger value="offers" className="gap-1.5">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Nabídky</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Akce</span>
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5">
            <Users2 className="w-4 h-4" />
            <span className="hidden sm:inline">Klienti</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Finance</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab data={data} />
        </TabsContent>
        <TabsContent value="offers">
          <OffersTab data={data} />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab data={data} />
        </TabsContent>
        <TabsContent value="clients">
          <ClientsTab data={data} />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
