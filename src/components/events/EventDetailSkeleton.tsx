'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function EventDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Close button area */}
      <div className="flex justify-end">
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      {/* Event Header Card */}
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Date */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>

            {/* Drive folder */}
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-28" />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Skeleton className="h-20 w-full rounded" />
                  <Skeleton className="h-20 w-full rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Skeleton className="h-9 w-32 rounded" />
            <Skeleton className="h-9 w-32 rounded" />
          </div>
        </CardContent>
      </Card>

      {/* Positions Section */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-24 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
