'use client';

import { useState } from 'react';
import { useWarehouseKits, useDeleteWarehouseKit } from '@/hooks/useWarehouse';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Layers, Edit2, Trash2, Package, Upload } from 'lucide-react';
import KitFormDialog from './KitFormDialog';
import KitsImportDialog from './KitsImportDialog';
import type { WarehouseKitWithItems } from '@/types/warehouse';

interface KitsListProps {
  isAdmin: boolean;
}

export default function KitsList({ isAdmin }: KitsListProps) {
  const { data: kits = [], isLoading } = useWarehouseKits();
  const deleteKit = useDeleteWarehouseKit();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingKit, setEditingKit] = useState<WarehouseKitWithItems | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu chcete smazat tento set?')) return;
    try {
      await deleteKit.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete kit:', error);
    }
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
        <h2 className="font-medium text-slate-700">Sety / Nadmateriály ({kits.length})</h2>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Nový set
            </Button>
          </div>
        )}
      </div>

      {kits.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Žádné sety</p>
          {isAdmin && (
            <p className="text-sm mt-1">Sety umožňují rezervovat více materiálu najednou</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kits.map((kit) => (
            <Card key={kit.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{kit.name}</CardTitle>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingKit(kit)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleDelete(kit.id)}
                        disabled={deleteKit.isPending}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
                {kit.description && (
                  <p className="text-sm text-slate-500">{kit.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-2">
                  Obsah ({kit.items?.length || 0} položek):
                </p>
                <div className="flex flex-wrap gap-1">
                  {kit.items?.slice(0, 5).map((kitItem) => (
                    <Badge key={kitItem.id} variant="secondary" className="text-xs">
                      <Package className="w-3 h-3 mr-1" />
                      {kitItem.item?.name || 'Neznámý'} x{kitItem.quantity}
                    </Badge>
                  ))}
                  {kit.items && kit.items.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{kit.items.length - 5} dalších
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      {(showCreateDialog || editingKit) && (
        <KitFormDialog
          open={showCreateDialog || !!editingKit}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateDialog(false);
              setEditingKit(null);
            }
          }}
          kit={editingKit || undefined}
          onSuccess={() => {
            setShowCreateDialog(false);
            setEditingKit(null);
          }}
        />
      )}

      {/* Import dialog */}
      {showImportDialog && (
        <KitsImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
