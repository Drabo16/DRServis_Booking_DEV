'use client';

import { useState } from 'react';
import { useWarehouseItem, useWarehouseItemHistory, useWarehouseItemStats, useDeleteWarehouseItem } from '@/hooks/useWarehouse';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X, Edit2, Trash2, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import ItemFormDialog from './ItemFormDialog';

interface ItemDetailPanelProps {
  itemId: string;
  onClose: () => void;
  isAdmin: boolean;
}

export default function ItemDetailPanel({ itemId, onClose, isAdmin }: ItemDetailPanelProps) {
  const { data: item, isLoading } = useWarehouseItem(itemId);
  const { data: history = [] } = useWarehouseItemHistory(itemId);
  const { data: stats } = useWarehouseItemStats(itemId);
  const deleteItem = useDeleteWarehouseItem();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Opravdu chcete smazat tento materiál?')) return;
    try {
      await deleteItem.mutateAsync(itemId);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chyba při mazání');
    }
  };

  if (isLoading || !item) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{item.name}</h2>
          {item.sku && <p className="text-sm text-slate-500">{item.sku}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={item.is_rent ? 'secondary' : 'default'}>
          {item.is_rent ? 'Rent' : 'Náš'}
        </Badge>
        {item.category && (
          <Badge
            variant="outline"
            style={{ borderColor: item.category.color, color: item.category.color }}
          >
            {item.category.name}
          </Badge>
        )}
      </div>

      {/* Quantity */}
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {item.quantity_total}
            </p>
            <p className="text-sm text-slate-500">{item.unit} celkem</p>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {item.description && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-1">Popis</h3>
          <p className="text-sm text-slate-600">{item.description}</p>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-1">Poznámky</h3>
          <p className="text-sm text-slate-600">{item.notes}</p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Statistiky
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Celkem rezervací</p>
              <p className="font-medium">{stats.total_reservations}</p>
            </div>
            <div>
              <p className="text-slate-500">Nadcházející</p>
              <p className="font-medium">{stats.upcoming_reservations}</p>
            </div>
            <div>
              <p className="text-slate-500">Vytíženost (30 dní)</p>
              <p className="font-medium">{stats.utilization_percentage}%</p>
            </div>
            <div>
              <p className="text-slate-500">Rezervováno ks</p>
              <p className="font-medium">{stats.total_quantity_reserved}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservation history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Historie rezervací ({history.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Žádné rezervace</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.slice(0, 10).map((res) => (
                <div key={res.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                  <div>
                    <p className="font-medium">{res.event?.title || 'Bez akce'}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(res.start_date)} - {formatDate(res.end_date)}
                    </p>
                  </div>
                  <Badge variant="outline">{res.quantity} {item.unit}</Badge>
                </div>
              ))}
              {history.length > 10 && (
                <p className="text-xs text-slate-500 text-center">...a {history.length - 10} dalších</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            Upravit
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDelete}
            disabled={deleteItem.isPending}
          >
            {deleteItem.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      {showEditDialog && (
        <ItemFormDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          item={item}
          onSuccess={() => setShowEditDialog(false)}
        />
      )}
    </div>
  );
}
