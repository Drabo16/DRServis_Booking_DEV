'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  useOfferTemplateCategories,
  useOfferTemplateItems,
  useCreateOfferTemplateItem,
  useUpdateOfferTemplateItem,
  useDeleteOfferTemplateItem,
} from '@/hooks/useOffers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
} from 'lucide-react';
import { formatCurrency } from '@/types/offers';
import type { OfferTemplateItemWithCategory } from '@/types/offers';

export default function TemplatesManager() {
  const { data: categories = [], isLoading: loadingCategories } = useOfferTemplateCategories();
  const { data: items = [], isLoading: loadingItems } = useOfferTemplateItems();

  const createItem = useCreateOfferTemplateItem();
  const updateItem = useUpdateOfferTemplateItem();
  const deleteItem = useDeleteOfferTemplateItem();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<OfferTemplateItemWithCategory | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    subcategory: '',
    default_price: '',
    unit: 'ks',
  });

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category_id === categoryFilter);
    }

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.subcategory?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [items, categoryFilter, search]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, OfferTemplateItemWithCategory[]> = {};
    for (const item of filteredItems) {
      const catName = (item.category as { name?: string } | null)?.name || 'Bez kategorie';
      if (!grouped[catName]) {
        grouped[catName] = [];
      }
      grouped[catName].push(item);
    }
    return grouped;
  }, [filteredItems]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const openCreateDialog = useCallback(() => {
    setFormData({
      name: '',
      category_id: categories[0]?.id || '',
      subcategory: '',
      default_price: '',
      unit: 'ks',
    });
    setShowCreateDialog(true);
  }, [categories]);

  const openEditDialog = useCallback((item: OfferTemplateItemWithCategory) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category_id: item.category_id,
      subcategory: item.subcategory || '',
      default_price: item.default_price.toString(),
      unit: item.unit,
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name || !formData.category_id) return;

    const data = {
      name: formData.name,
      category_id: formData.category_id,
      subcategory: formData.subcategory || null,
      default_price: parseFloat(formData.default_price) || 0,
      unit: formData.unit,
    };

    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...data });
        setEditingItem(null);
      } else {
        await createItem.mutateAsync(data);
        setShowCreateDialog(false);
      }
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  }, [formData, editingItem, createItem, updateItem]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Opravdu chcete smazat tuto položku?')) return;
    try {
      await deleteItem.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  }, [deleteItem]);

  const isLoading = loadingCategories || loadingItems;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  const dialogOpen = showCreateDialog || !!editingItem;
  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-50 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Hledat v ceníku..."
            value={search}
            onChange={handleSearchChange}
            className="pl-8 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48 h-9">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny kategorie</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-1" />
          Přidat položku
        </Button>
      </div>

      {/* Items by category */}
      {Object.keys(itemsByCategory).length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Žádné položky nenalezeny</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(itemsByCategory).map(([categoryName, categoryItems]) => (
            <Card key={categoryName}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  {categoryName}
                  <Badge variant="secondary">{categoryItems.length} položek</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 px-4 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="pb-2 font-medium">Název</th>
                        <th className="pb-2 font-medium">Podkategorie</th>
                        <th className="pb-2 font-medium text-right">Cena</th>
                        <th className="pb-2 font-medium text-center">Jednotka</th>
                        <th className="pb-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryItems.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{item.name}</td>
                          <td className="py-2 text-slate-500">{item.subcategory || '-'}</td>
                          <td className="py-2 text-right">{formatCurrency(item.default_price)}</td>
                          <td className="py-2 text-center">{item.unit}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => openEditDialog(item)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingItem(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Upravit položku' : 'Nová položka v ceníku'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kategorie *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte kategorii" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Název položky *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="např. d&b audiotechnik V8"
              />
            </div>

            <div className="space-y-2">
              <Label>Podkategorie</Label>
              <Input
                value={formData.subcategory}
                onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
                placeholder="např. Reproboxy, Zesilovače..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Výchozí cena *</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.default_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, default_price: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Jednotka</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ks">ks</SelectItem>
                    <SelectItem value="den">den</SelectItem>
                    <SelectItem value="hod">hod</SelectItem>
                    <SelectItem value="km">km</SelectItem>
                    <SelectItem value="m2">m²</SelectItem>
                    <SelectItem value="sada">sada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingItem(null);
              }}
            >
              Zrušit
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.category_id || isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingItem ? 'Uložit' : 'Vytvořit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
