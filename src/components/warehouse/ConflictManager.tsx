'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, AlertTriangle, Trash2, RefreshCw, Check, X } from 'lucide-react';
import {
  useCheckAvailabilityMutation,
  useUpdateWarehouseReservation,
  useDeleteWarehouseReservation,
  useWarehouseItems,
  useCreateWarehouseReservation,
} from '@/hooks/useWarehouse';
import { format, addDays } from 'date-fns';
import { cs } from 'date-fns/locale';

interface ConflictManagerProps {
  isAdmin: boolean;
}

// Flat conflict row for table display
interface ConflictRow {
  reservationId: string;
  itemId: string;
  itemName: string;
  itemSku: string | null;
  categoryName: string | null;
  eventId: string | null;
  eventTitle: string;
  startDate: string;
  endDate: string;
  quantity: number;
  quantityAvailable: number;
  shortage: number;
}

export default function ConflictManager({ isAdmin }: ConflictManagerProps) {
  const [daysAhead, setDaysAhead] = useState(30);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [replacingRow, setReplacingRow] = useState<string | null>(null);
  const [selectedReplacement, setSelectedReplacement] = useState<string>('');

  const checkAvailability = useCheckAvailabilityMutation();
  const updateReservation = useUpdateWarehouseReservation();
  const deleteReservation = useDeleteWarehouseReservation();
  const createReservation = useCreateWarehouseReservation();
  const { data: allItems } = useWarehouseItems();

  // Calculate date range
  const dateRange = useMemo(() => {
    const start = new Date();
    const end = addDays(start, daysAhead);
    return {
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
    };
  }, [daysAhead]);

  // Fetch conflicts
  const { data, isPending } = checkAvailability;

  const loadConflicts = useCallback(() => {
    checkAvailability.mutate(dateRange);
  }, [checkAvailability, dateRange]);

  // Initial load
  useEffect(() => {
    loadConflicts();
  }, []);

  // Reload when days change
  useEffect(() => {
    loadConflicts();
  }, [daysAhead]);

  // Process data into flat conflict rows
  const conflictRows = useMemo((): ConflictRow[] => {
    if (!data?.items) return [];

    const rows: ConflictRow[] = [];

    data.items
      .filter(item => item.quantity_reserved > item.quantity_total)
      .forEach(item => {
        item.conflicting_reservations.forEach(res => {
          rows.push({
            reservationId: res.reservation_id,
            itemId: item.item_id,
            itemName: item.item_name,
            itemSku: item.sku,
            categoryName: item.category_name,
            eventId: res.event_id,
            eventTitle: res.event_title || 'Bez akce',
            startDate: res.start_date,
            endDate: res.end_date,
            quantity: res.quantity,
            quantityAvailable: item.quantity_total,
            shortage: item.quantity_reserved - item.quantity_total,
          });
        });
      });

    // Sort by shortage (most urgent first), then by date
    return rows.sort((a, b) => {
      if (b.shortage !== a.shortage) return b.shortage - a.shortage;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }, [data]);

  // Get alternative items for replacement (same category, different item)
  const getAlternativeItems = useCallback((row: ConflictRow) => {
    if (!allItems) return [];
    return allItems.filter(item =>
      item.id !== row.itemId &&
      (row.categoryName ? item.category?.name === row.categoryName : true) &&
      item.quantity_total > 0
    );
  }, [allItems]);

  // Handle quantity update
  const handleSaveQuantity = useCallback(async () => {
    if (!editingRow) return;

    try {
      await updateReservation.mutateAsync({
        id: editingRow,
        data: { quantity: editQuantity },
      });
      setEditingRow(null);
      loadConflicts();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  }, [editingRow, editQuantity, updateReservation, loadConflicts]);

  // Handle item replacement
  const handleReplaceItem = useCallback(async (row: ConflictRow) => {
    if (!selectedReplacement) return;

    try {
      // Create new reservation with the replacement item
      await createReservation.mutateAsync({
        item_id: selectedReplacement,
        event_id: row.eventId || undefined,
        quantity: row.quantity,
        start_date: row.startDate,
        end_date: row.endDate,
        notes: `Nahrazeno za: ${row.itemName}`,
      });

      // Delete the old reservation
      await deleteReservation.mutateAsync(row.reservationId);

      setReplacingRow(null);
      setSelectedReplacement('');
      loadConflicts();
    } catch (error) {
      console.error('Failed to replace item:', error);
    }
  }, [selectedReplacement, createReservation, deleteReservation, loadConflicts]);

  // Handle reservation deletion
  const handleDelete = useCallback(async (reservationId: string) => {
    if (!confirm('Opravdu smazat tuto rezervaci?')) return;

    try {
      await deleteReservation.mutateAsync(reservationId);
      loadConflicts();
    } catch (error) {
      console.error('Failed to delete reservation:', error);
    }
  }, [deleteReservation, loadConflicts]);

  const isLoading = isPending || updateReservation.isPending || deleteReservation.isPending || createReservation.isPending;

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
              onChange={(e) => setDaysAhead(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1"
            >
              <option value={7}>7 dní</option>
              <option value={14}>14 dní</option>
              <option value={30}>30 dní</option>
              <option value={60}>60 dní</option>
              <option value={90}>90 dní</option>
            </select>
            <Button size="sm" variant="outline" onClick={loadConflicts} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
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
        {isLoading && conflictRows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : conflictRows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p className="font-medium">Žádné konflikty</p>
            <p className="text-sm">Všechen materiál je v daném období dostupný</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Materiál</TableHead>
                  <TableHead>Akce</TableHead>
                  <TableHead>Termín</TableHead>
                  <TableHead className="text-center">Máte</TableHead>
                  <TableHead className="text-center">Potřeba</TableHead>
                  <TableHead className="text-center">Chybí</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conflictRows.map((row) => (
                  <TableRow key={row.reservationId} className="bg-red-50/30">
                    <TableCell>
                      <div className="font-medium">{row.itemName}</div>
                      {row.itemSku && (
                        <div className="text-xs text-slate-500">{row.itemSku}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={row.eventTitle}>
                        {row.eventTitle}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(row.startDate), 'd.M.', { locale: cs })} - {format(new Date(row.endDate), 'd.M.', { locale: cs })}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {row.quantityAvailable}
                    </TableCell>
                    <TableCell className="text-center">
                      {editingRow === row.reservationId ? (
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(Number(e.target.value))}
                            className="w-16 h-8 text-center"
                            min={0}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveQuantity();
                              if (e.key === 'Escape') setEditingRow(null);
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={handleSaveQuantity}
                            disabled={isLoading}
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setEditingRow(null)}
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingRow(row.reservationId);
                            setEditQuantity(row.quantity);
                          }}
                          className="font-bold hover:bg-slate-100 px-2 py-1 rounded"
                          title="Klikni pro úpravu"
                        >
                          {row.quantity}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{row.shortage}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {replacingRow === row.reservationId ? (
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={selectedReplacement}
                            onValueChange={setSelectedReplacement}
                          >
                            <SelectTrigger className="w-[180px] h-8">
                              <SelectValue placeholder="Vyberte náhradu..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getAlternativeItems(row).map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.quantity_total} ks)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleReplaceItem(row)}
                            disabled={!selectedReplacement || isLoading}
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setReplacingRow(null);
                              setSelectedReplacement('');
                            }}
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => {
                              setReplacingRow(row.reservationId);
                              setSelectedReplacement('');
                            }}
                            disabled={isLoading}
                          >
                            Nahradit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(row.reservationId)}
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {conflictRows.length > 0 && (
          <p className="text-xs text-slate-500 mt-4">
            Klikni na číslo v sloupci &quot;Potřeba&quot; pro úpravu množství. Použij &quot;Nahradit&quot; pro výměnu za jiný materiál.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
