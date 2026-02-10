'use client';

import { useState } from 'react';
import { useEvents } from '@/hooks/useEvents';
import CalendarView from '@/components/calendar/CalendarView';
import TechnicianOverview from '@/components/technicians/TechnicianOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Calendar, Users } from 'lucide-react';

export default function CalendarPage() {
  const [activeTab, setActiveTab] = useState('calendar');
  const { data: events = [], isLoading, error } = useEvents();

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Chyba při načítání akcí</p>
          <p className="text-sm text-slate-500">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Booking</h1>
        <p className="text-slate-600 mt-1">Kalendář akcí a přehled techniků</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4" />
            Kalendář
          </TabsTrigger>
          <TabsTrigger value="technicians" className="gap-2">
            <Users className="w-4 h-4" />
            Přehled techniků
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-600" />
                <p className="text-slate-600">Načítání kalendáře...</p>
              </div>
            </div>
          ) : (
            <CalendarView events={events} />
          )}
        </TabsContent>

        <TabsContent value="technicians" className="mt-6">
          <TechnicianOverview daysAhead={60} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
