import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LoadingCalendar() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Calendar Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="h-8 w-40 bg-slate-200 animate-pulse rounded" />
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 bg-slate-200 animate-pulse rounded" />
              <div className="h-10 w-32 bg-slate-200 animate-pulse rounded" />
              <div className="h-10 w-10 bg-slate-200 animate-pulse rounded" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Calendar Day Headers */}
          <div className="grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-6 bg-slate-200 animate-pulse rounded" />
            ))}
          </div>
          {/* Calendar Grid */}
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                <div key={col} className="h-24 bg-slate-200 animate-pulse rounded" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
