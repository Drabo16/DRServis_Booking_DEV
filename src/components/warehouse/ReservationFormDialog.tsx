'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  useCreateWarehouseReservation,
  useReserveWarehouseKit,
  useWarehouseItems,
  useWarehouseKits,
} from '@/hooks/useWarehouse';
import { useEvents } from '@/hooks/useEvents';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Layers, Search } from 'lucide-react';

interface ReservationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedEventId?: string;
}

interface SelectedItem {
  id: string;
  type: 'item' | 'kit';
  quantity: number;
}

export default function ReservationFormDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedEventId,
}: ReservationFormDialogProps) {
  const createReservation = useCreateWarehouseReservation();
  const reserveKit = useReserveWarehouseKit();
  const { data: items = [] } = useWarehouseItems();
  const { data: kits = [] } = useWarehouseKits();
  const { data: events = [] } = useEvents();

  const [eventId, setEventId] = useState(preselectedEventId || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isPending, setIsPending] = useState(false);

  // Auto-fill dates from event
  useEffect(() => {
    if (eventId) {
      const event = events.find((e) => e.id === eventId);
      if (event) {
        setStartDate(event.start_time.split('T')[0]);
        setEndDate(event.end_time.split('T')[0]);
      }
    }
  }, [eventId, events]);

  useEffect(() => {
    if (!open) {
      // Reset form
      setEventId(preselectedEventId || '');
      setStartDate('');
      setEndDate('');
      setNotes('');
      setError(null);
      setSearchQuery('');
      setSelectedItems([]);
    }
  }, [open, preselectedEventId]);

  // Filter items and kits based on search
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const filteredKits = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return kits.filter((kit) =>
      kit.name.toLowerCase().includes(query)
    );
  }, [kits, searchQuery]);

  const toggleItem = (id: string, type: 'item' | 'kit') => {
    setSelectedItems((prev) => {
      const existing = prev.find((s) => s.id === id && s.type === type);
      if (existing) {
        return prev.filter((s) => !(s.id === id && s.type === type));
      }
      return [...prev, { id, type, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, type: 'item' | 'kit', quantity: number) => {
    setSelectedItems((prev) =>
      prev.map((s) =>
        s.id === id && s.type === type ? { ...s, quantity: Math.max(1, quantity) } : s
      )
    );
  };

  const isSelected = (id: string, type: 'item' | 'kit') => {
    return selectedItems.some((s) => s.id === id && s.type === type);
  };

  const getQuantity = (id: string, type: 'item' | 'kit') => {
    return selectedItems.find((s) => s.id === id && s.type === type)?.quantity || 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!eventId) {
      setError('Vyberte akci');
      return;
    }

    if (!startDate || !endDate) {
      setError('Zadejte datum od a do');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Vyberte alespoň jeden materiál nebo set');
      return;
    }

    setIsPending(true);

    try {
      // Create all reservations
      const itemReservations = selectedItems.filter((s) => s.type === 'item');
      const kitReservations = selectedItems.filter((s) => s.type === 'kit');

      // Create item reservations
      for (const selected of itemReservations) {
        await createReservation.mutateAsync({
          event_id: eventId,
          item_id: selected.id,
          quantity: selected.quantity,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          notes: notes.trim() || undefined,
        });
      }

      // Create kit reservations
      for (const selected of kitReservations) {
        await reserveKit.mutateAsync({
          kit_id: selected.id,
          event_id: eventId,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          notes: notes.trim() || undefined,
        });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo k chybě');
    } finally {
      setIsPending(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nová rezervace</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {/* Event selection - REQUIRED */}
          <div className="space-y-2">
            <Label>Akce *</Label>
            <Select value={eventId || 'none'} onValueChange={(v) => setEventId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte akci..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Vyberte akci...</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates - auto-filled from event but editable */}
          {eventId && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Od *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Do *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Material/Kit selection */}
          {eventId && (
            <>
              <div className="space-y-2">
                <Label>Materiály a sety</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Hledat materiál nebo set..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 max-h-[300px] border rounded-md overflow-y-auto">
                <div className="p-2 space-y-1">
                  {/* Kits section */}
                  {filteredKits.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                        Sety
                      </div>
                      {filteredKits.map((kit) => (
                        <div
                          key={`kit-${kit.id}`}
                          className={`flex items-center gap-3 p-2 rounded-md hover:bg-slate-50 ${
                            isSelected(kit.id, 'kit') ? 'bg-blue-50' : ''
                          }`}
                        >
                          <Checkbox
                            checked={isSelected(kit.id, 'kit')}
                            onCheckedChange={() => toggleItem(kit.id, 'kit')}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-purple-500 flex-shrink-0" />
                              <span className="font-medium truncate">{kit.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {kit.items?.length || 0} položek
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Items section */}
                  {filteredItems.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase mt-2">
                        Materiály
                      </div>
                      {filteredItems.map((item) => (
                        <div
                          key={`item-${item.id}`}
                          className={`flex items-center gap-3 p-2 rounded-md hover:bg-slate-50 ${
                            isSelected(item.id, 'item') ? 'bg-blue-50' : ''
                          }`}
                        >
                          <Checkbox
                            checked={isSelected(item.id, 'item')}
                            onCheckedChange={() => toggleItem(item.id, 'item')}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <span className="font-medium truncate">{item.name}</span>
                              {item.is_rent && (
                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                  Rent
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {item.quantity_total} {item.unit} celkem
                            </p>
                          </div>
                          {isSelected(item.id, 'item') && (
                            <Input
                              type="number"
                              min={1}
                              max={item.quantity_total}
                              value={getQuantity(item.id, 'item')}
                              onChange={(e) =>
                                updateQuantity(item.id, 'item', parseInt(e.target.value) || 1)
                              }
                              className="w-20 h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {filteredItems.length === 0 && filteredKits.length === 0 && (
                    <div className="py-8 text-center text-slate-500">
                      Žádné položky nenalezeny
                    </div>
                  )}
                </div>
              </div>

              {/* Selected count */}
              {selectedItems.length > 0 && (
                <div className="text-sm text-slate-600">
                  Vybráno: {selectedItems.length} položek
                </div>
              )}
            </>
          )}

          {/* Notes */}
          {eventId && (
            <div className="space-y-2">
              <Label>Poznámky</Label>
              <Textarea
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                rows={2}
                placeholder="Volitelné poznámky..."
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={isPending || !eventId || selectedItems.length === 0}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vytvořit ({selectedItems.length})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
