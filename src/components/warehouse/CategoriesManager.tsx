'use client';

import { useState } from 'react';
import {
  useWarehouseCategories,
  useCreateWarehouseCategory,
  useUpdateWarehouseCategory,
  useDeleteWarehouseCategory,
} from '@/hooks/useWarehouse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Edit2, Trash2, Check, X, GripVertical } from 'lucide-react';

export default function CategoriesManager() {
  const { data: categories = [], isLoading } = useWarehouseCategories();
  const createCategory = useCreateWarehouseCategory();
  const updateCategory = useUpdateWarehouseCategory();
  const deleteCategory = useDeleteWarehouseCategory();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6b7280');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createCategory.mutateAsync({
        name: newName.trim(),
        color: newColor,
        sort_order: categories.length,
      });
      setNewName('');
      setNewColor('#6b7280');
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateCategory.mutateAsync({
        id,
        data: { name: editName.trim(), color: editColor },
      });
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu chcete smazat tuto kategorii? Materiály v ní zůstanou, ale bez kategorie.')) return;
    try {
      await deleteCategory.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const startEdit = (cat: typeof categories[0]) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border min-h-[52px]">
        <h2 className="font-medium text-slate-700">Kategorie materiálu ({categories.length})</h2>
        {!isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Přidat
          </Button>
        )}
      </div>

      {/* Add new category form */}
      {isAdding && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Název kategorie"
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCreate}
                disabled={createCategory.isPending || !newName.trim()}
              >
                {createCategory.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsAdding(false)}
              >
                <X className="w-4 h-4 text-slate-500" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories list */}
      {categories.length === 0 && !isAdding ? (
        <div className="text-center py-12 text-slate-500">
          <p>Žádné kategorie</p>
          <p className="text-sm mt-1">Přidejte první kategorii tlačítkem výše</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardContent className="p-3">
                {editingId === cat.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(cat.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleUpdate(cat.id)}
                      disabled={updateCategory.isPending || !editName.trim()}
                    >
                      {updateCategory.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 font-medium">{cat.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(cat)}
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(cat.id)}
                      disabled={deleteCategory.isPending}
                    >
                      {deleteCategory.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
