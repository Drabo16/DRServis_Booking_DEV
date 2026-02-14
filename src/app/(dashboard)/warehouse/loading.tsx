import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LoadingWarehouse() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Warehouse Table Skeleton */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="h-8 w-1/4 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/3 bg-slate-200 animate-pulse rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table Header */}
          <div className="flex items-center gap-4 p-3 border-b">
            <div className="h-4 w-1/6 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/4 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/6 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/6 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-1/8 bg-slate-200 animate-pulse rounded" />
          </div>
          {/* Table Rows */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
              <div className="h-4 w-1/6 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-1/4 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-1/6 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-1/6 bg-slate-200 animate-pulse rounded" />
              <div className="h-8 w-16 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
