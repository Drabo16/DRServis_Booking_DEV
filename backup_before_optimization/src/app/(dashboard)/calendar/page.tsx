'use client';

import { useEvents } from '@/hooks/useEvents';
import CalendarView from '@/components/calendar/CalendarView';
import { Loader2 } from 'lucide-react';

export default function CalendarPage() {
  const { data: events = [], isLoading, error } = useEvents();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600">Načítání kalendáře...</p>
        </div>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold text-slate-900">Kalendář akcí</h1>
        <p className="text-slate-600 mt-1">Přehled všech nadcházejících akcí</p>
      </div>

      <CalendarView events={events} />
    </div>
  );
}
