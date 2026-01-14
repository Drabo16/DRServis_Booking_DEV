'use client';

import { useEvents } from '@/hooks/useEvents';
import { useTechnicians } from '@/hooks/useTechnicians';
import EventsWithSidebar from './EventsWithSidebar';
import { Loader2 } from 'lucide-react';

interface EventsClientWrapperProps {
  isAdmin: boolean;
  userId: string;
}

export default function EventsClientWrapper({ isAdmin, userId }: EventsClientWrapperProps) {
  // Use React Query for data fetching with aggressive caching
  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useEvents();
  const { data: technicians = [], isLoading: techniciansLoading } = useTechnicians();

  if (eventsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600">Načítání akcí...</p>
        </div>
      </div>
    );
  }

  if (eventsError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Chyba při načítání akcí</p>
          <p className="text-sm text-slate-500">{eventsError.message}</p>
        </div>
      </div>
    );
  }

  // Filter events for non-admin users (show only their assignments)
  const filteredEvents = isAdmin
    ? events
    : events.filter((event) =>
        event.positions?.some((position: any) =>
          position.assignments?.some((assignment: any) => assignment.technician_id === userId)
        )
      );

  return (
    <EventsWithSidebar
      events={filteredEvents}
      isAdmin={isAdmin}
      userId={userId}
      allTechnicians={technicians}
    />
  );
}
