import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, CheckCircle2, FolderOpen } from 'lucide-react';
import { formatDateRange } from '@/lib/utils';
import type { Event } from '@/types';

interface EventCardProps {
  event: Event & {
    positions?: Array<{
      id: string;
      assignments?: Array<{ id: string; attendance_status: string }>;
    }>;
    drive_folder_id?: string | null;
    google_event_id?: string | null;
  };
  onOpen?: (id: string) => void;
}

function EventCard({ event, onOpen }: EventCardProps) {
  // Použij useMemo pro výpočet statistik - počítá se pouze když se změní positions
  const stats = useMemo(() => {
    const positions = event.positions || [];
    const totalPositions = positions.length;
    const filledPositions = positions.filter(
      (p) => p.assignments && p.assignments.some((a) => a.attendance_status === 'accepted')
    ).length;
    const fillPercentage = totalPositions > 0 ? Math.round((filledPositions / totalPositions) * 100) : 0;

    return {
      totalPositions,
      filledPositions,
      fillPercentage,
    };
  }, [event.positions]);

  // Memoizované color getters
  const fillColor = useMemo(() => {
    if (stats.fillPercentage === 100) return 'text-green-600';
    if (stats.fillPercentage >= 50) return 'text-amber-600';
    return 'text-red-600';
  }, [stats.fillPercentage]);

  const progressBarColor = useMemo(() => {
    if (stats.fillPercentage === 100) return 'bg-green-600';
    if (stats.fillPercentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  }, [stats.fillPercentage]);

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpen?.(event.id)}
    >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold line-clamp-1 flex-1">{event.title}</CardTitle>
            {/* Status icons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {event.drive_folder_id && (
                <div
                  className="p-1 rounded text-green-600 bg-green-50"
                  title="Drive složka vytvořena"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </div>
              )}
              {event.google_event_id && (
                <div
                  className="p-1 rounded text-blue-600 bg-blue-50"
                  title="Synchronizováno s kalendářem"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDateRange(event.start_time, event.end_time)}</span>
          </div>

          {event.location && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <MapPin className="w-3.5 h-3.5" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}

          {stats.totalPositions > 0 && (
            <div className="pt-1.5 border-t space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Obsazení</span>
                </div>
                <span className={`font-semibold ${fillColor}`}>
                  {stats.filledPositions}/{stats.totalPositions}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all ${progressBarColor}`}
                  style={{ width: `${stats.fillPercentage}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
    </Card>
  );
}

// React.memo prevents re-renders when props haven't changed
export default memo(EventCard);
