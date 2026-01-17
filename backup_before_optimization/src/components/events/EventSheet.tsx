'use client';

import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface EventSheetProps {
  eventId: string | null;
  onClose: () => void;
  children: React.ReactNode;
}

export default function EventSheet({ eventId, onClose, children }: EventSheetProps) {
  return (
    <Sheet open={!!eventId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        {children}
      </SheetContent>
    </Sheet>
  );
}
