'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EventCard from './EventCard';
import CalendarView from '@/components/calendar/CalendarView';
import EventDetailSheet from './EventDetailSheet';
import { Event } from '@/types';

interface EventsTabsProps {
  events: Array<Event & {
    positions?: Array<{
      id: string;
      assignments?: Array<{ id: string; attendance_status: string }>;
    }>;
  }>;
}

export default function EventsTabs({ events }: EventsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');

  const handleOpenEvent = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('event', id);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const handleCloseEvent = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('event');
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list">Seznam</TabsTrigger>
          <TabsTrigger value="calendar">Kalendář</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {!events || events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600">
                Žádné nadcházející akce. Pro načtení akcí z Google Calendar použijte tlačítko &quot;Synchronizovat&quot; v hlavičce.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <EventCard key={event.id} event={event} onOpen={handleOpenEvent} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView events={events} onEventClick={handleOpenEvent} />
        </TabsContent>
      </Tabs>

      <EventDetailSheet eventId={eventId} onClose={handleCloseEvent} />
    </>
  );
}
