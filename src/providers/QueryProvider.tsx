'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, lazy, Suspense } from 'react';

// Lazy load DevTools only in development - reduces production bundle significantly
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((mod) => ({
    default: mod.ReactQueryDevtools,
  }))
);

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is fresh for 30 seconds - after that it will refetch on mount
            staleTime: 30 * 1000, // 30 seconds
            gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
            // Retry failed requests
            retry: 2,
            // Refetch on window focus for live data
            refetchOnWindowFocus: true,
            // Refetch on reconnect
            refetchOnReconnect: true,
            // IMPORTANT: Refetch when component mounts if data is stale
            refetchOnMount: true,
            // Structural sharing for better performance
            structuralSharing: true,
          },
          mutations: {
            // Don't retry mutations - user should retry manually
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
