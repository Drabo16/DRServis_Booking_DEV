'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function EventCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-3/4" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="pt-1.5 border-t space-y-1">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EventCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}
