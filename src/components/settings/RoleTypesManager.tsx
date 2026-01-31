'use client';

import { useState } from 'react';
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
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';

interface RoleType {
  id: string;
  value: string;
  label: string;
}

interface RoleTypesManagerProps {
  initialRoleTypes: RoleType[];
}

export default function RoleTypesManager({ initialRoleTypes }: RoleTypesManagerProps) {
  const [roleTypes, setRoleTypes] = useState<RoleType[]>(initialRoleTypes);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ value: '', label: '' });
  const [editRole, setEditRole] = useState({ value: '', label: '' });
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newRole.value || !newRole.label) {
      alert('Vyplňte všechna pole');
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
      // Immediately update local state with new role
      setRoleTypes(prev => [...prev, data.roleType]);
      setNewRole({ value: '', label: '' });
      setIsAdding(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Chyba při vytváření role');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editRole.value || !editRole.label) {
      alert('Vyplňte všechna pole');
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
      // Immediately update local state with edited role
      setRoleTypes(prev => prev.map(rt => rt.id === id ? data.roleType : rt));
      setEditingId(null);
    } catch (error) {
      alert('Chyba při aktualizaci role');
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

      // Immediately update local state by removing deleted role
      setRoleTypes(prev => prev.filter(rt => rt.id !== id));
    } catch (error) {
      alert('Chyba při mazání role');
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Typy rolí</CardTitle>
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="w-4 h-4 mr-2" />
            Přidat roli
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hodnota (ID)</TableHead>
              <TableHead>Název</TableHead>
              <TableHead className="w-[120px]">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleTypes.map((roleType) => (
              <TableRow key={roleType.id}>
                {editingId === roleType.id ? (
                  <>
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
            Žádné role. Klikněte na "Přidat roli" pro vytvoření nové.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
