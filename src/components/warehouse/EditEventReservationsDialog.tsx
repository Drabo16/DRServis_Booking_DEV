'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  useWarehouseReservations,
  useCreateWarehouseReservation,
  useUpdateWarehouseReservation,
  useDeleteWarehouseReservation,
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Package,
  Layers,
  Search,
  Trash2,
  Plus,
  Calendar,
  MapPin,
  Clock,
  Save,
} from 'lucide-react';

interface EditEventReservationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSuccess?: () => void;
}

interface ReservationChange {
  id?: string; // undefined = new reservation
  item_id: string;
  quantity: number;
  isNew?: boolean;
  isDeleted?: boolean;
  originalQuantity?: number;
}

export default function EditEventReservationsDialog({
  open,
  onOpenChange,
  eventId,
  onSuccess,
}: EditEventReservationsDialogProps) {
  const { data: allReservations = [] } = useWarehouseReservations({ event_id: eventId });
  const { data: items = [] } = useWarehouseItems();
  const { data: kits = [] } = useWarehouseKits();
  const { data: events = [] } = useEvents();
  const createReservation = useCreateWarehouseReservation();
  const updateReservation = useUpdateWarehouseReservation();
  const deleteReservation = useDeleteWarehouseReservation();
  const reserveKit = useReserveWarehouseKit();

  const [searchQuery, setSearchQuery] = useState('');
  const [changes, setChanges] = useState<Map<string, ReservationChange>>(new Map());
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const event = events.find((e) => e.id === eventId);
  const eventReservations = allReservations.filter((r) => r.event_id === eventId);

  // Initialize changes from existing reservations
  useEffect(() => {
    if (open && eventReservations.length > 0) {
      const initialChanges = new Map<string, ReservationChange>();
      for (const res of eventReservations) {
        initialChanges.set(res.id, {
          id: res.id,
          item_id: res.item_id,
          quantity: res.quantity,
          originalQuantity: res.quantity,
        });
      }
      setChanges(initialChanges);
    }
  }, [open, eventReservations.length]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setChanges(new Map());
      setError(null);
    }
  }, [open]);

  // Get current state of each item (existing + changes)
  const currentItemStates = useMemo(() => {
    const states = new Map<string, { reservationId?: string; quantity: number; isNew?: boolean; isDeleted?: boolean }>();

    // First, add all existing reservations
    for (const res of eventReservations) {
      const change = changes.get(res.id);
      if (change?.isDeleted) {
        // Skip deleted
        continue;
      }
      states.set(res.item_id, {
        reservationId: res.id,
        quantity: change?.quantity ?? res.quantity,
      });
    }

    // Add new items from changes
    for (const [key, change] of changes) {
      if (change.isNew && !change.isDeleted) {
        states.set(change.item_id, {
          quantity: change.quantity,
          isNew: true,
        });
      }
    }

    return states;
  }, [eventReservations, changes]);

  // Filter items for adding new ones
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(query);
      const notAlreadyReserved = !currentItemStates.has(item.id);
      return matchesSearch && notAlreadyReserved;
    });
  }, [items, searchQuery, currentItemStates]);

  const filteredKits = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return kits.filter((kit) => kit.name.toLowerCase().includes(query));
  }, [kits, searchQuery]);

  const updateQuantity = (itemId: string, quantity: number) => {
    const state = currentItemStates.get(itemId);
    if (!state) return;

    if (state.reservationId) {
      // Existing reservation
      setChanges((prev) => {
        const next = new Map(prev);
        const existing = next.get(state.reservationId!);
        next.set(state.reservationId!, {
          ...existing!,
          quantity: Math.max(1, quantity),
        });
        return next;
      });
    } else {
      // New reservation - find by item_id
      setChanges((prev) => {
        const next = new Map(prev);
        for (const [key, change] of next) {
          if (change.isNew && change.item_id === itemId) {
            next.set(key, { ...change, quantity: Math.max(1, quantity) });
            break;
          }
        }
        return next;
      });
    }
  };

  const removeItem = (itemId: string) => {
    const state = currentItemStates.get(itemId);
    if (!state) return;

    if (state.reservationId) {
      // Mark existing for deletion
      setChanges((prev) => {
        const next = new Map(prev);
        const existing = next.get(state.reservationId!);
        next.set(state.reservationId!, {
          ...existing!,
          isDeleted: true,
        });
        return next;
      });
    } else {
      // Remove new item
      setChanges((prev) => {
        const next = new Map(prev);
        for (const [key, change] of next) {
          if (change.isNew && change.item_id === itemId) {
            next.delete(key);
            break;
          }
        }
        return next;
      });
    }
  };

  const addItem = (itemId: string) => {
    const tempId = `new-${Date.now()}-${itemId}`;
    setChanges((prev) => {
      const next = new Map(prev);
      next.set(tempId, {
        item_id: itemId,
        quantity: 1,
        isNew: true,
      });
      return next;
    });
  };

  const addKit = async (kitId: string) => {
    if (!event) return;

    setIsPending(true);
    setError(null);

    try {
      await reserveKit.mutateAsync({
        kit_id: kitId,
        event_id: eventId,
        start_date: event.start_time,
        end_date: event.end_time,
      });
      // The query will auto-refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při přidávání setu');
    } finally {
      setIsPending(false);
    }
  };

  const handleSave = async () => {
    if (!event) return;

    setIsPending(true);
    setError(null);

    try {
      const promises: Promise<unknown>[] = [];

      for (const [key, change] of changes) {
        if (change.isNew && !change.isDeleted) {
          // Create new reservation
          promises.push(
            createReservation.mutateAsync({
              event_id: eventId,
              item_id: change.item_id,
              quantity: change.quantity,
              start_date: event.start_time,
              end_date: event.end_time,
            })
          );
        } else if (change.isDeleted && change.id) {
          // Delete existing
          promises.push(deleteReservation.mutateAsync(change.id));
        } else if (change.id && change.quantity !== change.originalQuantity) {
          // Update quantity
          promises.push(
            updateReservation.mutateAsync({
              id: change.id,
              data: { quantity: change.quantity },
            })
          );
        }
      }

      await Promise.all(promises);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo k chybě při ukládání');
    } finally {
      setIsPending(false);
    }
  };

  const hasChanges = useMemo(() => {
    for (const [, change] of changes) {
      if (change.isNew || change.isDeleted) return true;
      if (change.quantity !== change.originalQuantity) return true;
    }
    return false;
  }, [changes]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get item details
  const getItem = (itemId: string) => items.find((i) => i.id === itemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upravit rezervace
          </DialogTitle>
          {event && (
            <div className="text-sm text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span className="font-medium text-slate-700">{event.title}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(event.start_time)}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {event.location}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {/* Current reservations */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Aktuální rezervace</Label>
            {currentItemStates.size === 0 ? (
              <div className="text-sm text-slate-500 p-4 text-center border rounded-md bg-slate-50">
                Žádné rezervace pro tuto akci
              </div>
            ) : (
              <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                {Array.from(currentItemStates.entries()).map(([itemId, state]) => {
                  const item = getItem(itemId);
                  if (!item) return null;

                  return (
                    <div
                      key={itemId}
                      className="flex items-center justify-between p-3 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <span>{item.quantity_total} {item.unit} celkem</span>
                            {state.isNew && (
                              <Badge variant="secondary" className="text-[10px]">
                                Nové
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={item.quantity_total}
                          value={state.quantity}
                          onChange={(e) =>
                            updateQuantity(itemId, parseInt(e.target.value) || 1)
                          }
                          className="w-20 h-8"
                        />
                        <span className="text-xs text-slate-500 w-8">{item.unit}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => removeItem(itemId)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add new items */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Přidat materiály</Label>
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

          {/* Available items and kits */}
          <div className="flex-1 min-h-0 max-h-[250px] border rounded-md overflow-y-auto">
            <div className="p-2 space-y-1">
              {/* Kits section */}
              {filteredKits.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                    Sety (přidá všechny položky najednou)
                  </div>
                  {filteredKits.map((kit) => (
                    <div
                      key={`kit-${kit.id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <span className="font-medium truncate">{kit.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {kit.items?.length || 0} položek
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addKit(kit.id)}
                        disabled={isPending}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Přidat
                      </Button>
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
                      className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium truncate block">{item.name}</span>
                          <span className="text-xs text-slate-500">
                            {item.quantity_total} {item.unit} celkem
                          </span>
                        </div>
                        {item.is_rent && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            Rent
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addItem(item.id)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Přidat
                      </Button>
                    </div>
                  ))}
                </>
              )}

              {filteredItems.length === 0 && filteredKits.length === 0 && searchQuery && (
                <div className="py-8 text-center text-slate-500">
                  Žádné položky nenalezeny
                </div>
              )}

              {filteredItems.length === 0 && filteredKits.length === 0 && !searchQuery && (
                <div className="py-8 text-center text-slate-500">
                  Vyhledejte materiál nebo set
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button onClick={handleSave} disabled={isPending || !hasChanges}>
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Uložit změny
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
