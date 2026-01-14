import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LoadingEventDetail() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Event Header Skeleton */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="h-8 w-3/4 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-slate-200 animate-pulse rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-slate-200 animate-pulse rounded" />
                  <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Positions Section Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
          <div className="h-10 w-40 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 w-1/2 bg-slate-200 animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-slate-200 animate-pulse rounded" />
                  <div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
