'use client';

import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />
    </ErrorBoundary>
  );
}
