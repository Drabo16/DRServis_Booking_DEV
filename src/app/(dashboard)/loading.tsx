import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LoadingDashboard() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Dashboard Header Skeleton */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="h-8 w-1/3 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/4 bg-slate-200 animate-pulse rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Event Row Skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
              <div className="w-10 h-10 bg-slate-200 animate-pulse rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
                <div className="h-3 w-1/3 bg-slate-200 animate-pulse rounded" />
              </div>
              <div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" />
              <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
