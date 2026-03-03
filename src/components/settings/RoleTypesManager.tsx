'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Check, X, GripVertical, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { roleTypeKeys } from '@/hooks/useRoleTypes';

interface RoleType {
  id: string;
  value: string;
  label: string;
  sort_order?: number;
}

interface RoleTypesManagerProps {
  initialRoleTypes: RoleType[];
}

export default function RoleTypesManager({ initialRoleTypes }: RoleTypesManagerProps) {
  const queryClient = useQueryClient();
  const [roleTypes, setRoleTypes] = useState<RoleType[]>(initialRoleTypes);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ value: '', label: '' });
  const [editRole, setEditRole] = useState({ value: '', label: '' });
  const [loading, setLoading] = useState(false);

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const handleAdd = async () => {
    if (!newRole.value || !newRole.label) {
      toast.warning('Vyplňte všechna pole');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/role-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create role type');
      }

      const data = await response.json();
      setRoleTypes(prev => [...prev, data.roleType]);
      setNewRole({ value: '', label: '' });
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: roleTypeKeys.all });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chyba při vytváření role');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editRole.value || !editRole.label) {
      toast.warning('Vyplňte všechna pole');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/role-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRole),
      });

      if (!response.ok) throw new Error('Failed to update role type');

      const data = await response.json();
      setRoleTypes(prev => prev.map(rt => rt.id === id ? data.roleType : rt));
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: roleTypeKeys.all });
    } catch (error) {
      toast.error('Chyba při aktualizaci role');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Opravdu smazat roli "${label}"? Všechny pozice s touto rolí budou změněny na "Ostatní".`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/role-types/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete role type');

      setRoleTypes(prev => prev.filter(rt => rt.id !== id));
      queryClient.invalidateQueries({ queryKey: roleTypeKeys.all });
    } catch (error) {
      toast.error('Chyba při mazání role');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (roleType: RoleType) => {
    setEditingId(roleType.id);
    setEditRole({ value: roleType.value, label: roleType.label });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditRole({ value: '', label: '' });
  };

  // Drag and drop reordering
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    setDragOverId(targetId);

    // Reorder locally on hover for visual feedback
    setRoleTypes(prev => {
      const fromIdx = prev.findIndex(r => r.id === draggedId);
      const toIdx = prev.findIndex(r => r.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleDragEnd = async () => {
    const wasDragging = draggedId !== null;
    setDraggedId(null);
    setDragOverId(null);

    if (!wasDragging) return;

    // Save new order to server
    setIsSavingOrder(true);
    try {
      const orderedIds = roleTypes.map(r => r.id);
      const res = await fetch('/api/role-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });

      if (!res.ok) throw new Error('Failed to save order');

      queryClient.invalidateQueries({ queryKey: roleTypeKeys.all });
    } catch {
      toast.error('Chyba při ukládání pořadí');
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Typy rolí</CardTitle>
            {isSavingOrder && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Ukládám pořadí...
              </div>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="w-4 h-4 mr-2" />
            Přidat roli
          </Button>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Přetažením řádků změníte pořadí rolí ve všech nabídkách.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Hodnota (ID)</TableHead>
              <TableHead>Název</TableHead>
              <TableHead className="w-[120px]">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleTypes.map((roleType) => (
              <TableRow
                key={roleType.id}
                draggable={editingId === null && !isAdding}
                onDragStart={(e) => handleDragStart(e, roleType.id)}
                onDragOver={(e) => handleDragOver(e, roleType.id)}
                onDragEnd={handleDragEnd}
                className={`${
                  draggedId === roleType.id ? 'opacity-50 bg-blue-50' : ''
                } ${editingId === null && !isAdding ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {editingId === roleType.id ? (
                  <>
                    <TableCell>
                      <GripVertical className="w-4 h-4 text-slate-300" />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editRole.value}
                        onChange={(e) => setEditRole({ ...editRole, value: e.target.value })}
                        placeholder="sound"
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editRole.label}
                        onChange={(e) => setEditRole({ ...editRole, label: e.target.value })}
                        placeholder="Zvukař"
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(roleType.id)}
                          disabled={loading}
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                          disabled={loading}
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{roleType.value}</TableCell>
                    <TableCell>{roleType.label}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(roleType)}
                          disabled={loading || editingId !== null}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(roleType.id, roleType.label)}
                          disabled={loading || editingId !== null}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
            {isAdding && (
              <TableRow>
                <TableCell>
                  <GripVertical className="w-4 h-4 text-slate-300" />
                </TableCell>
                <TableCell>
                  <Input
                    value={newRole.value}
                    onChange={(e) => setNewRole({ ...newRole, value: e.target.value })}
                    placeholder="sound"
                    disabled={loading}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={newRole.label}
                    onChange={(e) => setNewRole({ ...newRole, label: e.target.value })}
                    placeholder="Zvukař"
                    disabled={loading}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAdd}
                      disabled={loading}
                    >
                      Uložit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsAdding(false);
                        setNewRole({ value: '', label: '' });
                      }}
                      disabled={loading}
                    >
                      Zrušit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {roleTypes.length === 0 && !isAdding && (
          <div className="text-center py-8 text-slate-500">
            Žádné role. Klikněte na &quot;Přidat roli&quot; pro vytvoření nové.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
