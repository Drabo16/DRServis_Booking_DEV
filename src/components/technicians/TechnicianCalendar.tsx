'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent, ToolbarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Loader2, User, Calendar as CalendarIcon } from 'lucide-react';
import type { Profile } from '@/types';
import '../calendar/calendar.css';

// Czech month names in nominative case
const CZECH_MONTHS_NOMINATIVE = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

const locales = { cs };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface TechnicianAssignment {
  id: string;
  attendance_status: string;
  start_date: string | null;
  end_date: string | null;
  position: {
    id: string;
    title: string;
    role_type: string;
  };
  event: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: string | null;
    status: string;
  };
}

interface TechnicianCalendarProps {
  allTechnicians: Profile[];
}

export default function TechnicianCalendar({ allTechnicians }: TechnicianCalendarProps) {
  const router = useRouter();
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch technician assignments - only refetch when technician changes, not on date navigation
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['technician', 'calendar', selectedTechnicianId],
    queryFn: async () => {
      if (!selectedTechnicianId) return { assignments: [] };

      // Fetch a wide date range to avoid refetching on navigation
      const response = await fetch(`/api/technicians/calendar?technician_id=${selectedTechnicianId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json() as Promise<{ assignments: TechnicianAssignment[] }>;
    },
    enabled: !!selectedTechnicianId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  const selectedTechnician = useMemo(() =>
    allTechnicians.find(t => t.id === selectedTechnicianId),
    [allTechnicians, selectedTechnicianId]
  );

  // Transform assignments to calendar events
  const calendarEvents: BigCalendarEvent[] = useMemo(() => {
    if (!data?.assignments) return [];

    return data.assignments.map((assignment) => {
      // Use assignment-specific dates if available, otherwise use event dates
      const startDateStr = assignment.start_date || assignment.event.start_time;
      const endDateStr = assignment.end_date || assignment.event.end_time;

      const startDateUTC = new Date(startDateStr);
      const endDateUTC = new Date(endDateStr);

      // Check if all-day event
      const isAllDayEvent =
        startDateUTC.getUTCHours() === 0 &&
        startDateUTC.getUTCMinutes() === 0 &&
        endDateUTC.getUTCHours() === 0 &&
        endDateUTC.getUTCMinutes() === 0;

      let startDate: Date;
      let endDate: Date;

      if (isAllDayEvent) {
        startDate = new Date(
          startDateUTC.getUTCFullYear(),
          startDateUTC.getUTCMonth(),
          startDateUTC.getUTCDate()
        );
        endDate = new Date(
          endDateUTC.getUTCFullYear(),
          endDateUTC.getUTCMonth(),
          endDateUTC.getUTCDate()
        );
      } else {
        startDate = startDateUTC;
        endDate = endDateUTC;
      }

      return {
        title: `${assignment.event.title} (${assignment.position.title})`,
        start: startDate,
        end: endDate,
        allDay: isAllDayEvent,
        resource: { assignment },
      };
    });
  }, [data]);

  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    const { assignment } = event.resource as { assignment: TechnicianAssignment };
    router.push(`/events/${assignment.event.id}`);
  }, [router]);

  const eventStyleGetter = useCallback((event: BigCalendarEvent) => {
    const { assignment } = event.resource as { assignment: TechnicianAssignment };

    let backgroundColor = '#334155'; // slate-700 default

    switch (assignment.attendance_status) {
      case 'accepted':
        backgroundColor = '#16a34a'; // green-600
        break;
      case 'pending':
        backgroundColor = '#f59e0b'; // amber-500
        break;
      case 'tentative':
        backgroundColor = '#3b82f6'; // blue-500
        break;
      case 'declined':
        backgroundColor = '#dc2626'; // red-600
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.875rem',
        padding: '2px 6px',
      },
    };
  }, []);

  const messages = useMemo(() => ({
    allDay: 'Celý den',
    previous: 'Předchozí',
    next: 'Další',
    today: 'Dnes',
    month: 'Měsíc',
    week: 'Týden',
    day: 'Den',
    agenda: 'Agenda',
    date: 'Datum',
    time: 'Čas',
    event: 'Akce',
    noEventsInRange: 'V tomto období nejsou žádné akce',
    showMore: (total: number) => `+ další (${total})`,
  }), []);

  const CustomToolbar = useCallback(({ date, onNavigate }: ToolbarProps) => {
    const month = CZECH_MONTHS_NOMINATIVE[date.getMonth()];
    const year = date.getFullYear();
    const label = `${month} ${year}`;

    return (
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('PREV')}
          className="px-2 sm:px-3"
        >
          <ChevronLeft className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Předchozí</span>
        </Button>
        <h2 className="text-sm sm:text-lg font-semibold text-slate-900">{label}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('NEXT')}
          className="px-2 sm:px-3"
        >
          <span className="hidden sm:inline">Další</span>
          <ChevronRight className="w-4 h-4 sm:ml-1" />
        </Button>
      </div>
    );
  }, []);

  const components = useMemo(() => ({
    toolbar: CustomToolbar,
  }), [CustomToolbar]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Kalendář technika
          </CardTitle>
        </div>

        {/* Technician selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <User className="w-4 h-4 text-slate-400" />
            <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Vyberte technika..." />
              </SelectTrigger>
              <SelectContent>
                {allTechnicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    <div className="flex items-center gap-2">
                      <span>{tech.full_name}</span>
                      {!tech.is_drservis && (
                        <Badge variant="outline" className="text-xs">Externí</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTechnician && (
            <div className="flex gap-2">
              <Badge variant="secondary">{selectedTechnician.email}</Badge>
              {selectedTechnician.specialization && selectedTechnician.specialization.length > 0 && (
                <Badge variant="outline">{selectedTechnician.specialization.join(', ')}</Badge>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        {selectedTechnicianId && (
          <div className="flex flex-wrap gap-3 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-600" />
              <span>Potvrzeno</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span>Čeká na odpověď</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Předběžně</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-600" />
              <span>Odmítnuto</span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-2 sm:p-6">
        {!selectedTechnicianId ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <User className="w-16 h-16 mb-4" />
            <p className="text-lg">Vyberte technika pro zobrazení jeho kalendáře</p>
          </div>
        ) : isLoading && !data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div
            className="bg-white rounded-lg calendar-container relative"
            style={{ height: '750px' }}
          >
            {isFetching && (
              <div className="absolute top-2 right-2 z-10">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            )}
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              messages={messages}
              culture="cs"
              views={['month']}
              defaultView="month"
              popup
              components={components}
              style={{ height: '100%' }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
