'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, ChevronRight, ChevronLeft, Minus, Plus, Check, X } from 'lucide-react';
import { useCheckAvailabilityMutation, useUpdateWarehouseReservation, warehouseKeys } from '@/hooks/useWarehouse';
import { useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { cs } from 'date-fns/locale';
import type { ItemAvailability } from '@/types/warehouse';

interface ConflictManagerProps {
  isAdmin: boolean;
}

// Conflict group - items with overlapping reservations
interface ConflictGroup {
  item: ItemAvailability;
  reservationsByEvent: Map<string, {
    eventId: string | null;
    eventTitle: string;
    reservationId: string;
    quantity: number;
    startDate: string;
    endDate: string;
  }[]>;
  totalNeeded: number;
  shortage: number;
}

export default function ConflictManager({ isAdmin }: ConflictManagerProps) {
  const queryClient = useQueryClient();
  const [daysAhead, setDaysAhead] = useState(30);
  const [editingReservation, setEditingReservation] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);

  const checkAvailability = useCheckAvailabilityMutation();
  const updateReservation = useUpdateWarehouseReservation();

  // Calculate date range
  const dateRange = useMemo(() => {
    const start = new Date();
    const end = addDays(start, daysAhead);
    return {
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
    };
  }, [daysAhead]);

  // Fetch conflicts on mount and when date range changes
  const { data, isPending } = checkAvailability;

  // Load conflicts
  const loadConflicts = useCallback(() => {
    checkAvailability.mutate(dateRange);
  }, [checkAvailability, dateRange]);

  // Initial load
  useState(() => {
    loadConflicts();
  });

  // Process data into conflict groups
  const conflicts = useMemo((): ConflictGroup[] => {
    if (!data?.items) return [];

    return data.items
      .filter(item => item.quantity_reserved > item.quantity_total)
      .map(item => {
        const reservationsByEvent = new Map<string, {
          eventId: string | null;
          eventTitle: string;
          reservationId: string;
          quantity: number;
          startDate: string;
          endDate: string;
        }[]>();

        item.conflicting_reservations.forEach(res => {
          const key = res.event_id || 'no-event';
          const existing = reservationsByEvent.get(key) || [];
          existing.push({
            eventId: res.event_id,
            eventTitle: res.event_title || 'Bez akce',
            reservationId: res.reservation_id,
            quantity: res.quantity,
            startDate: res.start_date,
            endDate: res.end_date,
          });
          reservationsByEvent.set(key, existing);
        });

        return {
          item,
          reservationsByEvent,
          totalNeeded: item.quantity_reserved,
          shortage: item.quantity_reserved - item.quantity_total,
        };
      })
      .sort((a, b) => b.shortage - a.shortage);
  }, [data]);

  // Quick quantity adjustment
  const handleQuickAdjust = useCallback(async (reservationId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(0, currentQty + delta);
    if (newQty === currentQty) return;

    try {
      await updateReservation.mutateAsync({
        id: reservationId,
        data: { quantity: newQty },
      });
      // Reload conflicts
      loadConflicts();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  }, [updateReservation, loadConflicts]);

  // Start inline editing
  const startEditing = useCallback((reservationId: string, currentQty: number) => {
    setEditingReservation(reservationId);
    setEditQuantity(currentQty);
  }, []);

  // Save edited quantity
  const saveEdit = useCallback(async () => {
    if (!editingReservation) return;

    try {
      await updateReservation.mutateAsync({
        id: editingReservation,
        data: { quantity: editQuantity },
      });
      setEditingReservation(null);
      loadConflicts();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  }, [editingReservation, editQuantity, updateReservation, loadConflicts]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingReservation(null);
    setEditQuantity(0);
  }, []);

  // Transfer quantity between reservations
  const handleTransfer = useCallback(async (
    fromReservationId: string,
    toReservationId: string,
    fromCurrentQty: number,
    toCurrentQty: number,
    amount: number = 1
  ) => {
    if (fromCurrentQty < amount) return;

    try {
      // Update both reservations
      await Promise.all([
        updateReservation.mutateAsync({
          id: fromReservationId,
          data: { quantity: fromCurrentQty - amount },
        }),
        updateReservation.mutateAsync({
          id: toReservationId,
          data: { quantity: toCurrentQty + amount },
        }),
      ]);
      loadConflicts();
    } catch (error) {
      console.error('Failed to transfer:', error);
    }
  }, [updateReservation, loadConflicts]);

  const isLoading = isPending || updateReservation.isPending;

  // Stats
  const stats = useMemo(() => {
    if (!data?.summary) return { conflicts: 0, partial: 0, ok: 0 };
    return {
      conflicts: data.summary.unavailable,
      partial: data.summary.partially_available,
      ok: data.summary.fully_available,
    };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Konflikty materiálu
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Období:</span>
            <select
              value={daysAhead}
              onChange={(e) => {
                setDaysAhead(Number(e.target.value));
                setTimeout(loadConflicts, 0);
              }}
              className="text-sm border rounded px-2 py-1"
            >
              <option value={7}>7 dní</option>
              <option value={14}>14 dní</option>
              <option value={30}>30 dní</option>
              <option value={60}>60 dní</option>
              <option value={90}>90 dní</option>
            </select>
            <Button size="sm" variant="outline" onClick={loadConflicts} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Obnovit'}
            </Button>
          </div>
        </div>

        {/* Stats badges */}
        <div className="flex gap-2 mt-4">
          <Badge variant="destructive" className="gap-1">
            {stats.conflicts} konfliktů
          </Badge>
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
            {stats.partial} částečné
          </Badge>
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
            {stats.ok} v pořádku
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && conflicts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : conflicts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p className="font-medium">Žádné konflikty</p>
            <p className="text-sm">Všechen materiál je v daném období dostupný</p>
          </div>
        ) : (
          <div className="space-y-6">
            {conflicts.map((conflict) => (
              <div
                key={conflict.item.item_id}
                className="border rounded-lg p-4 bg-red-50/50"
              >
                {/* Item header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {conflict.item.item_name}
                    </h3>
                    {conflict.item.sku && (
                      <span className="text-xs text-slate-500">{conflict.item.sku}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="text-slate-600">Máte: </span>
                      <span className="font-bold">{conflict.item.quantity_total} ks</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-600">Potřeba: </span>
                      <span className="font-bold text-red-600">{conflict.totalNeeded} ks</span>
                    </div>
                    <Badge variant="destructive" className="mt-1">
                      Chybí {conflict.shortage} ks
                    </Badge>
                  </div>
                </div>

                {/* Reservations grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from(conflict.reservationsByEvent.entries()).map(([eventKey, reservations]) => {
                    const firstRes = reservations[0];
                    const totalForEvent = reservations.reduce((sum, r) => sum + r.quantity, 0);

                    return (
                      <div
                        key={eventKey}
                        className="bg-white rounded-lg border p-3 shadow-sm"
                      >
                        <div className="text-sm font-medium text-slate-900 mb-1 truncate">
                          {firstRes.eventTitle}
                        </div>
                        <div className="text-xs text-slate-500 mb-3">
                          {format(new Date(firstRes.startDate), 'd.M.', { locale: cs })} - {format(new Date(firstRes.endDate), 'd.M.yyyy', { locale: cs })}
                        </div>

                        {reservations.map((res) => (
                          <div key={res.reservationId} className="flex items-center justify-center gap-2">
                            {editingReservation === res.reservationId ? (
                              // Inline edit mode
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={editQuantity}
                                  onChange={(e) => setEditQuantity(Number(e.target.value))}
                                  className="w-16 h-8 text-center text-lg font-bold"
                                  min={0}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={saveEdit}
                                  disabled={updateReservation.isPending}
                                >
                                  <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={cancelEdit}
                                >
                                  <X className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              // Display mode with quick controls
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleQuickAdjust(res.reservationId, res.quantity, -1)}
                                  disabled={res.quantity <= 0 || isLoading}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>

                                <button
                                  onClick={() => startEditing(res.reservationId, res.quantity)}
                                  className="w-12 h-10 text-xl font-bold text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                  title="Klikni pro editaci"
                                >
                                  {res.quantity}
                                </button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleQuickAdjust(res.reservationId, res.quantity, 1)}
                                  disabled={isLoading}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        ))}

                        {/* Transfer buttons - show if there are multiple events */}
                        {conflict.reservationsByEvent.size > 1 && (
                          <div className="flex justify-center gap-1 mt-2 pt-2 border-t">
                            {Array.from(conflict.reservationsByEvent.entries())
                              .filter(([key]) => key !== eventKey)
                              .slice(0, 2)
                              .map(([otherKey, otherReservations]) => {
                                const otherRes = otherReservations[0];
                                const currentRes = reservations[0];
                                return (
                                  <Button
                                    key={otherKey}
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-7 px-2"
                                    onClick={() => handleTransfer(
                                      currentRes.reservationId,
                                      otherRes.reservationId,
                                      currentRes.quantity,
                                      otherRes.quantity,
                                      1
                                    )}
                                    disabled={currentRes.quantity <= 0 || isLoading}
                                    title={`Přesunout 1 ks na ${otherRes.eventTitle}`}
                                  >
                                    <ChevronRight className="w-3 h-3 mr-1" />
                                    {otherRes.eventTitle.substring(0, 10)}...
                                  </Button>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick tip */}
                <p className="text-xs text-slate-500 mt-3">
                  Klikni na číslo pro editaci, použij +/- pro rychlou úpravu, nebo šipky pro přesun mezi akcemi
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
