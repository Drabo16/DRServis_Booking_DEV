'use client';

import { useState, useEffect } from 'react';
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
import { Plus, Trash2, X, Mail, UserPlus, Loader2 } from 'lucide-react';
import { getRoleTypeLabel, getAttendanceStatusLabel, getAttendanceStatusColor } from '@/lib/utils';
import type { Position, Assignment, Profile, RoleType, AttendanceStatus } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/hooks/useEvents';

interface RoleTypeDB {
  id: string;
  value: string;
  label: string;
}

interface PositionsManagerProps {
  positions: (Position & {
    assignments: (Assignment & { technician: Profile })[];
  })[];
  eventId: string;
  isAdmin: boolean;
  allTechnicians?: Profile[];
}

export default function PositionsManager({
  positions: initialPositions,
  eventId,
  isAdmin,
  allTechnicians = [],
}: PositionsManagerProps) {
  const queryClient = useQueryClient();
  const [positions, setPositions] = useState(initialPositions);
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [newPosition, setNewPosition] = useState<{ role_type: RoleType | '', technicianId: string }>({
    role_type: '',
    technicianId: '',
  });
  const [loading, setLoading] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<{ [key: string]: string }>({});
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Dynamic role types from database
  const [roleTypes, setRoleTypes] = useState<RoleTypeDB[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // Load role types from database
  useEffect(() => {
    const fetchRoleTypes = async () => {
      try {
        const res = await fetch('/api/role-types');
        if (res.ok) {
          const data = await res.json();
          setRoleTypes(data.roleTypes || []);
        }
      } catch (error) {
        console.error('Error fetching role types:', error);
      } finally {
        setLoadingRoles(false);
      }
    };
    fetchRoleTypes();
  }, []);

  // Sync local state with props when React Query cache updates
  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  const handleAddPosition = async () => {
    if (!newPosition.role_type) return;

    setLoading(true);
    const roleLabel = roleTypes.find((t) => t.value === newPosition.role_type)?.label || newPosition.role_type;

    try {
      // Server call
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
        const assignResp = await fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position_id: position.id,
            technician_id: newPosition.technicianId,
          }),
        });

        if (assignResp.ok) {
          const { assignment } = await assignResp.json();

          // Manuální update UI bez router.refresh
          const tech = allTechnicians.find(t => t.id === newPosition.technicianId);
          const newPos: any = {
            ...position,
            assignments: assignment && tech ? [{
              ...assignment,
              technician: tech
            }] : []
          };
          setPositions([...positions, newPos]);
        }
      } else {
        // Přidej prázdnou pozici
        setPositions([...positions, { ...position, assignments: [] } as any]);
      }

      setNewPosition({ role_type: '', technicianId: '' });
      setIsAddingPosition(false);

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
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

      // Manuální update UI bez router.refresh
      setPositions(positions.filter(p => p.id !== positionId));

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      alert('Chyba při mazání pozice');
    }
  };

  const handleAssignTechnician = async (positionId: string, technicianId: string) => {
    const tech = allTechnicians.find(t => t.id === technicianId);
    if (!tech) return;

    // OPTIMISTIC UPDATE - okamžitě aktualizuj UI s temporary ID
    const tempAssignment = {
      id: `temp-${Date.now()}`,
      position_id: positionId,
      technician_id: technicianId,
      attendance_status: 'pending' as const,
      technician: tech,
    };

    setPositions(prev => prev.map(pos => {
      if (pos.id === positionId) {
        return {
          ...pos,
          assignments: [...(pos.assignments || []), tempAssignment as any]
        };
      }
      return pos;
    }));
    setSelectedTechnician({ ...selectedTechnician, [positionId]: '' });

    // Server call na pozadí
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

      const { assignment } = await response.json();

      // Nahraď temporary assignment skutečným - POUŽIJ PREV!
      setPositions(prev => prev.map(pos => {
        if (pos.id === positionId) {
          return {
            ...pos,
            assignments: (pos.assignments || []).map(a =>
              a.id === tempAssignment.id ? { ...assignment, technician: tech } : a
            )
          };
        }
        return pos;
      }));

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      // ROLLBACK - odeber temporary assignment při chybě - POUŽIJ PREV!
      setPositions(prev => prev.map(pos => {
        if (pos.id === positionId) {
          return {
            ...pos,
            assignments: (pos.assignments || []).filter(a => a.id !== tempAssignment.id)
          };
        }
        return pos;
      }));
      alert('Chyba při přiřazování technika');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Opravdu odebrat přiřazení?')) return;

    // Backup pro rollback - extrahuj PŘED optimistic update
    let backup: any = null;
    setPositions(prev => {
      backup = prev.find(pos =>
        pos.assignments?.some(a => a.id === assignmentId)
      )?.assignments?.find(a => a.id === assignmentId);

      // OPTIMISTIC UPDATE - okamžitě odeber z UI
      return prev.map(pos => ({
        ...pos,
        assignments: (pos.assignments || []).filter(a => a.id !== assignmentId)
      }));
    });

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove assignment');

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      // ROLLBACK - vrať assignment zpět - POUŽIJ PREV!
      if (backup) {
        setPositions(prev => prev.map(pos => {
          if (pos.id === backup.position_id) {
            return {
              ...pos,
              assignments: [...(pos.assignments || []), backup]
            };
          }
          return pos;
        }));
      }
      alert('Chyba při odebírání přiřazení');
    }
  };

  const handleStatusChange = async (assignmentId: string, newStatus: AttendanceStatus) => {
    // Backup starého statusu pro rollback - extrahuj PŘED optimistic update
    let oldStatus: AttendanceStatus | undefined;
    setPositions(prev => {
      oldStatus = prev
        .flatMap(pos => pos.assignments || [])
        .find(a => a.id === assignmentId)?.attendance_status;

      // OPTIMISTIC UPDATE - okamžitě změň status v UI
      return prev.map(pos => ({
        ...pos,
        assignments: (pos.assignments || []).map(a =>
          a.id === assignmentId ? { ...a, attendance_status: newStatus } : a
        )
      }));
    });

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      // ROLLBACK - vrať starý status - POUŽIJ PREV!
      if (oldStatus) {
        setPositions(prev => prev.map(pos => ({
          ...pos,
          assignments: (pos.assignments || []).map(a =>
            a.id === assignmentId ? { ...a, attendance_status: oldStatus! } : a
          )
        })));
      }
      alert('Chyba při aktualizaci statusu');
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
      } else {
        alert('Chyba při odesílání pozvánky');
      }
    } catch (error) {
      alert('Chyba při odesílání pozvánky');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 md:pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-xl">Pozice a přiřazení</CardTitle>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddingPosition(true)}
              className="text-xs md:text-sm"
            >
              <Plus className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Přidat pozici</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2 md:p-6">
        {/* Mobile: Card layout */}
        <div className="md:hidden space-y-3">
          {positions.map((position) => (
            <div key={position.id} className="border rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-xs">{getRoleTypeLabel(position.role_type)}</Badge>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeletePosition(position.id)}
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {position.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex flex-col gap-2 p-2 bg-white rounded-md border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {assignment.technician.full_name}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 ml-2">
                          {assignment.attendance_status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleInvite(assignment.id)}
                              className="h-7 w-7 p-0"
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveAssignment(assignment.id)}
                            className="h-7 w-7 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {isAdmin ? (
                      <Select
                        value={assignment.attendance_status}
                        onValueChange={(value) =>
                          handleStatusChange(assignment.id, value as AttendanceStatus)
                        }
                        disabled={updatingStatus === assignment.id}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Čeká</SelectItem>
                          <SelectItem value="accepted">Přijato</SelectItem>
                          <SelectItem value="declined">Odmítnuto</SelectItem>
                          <SelectItem value="tentative">Předběžně</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`${getAttendanceStatusColor(assignment.attendance_status)} text-xs`}>
                        {getAttendanceStatusLabel(assignment.attendance_status)}
                      </Badge>
                    )}
                  </div>
                ))}
                {isAdmin && (
                  <div className="flex items-center gap-2 pt-1">
                    <Select
                      value={selectedTechnician[position.id] || ''}
                      onValueChange={(value) =>
                        setSelectedTechnician({ ...selectedTechnician, [position.id]: value })
                      }
                    >
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue placeholder="Přidat technika..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allTechnicians
                          .filter(
                            (tech) =>
                              !position.assignments.some((a) => a.technician_id === tech.id)
                          )
                          .map((tech) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.full_name}
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
                      className="h-8 w-8 p-0"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Mobile: Add position form */}
          {isAddingPosition && (
            <div className="border rounded-lg p-3 bg-blue-50 space-y-2">
              <Select
                value={newPosition.role_type}
                onValueChange={(value) =>
                  setNewPosition({ ...newPosition, role_type: value as RoleType })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Vyberte typ role..." />
                </SelectTrigger>
                <SelectContent>
                  {roleTypes.map((role) => (
                    <SelectItem key={role.id} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newPosition.technicianId}
                onValueChange={(value) =>
                  setNewPosition({ ...newPosition, technicianId: value })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Technik (volitelné)..." />
                </SelectTrigger>
                <SelectContent>
                  {allTechnicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddPosition}
                  disabled={!newPosition.role_type || loading}
                  className="flex-1 h-8 text-xs"
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
                  className="h-8 text-xs"
                >
                  Zrušit
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: Table layout */}
        <div className="hidden md:block">
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
                        {roleTypes.map((role) => (
                          <SelectItem key={role.id} value={role.value}>
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
        </div>

        {positions.length === 0 && !isAddingPosition && (
          <div className="text-center py-6 md:py-8 text-slate-500 text-sm">
            {isAdmin ? 'Zatím nejsou vytvořené žádné pozice.' : 'Pro tuto akci zatím nejsou vytvořené žádné pozice.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
