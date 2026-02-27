'use client';

import { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent, ToolbarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useRouter } from 'next/navigation';
import { Event } from '@/types';
import { Button } from '@/components/ui/button';

interface FillRate {
  filled: number;
  total: number;
  percentage: number;
}
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './calendar.css';

// Czech month names in nominative case (1st case) - for headers
const CZECH_MONTHS_NOMINATIVE = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

const locales = {
  cs: cs,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }), // Monday start
  getDay,
  locales,
});

interface CalendarViewProps {
  events: Array<Event & {
    positions?: Array<{
      id: string;
      assignments?: Array<{ id: string; attendance_status: string }>;
    }>;
  }>;
  onEventClick?: (eventId: string) => void;
}

export default function CalendarView({ events, onEventClick }: CalendarViewProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Memoizovaný výpočet fill rate - přepočítá se pouze když se změní events array
  const getEventFillRate = useCallback((event: typeof events[0]) => {
    const positions = event.positions || [];
    const totalPositions = positions.length;
    if (totalPositions === 0) return { filled: 0, total: 0, percentage: 0 };

    const filledPositions = positions.filter(
      (p) => p.assignments && p.assignments.some((a) => a.attendance_status === 'accepted')
    ).length;

    return {
      filled: filledPositions,
      total: totalPositions,
      percentage: Math.round((filledPositions / totalPositions) * 100),
    };
  }, []);

  // Transformace events do formátu pro react-big-calendar
  // POUŽIJ useMemo - přepočítá se POUZE když se změní events array
  const calendarEvents: BigCalendarEvent[] = useMemo(() => {
    return events.map((event) => {
      const fillRate = getEventFillRate(event);

      // Parse dates - Google Calendar uses exclusive end dates for all-day events
      // e.g., single-day event on Jan 15 has end_time at Jan 16 00:00:00
      const startDateUTC = new Date(event.start_time);
      const endDateUTC = new Date(event.end_time);

      // Check if this is an all-day event (midnight UTC times)
      const isAllDayEvent =
        startDateUTC.getUTCHours() === 0 &&
        startDateUTC.getUTCMinutes() === 0 &&
        endDateUTC.getUTCHours() === 0 &&
        endDateUTC.getUTCMinutes() === 0;

      let startDate: Date;
      let endDate: Date;

      if (isAllDayEvent) {
        // For all-day events, create LOCAL dates to avoid timezone issues
        // Use the UTC date components directly to create local dates
        startDate = new Date(
          startDateUTC.getUTCFullYear(),
          startDateUTC.getUTCMonth(),
          startDateUTC.getUTCDate()
        );

        // React-big-calendar also uses EXCLUSIVE end dates for all-day events
        // Google: event Feb 5-8 inclusive → end=Feb 9 00:00 UTC (exclusive)
        // RBC: same, end should be the day AFTER the last visible day
        // So we pass Google's end date directly (no subtraction needed)
        endDate = new Date(
          endDateUTC.getUTCFullYear(),
          endDateUTC.getUTCMonth(),
          endDateUTC.getUTCDate()
        );
      } else {
        // For timed events, use the dates as-is
        startDate = startDateUTC;
        endDate = endDateUTC;
      }

      return {
        title: `${event.title} (${fillRate.filled}/${fillRate.total})`,
        start: startDate,
        end: endDate,
        allDay: isAllDayEvent,
        resource: { event, fillRate },
      };
    });
  }, [events, getEventFillRate]);

  // Calculate max events per day for dynamic height
  const maxEventsPerDay = useMemo(() => {
    if (calendarEvents.length === 0) return 3;

    const eventsByDay: Record<string, number> = {};
    calendarEvents.forEach(event => {
      // Count events for each day they span
      const start = new Date(event.start as Date);
      const end = new Date(event.end as Date);

      // Safety: limit to 30 days max to prevent infinite loops
      const maxIterations = 30;
      let iterations = 0;
      const current = new Date(start);

      while (current <= end && iterations < maxIterations) {
        const dayKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        eventsByDay[dayKey] = (eventsByDay[dayKey] || 0) + 1;
        current.setDate(current.getDate() + 1);
        iterations++;
      }
    });

    const counts = Object.values(eventsByDay);
    return counts.length > 0 ? Math.max(3, ...counts) : 3;
  }, [calendarEvents]);

  // Memoizovaný handler
  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    const { event: originalEvent } = event.resource as { event: Event; fillRate: FillRate };
    if (onEventClick) {
      onEventClick(originalEvent.id);
    } else {
      router.push(`/events/${originalEvent.id}`);
    }
  }, [onEventClick, router]);

  // Memoizovaný style getter
  const eventStyleGetter = useCallback((event: BigCalendarEvent) => {
    const { event: originalEvent, fillRate } = event.resource as { event: Event; fillRate: FillRate };

    let backgroundColor = '#334155'; // slate-700 default

    // Barva podle obsazenosti
    if (fillRate.percentage === 100) {
      backgroundColor = '#16a34a'; // green-600
    } else if (fillRate.percentage >= 50) {
      backgroundColor = '#f59e0b'; // amber-500
    } else if (fillRate.total > 0) {
      backgroundColor = '#dc2626'; // red-600
    } else {
      // Žádné pozice - použij status
      if (originalEvent.status === 'confirmed') {
        backgroundColor = '#0f172a'; // slate-900
      } else if (originalEvent.status === 'tentative') {
        backgroundColor = '#64748b'; // slate-500
      } else if (originalEvent.status === 'cancelled') {
        backgroundColor = '#ef4444'; // red-500
      }
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

  // Vlastní toolbar pouze s navigací měsíců - používá 1. pád pro měsíce
  const CustomToolbar = useCallback(({ date, onNavigate }: ToolbarProps) => {
    // Format month in nominative case (1st case in Czech)
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

  // Memoizované komponenty objekty
  const components = useMemo(() => ({
    toolbar: CustomToolbar,
  }), [CustomToolbar]);

  // Dynamic height based on max events per day
  const { dynamicHeight, rowHeight } = useMemo(() => {
    const dateHeaderHeight = 28; // Date number in each cell
    const eventHeight = 24; // Height per event
    const eventGap = 2; // Gap between events
    const rows = 6; // Max rows in month view
    const toolbarHeight = 80; // Toolbar + day headers
    const minHeight = 500;

    // Calculate row height to fit all events + date header + some padding
    const calculatedRowHeight = dateHeaderHeight + (maxEventsPerDay * (eventHeight + eventGap)) + 10;
    const minRowHeight = 100; // Minimum row height
    const finalRowHeight = Math.max(minRowHeight, calculatedRowHeight);

    // Total height = toolbar + day headers (40px) + (rows * rowHeight)
    const calculatedHeight = toolbarHeight + 40 + (rows * finalRowHeight);
    const finalHeight = Math.max(minHeight, Math.min(calculatedHeight, 1500)); // Cap at 1500px

    return { dynamicHeight: finalHeight, rowHeight: finalRowHeight };
  }, [maxEventsPerDay]);

  // CSS custom property for dynamic row height
  const calendarStyle = useMemo(() => ({
    '--rbc-row-height': `${rowHeight}px`,
  } as React.CSSProperties), [rowHeight]);

  return (
    <div
      className="bg-white p-2 sm:p-4 rounded-lg shadow-sm calendar-container"
      style={{ height: `${dynamicHeight}px`, ...calendarStyle }}
    >
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
  );
}
