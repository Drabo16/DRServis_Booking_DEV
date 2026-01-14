import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import { formatDateRange } from '@/lib/utils';
import type { Event } from '@/types';

interface EventCardProps {
  event: Event & {
    positions?: Array<{
      id: string;
      assignments?: Array<{ id: string; attendance_status: string }>;
    }>;
  };
  onOpen?: (id: string) => void;
}

export default function EventCard({ event, onOpen }: EventCardProps) {
  const positions = event.positions || [];
  const totalPositions = positions.length;
  // Pozice je obsazená pouze když má assignment se statusem 'accepted'
  const filledPositions = positions.filter(
    (p) => p.assignments && p.assignments.some((a) => a.attendance_status === 'accepted')
  ).length;
  const fillPercentage = totalPositions > 0 ? Math.round((filledPositions / totalPositions) * 100) : 0;

  const getFillColor = () => {
    if (fillPercentage === 100) return 'text-green-600';
    if (fillPercentage >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getFillBgColor = () => {
    if (fillPercentage === 100) return 'bg-green-100';
    if (fillPercentage >= 50) return 'bg-amber-100';
    return 'bg-red-100';
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpen?.(event.id)}
    >
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold line-clamp-1">{event.title}</CardTitle>
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

          {totalPositions > 0 && (
            <div className="pt-1.5 border-t space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Obsazení</span>
                </div>
                <span className={`font-semibold ${getFillColor()}`}>
                  {filledPositions}/{totalPositions}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all ${fillPercentage === 100 ? 'bg-green-600' : fillPercentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${fillPercentage}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
    </Card>
  );
}
