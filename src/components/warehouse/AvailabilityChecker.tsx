'use client';

// =====================================================
// AVAILABILITY CHECKER COMPONENT
// =====================================================
// Check material availability for specific date ranges
// To remove: delete this file

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { format, addDays } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Search, CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useCheckAvailabilityMutation, useWarehouseCategories } from '@/hooks/useWarehouse';
import type { ItemAvailability } from '@/types/warehouse';

export default function AvailabilityChecker() {
  // Default: today to day after tomorrow (3 days)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: new Date(),
    to: addDays(new Date(), 2),
  }));

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const { data: categories } = useWarehouseCategories();
  const checkAvailability = useCheckAvailabilityMutation();

  // Track if initial load has happened
  const isInitialMount = useRef(true);

  // Auto-check on date/category change with debounce
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;

    // Immediate fetch on initial mount, debounced on subsequent changes
    const delay = isInitialMount.current ? 0 : 300;
    isInitialMount.current = false;

    const timer = setTimeout(() => {
      checkAvailability.mutate({
        start_date: format(dateRange.from!, 'yyyy-MM-dd'),
        end_date: format(dateRange.to!, 'yyyy-MM-dd'),
        category_id: categoryFilter || undefined,
      });
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime(), categoryFilter]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!checkAvailability.data?.items) return [];

    let items = checkAvailability.data.items;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.item_name.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query) ||
          item.category_name?.toLowerCase().includes(query)
      );
    }

    return items;
  }, [checkAvailability.data?.items, searchQuery]);

  // Group items by availability status
  const groupedItems = useMemo(() => ({
    unavailable: filteredItems.filter(i => i.quantity_available === 0),
    partial: filteredItems.filter(i => i.quantity_available > 0 && i.quantity_available < i.quantity_total),
    available: filteredItems.filter(i => i.quantity_available === i.quantity_total),
  }), [filteredItems]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setCategoryFilter('');
  }, []);

  const hasFilters = searchQuery || categoryFilter;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        {/* Date range picker */}
        <div>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Vyberte období"
          />
        </div>

        {/* Search and filter row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Hledat materiál..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={categoryFilter || 'all'} onValueChange={(val) => setCategoryFilter(val === 'all' ? '' : val)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny kategorie</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
              <X className="w-4 h-4 mr-1" />
              Zrušit filtry
            </Button>
          )}
        </div>

        {checkAvailability.isPending && (
          <div className="text-sm text-slate-500 text-center">Načítám...</div>
        )}
      </div>

      {/* Results */}
      {checkAvailability.data && (
        <div className="space-y-4">
          {/* Quick summary */}
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              {groupedItems.unavailable.length} nedostupných
            </Badge>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              {groupedItems.partial.length} částečně
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {groupedItems.available.length} dostupných
            </Badge>
            {hasFilters && filteredItems.length !== checkAvailability.data.items.length && (
              <span className="text-slate-500 text-xs self-center">
                (zobrazeno {filteredItems.length} z {checkAvailability.data.items.length})
              </span>
            )}
          </div>

          {/* No results after filter */}
          {filteredItems.length === 0 && hasFilters && (
            <div className="text-center py-8 text-slate-500">
              Žádné položky neodpovídají vyhledávání
            </div>
          )}

          {/* Unavailable items - shown first as they're most important */}
          {groupedItems.unavailable.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-700 flex items-center gap-1">
                <XCircle className="w-4 h-4" /> Nedostupné
              </h4>
              <div className="grid gap-2">
                {groupedItems.unavailable.map((item) => (
                  <ItemCard key={item.item_id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Partial items */}
          {groupedItems.partial.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-yellow-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Částečně dostupné
              </h4>
              <div className="grid gap-2">
                {groupedItems.partial.map((item) => (
                  <ItemCard key={item.item_id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Available items - collapsed by default if there are issues */}
          {groupedItems.available.length > 0 && (
            <details open={groupedItems.unavailable.length === 0 && groupedItems.partial.length === 0}>
              <summary className="text-sm font-medium text-green-700 flex items-center gap-1 cursor-pointer">
                <CheckCircle2 className="w-4 h-4" /> Plně dostupné ({groupedItems.available.length})
              </summary>
              <div className="grid gap-2 mt-2">
                {groupedItems.available.map((item) => (
                  <ItemCard key={item.item_id} item={item} compact />
                ))}
              </div>
            </details>
          )}

          {/* All clear message */}
          {filteredItems.length > 0 && groupedItems.unavailable.length === 0 && groupedItems.partial.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-medium">Vše je dostupné pro vybrané období</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ItemCard = memo(function ItemCard({ item, compact = false }: { item: ItemAvailability; compact?: boolean }) {
  const hasConflicts = item.conflicting_reservations.length > 0;

  return (
    <div className={`rounded-lg border p-3 ${
      item.quantity_available === 0
        ? 'bg-red-50 border-red-200'
        : item.quantity_available < item.quantity_total
        ? 'bg-yellow-50 border-yellow-200'
        : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${compact ? 'text-sm' : ''} truncate`}>
              {item.item_name}
            </span>
            {item.is_rent && (
              <Badge variant="outline" className="text-xs shrink-0">Rent</Badge>
            )}
          </div>
          {!compact && item.category_name && (
            <div className="flex items-center gap-1 mt-0.5">
              {item.category_color && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.category_color }}
                />
              )}
              <span className="text-xs text-slate-500">{item.category_name}</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className={`font-bold ${
            item.quantity_available === 0
              ? 'text-red-700'
              : item.quantity_available < item.quantity_total
              ? 'text-yellow-700'
              : 'text-green-700'
          }`}>
            {item.quantity_available}
          </span>
          <span className="text-slate-400">/{item.quantity_total}</span>
        </div>
      </div>

      {/* Show conflicts inline for problematic items */}
      {hasConflicts && !compact && (
        <div className="mt-2 pt-2 border-t border-slate-200/50 text-xs text-slate-600">
          <div className="flex items-center gap-1 mb-1">
            <Info className="w-3 h-3" />
            <span>Rezervováno pro:</span>
          </div>
          {item.conflicting_reservations.slice(0, 3).map((res) => (
            <div key={res.reservation_id} className="ml-4">
              {res.event_title || 'Bez akce'} ({res.quantity}x) - {format(new Date(res.start_date), 'd.M.', { locale: cs })}
            </div>
          ))}
          {item.conflicting_reservations.length > 3 && (
            <div className="ml-4 text-slate-400">
              +{item.conflicting_reservations.length - 3} další
            </div>
          )}
        </div>
      )}
    </div>
  );
});
