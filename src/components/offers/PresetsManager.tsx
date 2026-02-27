'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  useOfferPresets,
  useCreateOfferPreset,
  useDeleteOfferPreset,
  useUpdateOfferPreset,
} from '@/hooks/useOffers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Plus,
  Trash2,
  Edit2,
  Package,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { OfferPresetWithCount } from '@/types/offers';

interface PresetsManagerProps {
  onPresetSelect: (id: string) => void;
}

export default function PresetsManager({ onPresetSelect }: PresetsManagerProps) {
  const { data: presets = [], isLoading } = useOfferPresets();
  const createPreset = useCreateOfferPreset();
  const deletePreset = useDeleteOfferPreset();
  const updatePreset = useUpdateOfferPreset();

  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<OfferPresetWithCount | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const filteredPresets = useMemo(() => {
    if (!search.trim()) return presets;
    const terms = search.toLowerCase().trim().split(/\s+/);
    return presets.filter(p => {
      const searchable = [p.name, p.description].filter(Boolean).join(' ').toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [presets, search]);

  const openCreateDialog = useCallback(() => {
    setEditingPreset(null);
    setFormName('');
    setFormDescription('');
    setShowDialog(true);
  }, []);

  const openEditDialog = useCallback((preset: OfferPresetWithCount, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPreset(preset);
    setFormName(preset.name);
    setFormDescription(preset.description || '');
    setShowDialog(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) return;

    try {
      if (editingPreset) {
        await updatePreset.mutateAsync({
          id: editingPreset.id,
          name: formName,
          description: formDescription || null,
        });
      } else {
        const result = await createPreset.mutateAsync({
          name: formName,
          description: formDescription || undefined,
        });
        if (result.preset) {
          onPresetSelect(result.preset.id);
        }
      }
      setShowDialog(false);
    } catch (error) {
      console.error('Failed to save preset:', error);
      toast.error('Nepodařilo se uložit šablonu. Ujistěte se, že byla spuštěna databázová migrace (supabase-offer-presets.sql).');
    }
  }, [formName, formDescription, editingPreset, createPreset, updatePreset, onPresetSelect]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Opravdu chcete smazat tuto šablonu?')) return;
    try {
      await deletePreset.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete preset:', error);
      toast.error('Nepodařilo se smazat šablonu.');
    }
  }, [deletePreset]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const isPending = createPreset.isPending || updatePreset.isPending;

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
      <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-50 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Hledat šablonu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-1" />
          Nová šablona
        </Button>
      </div>

      {/* Presets grid */}
      {filteredPresets.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Žádné šablony nenalezeny</p>
          <p className="text-sm mt-1">Vytvořte první šablonu tlačítkem &quot;Nová šablona&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPresets.map((preset) => (
            <Card
              key={preset.id}
              className="cursor-pointer transition-all hover:shadow-md hover:bg-slate-50"
              onClick={() => onPresetSelect(preset.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">
                      {preset.name}
                    </h3>
                    {preset.description && (
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                        {preset.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{preset.items_count} položek</Badge>
                      <span className="text-xs text-slate-400">
                        {formatDate(preset.created_at)}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => openEditDialog(preset, e)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Přejmenovat
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => handleDelete(preset.id, e)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Smazat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPreset ? 'Upravit šablonu' : 'Nová šablona nabídky'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Název *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="např. Malý festival, Konference 200 lidí..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Popis</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Krátký popis šablony..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Zrušit
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim() || isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingPreset ? 'Uložit' : 'Vytvořit a upravit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
