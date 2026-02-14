import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LoadingOffers() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
        <div className="h-10 w-36 bg-slate-200 animate-pulse rounded" />
      </div>

      {/* Offer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-6 w-1/2 bg-slate-200 animate-pulse rounded" />
                  <div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" />
                </div>
                <div className="h-4 w-2/3 bg-slate-200 animate-pulse rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded" />
              <div className="flex items-center justify-between pt-2">
                <div className="h-5 w-24 bg-slate-200 animate-pulse rounded" />
                <div className="h-8 w-20 bg-slate-200 animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
