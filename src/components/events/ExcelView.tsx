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
import { X, Plus, Check, Loader2, Save, Users, FolderPlus, Settings } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import type { Event, Position, Assignment, Profile, RoleType, AttendanceStatus } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/hooks/useEvents';

interface RoleTypeDB {
  id: string;
  value: string;
  label: string;
}

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
  | { type: 'addRole'; eventId: string; roleType: string }
  | { type: 'removeRole'; eventId: string; roleType: string; positionIds: string[] }
  | { type: 'assignTechnician'; eventId: string; roleType: string; technicianId: string; tempId: string }
  | { type: 'removeAssignment'; assignmentId: string; positionId: string; eventId: string }
  | { type: 'updateStatus'; assignmentId: string; newStatus: AttendanceStatus };

export default function ExcelView({ events, isAdmin, allTechnicians, userId }: ExcelViewProps) {
  const queryClient = useQueryClient();

  // Role types from database
  const [roleTypes, setRoleTypes] = useState<RoleTypeDB[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // Multiselect state
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  // Refs for initialization
  const initializedRef = useRef(false);
  const initialEventsRef = useRef<typeof events | null>(null);

  // Capture initial events ONCE
  if (initialEventsRef.current === null) {
    initialEventsRef.current = events;
  }

  // LOCAL STATE - single source of truth
  const [localData, setLocalData] = useState<typeof events>(() => initialEventsRef.current || []);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);

  // Refs for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

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

  // Schedule auto-save after 2 seconds of inactivity (faster!)
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('unsaved');

    saveTimeoutRef.current = setTimeout(() => {
      saveToDatabase();
    }, 2000); // Reduced from 5000 to 2000ms
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
            const roleLabel = roleTypes.find(r => r.value === op.roleType)?.label || op.roleType;
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
            const realIds = op.positionIds.filter(id => !id.startsWith('temp-'));
            await Promise.all(
              realIds.map(posId =>
                fetch(`/api/positions?id=${posId}`, { method: 'DELETE' })
              )
            );
            break;
          }

          case 'assignTechnician': {
            const roleLabel = roleTypes.find(r => r.value === op.roleType)?.label || op.roleType;

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

      setPendingOperations([]);
      setSaveStatus('saved');

      queryClient.invalidateQueries({ queryKey: eventKeys.list() });

    } catch (error) {
      console.error('Error saving to database:', error);
      setSaveStatus('unsaved');
    } finally {
      isSavingRef.current = false;
    }
  }, [pendingOperations, queryClient, roleTypes]);

  // Add technician to role
  const addTechnician = useCallback((eventId: string, roleType: string, technicianId: string) => {
    const tech = allTechnicians.find(t => t.id === technicianId);
    if (!tech) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const roleLabel = roleTypes.find(r => r.value === roleType)?.label || roleType;

    setLocalData(prev => prev.map(event => {
      if (event.id !== eventId) return event;

      const newPosition = {
        id: tempId,
        event_id: eventId,
        title: roleLabel,
        role_type: roleType as RoleType,
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

    setPendingOperations(prev => [...prev, {
      type: 'assignTechnician',
      eventId,
      roleType,
      technicianId,
      tempId
    }]);

    scheduleAutoSave();
  }, [allTechnicians, roleTypes, scheduleAutoSave]);

  // Remove assignment
  const removeAssignment = useCallback((assignmentId: string, positionId: string, eventId: string) => {
    setLocalData(prev => prev.map(event => {
      if (event.id !== eventId) return event;
      return {
        ...event,
        positions: (event.positions || []).filter(p => p.id !== positionId)
      };
    }));

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
  const getAssignmentsForRole = (event: typeof localData[0], roleType: string) => {
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
    const roleTypesSet = new Set(positions.map(p => p.role_type));
    const total = roleTypesSet.size;
    const filled = Array.from(roleTypesSet).filter(roleType => {
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

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedEvents.size === localData.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(localData.map(e => e.id)));
    }
  };

  // Toggle single event
  const toggleSelectEvent = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  // Bulk create drive folders
  const bulkCreateDriveFolders = async () => {
    if (selectedEvents.size === 0) return;
    if (!confirm(`Vytvořit Drive složky pro ${selectedEvents.size} akcí?`)) return;

    for (const eventId of selectedEvents) {
      const event = localData.find(e => e.id === eventId);
      if (event && !event.drive_folder_id) {
        try {
          await fetch(`/api/events/${eventId}/drive`, { method: 'POST' });
        } catch (error) {
          console.error(`Error creating folder for ${eventId}:`, error);
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    setSelectedEvents(new Set());
  };

  if (loadingRoles) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (roleTypes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">Žádné typy rolí</h3>
        <p className="text-slate-500 mb-4">
          Nejprve vytvořte typy rolí v nastavení, aby se zobrazily sloupce pro přiřazování techniků.
        </p>
        {isAdmin && (
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="w-4 h-4 mr-2" />
              Přejít do nastavení
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header with save status, bulk actions, and button */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
        <div className="flex items-center gap-4">
          {/* Save status */}
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

          {/* Bulk actions */}
          {isAdmin && selectedEvents.size > 0 && (
            <div className="flex items-center gap-2 pl-4 border-l">
              <span className="text-sm text-slate-600">
                Vybráno: {selectedEvents.size}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={bulkCreateDriveFolders}
                className="gap-1"
              >
                <FolderPlus className="w-4 h-4" />
                Vytvořit složky
              </Button>
            </div>
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

      {/* Table with horizontal scroll */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedEvents.size === localData.length && localData.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-[180px] sticky left-0 bg-white z-10">Akce</TableHead>
              <TableHead className="w-[90px]">Datum</TableHead>
              {/* Dynamic role columns */}
              {roleTypes.map(role => (
                <TableHead key={role.id} className="min-w-[150px]">
                  {role.label}
                </TableHead>
              ))}
              <TableHead className="w-[70px] text-center">Obsaz.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localData.map((event) => {
              const stats = getEventStats(event);

              return (
                <TableRow key={event.id}>
                  {/* Checkbox */}
                  {isAdmin && (
                    <TableCell>
                      <Checkbox
                        checked={selectedEvents.has(event.id)}
                        onCheckedChange={() => toggleSelectEvent(event.id)}
                      />
                    </TableCell>
                  )}

                  {/* Event name */}
                  <TableCell className="font-medium sticky left-0 bg-white">
                    <div className="line-clamp-2 text-sm">{event.title}</div>
                  </TableCell>

                  {/* Date */}
                  <TableCell className="text-xs text-slate-600">
                    {format(new Date(event.start_time), 'd.M.yy', { locale: cs })}
                  </TableCell>

                  {/* Role columns */}
                  {roleTypes.map(role => {
                    const assignments = getAssignmentsForRole(event, role.value);

                    return (
                      <TableCell key={role.id} className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {assignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${getStatusColor(assignment.attendance_status)}`}
                            >
                              <span className="font-medium max-w-[80px] truncate">
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

                          {/* Add person dropdown */}
                          {isAdmin && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-dashed border-slate-300 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <Plus className="w-3 h-3" />
                                  <span className="hidden sm:inline">Poptat</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-1">
                                <div className="text-xs font-medium text-slate-500 px-2 py-1">
                                  Poptat osobu
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {allTechnicians
                                    .filter(t => !assignments.some(a => a.technician_id === t.id))
                                    .map(tech => (
                                      <button
                                        key={tech.id}
                                        onClick={() => addTechnician(event.id, role.value, tech.id)}
                                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100"
                                      >
                                        {tech.full_name}
                                      </button>
                                    ))}
                                  {allTechnicians.filter(t => !assignments.some(a => a.technician_id === t.id)).length === 0 && (
                                    <div className="px-2 py-1.5 text-sm text-slate-400">
                                      Všichni přiřazeni
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}

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
