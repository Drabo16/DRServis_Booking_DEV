'use client';

import { useState } from 'react';
import { useCreateOffer } from '@/hooks/useOffers';
import { useEvents } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface OfferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (offer: { id: string }) => void;
}

export default function OfferFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: OfferFormDialogProps) {
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const { data: events = [] } = useEvents();
  const createOffer = useCreateOffer();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    try {
      const result = await createOffer.mutateAsync({
        title: title.trim(),
        event_id: eventId || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess(result.offer);
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
  };

  // When event is selected, use its title as default
  const handleEventChange = (value: string) => {
    setEventId(value === 'none' ? '' : value);
    if (value && value !== 'none' && !title) {
      const event = events.find(e => e.id === value);
      if (event) {
        setTitle(event.title);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nová nabídka</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event">Akce (nepovinné)</Label>
            <Select value={eventId || 'none'} onValueChange={handleEventChange}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte akci..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez akce</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Název nabídky *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="např. Zeelandia, Festival XY..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Poznámky</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interní poznámky k nabídce..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={!title.trim() || createOffer.isPending}>
              {createOffer.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Vytvořit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
