'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';

interface EventDetailSheetProps {
  eventId: string | null;
  onClose: () => void;
}

export default function EventDetailSheet({ eventId, onClose }: EventDetailSheetProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (eventId) {
      setLoading(true);
      // Simulace načítání - v skutečnosti se iframe postará o načtení
      setTimeout(() => setLoading(false), 500);
    }
  }, [eventId]);

  return (
    <Sheet open={!!eventId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-hidden p-0">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}
        {!loading && eventId && (
          <iframe
            src={`/events/${eventId}`}
            className="w-full h-full border-0"
            title="Event Detail"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
