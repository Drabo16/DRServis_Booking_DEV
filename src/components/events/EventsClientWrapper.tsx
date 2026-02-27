'use client';

import { useState } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useMyPermissions, canPerformAction } from '@/hooks/usePermissions';
import EventsWithSidebar from './EventsWithSidebar';
import { EventCardSkeletonList } from './EventCardSkeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EventsClientWrapperProps {
  isAdmin: boolean;
  userId: string;
  canSeeAllEvents: boolean; // Calculated on server-side for reliability
}

export default function EventsClientWrapper({ isAdmin, userId, canSeeAllEvents }: EventsClientWrapperProps) {
  // Toggle between upcoming and past events
  const [showPast, setShowPast] = useState(false);

  // Use React Query for data fetching with aggressive caching
  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch } = useEvents(showPast);
  const { data: technicians = [] } = useTechnicians();
  const { data: permissions } = useMyPermissions();

  // Permission checks for UI elements (manage buttons etc.)
  const hasManageEvents = canPerformAction(permissions, 'booking_manage_events');
  const hasManagePositions = canPerformAction(permissions, 'booking_manage_positions');
  const hasInvite = canPerformAction(permissions, 'booking_invite');
  const hasManageFolders = canPerformAction(permissions, 'booking_manage_folders');

  // canSeeAllEvents is now passed from server - no client-side calculation needed

  // Can manage events like an admin (full booking access)
  const hasFullBookingAccess = isAdmin || hasManageEvents || hasManagePositions || hasInvite || hasManageFolders;

  // Show loading while events are loading (permissions for visibility come from server)
  if (eventsLoading) {
    return (
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            Akce
          </h1>
        </div>
        <EventCardSkeletonList count={5} />
      </div>
    );
  }

  if (eventsError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-red-600">Chyba při načítání akcí</p>
          <p className="text-sm text-slate-500">{eventsError.message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Zkusit znovu
          </Button>
        </div>
      </div>
    );
  }

  // Filter events - users with booking permissions see all, others only their assignments
  const filteredEvents = canSeeAllEvents
    ? events
    : events.filter((event) =>
        event.positions?.some((position) =>
          position.assignments?.some((assignment) => assignment.technician_id === userId)
        )
      );

  return (
    <EventsWithSidebar
      events={filteredEvents}
      isAdmin={hasFullBookingAccess}
      userId={userId}
      allTechnicians={technicians}
      showPast={showPast}
      onTogglePast={() => setShowPast(!showPast)}
    />
  );
}
