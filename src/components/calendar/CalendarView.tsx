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

      // Fix for Google Calendar all-day events: end time is midnight UTC of next day
      let endDate = new Date(event.end_time);
      if (endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0 && endDate.getUTCSeconds() === 0) {
        // For calendar display, we need to keep the end at midnight for proper rendering
        // but react-big-calendar treats end date as exclusive, so this is correct
        // However, we need to check if start and end are on consecutive days (single-day event)
        const startDate = new Date(event.start_time);
        const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

        // If end is exactly one day after start (all-day single-day event), adjust
        const diffDays = (endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          // Single day event - set end to end of the same day
          endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59);
        }
      }

      return {
        title: `${event.title} (${fillRate.filled}/${fillRate.total})`,
        start: new Date(event.start_time),
        end: endDate,
        resource: { event, fillRate },
      };
    });
  }, [events, getEventFillRate]);

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

  return (
    <div className="bg-white p-2 sm:p-4 rounded-lg shadow-sm h-[500px] sm:h-[600px] md:h-[800px]">
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
      />
    </div>
  );
}
