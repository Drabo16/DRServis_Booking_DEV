'use client';

import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EventCard from './EventCard';
import EventDetailPanel from './EventDetailPanel';
import type { Event, Profile } from '@/types';
import { eventKeys } from '@/hooks/useEvents';
import { Loader2, Filter, X, FolderPlus, Link2, RefreshCw, Trash2, MoreHorizontal, History, CalendarDays } from 'lucide-react';

// Lazy load heavy components for better initial load time
const CalendarView = lazy(() => import('@/components/calendar/CalendarView'));
const ExcelView = lazy(() => import('./ExcelView'));
const InviteResponsesTab = lazy(() => import('./InviteResponsesTab'));

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
  showPast?: boolean;
  onTogglePast?: () => void;
}

export default function EventsWithSidebar({ events, isAdmin, userId, allTechnicians = [], showPast = false, onTogglePast }: EventsWithSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const eventId = searchParams.get('event');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(eventId);
  const [activeTab, setActiveTab] = useState('list');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Multiselect state for Seznam view
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingDrive, setIsValidatingDrive] = useState(false);

  // Detect mobile/desktop for sheet rendering
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    setSelectedEventId(eventId);
    if (eventId) {
      setMobileSheetOpen(true);
    }
  }, [eventId]);

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedEvents(new Set());
  }, [activeTab]);

  const handleOpenEvent = (id: string) => {
    setSelectedEventId(id);
    setMobileSheetOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set('event', id);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const handleCloseEvent = () => {
    setSelectedEventId(null);
    setMobileSheetOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('event');
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  // Filter events - show only incomplete if filter is active
  // A position is "filled" only if it has an ACCEPTED assignment
  const filteredEvents = useMemo(() => {
    if (!showIncompleteOnly) return events;

    return events.filter(event => {
      const totalPositions = event.positions?.length || 0;
      if (totalPositions === 0) return true; // Show events with no positions

      const filledPositions = event.positions?.filter(pos =>
        pos.assignments && pos.assignments.some(a => a.attendance_status === 'accepted')
      ).length || 0;

      return filledPositions < totalPositions; // Show if not all positions have accepted assignment
    });
  }, [events, showIncompleteOnly]);

  // Excel view a Odpovědi skrývají pravý panel, ale levý panel má stále stejnou šířku
  const hideRightPanel = activeTab === 'excel' || activeTab === 'responses';

  // Toggle select all (Seznam view)
  const toggleSelectAll = () => {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id)));
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

    const eventsWithoutFolder = Array.from(selectedEvents).filter(id => {
      const event = filteredEvents.find(e => e.id === id);
      return event && !(event as any).drive_folder_id;
    });

    if (eventsWithoutFolder.length === 0) {
      alert('Všechny vybrané akce již mají Drive složku.');
      return;
    }

    if (!confirm(`Vytvořit Drive složky pro ${eventsWithoutFolder.length} akcí?`)) return;

    setIsProcessing(true);
    let successCount = 0;

    for (const id of eventsWithoutFolder) {
      try {
        const res = await fetch(`/api/events/${id}/drive`, { method: 'POST' });
        if (res.ok) successCount++;
      } catch (error) {
        console.error(`Error creating folder for ${id}:`, error);
      }
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    alert(`Úspěšně vytvořeno ${successCount}/${eventsWithoutFolder.length} složek.`);
    setSelectedEvents(new Set());
  };

  // Bulk attach Drive folders to calendar
  // Allows re-attaching to add new files from the folder
  const bulkAttachToCalendar = async () => {
    if (selectedEvents.size === 0) return;

    const eligibleEvents = Array.from(selectedEvents).filter(id => {
      const event = filteredEvents.find(e => e.id === id) as any;
      // Allow attaching even if already synced - this will add any new files from the folder
      return event && event.drive_folder_id && event.google_event_id;
    });

    if (eligibleEvents.length === 0) {
      alert('Žádné vybrané akce nemají Drive složku nebo nejsou synchronizovány s kalendářem.');
      return;
    }

    if (!confirm(`Připojit/aktualizovat přílohy pro ${eligibleEvents.length} akcí?`)) return;

    setIsProcessing(true);
    let successCount = 0;

    for (const id of eligibleEvents) {
      try {
        const res = await fetch(`/api/events/${id}/attach-drive`, { method: 'POST' });
        if (res.ok) successCount++;
      } catch (error) {
        console.error(`Error attaching folder for ${id}:`, error);
      }
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    alert(`Úspěšně připojeno ${successCount}/${eligibleEvents.length} příloh.`);
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
        alert(`Ověřeno ${data.validated} složek, odstraněno ${data.invalidated} neplatných odkazů.`);
      }
    } catch (error) {
      console.error('Error validating drive folders:', error);
      alert('Chyba při ověřování složek');
    } finally {
      setIsValidatingDrive(false);
    }
  };

  // Bulk delete Drive folders
  const bulkDeleteDriveFolders = async () => {
    if (selectedEvents.size === 0) return;

    const eventsWithFolder = Array.from(selectedEvents).filter(id => {
      const event = filteredEvents.find(e => e.id === id) as any;
      return event && event.drive_folder_id;
    });

    if (eventsWithFolder.length === 0) {
      alert('Žádné vybrané akce nemají Drive složku.');
      return;
    }

    if (!confirm(`Opravdu chcete SMAZAT Drive složky pro ${eventsWithFolder.length} akcí? Tato akce je nevratná!`)) return;

    setIsProcessing(true);
    let successCount = 0;

    for (const id of eventsWithFolder) {
      try {
        const res = await fetch(`/api/events/${id}/drive`, { method: 'DELETE' });
        if (res.ok) successCount++;
      } catch (error) {
        console.error(`Error deleting folder for ${id}:`, error);
      }
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    alert(`Úspěšně smazáno ${successCount}/${eventsWithFolder.length} složek.`);
    setSelectedEvents(new Set());
  };

  // Bulk actions bar component - min-h matches other tab headers
  const BulkActionsBar = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border min-h-[52px] mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Checkbox
          checked={selectedEvents.size === filteredEvents.length && filteredEvents.length > 0}
          onCheckedChange={toggleSelectAll}
        />
        <span className="text-sm text-slate-600">
          {selectedEvents.size > 0 ? `Vybráno: ${selectedEvents.size}` : 'Vybrat vše'}
        </span>

        {selectedEvents.size > 0 && (
          <>
            {/* Desktop buttons */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l">
              <Button
                size="sm"
                variant="outline"
                onClick={bulkCreateDriveFolders}
                disabled={isProcessing}
                className="gap-1"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                Vytvořit podklady
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
              <Button
                size="sm"
                variant="outline"
                onClick={bulkDeleteDriveFolders}
                disabled={isProcessing}
                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Smazat podklady
              </Button>
            </div>

            {/* Mobile dropdown */}
            <div className="md:hidden pl-3 border-l">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                    <span className="ml-1">Akce</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={bulkCreateDriveFolders}>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Vytvořit podklady
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={bulkAttachToCalendar}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Připojit přílohy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={bulkDeleteDriveFolders} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Smazat podklady
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
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
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Levý panel - full width pro Excel/Odpovědi, poloviční pro Seznam/Kalendář */}
      <div className={hideRightPanel ? 'w-full' : 'w-full lg:w-1/2 lg:flex-shrink-0'}>
        {/* Fixed height header area to prevent layout shift when switching tabs */}
        <div className="mb-4 flex items-center justify-between gap-2 min-h-[40px]">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            {showPast ? 'Uplynulé akce' : (isAdmin ? 'Akce' : 'Moje akce')}
          </h1>

          <div className="flex items-center gap-2">
            {/* Past/Upcoming toggle */}
            {onTogglePast && (
              <Button
                variant={showPast ? 'default' : 'outline'}
                size="sm"
                onClick={onTogglePast}
                className="gap-1 md:gap-2"
              >
                {showPast ? (
                  <>
                    <CalendarDays className="w-4 h-4" />
                    <span className="hidden sm:inline">Nadcházející</span>
                  </>
                ) : (
                  <>
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">Uplynulé</span>
                  </>
                )}
              </Button>
            )}

            {/* Filter button */}
            <Button
              variant={showIncompleteOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
              className="gap-1 md:gap-2"
            >
              {showIncompleteOnly ? (
                <>
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Zrušit filtr</span>
                </>
              ) : (
                <>
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Neúplné obsazení</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="list" className="w-full" onValueChange={setActiveTab}>
          {/* Fixed width TabsList to prevent layout shift when switching tabs */}
          <TabsList className={`grid h-10 max-w-md ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="list" className="text-xs sm:text-sm">Seznam</TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs sm:text-sm">Kalendář</TabsTrigger>
            <TabsTrigger value="excel" className="text-xs sm:text-sm">Excel</TabsTrigger>
            {isAdmin && <TabsTrigger value="responses" className="text-xs sm:text-sm">Odpovědi</TabsTrigger>}
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {/* Actions bar - consistent with other tabs */}
            {isAdmin && filteredEvents.length > 0 ? (
              <BulkActionsBar />
            ) : (
              <div className="min-h-[52px] mb-4" />
            )}

            {!filteredEvents || filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 text-sm md:text-base">
                  {showIncompleteOnly
                    ? 'Žádné akce s neúplným obsazením.'
                    : 'Žádné nadcházející akce. Pro načtení akcí z Google Calendar použijte tlačítko "Synchronizovat" v hlavičce.'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                {filteredEvents.map((event) => (
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

          <TabsContent value="calendar" className="mt-4">
            {/* Actions bar - consistent with other tabs */}
            {isAdmin && filteredEvents.length > 0 ? (
              <BulkActionsBar />
            ) : (
              <div className="min-h-[52px] mb-4" />
            )}

            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[300px] md:min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
              </div>
            }>
              <CalendarView events={filteredEvents} onEventClick={handleOpenEvent} />
            </Suspense>
          </TabsContent>

          <TabsContent value="excel" className="mt-4">
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[300px] md:min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
              </div>
            }>
              <ExcelView events={filteredEvents as any} isAdmin={isAdmin} allTechnicians={allTechnicians} userId={userId} />
            </Suspense>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="responses" className="mt-4">
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[300px] md:min-h-[400px]">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                </div>
              }>
                <InviteResponsesTab
                  events={filteredEvents as any}
                  isAdmin={isAdmin}
                  allTechnicians={allTechnicians}
                  onEventClick={handleOpenEvent}
                />
              </Suspense>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Pravý panel - detail akce - DESKTOP only */}
      {!hideRightPanel && (
        <div className="hidden lg:block w-1/2 border-l border-slate-200 pl-6 overflow-y-auto sticky top-0 h-screen">
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

      {/* Mobile sheet for event detail - only render on mobile/tablet */}
      {isMobile && (
        <Sheet open={mobileSheetOpen && !hideRightPanel} onOpenChange={(open) => {
          if (!open) handleCloseEvent();
        }}>
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
            {selectedEventId && (
              <EventDetailPanel
                eventId={selectedEventId}
                onClose={handleCloseEvent}
                isAdmin={isAdmin}
              />
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
