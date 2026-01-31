'use client';

import { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent, ToolbarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useRouter } from 'next/navigation';
import { Event } from '@/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './calendar.css';

const locales = {
  cs: cs,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
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

      const startDate = new Date(event.start_time);
      let endDate = new Date(event.end_time);

      // For all-day events from Google Calendar (end time is midnight UTC of next day)
      // Google Calendar sets end to midnight of the day AFTER the event ends
      // So a 2-day event (Jan 1-2) has end_time at Jan 3 00:00:00
      // We need to subtract 1ms to get the actual last day (Jan 2 23:59:59)
      if (endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0 && endDate.getUTCSeconds() === 0) {
        // Subtract 1 millisecond to get the end of the actual last day
        endDate = new Date(endDate.getTime() - 1);
      }

      // Make sure end date is at least the same as start date
      if (endDate < startDate) {
        endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59);
      }

      return {
        title: `${event.title} (${fillRate.filled}/${fillRate.total})`,
        start: startDate,
        end: endDate,
        allDay: true, // Treat all events as all-day for proper multi-day spanning
        resource: { event, fillRate },
      };
    });
  }, [events, getEventFillRate]);

  // Calculate max events per day for dynamic height
  const maxEventsPerDay = useMemo(() => {
    const eventsByDay: Record<string, number> = {};
    calendarEvents.forEach(event => {
      // Count events for each day they span
      const start = new Date(event.start as Date);
      const end = new Date(event.end as Date);
      const current = new Date(start);
      while (current <= end) {
        const dayKey = current.toISOString().split('T')[0];
        eventsByDay[dayKey] = (eventsByDay[dayKey] || 0) + 1;
        current.setDate(current.getDate() + 1);
      }
    });
    return Math.max(3, ...Object.values(eventsByDay)); // Minimum 3 events per row
  }, [calendarEvents]);

  // Memoizovaný handler
  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    const { event: originalEvent } = event.resource as { event: Event; fillRate: any };
    if (onEventClick) {
      onEventClick(originalEvent.id);
    } else {
      router.push(`/events/${originalEvent.id}`);
    }
  }, [onEventClick, router]);

  // Memoizovaný style getter
  const eventStyleGetter = useCallback((event: BigCalendarEvent) => {
    const { event: originalEvent, fillRate } = event.resource as { event: Event; fillRate: any };

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

  // Vlastní toolbar pouze s navigací měsíců
  const CustomToolbar = useCallback(({ label, onNavigate }: ToolbarProps) => {
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

  // Dynamic height based on max events per day (each event ~24px + header ~40px + padding)
  const dynamicHeight = useMemo(() => {
    const baseRowHeight = 40; // Header row
    const eventHeight = 26; // Height per event
    const rows = 6; // Max rows in month view
    const headerHeight = 80; // Toolbar + day headers
    const minHeight = 500;

    const calculatedHeight = headerHeight + (rows * (baseRowHeight + (maxEventsPerDay * eventHeight)));
    return Math.max(minHeight, Math.min(calculatedHeight, 1200)); // Cap at 1200px
  }, [maxEventsPerDay]);

  return (
    <div
      className="bg-white p-2 sm:p-4 rounded-lg shadow-sm"
      style={{ minHeight: `${dynamicHeight}px` }}
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
        popup={false}
        components={components}
        dayPropGetter={() => ({
          style: {
            minHeight: `${40 + maxEventsPerDay * 26}px`,
          },
        })}
      />
    </div>
  );
}
