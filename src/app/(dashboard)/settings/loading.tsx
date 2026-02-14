import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LoadingSettings() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Config Card Skeleton */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="h-8 w-1/4 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                <div className="h-3 w-48 bg-slate-200 animate-pulse rounded" />
              </div>
              <div className="h-8 w-24 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-slate-200 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sync Card Skeleton */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="h-6 w-1/4 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/3 bg-slate-200 animate-pulse rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-48 bg-slate-200 animate-pulse rounded" />
          </div>
          <div className="h-10 w-32 bg-slate-200 animate-pulse rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
