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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, X, Mail, UserPlus, Loader2, Check, CalendarDays } from 'lucide-react';
import { getRoleTypeLabel, getAttendanceStatusLabel, getAttendanceStatusColor, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import type { Position, Assignment, Profile, RoleType, AttendanceStatus } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  eventStartDate?: string;
  eventEndDate?: string;
}

interface EditDatesDialogState {
  open: boolean;
  assignmentId: string;
  technicianName: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

export default function PositionsManager({
  positions: initialPositions,
  eventId,
  isAdmin,
  allTechnicians = [],
  eventStartDate,
  eventEndDate,
}: PositionsManagerProps) {
  const queryClient = useQueryClient();
  const [positions, setPositions] = useState(initialPositions);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<{ [key: string]: string }>({});
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Dialog for editing assignment dates
  const [editDatesDialog, setEditDatesDialog] = useState<EditDatesDialogState>({
    open: false,
    assignmentId: '',
    technicianName: '',
    startDate: undefined,
    endDate: undefined,
  });

  // Parse event dates for calendar constraints
  const eventStart = eventStartDate ? new Date(eventStartDate) : undefined;
  const eventEnd = eventEndDate ? new Date(eventEndDate) : undefined;

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

  // Toggle role selection
  const toggleRole = (roleValue: string) => {
    setSelectedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleValue)) {
        newSet.delete(roleValue);
      } else {
        newSet.add(roleValue);
      }
      return newSet;
    });
  };

  // Add multiple positions at once
  const handleAddPositions = async () => {
    if (selectedRoles.size === 0) return;

    setLoading(true);

    try {
      const newPositions: (Position & { assignments: (Assignment & { technician: Profile })[] })[] = [];

      for (const roleValue of selectedRoles) {
        const role = roleTypes.find(r => r.value === roleValue);
        if (!role) continue;

        const response = await fetch('/api/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            title: role.label,
            role_type: roleValue,
          }),
        });

        if (response.ok) {
          const { position } = await response.json();
          newPositions.push({ ...position, assignments: [] });
        }
      }

      // Update UI with all new positions
      setPositions([...positions, ...newPositions]);
      setSelectedRoles(new Set());
      setPopoverOpen(false);

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      toast.error('Chyba při vytváření pozic');
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
      toast.error('Chyba při mazání pozice');
    }
  };

  // Open edit dates dialog for existing assignment
  const openEditDatesDialog = (assignment: Assignment & { technician: Profile }) => {
    setEditDatesDialog({
      open: true,
      assignmentId: assignment.id,
      technicianName: assignment.technician.full_name,
      startDate: assignment.start_date ? new Date(assignment.start_date) : undefined,
      endDate: assignment.end_date ? new Date(assignment.end_date) : undefined,
    });
  };

  // Save updated dates
  const saveAssignmentDates = async () => {
    const { assignmentId, startDate, endDate } = editDatesDialog;

    setEditDatesDialog(prev => ({ ...prev, open: false }));

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update dates');

      // Update local state
      setPositions(prev => prev.map(pos => ({
        ...pos,
        assignments: (pos.assignments || []).map(a =>
          a.id === assignmentId
            ? {
                ...a,
                start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
                end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
              }
            : a
        )
      })));

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      toast.error('Chyba při aktualizaci dat');
    }
  };

  // Direct assignment for the full event (no dialog needed)
  const handleAssignTechnician = async (positionId: string, technicianId: string) => {
    const tech = allTechnicians.find(t => t.id === technicianId);
    if (!tech) return;

    // OPTIMISTIC UPDATE - okamžitě aktualizuj UI s temporary ID
    const tempAssignment = {
      id: `temp-${Date.now()}`,
      position_id: positionId,
      technician_id: technicianId,
      attendance_status: 'pending' as const,
      start_date: null, // Full event by default
      end_date: null,
      technician: tech,
    };

    setPositions(prev => prev.map(pos => {
      if (pos.id === positionId) {
        return {
          ...pos,
          assignments: [...(pos.assignments || []), tempAssignment as Assignment & { technician: Profile }]
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
          // No dates = full event
        }),
      });

      if (!response.ok) throw new Error('Failed to assign technician');

      const { assignment } = await response.json();

      // Nahraď temporary assignment skutečným
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
      // ROLLBACK - odeber temporary assignment při chybě
      setPositions(prev => prev.map(pos => {
        if (pos.id === positionId) {
          return {
            ...pos,
            assignments: (pos.assignments || []).filter(a => a.id !== tempAssignment.id)
          };
        }
        return pos;
      }));
      toast.error('Chyba při přiřazování technika');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Opravdu odebrat přiřazení?')) return;

    // Backup pro rollback - extrahuj PŘED optimistic update
    const backupRef: { value: (Assignment & { technician: Profile }) | null } = { value: null };
    setPositions(prev => {
      backupRef.value = prev.find(pos =>
        pos.assignments?.some(a => a.id === assignmentId)
      )?.assignments?.find(a => a.id === assignmentId) ?? null;

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
      if (backupRef.value) {
        const savedBackup = backupRef.value;
        setPositions(prev => prev.map(pos => {
          if (pos.id === savedBackup.position_id) {
            return {
              ...pos,
              assignments: [...(pos.assignments || []), savedBackup]
            };
          }
          return pos;
        }));
      }
      toast.error('Chyba při odebírání přiřazení');
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
      toast.error('Chyba při aktualizaci statusu');
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
        toast.success('Pozvánka odeslána!');
      } else {
        toast.error('Chyba při odesílání pozvánky');
      }
    } catch (error) {
      toast.error('Chyba při odesílání pozvánky');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 md:pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-xl">Pozice a přiřazení</CardTitle>
          {isAdmin && (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs md:text-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 md:mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 md:mr-2" />
                  )}
                  <span className="hidden md:inline">Přidat pozice</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-0">
                <div className="text-xs font-medium text-slate-500 px-3 py-2 border-b">
                  Vyberte role
                </div>
                <div className="py-1 px-1">
                  {roleTypes.map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 cursor-pointer rounded"
                    >
                      <Checkbox
                        checked={selectedRoles.has(role.value)}
                        onCheckedChange={() => toggleRole(role.value)}
                      />
                      <span className="text-sm">{role.label}</span>
                    </label>
                  ))}
                </div>
                {selectedRoles.size > 0 && (
                  <div className="border-t px-2 py-2">
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      onClick={handleAddPositions}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Přidat {selectedRoles.size} {selectedRoles.size === 1 ? 'pozici' : selectedRoles.size < 5 ? 'pozice' : 'pozic'}
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
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
                        {(assignment.start_date || assignment.end_date) && (
                          <Badge variant="outline" className="text-xs gap-1 mt-1">
                            <CalendarDays className="w-3 h-3" />
                            {assignment.start_date && format(new Date(assignment.start_date), 'd.M.', { locale: cs })}
                            {assignment.start_date && assignment.end_date && ' - '}
                            {assignment.end_date && format(new Date(assignment.end_date), 'd.M.', { locale: cs })}
                          </Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDatesDialog(assignment)}
                            className="h-7 w-7 p-0"
                            title="Upravit období"
                          >
                            <CalendarDays className="w-4 h-4" />
                          </Button>
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
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500 truncate">
                                {assignment.technician.email}
                              </p>
                              {(assignment.start_date || assignment.end_date) && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {assignment.start_date && format(new Date(assignment.start_date), 'd.M.', { locale: cs })}
                                  {assignment.start_date && assignment.end_date && ' - '}
                                  {assignment.end_date && format(new Date(assignment.end_date), 'd.M.', { locale: cs })}
                                </Badge>
                              )}
                            </div>
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDatesDialog(assignment)}
                                  title="Upravit období"
                                >
                                  <CalendarDays className="w-4 h-4" />
                                </Button>
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
            </TableBody>
          </Table>
        </div>

        {positions.length === 0 && (
          <div className="text-center py-6 md:py-8 text-slate-500 text-sm">
            {isAdmin ? 'Zatím nejsou vytvořené žádné pozice.' : 'Pro tuto akci zatím nejsou vytvořené žádné pozice.'}
          </div>
        )}
      </CardContent>

      {/* Dialog for editing assignment dates */}
      <Dialog open={editDatesDialog.open} onOpenChange={(open) => setEditDatesDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upravit období účasti</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Technik: <strong>{editDatesDialog.technicianName}</strong>
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Od</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !editDatesDialog.startDate && "text-slate-400"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {editDatesDialog.startDate
                          ? format(editDatesDialog.startDate, "d. M. yyyy", { locale: cs })
                          : "Celá akce"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDatesDialog.startDate}
                        onSelect={(date) => setEditDatesDialog(prev => ({ ...prev, startDate: date }))}
                        disabled={eventStart && eventEnd ? { before: eventStart, after: eventEnd } : undefined}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Do</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !editDatesDialog.endDate && "text-slate-400"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {editDatesDialog.endDate
                          ? format(editDatesDialog.endDate, "d. M. yyyy", { locale: cs })
                          : "Celá akce"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDatesDialog.endDate}
                        onSelect={(date) => setEditDatesDialog(prev => ({ ...prev, endDate: date }))}
                        disabled={eventStart && eventEnd ? { before: editDatesDialog.startDate || eventStart, after: eventEnd } : undefined}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {(editDatesDialog.startDate || editDatesDialog.endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditDatesDialog(prev => ({ ...prev, startDate: undefined, endDate: undefined }))}
                  className="text-xs text-slate-500"
                >
                  Zrušit období (celá akce)
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDatesDialog(prev => ({ ...prev, open: false }))}>
              Zrušit
            </Button>
            <Button onClick={saveAssignmentDates}>
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
