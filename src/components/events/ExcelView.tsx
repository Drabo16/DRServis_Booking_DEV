'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, Check, Loader2, Save, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { ROLE_TYPES } from '@/lib/constants';
import type { Event, Position, Assignment, Profile, RoleType, AttendanceStatus } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/hooks/useEvents';

interface ExcelViewProps {
  events: Array<Event & {
    positions?: Array<Position & {
      assignments?: Array<Assignment & { technician: Profile }>;
    }>;
  }>;
  isAdmin: boolean;
  allTechnicians: Profile[];
  userId: string;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving';

// Pending operation types
type PendingOperation =
  | { type: 'addRole'; eventId: string; roleType: RoleType }
  | { type: 'removeRole'; eventId: string; roleType: RoleType; positionIds: string[] }
  | { type: 'assignTechnician'; eventId: string; roleType: RoleType; technicianId: string; tempId: string }
  | { type: 'removeAssignment'; assignmentId: string; positionId: string; eventId: string }
  | { type: 'updateStatus'; assignmentId: string; newStatus: AttendanceStatus };

export default function ExcelView({ events, isAdmin, allTechnicians, userId }: ExcelViewProps) {
  const queryClient = useQueryClient();

  // Refs for initialization
  const initializedRef = useRef(false);
  const initialEventsRef = useRef<typeof events | null>(null);

  // Capture initial events ONCE
  if (initialEventsRef.current === null) {
    initialEventsRef.current = events;
  }

  // LOCAL STATE - single source of truth
  const [localData, setLocalData] = useState<typeof events>(() => initialEventsRef.current || []);
  const [visibleRoles, setVisibleRoles] = useState<Record<string, Set<RoleType>>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);

  // Refs for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Initialize visible roles from data - ONCE
  useEffect(() => {
    if (initializedRef.current) return;

    const newVisibleRoles: Record<string, Set<RoleType>> = {};
    localData.forEach((event) => {
      const usedRoles = new Set<RoleType>();
      (event.positions || []).forEach((pos) => {
        usedRoles.add(pos.role_type);
      });
      newVisibleRoles[event.id] = usedRoles;
    });
    setVisibleRoles(newVisibleRoles);
    initializedRef.current = true;
  }, [localData]);

  // Schedule auto-save after 5 seconds of inactivity
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('unsaved');

    saveTimeoutRef.current = setTimeout(() => {
      saveToDatabase();
    }, 5000);
  }, []);

  // CTRL+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveToDatabase();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingOperations]);

  // Save all pending operations to database
  const saveToDatabase = useCallback(async () => {
    if (isSavingRef.current || pendingOperations.length === 0) {
      if (pendingOperations.length === 0) {
        setSaveStatus('saved');
      }
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    const operations = [...pendingOperations];

    try {
      for (const op of operations) {
        switch (op.type) {
          case 'addRole': {
            const roleLabel = ROLE_TYPES.find(r => r.value === op.roleType)?.label || op.roleType;
            await fetch('/api/positions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_id: op.eventId,
                title: roleLabel,
                role_type: op.roleType,
              }),
            });
            break;
          }

          case 'removeRole': {
            // Delete all positions for this role (only real ones, not temp)
            const realIds = op.positionIds.filter(id => !id.startsWith('temp-'));
            await Promise.all(
              realIds.map(posId =>
                fetch(`/api/positions?id=${posId}`, { method: 'DELETE' })
              )
            );
            break;
          }

          case 'assignTechnician': {
            const roleLabel = ROLE_TYPES.find(r => r.value === op.roleType)?.label || op.roleType;

            // Create position
            const posResponse = await fetch('/api/positions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_id: op.eventId,
                title: roleLabel,
                role_type: op.roleType,
              }),
            });

            if (!posResponse.ok) continue;
            const { position } = await posResponse.json();

            // Create assignment
            await fetch('/api/assignments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                position_id: position.id,
                technician_id: op.technicianId,
              }),
            });
            break;
          }

          case 'removeAssignment': {
            if (op.assignmentId.startsWith('temp-')) continue;

            await fetch(`/api/assignments/${op.assignmentId}`, {
              method: 'DELETE',
            });

            // Delete position if it was the only assignment
            if (!op.positionId.startsWith('temp-')) {
              await fetch(`/api/positions?id=${op.positionId}`, {
                method: 'DELETE',
              });
            }
            break;
          }

          case 'updateStatus': {
            if (op.assignmentId.startsWith('temp-')) continue;

            await fetch(`/api/assignments/${op.assignmentId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ attendance_status: op.newStatus }),
            });
            break;
          }
        }
      }

      // Clear pending operations after successful save
      setPendingOperations([]);
      setSaveStatus('saved');

      // Invalidate queries to sync with other views (but don't update local state)
      queryClient.invalidateQueries({ queryKey: eventKeys.list() });

    } catch (error) {
      console.error('Error saving to database:', error);
      setSaveStatus('unsaved');
    } finally {
      isSavingRef.current = false;
    }
  }, [pendingOperations, queryClient]);

  // Toggle role checkbox
  const toggleRole = useCallback((eventId: string, roleType: RoleType) => {
    setVisibleRoles(prev => {
      const eventRoles = new Set(prev[eventId] || []);

      if (eventRoles.has(roleType)) {
        // Unchecking - remove role and all its positions/assignments
        const event = localData.find(e => e.id === eventId);
        const rolePositions = (event?.positions || []).filter(p => p.role_type === roleType);

        if (rolePositions.length > 0) {
          // Remove from local data
          setLocalData(prevData => prevData.map(e => {
            if (e.id !== eventId) return e;
            return {
              ...e,
              positions: (e.positions || []).filter(p => p.role_type !== roleType)
            };
          }));

          // Add pending operation
          setPendingOperations(prev => [...prev, {
            type: 'removeRole',
            eventId,
            roleType,
            positionIds: rolePositions.map(p => p.id)
          }]);
        }

        eventRoles.delete(roleType);
      } else {
        // Checking - just add to visible (no DB operation yet)
        eventRoles.add(roleType);
      }

      return { ...prev, [eventId]: eventRoles };
    });

    scheduleAutoSave();
  }, [localData, scheduleAutoSave]);

  // Add technician to role
  const addTechnician = useCallback((eventId: string, roleType: RoleType, technicianId: string) => {
    const tech = allTechnicians.find(t => t.id === technicianId);
    if (!tech) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const roleLabel = ROLE_TYPES.find(r => r.value === roleType)?.label || roleType;

    // Update local data immediately
    setLocalData(prev => prev.map(event => {
      if (event.id !== eventId) return event;

      const newPosition = {
        id: tempId,
        event_id: eventId,
        title: roleLabel,
        role_type: roleType,
        requirements: null,
        shift_start: null,
        shift_end: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignments: [{
          id: tempId,
          position_id: tempId,
          event_id: eventId,
          technician_id: technicianId,
          attendance_status: 'pending' as AttendanceStatus,
          response_time: null,
          notes: null,
          assigned_by: null,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          technician: tech
        }]
      };

      return {
        ...event,
        positions: [...(event.positions || []), newPosition]
      };
    }));

    // Add pending operation
    setPendingOperations(prev => [...prev, {
      type: 'assignTechnician',
      eventId,
      roleType,
      technicianId,
      tempId
    }]);

    scheduleAutoSave();
  }, [allTechnicians, scheduleAutoSave]);

  // Remove assignment
  const removeAssignment = useCallback((assignmentId: string, positionId: string, eventId: string) => {
    // Update local data immediately
    setLocalData(prev => prev.map(event => {
      if (event.id !== eventId) return event;
      return {
        ...event,
        positions: (event.positions || []).filter(p => p.id !== positionId)
      };
    }));

    // Add pending operation (only for real IDs)
    if (!assignmentId.startsWith('temp-')) {
      setPendingOperations(prev => [...prev, {
        type: 'removeAssignment',
        assignmentId,
        positionId,
        eventId
      }]);
    }

    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Update status
  const updateStatus = useCallback((assignmentId: string, newStatus: AttendanceStatus, eventId: string, positionId: string) => {
    // Update local data immediately
    setLocalData(prev => prev.map(event => {
      if (event.id !== eventId) return event;
      return {
        ...event,
        positions: (event.positions || []).map(pos => {
          if (pos.id !== positionId) return pos;
          return {
            ...pos,
            assignments: (pos.assignments || []).map(a =>
              a.id === assignmentId ? { ...a, attendance_status: newStatus } : a
            )
          };
        })
      };
    }));

    // Add pending operation
    if (!assignmentId.startsWith('temp-')) {
      setPendingOperations(prev => [...prev, {
        type: 'updateStatus',
        assignmentId,
        newStatus
      }]);
    }

    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Get assignments for role
  const getAssignmentsForRole = (event: typeof localData[0], roleType: RoleType) => {
    return (event.positions || [])
      .filter(p => p.role_type === roleType)
      .flatMap(pos =>
        (pos.assignments || []).map(a => ({
          ...a,
          positionId: pos.id
        }))
      );
  };

  // Get event stats
  const getEventStats = (event: typeof localData[0]) => {
    const positions = event.positions || [];
    const roleTypes = new Set(positions.map(p => p.role_type));
    const total = roleTypes.size;
    const filled = Array.from(roleTypes).filter(roleType => {
      const rolePositions = positions.filter(p => p.role_type === roleType);
      return rolePositions.some(p =>
        p.assignments?.some(a => a.attendance_status === 'accepted')
      );
    }).length;
    return { total, filled, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 };
  };

  // Status colors
  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
      case 'declined': return 'bg-red-100 text-red-800 border-red-200';
      case 'tentative': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header with save status and button */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-600">Ukládám...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600">Uloženo</span>
            </>
          )}
          {saveStatus === 'unsaved' && (
            <>
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-sm text-amber-600">
                Neuložené změny ({pendingOperations.length})
              </span>
            </>
          )}
        </div>

        <Button
          size="sm"
          onClick={saveToDatabase}
          disabled={saveStatus === 'saving' || pendingOperations.length === 0}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          Uložit (Ctrl+S)
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px] sticky left-0 bg-white z-10">Akce</TableHead>
              <TableHead className="w-[90px]">Datum</TableHead>
              <TableHead>Role a přiřazení</TableHead>
              <TableHead className="w-[70px] text-center">Obsaz.</TableHead>
              <TableHead className="w-[50px] sticky right-0 bg-white z-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localData.map((event) => {
              const stats = getEventStats(event);
              const eventVisibleRoles = visibleRoles[event.id] || new Set();

              return (
                <TableRow key={event.id}>
                  {/* Event name */}
                  <TableCell className="font-medium sticky left-0 bg-white">
                    <div className="line-clamp-2 text-sm">{event.title}</div>
                  </TableCell>

                  {/* Date */}
                  <TableCell className="text-xs text-slate-600">
                    {format(new Date(event.start_time), 'd.M.yy', { locale: cs })}
                  </TableCell>

                  {/* Roles and assignments */}
                  <TableCell className="p-2">
                    <div className="flex flex-wrap gap-2">
                      {/* Role checkboxes */}
                      <div className="flex flex-wrap gap-1 pr-3 border-r border-slate-200">
                        {ROLE_TYPES.map(role => {
                          const isChecked = eventVisibleRoles.has(role.value);
                          const hasAssignments = getAssignmentsForRole(event, role.value).length > 0;

                          return (
                            <label
                              key={role.value}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? hasAssignments
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-blue-50 border border-blue-200'
                                  : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => isAdmin && toggleRole(event.id, role.value)}
                                disabled={!isAdmin}
                                className="w-3.5 h-3.5"
                              />
                              <span>{role.label}</span>
                              {hasAssignments && (
                                <span className="text-green-600 font-medium">
                                  ({getAssignmentsForRole(event, role.value).length})
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>

                      {/* Assignments for checked roles */}
                      <div className="flex flex-wrap gap-2 flex-1">
                        {Array.from(eventVisibleRoles).map(roleType => {
                          const role = ROLE_TYPES.find(r => r.value === roleType);
                          const assignments = getAssignmentsForRole(event, roleType);

                          if (!role) return null;

                          return (
                            <div key={roleType} className="flex items-center gap-1">
                              <span className="text-xs font-medium text-slate-500">{role.label}:</span>

                              {assignments.map(assignment => (
                                <div
                                  key={assignment.id}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${getStatusColor(assignment.attendance_status)}`}
                                >
                                  <span className="font-medium">
                                    {assignment.technician?.full_name?.split(' ')[0] || '?'}
                                  </span>

                                  {isAdmin && (
                                    <>
                                      <Select
                                        value={assignment.attendance_status}
                                        onValueChange={(v) => updateStatus(assignment.id, v as AttendanceStatus, event.id, assignment.positionId)}
                                      >
                                        <SelectTrigger className="h-4 w-4 p-0 border-0 bg-transparent [&>svg]:hidden">
                                          <span className="text-[10px]">▼</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Čeká</SelectItem>
                                          <SelectItem value="accepted">Přijato</SelectItem>
                                          <SelectItem value="declined">Odmítnuto</SelectItem>
                                          <SelectItem value="tentative">Možná</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <button
                                        onClick={() => removeAssignment(assignment.id, assignment.positionId, event.id)}
                                        className="hover:text-red-600"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              ))}

                              {/* Add person to this role */}
                              {isAdmin && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-dashed border-slate-300 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-600">
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-48 p-1">
                                    <div className="max-h-48 overflow-y-auto">
                                      {allTechnicians
                                        .filter(t => !assignments.some(a => a.technician_id === t.id))
                                        .map(tech => (
                                          <button
                                            key={tech.id}
                                            onClick={() => addTechnician(event.id, roleType, tech.id)}
                                            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100"
                                          >
                                            {tech.full_name}
                                          </button>
                                        ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          );
                        })}

                        {eventVisibleRoles.size === 0 && (
                          <span className="text-xs text-slate-400 italic">
                            Zaškrtněte role vlevo
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Stats */}
                  <TableCell className="text-center">
                    {stats.total > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className={`text-xs font-semibold ${
                          stats.percentage === 100 ? 'text-green-600' :
                          stats.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {stats.filled}/{stats.total}
                        </span>
                        <div className="w-8 h-1 bg-slate-200 rounded-full mt-0.5">
                          <div
                            className={`h-full rounded-full ${
                              stats.percentage === 100 ? 'bg-green-600' :
                              stats.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${stats.percentage}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>

                  {/* Add role button */}
                  <TableCell className="sticky right-0 bg-white">
                    {isAdmin && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1" align="end">
                          {ROLE_TYPES.filter(r => !eventVisibleRoles.has(r.value)).map(role => (
                            <button
                              key={role.value}
                              onClick={() => toggleRole(event.id, role.value)}
                              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100"
                            >
                              {role.label}
                            </button>
                          ))}
                          {ROLE_TYPES.every(r => eventVisibleRoles.has(r.value)) && (
                            <div className="px-2 py-1.5 text-sm text-slate-400">
                              Všechny role přidány
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {localData.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          Žádné akce k zobrazení
        </div>
      )}
    </div>
  );
}
