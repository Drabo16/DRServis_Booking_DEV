'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, X, Mail, UserPlus } from 'lucide-react';
import { ROLE_TYPES } from '@/lib/constants';
import { getRoleTypeLabel, getAttendanceStatusLabel, getAttendanceStatusColor } from '@/lib/utils';
import type { Position, Assignment, Profile, RoleType, AttendanceStatus } from '@/types';
import { useRouter } from 'next/navigation';

interface PositionsManagerProps {
  positions: (Position & {
    assignments: (Assignment & { technician: Profile })[];
  })[];
  eventId: string;
  isAdmin: boolean;
  allTechnicians?: Profile[];
}

export default function PositionsManager({
  positions,
  eventId,
  isAdmin,
  allTechnicians = [],
}: PositionsManagerProps) {
  const router = useRouter();
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [newPosition, setNewPosition] = useState<{ role_type: RoleType | '', technicianId: string }>({
    role_type: '',
    technicianId: '',
  });
  const [loading, setLoading] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<{ [key: string]: string }>({});
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const handleAddPosition = async () => {
    if (!newPosition.role_type) return;

    setLoading(true);
    try {
      const roleLabel = ROLE_TYPES.find((t) => t.value === newPosition.role_type)?.label || newPosition.role_type;

      // Vytvoř pozici
      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          title: roleLabel,
          role_type: newPosition.role_type,
        }),
      });

      if (!response.ok) throw new Error('Failed to create position');

      const { position } = await response.json();

      // Přiřaď technika pokud je vybraný
      if (newPosition.technicianId) {
        await fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position_id: position.id,
            technician_id: newPosition.technicianId,
          }),
        });
      }

      setNewPosition({ role_type: '', technicianId: '' });
      setIsAddingPosition(false);
      router.refresh();
    } catch (error) {
      alert('Chyba při vytváření pozice');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    if (!confirm('Opravdu smazat tuto pozici?')) return;

    try {
      const response = await fetch(`/api/positions?id=${positionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete position');
      router.refresh();
    } catch (error) {
      alert('Chyba při mazání pozice');
    }
  };

  const handleAssignTechnician = async (positionId: string, technicianId: string) => {
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_id: positionId,
          technician_id: technicianId,
        }),
      });

      if (!response.ok) throw new Error('Failed to assign technician');

      setSelectedTechnician({ ...selectedTechnician, [positionId]: '' });
      router.refresh();
    } catch (error) {
      alert('Chyba při přiřazování technika');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Opravdu odebrat přiřazení?')) return;

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove assignment');
      router.refresh();
    } catch (error) {
      alert('Chyba při odebírání přiřazení');
    }
  };

  const handleStatusChange = async (assignmentId: string, newStatus: AttendanceStatus) => {
    setUpdatingStatus(assignmentId);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');
      router.refresh();
    } catch (error) {
      alert('Chyba při aktualizaci statusu');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleInvite = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });

      if (response.ok) {
        alert('Pozvánka odeslána!');
        router.refresh();
      } else {
        alert('Chyba při odesílání pozvánky');
      }
    } catch (error) {
      alert('Chyba při odesílání pozvánky');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pozice a přiřazení</CardTitle>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddingPosition(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Přidat pozici
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Typ role</TableHead>
              <TableHead>Přiřazení technici</TableHead>
              {isAdmin && <TableHead className="w-[100px]">Akce</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={position.id}>
                <TableCell className="font-medium">
                  <Badge variant="outline">{getRoleTypeLabel(position.role_type)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    {position.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {assignment.technician.full_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {assignment.technician.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isAdmin ? (
                            <>
                              <Select
                                value={assignment.attendance_status}
                                onValueChange={(value) =>
                                  handleStatusChange(assignment.id, value as AttendanceStatus)
                                }
                                disabled={updatingStatus === assignment.id}
                              >
                                <SelectTrigger className="w-32 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Čeká</SelectItem>
                                  <SelectItem value="accepted">Přijato</SelectItem>
                                  <SelectItem value="declined">Odmítnuto</SelectItem>
                                  <SelectItem value="tentative">Předběžně</SelectItem>
                                </SelectContent>
                              </Select>
                              {assignment.attendance_status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleInvite(assignment.id)}
                                >
                                  <Mail className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveAssignment(assignment.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Badge className={getAttendanceStatusColor(assignment.attendance_status)}>
                              {getAttendanceStatusLabel(assignment.attendance_status)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedTechnician[position.id] || ''}
                          onValueChange={(value) =>
                            setSelectedTechnician({ ...selectedTechnician, [position.id]: value })
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Vyberte technika..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allTechnicians
                              .filter(
                                (tech) =>
                                  !position.assignments.some((a) => a.technician_id === tech.id)
                              )
                              .map((tech) => (
                                <SelectItem key={tech.id} value={tech.id}>
                                  {tech.full_name} ({tech.email})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (selectedTechnician[position.id]) {
                              handleAssignTechnician(position.id, selectedTechnician[position.id]);
                            }
                          }}
                          disabled={!selectedTechnician[position.id]}
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletePosition(position.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {isAddingPosition && (
              <TableRow>
                <TableCell>
                  <Select
                    value={newPosition.role_type}
                    onValueChange={(value) =>
                      setNewPosition({ ...newPosition, role_type: value as RoleType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte typ role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_TYPES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={newPosition.technicianId}
                    onValueChange={(value) =>
                      setNewPosition({ ...newPosition, technicianId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte technika (volitelné)..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allTechnicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.full_name} ({tech.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddPosition}
                      disabled={!newPosition.role_type || loading}
                    >
                      Uložit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsAddingPosition(false);
                        setNewPosition({ role_type: '', technicianId: '' });
                      }}
                    >
                      Zrušit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {positions.length === 0 && !isAddingPosition && (
          <div className="text-center py-8 text-slate-500">
            {isAdmin ? 'Zatím nejsou vytvořené žádné pozice. Klikněte na "Přidat pozici".' : 'Pro tuto akci zatím nejsou vytvořené žádné pozice.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
