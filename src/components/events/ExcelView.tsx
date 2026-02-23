'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
// NOTE: We intentionally use raw <table> elements instead of the Table UI component
// because Table wraps <table> in a <div class="overflow-auto"> which creates a nested
// scroll context that breaks sticky header positioning.
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
import { X, Plus, Check, Loader2, Save, Users, FolderPlus, Settings, FolderOpen, Calendar, Link2, RefreshCw, Trash2 } from 'lucide-react';
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
  | { type: 'fillEmptyPosition'; eventId: string; positionId: string; technicianId: string; tempId: string }
  | { type: 'removeAssignment'; assignmentId: string; positionId: string; eventId: string }
  | { type: 'updateStatus'; assignmentId: string; newStatus: AttendanceStatus };

export default function ExcelView({ events, isAdmin, allTechnicians, userId }: ExcelViewProps) {
  const queryClient = useQueryClient();

  // Role types from database - cached across tab switches
  const { data: roleTypes = [], isLoading: loadingRoles } = useQuery<RoleTypeDB[]>({
    queryKey: ['roleTypes'],
    queryFn: async () => {
      const res = await fetch('/api/role-types');
      if (!res.ok) return [];
      const data = await res.json();
      return data.roleTypes || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - role types rarely change
  });

  // Pagination - load 10 events at a time
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Multiselect state
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  // LOCAL STATE - single source of truth
  const [localData, setLocalData] = useState<typeof events>(events);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const prevEventsRef = useRef(events);

  // Sync localData when events prop changes (search filter, new data from server)
  // but preserve local edits for events with pending operations
  useEffect(() => {
    if (prevEventsRef.current !== events) {
      prevEventsRef.current = events;
      setVisibleCount(PAGE_SIZE); // Reset pagination on data change
      if (pendingOperations.length === 0) {
        // No pending edits - just use the new events directly
        setLocalData(events);
      } else {
        // Has pending edits - merge: use local version for edited events, new data for the rest
        const editedEventIds = new Set(pendingOperations.flatMap(op => {
          if ('eventId' in op) return [op.eventId];
          return [];
        }));
        setLocalData(prev => {
          const localMap = new Map(prev.map(e => [e.id, e]));
          return events.map(event =>
            editedEventIds.has(event.id) && localMap.has(event.id)
              ? localMap.get(event.id)!
              : event
          );
        });
      }
    }
  }, [events, pendingOperations]);

  // Visible (paginated) data
  const visibleData = localData.slice(0, visibleCount);
  const hasMore = visibleCount < localData.length;

  // Refs for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // State for drive validation
  const [isValidatingDrive, setIsValidatingDrive] = useState(false);
  const driveValidatedRef = useRef(false);

  // Role types are now fetched via useQuery above (cached, no loading spinner on revisit)

  // Validate Drive folders on mount (only once per session)
  useEffect(() => {
    if (!isAdmin || driveValidatedRef.current) return;

    const validateDriveFolders = async () => {
      // Check if any events have drive_folder_id
      const hasAnyDriveFolders = events.some(e => e.drive_folder_id);
      if (!hasAnyDriveFolders) return;

      driveValidatedRef.current = true;
      setIsValidatingDrive(true);

      try {
        const res = await fetch('/api/events/validate-drive', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.invalidated > 0) {
            // Refresh data if any folders were invalidated
            queryClient.invalidateQueries({ queryKey: eventKeys.list() });
          }
        }
      } catch (error) {
        console.error('Error validating drive folders:', error);
      } finally {
        setIsValidatingDrive(false);
      }
    };

    validateDriveFolders();
  }, [isAdmin, events, queryClient]);

  // Auto-save effect - triggers when pendingOperations change
  useEffect(() => {
    if (pendingOperations.length === 0) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('unsaved');

    // Schedule save after 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      // Call save directly - this effect has access to current pendingOperations
      if (pendingOperations.length > 0 && !isSavingRef.current) {
        performSave(pendingOperations);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [pendingOperations]);

  // Schedule auto-save (just marks as unsaved, actual save happens via effect)
  const scheduleAutoSave = useCallback(() => {
    setSaveStatus('unsaved');
  }, []);

  // CTRL+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (pendingOperations.length > 0) {
          performSave(pendingOperations);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingOperations]);

  // Perform save with given operations (avoids stale closure)
  const performSave = async (operations: PendingOperation[]) => {
    if (isSavingRef.current || operations.length === 0) {
      if (operations.length === 0) {
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

          case 'fillEmptyPosition': {
            // Position already exists, just add assignment
            if (op.positionId.startsWith('temp-')) continue;

            await fetch('/api/assignments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                position_id: op.positionId,
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
  };

  // Save wrapper for button click
  const saveToDatabase = useCallback(() => {
    performSave(pendingOperations);
  }, [pendingOperations, roleTypes, queryClient]);

  // Add technician to role - fills empty position if available, otherwise creates new
  const addTechnician = useCallback((eventId: string, roleType: string, technicianId: string) => {
    const tech = allTechnicians.find(t => t.id === technicianId);
    if (!tech) return;

    const tempAssignmentId = `temp-${Date.now()}-${Math.random()}`;
    const roleLabel = roleTypes.find(r => r.value === roleType)?.label || roleType;

    // Check for empty position to fill
    let filledExistingPosition = false;
    let existingPositionId: string | null = null;

    setLocalData(prev => prev.map(event => {
      if (event.id !== eventId) return event;

      // Find empty position for this role type
      const emptyPosition = (event.positions || []).find(
        p => p.role_type === roleType && (!p.assignments || p.assignments.length === 0)
      );

      if (emptyPosition) {
        // Fill the existing empty position
        filledExistingPosition = true;
        existingPositionId = emptyPosition.id;

        return {
          ...event,
          positions: (event.positions || []).map(pos => {
            if (pos.id === emptyPosition.id) {
              return {
                ...pos,
                assignments: [{
                  id: tempAssignmentId,
                  position_id: pos.id,
                  event_id: eventId,
                  technician_id: technicianId,
                  attendance_status: 'pending' as AttendanceStatus,
                  response_time: null,
                  notes: null,
                  assigned_by: null,
                  assigned_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  start_date: null,
                  end_date: null,
                  technician: tech
                }]
              };
            }
            return pos;
          })
        };
      } else {
        // Create new position with assignment
        const newPosition = {
          id: tempAssignmentId,
          event_id: eventId,
          title: roleLabel,
          role_type: roleType as RoleType,
          requirements: null,
          shift_start: null,
          shift_end: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignments: [{
            id: tempAssignmentId,
            position_id: tempAssignmentId,
            event_id: eventId,
            technician_id: technicianId,
            attendance_status: 'pending' as AttendanceStatus,
            response_time: null,
            notes: null,
            assigned_by: null,
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            start_date: null,
            end_date: null,
            technician: tech
          }]
        };

        return {
          ...event,
          positions: [...(event.positions || []), newPosition]
        };
      }
    }));

    // Add appropriate pending operation
    if (filledExistingPosition && existingPositionId) {
      const positionIdToFill = existingPositionId; // Store in const for TypeScript narrowing
      setPendingOperations(prev => [...prev, {
        type: 'fillEmptyPosition',
        eventId,
        positionId: positionIdToFill,
        technicianId,
        tempId: tempAssignmentId
      }]);
    } else {
      setPendingOperations(prev => [...prev, {
        type: 'assignTechnician',
        eventId,
        roleType,
        technicianId,
        tempId: tempAssignmentId
      }]);
    }

    scheduleAutoSave();
  }, [allTechnicians, roleTypes, scheduleAutoSave]);

  // Add just a position (role) without technician
  const addPositionOnly = useCallback((eventId: string, roleType: string) => {
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
        assignments: [] // No assignment, just the position
      };

      return {
        ...event,
        positions: [...(event.positions || []), newPosition]
      };
    }));

    setPendingOperations(prev => [...prev, {
      type: 'addRole',
      eventId,
      roleType
    }]);

    scheduleAutoSave();
  }, [roleTypes, scheduleAutoSave]);

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

  // Get empty positions (positions without assignments) for role
  const getEmptyPositionsForRole = (event: typeof localData[0], roleType: string) => {
    return (event.positions || [])
      .filter(p => p.role_type === roleType && (!p.assignments || p.assignments.length === 0));
  };

  // Remove empty position
  const removeEmptyPosition = useCallback((positionId: string, eventId: string) => {
    setLocalData(prev => prev.map(event => {
      if (event.id !== eventId) return event;
      return {
        ...event,
        positions: (event.positions || []).filter(p => p.id !== positionId)
      };
    }));

    if (!positionId.startsWith('temp-')) {
      setPendingOperations(prev => [...prev, {
        type: 'removeRole',
        eventId,
        roleType: '',
        positionIds: [positionId]
      }]);
    }

    scheduleAutoSave();
  }, [scheduleAutoSave]);

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

  // Bulk attach Drive folders to calendar
  const bulkAttachToCalendar = async () => {
    if (selectedEvents.size === 0) return;

    // Filter events that have drive folder but not yet attached to calendar
    const eligibleEvents = Array.from(selectedEvents).filter(eventId => {
      const event = localData.find(e => e.id === eventId);
      return event && event.drive_folder_id && event.google_event_id && !event.calendar_attachment_synced;
    });

    if (eligibleEvents.length === 0) {
      alert('Žádné vybrané akce nemají Drive složku nebo nejsou v kalendáři, nebo už mají přílohu připojenou.');
      return;
    }

    if (!confirm(`Připojit Drive složky jako přílohu do kalendáře pro ${eligibleEvents.length} akcí?`)) return;

    let successCount = 0;
    for (const eventId of eligibleEvents) {
      try {
        const response = await fetch(`/api/events/${eventId}/attach-drive`, { method: 'POST' });
        if (response.ok) {
          successCount++;
          // Update local state optimistically
          setLocalData(prev => prev.map(e =>
            e.id === eventId ? { ...e, calendar_attachment_synced: true } : e
          ));
        }
      } catch (error) {
        console.error(`Error attaching folder for ${eventId}:`, error);
      }
    }

    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    }

    alert(`Úspěšně připojeno ${successCount}/${eligibleEvents.length} příloh.`);
    setSelectedEvents(new Set());
  };

  // Manual drive validation
  const validateDriveFolders = async () => {
    setIsValidatingDrive(true);
    try {
      const res = await fetch('/api/events/validate-drive', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        queryClient.invalidateQueries({ queryKey: eventKeys.list() });
        alert(`Ověřeno ${data.validated} složek, odstraněno ${data.invalidated} neplatných odkazů.`);
      }
    } catch (error) {
      console.error('Error validating drive folders:', error);
      alert('Chyba při ověřování složek');
    } finally {
      setIsValidatingDrive(false);
    }
  };

  // Bulk delete Drive folders
  const bulkDeleteDriveFolders = async () => {
    if (selectedEvents.size === 0) return;

    const eventsWithFolder = Array.from(selectedEvents).filter(eventId => {
      const event = localData.find(e => e.id === eventId);
      return event && event.drive_folder_id;
    });

    if (eventsWithFolder.length === 0) {
      alert('Žádné vybrané akce nemají Drive složku.');
      return;
    }

    if (!confirm(`Opravdu chcete SMAZAT Drive složky pro ${eventsWithFolder.length} akcí? Tato akce je nevratná!`)) return;

    let successCount = 0;
    for (const eventId of eventsWithFolder) {
      try {
        const res = await fetch(`/api/events/${eventId}/drive`, { method: 'DELETE' });
        if (res.ok) {
          successCount++;
          // Update local state
          setLocalData(prev => prev.map(e =>
            e.id === eventId ? { ...e, drive_folder_id: null, drive_folder_url: null, calendar_attachment_synced: false } : e
          ));
        }
      } catch (error) {
        console.error(`Error deleting folder for ${eventId}:`, error);
      }
    }

    queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    alert(`Úspěšně smazáno ${successCount}/${eventsWithFolder.length} složek.`);
    setSelectedEvents(new Set());
  };

  if (!loadingRoles && roleTypes.length === 0) {
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
      {/* Header with save status, bulk actions, and button - min-h matches other tab headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b bg-slate-50 min-h-[52px]">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Save status */}
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-xs sm:text-sm text-blue-600">Ukládám...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-xs sm:text-sm text-green-600">Uloženo</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-xs sm:text-sm text-amber-600">
                  Neuložené změny ({pendingOperations.length})
                </span>
              </>
            )}
          </div>

          {/* Bulk actions - hidden on mobile, shown in dropdown */}
          {isAdmin && selectedEvents.size > 0 && (
            <>
              {/* Desktop bulk actions */}
              <div className="hidden md:flex items-center gap-2 pl-4 border-l">
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
                  Vytvořit podklady
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={bulkAttachToCalendar}
                  className="gap-1"
                >
                  <Link2 className="w-4 h-4" />
                  Připojit přílohy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={bulkDeleteDriveFolders}
                  className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Smazat podklady
                </Button>
              </div>
              {/* Mobile bulk actions count */}
              <span className="md:hidden text-xs text-slate-600 pl-2 border-l">
                Vybráno: {selectedEvents.size}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Validate Drive button */}
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={validateDriveFolders}
              disabled={isValidatingDrive}
              title="Ověřit Drive složky"
            >
              <RefreshCw className={`w-4 h-4 ${isValidatingDrive ? 'animate-spin' : ''}`} />
            </Button>
          )}

          <Button
            size="sm"
            onClick={saveToDatabase}
            disabled={saveStatus === 'saving' || pendingOperations.length === 0}
            className="gap-1 sm:gap-2"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Uložit (Ctrl+S)</span>
            <span className="sm:hidden">Uložit</span>
          </Button>
        </div>
      </div>

      {/* Mobile: Card layout */}
      <div className="md:hidden space-y-3 p-3">
        {visibleData.map((event) => {
          const stats = getEventStats(event);

          return (
            <div key={event.id} className="border rounded-lg p-3 bg-white">
              {/* Header: Checkbox + Title + Stats */}
              <div className="flex items-start gap-2 mb-2">
                {isAdmin && (
                  <Checkbox
                    checked={selectedEvents.has(event.id)}
                    onCheckedChange={() => toggleSelectEvent(event.id)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 line-clamp-2">{event.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>{format(new Date(event.start_time), 'd.M.yyyy', { locale: cs })}</span>
                    {stats.total > 0 && (
                      <span className={`font-semibold ${
                        stats.percentage === 100 ? 'text-green-600' :
                        stats.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {stats.filled}/{stats.total}
                      </span>
                    )}
                  </div>
                </div>
                {/* Status icons */}
                <div className="flex items-center gap-1">
                  <div className={`p-1 rounded ${event.drive_folder_id ? 'text-green-600 bg-green-50' : 'text-slate-300'}`}>
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className={`p-1 rounded ${event.calendar_attachment_synced ? 'text-blue-600 bg-blue-50' : 'text-slate-300'}`}>
                    <Link2 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Role assignments */}
              <div className="space-y-2">
                {roleTypes.map(role => {
                  const assignments = getAssignmentsForRole(event, role.value);
                  const emptyPositions = getEmptyPositionsForRole(event, role.value);
                  if (assignments.length === 0 && emptyPositions.length === 0 && !isAdmin) return null;

                  return (
                    <div key={role.id} className="flex items-start gap-2">
                      <span className="text-[10px] font-medium text-slate-500 w-16 shrink-0 pt-0.5">
                        {role.label.substring(0, 8)}{role.label.length > 8 ? '.' : ''}
                      </span>
                      <div className="flex flex-wrap gap-1 flex-1">
                        {/* Empty positions */}
                        {emptyPositions.map(pos => (
                          <div
                            key={pos.id}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-dashed border-slate-400 bg-slate-50 text-slate-600"
                          >
                            <span className="font-medium">Volná</span>
                            {isAdmin && (
                              <button
                                onClick={() => removeEmptyPosition(pos.id, event.id)}
                                className="hover:text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        {assignments.map(assignment => (
                          <div
                            key={assignment.id}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${getStatusColor(assignment.attendance_status)}`}
                          >
                            <span className="font-medium truncate max-w-[80px]">
                              {assignment.technician?.full_name || '?'}
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
                        {isAdmin && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center justify-center w-5 h-5 rounded border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50">
                                <Plus className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1">
                              {/* Add position only button */}
                              <button
                                onClick={() => addPositionOnly(event.id, role.value)}
                                className="w-full text-left px-2 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200 mb-1 font-medium text-slate-700"
                              >
                                + Pouze pozice
                              </button>
                              <div className="border-t my-1" />
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
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Table layout - uses raw <table> to avoid nested overflow-auto from Table component */}
      <div className="hidden md:block overflow-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
        <table className="w-full caption-bottom text-sm min-w-max">
          <thead className="sticky top-0 bg-white z-20 shadow-[0_1px_0_0_theme(colors.slate.200)] [&_tr]:border-b">
            <tr className="border-b">
              {isAdmin && (
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[40px]">
                  <Checkbox
                    checked={selectedEvents.size === localData.length && localData.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
              )}
              <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground w-[70px]">Obsaz.</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[180px] sticky left-0 bg-white z-30">Akce</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[90px]">Datum</th>
              <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground w-[60px]">Status</th>
              {loadingRoles ? (
                // Skeleton columns while role types load
                Array.from({ length: 4 }).map((_, i) => (
                  <th key={`skel-${i}`} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[150px]">
                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                  </th>
                ))
              ) : (
                roleTypes.map(role => (
                  <th key={role.id} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[150px]">
                    {role.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {visibleData.map((event) => {
              const stats = getEventStats(event);

              return (
                <tr key={event.id} className="border-b transition-colors hover:bg-muted/50">
                  {isAdmin && (
                    <td className="p-4 align-middle">
                      <Checkbox
                        checked={selectedEvents.has(event.id)}
                        onCheckedChange={() => toggleSelectEvent(event.id)}
                      />
                    </td>
                  )}

                  <td className="p-4 align-middle text-center">
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
                  </td>

                  <td className="p-4 align-middle font-medium sticky left-0 bg-white">
                    <div className="line-clamp-2 text-sm">{event.title}</div>
                  </td>

                  <td className="p-4 align-middle text-xs text-slate-600">
                    {format(new Date(event.start_time), 'd.M.yy', { locale: cs })}
                  </td>

                  <td className="p-4 align-middle text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div
                        className={`p-1 rounded ${event.drive_folder_id ? 'text-green-600 bg-green-50' : 'text-slate-300'}`}
                        title={event.drive_folder_id ? 'Drive složka vytvořena' : 'Bez Drive složky'}
                      >
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <div
                        className={`p-1 rounded ${event.calendar_attachment_synced ? 'text-blue-600 bg-blue-50' : 'text-slate-300'}`}
                        title={event.calendar_attachment_synced ? 'Příloha synchronizována s kalendářem' : 'Příloha není v kalendáři'}
                      >
                        <Link2 className="w-4 h-4" />
                      </div>
                    </div>
                  </td>

                  {loadingRoles ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <td key={`skel-${i}`} className="p-2 align-middle">
                        <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))
                  ) : roleTypes.map(role => {
                    const assignments = getAssignmentsForRole(event, role.value);
                    const emptyPositions = getEmptyPositionsForRole(event, role.value);

                    return (
                      <td key={role.id} className="p-2 align-middle">
                        <div className="flex flex-wrap gap-1">
                          {/* Empty positions (without assigned technician) */}
                          {emptyPositions.map(pos => (
                            <div
                              key={pos.id}
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-dashed border-slate-400 bg-slate-50 text-slate-600"
                            >
                              <span className="font-medium">Volná pozice</span>
                              {isAdmin && (
                                <button
                                  onClick={() => removeEmptyPosition(pos.id, event.id)}
                                  className="hover:text-red-600 p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          {assignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${getStatusColor(assignment.attendance_status)}`}
                            >
                              <span className="font-medium max-w-[120px] truncate" title={assignment.technician?.full_name}>
                                {assignment.technician?.full_name || '?'}
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
                                    className="hover:text-red-600 p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}

                          {isAdmin && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-dashed border-slate-300 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <Plus className="w-3 h-3" />
                                  Poptat
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-1">
                                {/* Add position only button */}
                                <button
                                  onClick={() => addPositionOnly(event.id, role.value)}
                                  className="w-full text-left px-2 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200 mb-1 font-medium text-slate-700"
                                >
                                  + Pouze pozice
                                </button>
                                <div className="border-t my-1" />
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
                      </td>
                    );
                  })}

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="gap-2"
          >
            Zobrazit dalších {Math.min(PAGE_SIZE, localData.length - visibleCount)} akcí
            <span className="text-slate-400">({visibleCount}/{localData.length})</span>
          </Button>
        </div>
      )}

      {localData.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          Žádné akce k zobrazení
        </div>
      )}
    </div>
  );
}
