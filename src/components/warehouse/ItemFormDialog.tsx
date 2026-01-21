'use client';

import { useState, useEffect } from 'react';
import { useCreateWarehouseItem, useUpdateWarehouseItem, useWarehouseCategories } from '@/hooks/useWarehouse';
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
import { Loader2 } from 'lucide-react';
import type { WarehouseItemWithCategory } from '@/types/warehouse';

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: WarehouseItemWithCategory;
  onSuccess?: () => void;
}

export default function ItemFormDialog({ open, onOpenChange, item, onSuccess }: ItemFormDialogProps) {
  const isEdit = !!item;
  const createItem = useCreateWarehouseItem();
  const updateItem = useUpdateWarehouseItem();
  const { data: categories = [] } = useWarehouseCategories();

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category_id: '',
    quantity_total: 0,
    is_rent: false,
    unit: 'ks',
    notes: '',
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        sku: item.sku || '',
        description: item.description || '',
        category_id: item.category_id || '',
        quantity_total: item.quantity_total,
        is_rent: item.is_rent,
        unit: item.unit,
        notes: item.notes || '',
      });
    } else {
      setFormData({
        name: '',
        sku: '',
        description: '',
        category_id: '',
        quantity_total: 0,
        is_rent: false,
        unit: 'ks',
        notes: '',
      });
    }
    setError(null);
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Název je povinný');
      return;
    }

    try {
      const data = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        description: formData.description.trim() || undefined,
        category_id: formData.category_id || undefined,
        quantity_total: formData.quantity_total,
        is_rent: formData.is_rent,
        unit: formData.unit,
        notes: formData.notes.trim() || undefined,
      };

      if (isEdit) {
        await updateItem.mutateAsync({ id: item.id, data });
      } else {
        await createItem.mutateAsync(data);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo k chybě');
    }
  };

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Upravit materiál' : 'Nový materiál'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Název *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Např. Mikrofon SM58"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Kód</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Např. MIC-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Počet *</Label>
              <Input
                id="quantity"
                type="number"
                min={0}
                value={formData.quantity_total}
                onChange={(e) => setFormData({ ...formData, quantity_total: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Jednotka</Label>
              <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ks">ks</SelectItem>
                  <SelectItem value="m">m</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="sada">sada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategorie</Label>
              <Select
                value={formData.category_id || 'none'}
                onValueChange={(v) => setFormData({ ...formData, category_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte..." />
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
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_rent"
              checked={formData.is_rent}
              onCheckedChange={(checked) => setFormData({ ...formData, is_rent: !!checked })}
            />
            <Label htmlFor="is_rent" className="text-sm font-normal cursor-pointer">
              Rent materiál (pronajatý)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Popis</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Krátký popis materiálu..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Poznámky</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Interní poznámky..."
            />
          </div>

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
