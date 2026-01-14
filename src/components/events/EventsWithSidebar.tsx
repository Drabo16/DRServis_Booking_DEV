'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EventCard from './EventCard';
import CalendarView from '@/components/calendar/CalendarView';
import EventDetailPanel from './EventDetailPanel';
import ExcelView from './ExcelView';
import type { Event, Profile } from '@/types';

interface EventsWithSidebarProps {
  events: Array<Event & {
    positions?: Array<{
      id: string;
      assignments?: Array<{ id: string; attendance_status: string; technician_id?: string; technician?: Profile }>;
    }>;
  }>;
  isAdmin: boolean;
  userId: string;
  allTechnicians?: Profile[];
}

export default function EventsWithSidebar({ events, isAdmin, userId, allTechnicians = [] }: EventsWithSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(eventId);
  const [activeTab, setActiveTab] = useState('list');

  useEffect(() => {
    setSelectedEventId(eventId);
  }, [eventId]);

  const handleOpenEvent = (id: string) => {
    setSelectedEventId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('event', id);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const handleCloseEvent = () => {
    setSelectedEventId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('event');
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  // Excel view má full width, ostatní mají split view
  const isExcelView = activeTab === 'excel';

  return (
    <div className={isExcelView ? '' : 'flex gap-6 h-full'}>
      {/* Levý panel nebo full width panel */}
      <div className={isExcelView ? 'w-full' : 'w-1/2'}>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">
            {isAdmin ? 'Akce' : 'Moje akce'}
          </h1>
        </div>

        <Tabs defaultValue="list" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="list">Seznam</TabsTrigger>
            <TabsTrigger value="calendar">Kalendář</TabsTrigger>
            <TabsTrigger value="excel">Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            {!events || events.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600">
                  Žádné nadcházející akce. Pro načtení akcí z Google Calendar použijte tlačítko &quot;Synchronizovat&quot; v hlavičce.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onOpen={handleOpenEvent}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <CalendarView events={events} onEventClick={handleOpenEvent} />
          </TabsContent>

          <TabsContent value="excel" className="mt-6">
            <ExcelView events={events} isAdmin={isAdmin} allTechnicians={allTechnicians} userId={userId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Pravý panel - detail akce (pouze pro Seznam a Kalendář view) */}
      {!isExcelView && (
        <div className="w-1/2 border-l border-slate-200 pl-6 overflow-y-auto max-h-screen">
          {selectedEventId ? (
            <EventDetailPanel
              eventId={selectedEventId}
              onClose={handleCloseEvent}
              isAdmin={isAdmin}
            />
          ) : (
            <div className="flex items-center justify-center h-96 text-slate-400">
              <div className="text-center">
                <p className="text-lg">Vyberte akci pro zobrazení detailu</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
