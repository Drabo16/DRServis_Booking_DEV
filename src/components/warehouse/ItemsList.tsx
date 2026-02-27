'use client';

import { useState, useCallback, memo } from 'react';
import {
  useWarehouseItems,
  useWarehouseCategories,
  useBulkUpdateWarehouseItems,
  useBulkDeleteWarehouseItems,
} from '@/hooks/useWarehouse';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search, Package, Trash2, FolderEdit, X } from 'lucide-react';
import { toast } from 'sonner';
import type { WarehouseItemWithCategory } from '@/types/warehouse';

interface ItemsListProps {
  onItemClick: (id: string) => void;
  isAdmin: boolean;
  selectedItemId: string | null;
}

export default function ItemsList({ onItemClick, isAdmin, selectedItemId }: ItemsListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');

  const bulkUpdate = useBulkUpdateWarehouseItems();
  const bulkDelete = useBulkDeleteWarehouseItems();

  const { data: items = [], isLoading } = useWarehouseItems({
    category_id: categoryFilter !== 'all' ? categoryFilter : undefined,
    is_rent: ownershipFilter === 'all' ? undefined : ownershipFilter === 'rent',
    search: search || undefined,
  });

  const { data: categories = [] } = useWarehouseCategories();

  const isSelecting = selectedIds.size > 0;
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  }, [allSelected, items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkCategoryId('');
  }, []);

  const handleBulkCategoryChange = useCallback(async () => {
    if (!bulkCategoryId || selectedIds.size === 0) return;
    try {
      await bulkUpdate.mutateAsync({
        ids: Array.from(selectedIds),
        data: { category_id: bulkCategoryId === 'none' ? null : bulkCategoryId },
      });
      clearSelection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chyba při úpravě');
    }
  }, [bulkCategoryId, selectedIds, bulkUpdate, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Opravdu chcete smazat ${selectedIds.size} položek?`)) return;
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds));
      clearSelection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chyba při mazání');
    }
  }, [selectedIds, bulkDelete, clearSelection]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  const isPending = bulkUpdate.isPending || bulkDelete.isPending;

  return (
    <div className="space-y-4">
      {/* Bulk actions bar */}
      {isAdmin && isSelecting && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size} vybráno
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Kategorie..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez kategorie</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkCategoryChange}
              disabled={!bulkCategoryId || isPending}
            >
              {bulkUpdate.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderEdit className="w-4 h-4" />
              )}
              <span className="ml-1 hidden sm:inline">Změnit</span>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isPending}
            >
              {bulkDelete.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span className="ml-1 hidden sm:inline">Smazat</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              disabled={isPending}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-50 rounded-lg border min-h-[52px]">
        {isAdmin && !isSelecting && (
          <div className="flex items-center">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
            />
          </div>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Hledat materiál..."
            value={search}
            onChange={handleSearchChange}
            className="pl-8 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-40 h-9">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vše kategorie</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
          <SelectTrigger className="w-full sm:w-32 h-9">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vše</SelectItem>
            <SelectItem value="ours">Náš</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items grid */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Žádné materiály nenalezeny</p>
          {isAdmin && <p className="text-sm mt-1">Přidejte první materiál tlačítkem &quot;Nový materiál&quot;</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={onItemClick}
              isSelected={selectedItemId === item.id}
              isChecked={selectedIds.has(item.id)}
              onCheckChange={toggleSelect}
              showCheckbox={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ItemCardProps {
  item: WarehouseItemWithCategory;
  onClick: (id: string) => void;
  isSelected: boolean;
  isChecked: boolean;
  onCheckChange: (id: string) => void;
  showCheckbox: boolean;
}

const ItemCard = memo(function ItemCard({ item, onClick, isSelected, isChecked, onCheckChange, showCheckbox }: ItemCardProps) {
  const handleClick = useCallback(() => {
    onClick(item.id);
  }, [onClick, item.id]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleCheckChange = useCallback(() => {
    onCheckChange(item.id);
  }, [onCheckChange, item.id]);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50/50' : isChecked ? 'ring-2 ring-blue-300 bg-blue-50/30' : 'hover:bg-slate-50'
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {showCheckbox && (
            <div className="pt-0.5" onClick={handleCheckboxClick}>
              <Checkbox
                checked={isChecked}
                onCheckedChange={handleCheckChange}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-slate-900 truncate">{item.name}</h3>
                {item.sku && (
                  <p className="text-xs text-slate-500 truncate">{item.sku}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={item.is_rent ? 'secondary' : 'default'} className="text-xs">
                  {item.is_rent ? 'Rent' : 'Náš'}
                </Badge>
                <span className="text-sm font-medium text-slate-700">
                  {item.quantity_total} {item.unit}
                </span>
              </div>
            </div>
            {item.category && (
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: item.category.color, color: item.category.color }}
                >
                  {item.category.name}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
