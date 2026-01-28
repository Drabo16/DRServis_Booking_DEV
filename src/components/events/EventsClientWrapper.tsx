'use client';

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
}

export default function EventsClientWrapper({ isAdmin, userId }: EventsClientWrapperProps) {
  // Use React Query for data fetching with aggressive caching
  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch } = useEvents();
  const { data: technicians = [] } = useTechnicians();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();

  // Permission checks - user with ANY booking permission should see all events
  const hasBookingView = canPerformAction(permissions, 'booking_view');
  const hasManageEvents = canPerformAction(permissions, 'booking_manage_events');
  const hasManagePositions = canPerformAction(permissions, 'booking_manage_positions');
  const hasInvite = canPerformAction(permissions, 'booking_invite');
  const hasManageFolders = canPerformAction(permissions, 'booking_manage_folders');

  // Can see all events = admin OR has booking_view OR has any booking management permission
  const canSeeAllEvents = isAdmin || hasBookingView || hasManageEvents || hasManagePositions || hasInvite;

  // Can manage events like an admin (full booking access)
  const hasFullBookingAccess = isAdmin || hasManageEvents || hasManagePositions || hasInvite || hasManageFolders;

  // Show loading while either events or permissions are loading
  if (eventsLoading || permissionsLoading) {
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
    />
  );
}
