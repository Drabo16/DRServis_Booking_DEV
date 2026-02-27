'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/hooks/useEvents';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { Position } from '@/types';
import { ROLE_TYPES } from '@/lib/constants';

interface PositionTableProps {
  positions: Position[];
  eventId: string;
}

export default function PositionTable({ positions, eventId }: PositionTableProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPosition, setNewPosition] = useState({
    title: '',
    role_type: 'sound' as const,
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // Generuj title podle typu role
      const roleLabel = ROLE_TYPES.find((t) => t.value === newPosition.role_type)?.label || newPosition.role_type;

      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          title: roleLabel, // Použij label typu role jako title
          role_type: newPosition.role_type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create position');
      }

      setNewPosition({ title: '', role_type: 'sound' });
      setIsAdding(false);

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Chyba při vytváření pozice');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewPosition({ title: '', role_type: 'sound' });
    setIsAdding(false);
  };

  const handleDelete = async (positionId: string) => {
    if (!confirm('Opravdu chcete smazat tuto pozici?')) {
      return;
    }

    try {
      const response = await fetch(`/api/positions?id=${positionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete position');
      }

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Chyba při mazání pozice');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pozice</h3>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Přidat pozici
          </Button>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Typ role</TableHead>
              <TableHead className="w-20">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={position.id}>
                <TableCell className="font-medium">
                  {ROLE_TYPES.find((t) => t.value === position.role_type)?.label || position.role_type}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(position.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Select
                    value={newPosition.role_type}
                    onValueChange={(value) =>
                      setNewPosition({ ...newPosition, role_type: value as typeof newPosition.role_type })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte typ role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSave}
                      disabled={loading}
                    >
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      disabled={loading}
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {positions.length === 0 && !isAdding && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-slate-500 py-8">
                  Žádné pozice. Klikněte na "Přidat pozici" pro vytvoření nové.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
