'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { useWarehouseReservations, useDeleteWarehouseReservation } from '@/hooks/useWarehouse';
import { useEvents } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Plus,
  Calendar,
  Package,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Layers,
  Edit2,
  Search,
  Clock,
} from 'lucide-react';
import ReservationFormDialog from './ReservationFormDialog';
import EditEventReservationsDialog from './EditEventReservationsDialog';
import type { WarehouseReservationWithDetails } from '@/types/warehouse';

interface ReservationsViewProps {
  isAdmin: boolean;
}

interface EventGroup {
  eventId: string;
  event: WarehouseReservationWithDetails['event'];
  reservations: WarehouseReservationWithDetails[];
  totalItems: number;
  dateRange: { start: string; end: string };
}

export default function ReservationsView({ isAdmin }: ReservationsViewProps) {
  const { data: reservations = [], isLoading } = useWarehouseReservations();
  const { data: events = [] } = useEvents();
  const deleteReservation = useDeleteWarehouseReservation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Group reservations by event
  const eventGroups = useMemo(() => {
    const groups: Record<string, EventGroup> = {};

    for (const res of reservations) {
      const eventId = res.event_id || 'no-event';

      if (!groups[eventId]) {
        groups[eventId] = {
          eventId,
          event: res.event,
          reservations: [],
          totalItems: 0,
          dateRange: { start: res.start_date, end: res.end_date },
        };
      }

      groups[eventId].reservations.push(res);
      groups[eventId].totalItems += res.quantity;

      // Update date range
      if (res.start_date < groups[eventId].dateRange.start) {
        groups[eventId].dateRange.start = res.start_date;
      }
      if (res.end_date > groups[eventId].dateRange.end) {
        groups[eventId].dateRange.end = res.end_date;
      }
    }

    return Object.values(groups);
  }, [reservations]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    let filtered = eventGroups;

    // Filter by event
    if (eventFilter !== 'all') {
      filtered = filtered.filter((g) => g.eventId === eventFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((g) => {
        const eventMatches = g.event?.title.toLowerCase().includes(query);
        const itemMatches = g.reservations.some((r) =>
          r.item?.name.toLowerCase().includes(query)
        );
        return eventMatches || itemMatches;
      });
    }

    // Sort by event date (upcoming first)
    return filtered.sort((a, b) => {
      const dateA = a.event?.start_time || a.dateRange.start;
      const dateB = b.event?.start_time || b.dateRange.start;
      return dateA.localeCompare(dateB);
    });
  }, [eventGroups, eventFilter, searchQuery]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
    });
  }, []);

  const formatDateTime = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Opravdu chcete smazat tuto rezervaci?')) return;
    try {
      await deleteReservation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete reservation:', error);
    }
  }, [deleteReservation]);

  const toggleExpand = useCallback((eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Memoize today's date to avoid recalculating in each isUpcoming call
  const todayStart = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), []);

  const isUpcoming = useCallback((dateStr: string) => {
    return new Date(dateStr) >= todayStart;
  }, [todayStart]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const openCreateDialog = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setShowCreateDialog(false);
  }, []);

  const closeEditDialog = useCallback((open: boolean) => {
    if (!open) setEditingEventId(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 p-3 bg-slate-50 rounded-lg border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-medium text-slate-700">
            Rezervace ({reservations.length} položek pro {eventGroups.length} akcí)
          </h2>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-1" />
            Nová rezervace
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Hledat akci nebo materiál..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 h-9"
            />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-full sm:w-56 h-9">
              <SelectValue placeholder="Filtrovat dle akce" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny akce</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reservations grouped by event */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Žádné rezervace</p>
          <p className="text-sm mt-1">Vytvořte rezervaci materiálu na akci</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = expandedEvents.has(group.eventId);
            const upcoming = group.event ? isUpcoming(group.event.start_time) : true;

            // Count unique items and kits
            const uniqueItems = new Set(group.reservations.map((r) => r.item_id)).size;
            const kitReservations = group.reservations.filter((r) => r.kit_id);
            const uniqueKits = new Set(kitReservations.map((r) => r.kit_id)).size;

            return (
              <Card
                key={group.eventId}
                className={`overflow-hidden transition-all ${
                  upcoming ? '' : 'opacity-60'
                }`}
              >
                {/* Event Header - clickable */}
                <CardHeader
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(group.eventId)}
                >
                  <div className="flex items-center gap-3">
                    {/* Expand/Collapse icon */}
                    <div className="text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">
                          {group.event?.title || 'Bez akce'}
                        </h3>
                        {!upcoming && (
                          <Badge variant="secondary" className="text-xs">
                            Proběhlo
                          </Badge>
                        )}
                      </div>

                      {/* Event details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                        {group.event && (
                          <>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDateTime(group.event.start_time)}
                            </span>
                            {group.event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {group.event.location}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Summary badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        <Package className="w-3 h-3 mr-1" />
                        {uniqueItems} materiálů
                      </Badge>
                      {uniqueKits > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Layers className="w-3 h-3 mr-1" />
                          {uniqueKits} setů
                        </Badge>
                      )}
                    </div>

                    {/* Edit button */}
                    {isAdmin && group.event && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEventId(group.eventId);
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Upravit
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {/* Expanded content - reservation list */}
                {isExpanded && (
                  <CardContent className="p-0 border-t">
                    <div className="divide-y">
                      {group.reservations.map((res) => (
                        <div
                          key={res.id}
                          className="flex items-center justify-between p-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">
                                {res.item?.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>
                                  {formatDate(res.start_date)} - {formatDate(res.end_date)}
                                </span>
                                {res.kit && (
                                  <Badge variant="secondary" className="text-[10px] h-4">
                                    <Layers className="w-2.5 h-2.5 mr-0.5" />
                                    {res.kit.name}
                                  </Badge>
                                )}
                                {res.notes && (
                                  <span className="text-slate-400 truncate max-w-32">
                                    {res.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="secondary">
                              {res.quantity} {res.item?.unit || 'ks'}
                            </Badge>
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => handleDelete(res.id, e)}
                                disabled={deleteReservation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quick add more */}
                    {isAdmin && group.event && (
                      <div className="p-3 bg-slate-50 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setEditingEventId(group.eventId)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Přidat další materiály
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create reservation dialog */}
      {showCreateDialog && (
        <ReservationFormDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={closeCreateDialog}
        />
      )}

      {/* Edit event reservations dialog */}
      {editingEventId && (
        <EditEventReservationsDialog
          open={!!editingEventId}
          onOpenChange={closeEditDialog}
          eventId={editingEventId}
          onSuccess={() => setEditingEventId(null)}
        />
      )}
    </div>
  );
}
