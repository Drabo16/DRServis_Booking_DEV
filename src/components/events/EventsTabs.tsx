'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import EventCard from './EventCard';
import CalendarView from '@/components/calendar/CalendarView';
import EventDetailSheet from './EventDetailSheet';
import { Event } from '@/types';
import { eventKeys } from '@/hooks/useEvents';
import { toast } from 'sonner';
import { FolderPlus, Link2, RefreshCw, Loader2 } from 'lucide-react';

interface EventsTabsProps {
  events: Array<Event & {
    positions?: Array<{
      id: string;
      assignments?: Array<{ id: string; attendance_status: string }>;
    }>;
    drive_folder_id?: string | null;
    google_event_id?: string | null;
    calendar_attachment_synced?: boolean;
  }>;
  isAdmin?: boolean;
}

export default function EventsTabs({ events, isAdmin }: EventsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const eventId = searchParams.get('event');

  // Multiselect state
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingDrive, setIsValidatingDrive] = useState(false);

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

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedEvents.size === events.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(events.map(e => e.id)));
    }
  };

  // Toggle single event selection
  const handleSelectChange = (eventId: string, selected: boolean) => {
    const newSelected = new Set(selectedEvents);
    if (selected) {
      newSelected.add(eventId);
    } else {
      newSelected.delete(eventId);
    }
    setSelectedEvents(newSelected);
  };

  // Bulk create drive folders
  const bulkCreateDriveFolders = async () => {
    if (selectedEvents.size === 0) return;

    const eventsWithoutFolder = Array.from(selectedEvents).filter(eventId => {
      const event = events.find(e => e.id === eventId);
      return event && !event.drive_folder_id;
    });

    if (eventsWithoutFolder.length === 0) {
      toast.info('Všechny vybrané akce již mají Drive složku.');
      return;
    }

    if (!confirm(`Vytvořit Drive složky pro ${eventsWithoutFolder.length} akcí?`)) return;

    setIsProcessing(true);
    let successCount = 0;

    for (const eventId of eventsWithoutFolder) {
      try {
        const res = await fetch(`/api/events/${eventId}/drive`, { method: 'POST' });
        if (res.ok) successCount++;
      } catch (error) {
        console.error(`Error creating folder for ${eventId}:`, error);
      }
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    toast.success(`Úspěšně vytvořeno ${successCount}/${eventsWithoutFolder.length} složek.`);
    setSelectedEvents(new Set());
  };

  // Bulk attach Drive folders to calendar
  const bulkAttachToCalendar = async () => {
    if (selectedEvents.size === 0) return;

    const eligibleEvents = Array.from(selectedEvents).filter(eventId => {
      const event = events.find(e => e.id === eventId);
      return event && event.drive_folder_id && event.google_event_id && !event.calendar_attachment_synced;
    });

    if (eligibleEvents.length === 0) {
      toast.info('Žádné vybrané akce nemají Drive složku nebo nejsou v kalendáři, nebo už mají přílohu připojenou.');
      return;
    }

    if (!confirm(`Připojit Drive složky jako přílohu do kalendáře pro ${eligibleEvents.length} akcí?`)) return;

    setIsProcessing(true);
    let successCount = 0;

    for (const eventId of eligibleEvents) {
      try {
        const res = await fetch(`/api/events/${eventId}/attach-drive`, { method: 'POST' });
        if (res.ok) successCount++;
      } catch (error) {
        console.error(`Error attaching folder for ${eventId}:`, error);
      }
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    toast.success(`Úspěšně připojeno ${successCount}/${eligibleEvents.length} příloh.`);
    setSelectedEvents(new Set());
  };

  // Validate Drive folders
  const validateDriveFolders = async () => {
    setIsValidatingDrive(true);
    try {
      const res = await fetch('/api/events/validate-drive', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        queryClient.invalidateQueries({ queryKey: eventKeys.list() });
        toast.success(`Ověřeno ${data.validated} složek, odstraněno ${data.invalidated} neplatných odkazů.`);
      }
    } catch (error) {
      console.error('Error validating drive folders:', error);
      toast.error('Chyba při ověřování složek');
    } finally {
      setIsValidatingDrive(false);
    }
  };

  return (
    <>
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list">Seznam</TabsTrigger>
          <TabsTrigger value="calendar">Kalendář</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {/* Bulk actions bar for admin */}
          {isAdmin && events.length > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedEvents.size === events.length && events.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-slate-600">
                  {selectedEvents.size > 0 ? `Vybráno: ${selectedEvents.size}` : 'Vybrat vše'}
                </span>

                {selectedEvents.size > 0 && (
                  <div className="flex items-center gap-2 pl-3 border-l">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={bulkCreateDriveFolders}
                      disabled={isProcessing}
                      className="gap-1"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                      Vytvořit složky
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={bulkAttachToCalendar}
                      disabled={isProcessing}
                      className="gap-1"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      Připojit přílohy
                    </Button>
                  </div>
                )}
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={validateDriveFolders}
                disabled={isValidatingDrive}
                title="Ověřit Drive složky"
              >
                <RefreshCw className={`w-4 h-4 ${isValidatingDrive ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          )}

          {!events || events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600">
                Žádné nadcházející akce. Pro načtení akcí z Google Calendar použijte tlačítko &quot;Synchronizovat&quot; v hlavičce.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onOpen={handleOpenEvent}
                  selected={selectedEvents.has(event.id)}
                  onSelectChange={handleSelectChange}
                  showCheckbox={isAdmin}
                />
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
