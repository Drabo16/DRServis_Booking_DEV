'use client';

import { useState, useEffect } from 'react';
import { useCreateWarehouseKit, useUpdateWarehouseKit, useWarehouseItems } from '@/hooks/useWarehouse';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Package, Plus, Minus } from 'lucide-react';
import type { WarehouseKitWithItems } from '@/types/warehouse';

interface KitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit?: WarehouseKitWithItems;
  onSuccess?: () => void;
}

interface KitItem {
  item_id: string;
  quantity: number;
}

export default function KitFormDialog({ open, onOpenChange, kit, onSuccess }: KitFormDialogProps) {
  const isEdit = !!kit;
  const createKit = useCreateWarehouseKit();
  const updateKit = useUpdateWarehouseKit();
  const { data: allItems = [] } = useWarehouseItems();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<KitItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kit) {
      setName(kit.name);
      setDescription(kit.description || '');
      setSelectedItems(
        kit.items?.map((i) => ({ item_id: i.item_id, quantity: i.quantity })) || []
      );
    } else {
      setName('');
      setDescription('');
      setSelectedItems([]);
    }
    setError(null);
  }, [kit, open]);

  const toggleItem = (itemId: string) => {
    const exists = selectedItems.find((i) => i.item_id === itemId);
    if (exists) {
      setSelectedItems(selectedItems.filter((i) => i.item_id !== itemId));
    } else {
      setSelectedItems([...selectedItems, { item_id: itemId, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setSelectedItems(
      selectedItems.map((i) => {
        if (i.item_id === itemId) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Název je povinný');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Vyberte alespoň jeden materiál');
      return;
    }

    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        items: selectedItems,
      };

      if (isEdit && kit) {
        await updateKit.mutateAsync({ id: kit.id, data });
      } else {
        await createKit.mutateAsync(data);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo k chybě');
    }
  };

  const isPending = createKit.isPending || updateKit.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Upravit set' : 'Nový set'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Název setu *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Podium komplet"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Popis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              rows={2}
              placeholder="Krátký popis setu..."
            />
          </div>

          <div className="space-y-2">
            <Label>Materiály v setu ({selectedItems.length})</Label>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {allItems.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 text-center">
                  Nejdříve vytvořte nějaké materiály
                </p>
              ) : (
                <div className="divide-y">
                  {allItems.map((item) => {
                    const selected = selectedItems.find((i) => i.item_id === item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-2 ${selected ? 'bg-blue-50' : ''}`}
                      >
                        <Checkbox
                          checked={!!selected}
                          onCheckedChange={() => toggleItem(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <div className="flex gap-1">
                            {item.category && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1"
                                style={{ borderColor: item.category.color }}
                              >
                                {item.category.name}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-[10px] px-1">
                              {item.quantity_total} {item.unit}
                            </Badge>
                          </div>
                        </div>
                        {selected && (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {selected.quantity}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-2">Vybrané položky:</p>
              <div className="flex flex-wrap gap-1">
                {selectedItems.map((si) => {
                  const item = allItems.find((i) => i.id === si.item_id);
                  return (
                    <Badge key={si.item_id} variant="secondary" className="text-xs">
                      <Package className="w-3 h-3 mr-1" />
                      {item?.name || 'Neznámý'} x{si.quantity}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Uložit' : 'Vytvořit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
