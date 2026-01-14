'use client';

import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { X, Plus, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { ROLE_TYPES } from '@/lib/constants';
import type { Event, Position, Assignment, Profile, RoleType } from '@/types';

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

export default function ExcelView({ events: initialEvents, isAdmin, allTechnicians, userId }: ExcelViewProps) {
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState<string | null>(null);

  // Sync local state with prop changes (e.g., when parent refetches)
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  // Přidej technika do role - vždy vytvoří novou pozici
  const handleAssignToRole = async (eventId: string, roleType: RoleType, technicianId: string) => {
    const tech = allTechnicians.find(t => t.id === technicianId);
    if (!tech) return;

    const roleLabel = ROLE_TYPES.find((t) => t.value === roleType)?.label || roleType;

    // OPTIMISTIC UPDATE - okamžitě přidej do UI s temporary IDs
    const tempPositionId = `temp-pos-${Date.now()}`;
    const tempAssignmentId = `temp-assign-${Date.now()}`;

    const tempPosition = {
      id: tempPositionId,
      event_id: eventId,
      title: roleLabel,
      role_type: roleType,
      assignments: [{
        id: tempAssignmentId,
        position_id: tempPositionId,
        technician_id: technicianId,
        attendance_status: 'pending' as const,
        technician: tech
      }]
    };

    setEvents(prev => prev.map(event => {
      if (event.id === eventId) {
        return {
          ...event,
          positions: [...(event.positions || []), tempPosition as any]
        };
      }
      return event;
    }));

    // Server calls na pozadí
    try {
      // 1. Vytvoř pozici
      const posResponse = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          title: roleLabel,
          role_type: roleType,
        }),
      });

      if (!posResponse.ok) throw new Error('Failed to create position');
      const { position } = await posResponse.json();

      // 2. Přiřaď technika
      const assignResponse = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_id: position.id,
          technician_id: technicianId,
        }),
      });

      if (!assignResponse.ok) throw new Error('Failed to create assignment');
      const { assignment } = await assignResponse.json();

      // 3. Nahraď temporary data skutečnými - POUŽIJ PREV!
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            positions: (event.positions || []).map(pos =>
              pos.id === tempPositionId
                ? {
                    ...position,
                    assignments: [{
                      ...assignment,
                      technician: tech
                    }]
                  }
                : pos
            )
          };
        }
        return event;
      }));
    } catch (error) {
      // ROLLBACK - odeber temporary pozici - POUŽIJ PREV!
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            positions: (event.positions || []).filter(pos => pos.id !== tempPositionId)
          };
        }
        return event;
      }));
      alert('Chyba při přiřazování technika');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string, eventId: string, positionId: string) => {
    // Backup pro rollback
    const backupEvent = events.find(e => e.id === eventId);
    const backupPosition = backupEvent?.positions?.find(p => p.id === positionId);

    // OPTIMISTIC UPDATE - okamžitě odeber assignment a případně i pozici
    setEvents(prev => prev.map(event => {
      if (event.id === eventId) {
        return {
          ...event,
          positions: (event.positions || []).map(pos => {
            if (pos.id === positionId) {
              return {
                ...pos,
                assignments: (pos.assignments || []).filter(a => a.id !== assignmentId)
              };
            }
            return pos;
          }).filter(pos =>
            // Odstraň pozici, pokud už nemá žádné assignments
            pos.id !== positionId || (pos.assignments && pos.assignments.length > 0)
          )
        };
      }
      return event;
    }));

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete assignment');
    } catch (error) {
      // ROLLBACK - vrať původní stav
      if (backupEvent && backupPosition) {
        setEvents(prev => prev.map(event => {
          if (event.id === eventId) {
            const existingPositions = event.positions || [];
            const positionExists = existingPositions.some(p => p.id === positionId);

            return {
              ...event,
              positions: positionExists
                ? existingPositions.map(pos => pos.id === positionId ? backupPosition : pos)
                : [...existingPositions, backupPosition]
            };
          }
          return event;
        }));
      }
      alert('Chyba při odebírání přiřazení');
    }
  };

  const handleRemovePosition = async (positionId: string, eventId: string, hasAssignments: boolean = false) => {
    const message = hasAssignments
      ? 'Opravdu chcete smazat tuto pozici? Všichni přiřazení technici budou odebráni.'
      : 'Opravdu chcete smazat tuto prázdnou pozici?';

    if (!confirm(message)) {
      return;
    }

    setLoading(`position-${positionId}`);
    try {
      const response = await fetch(`/api/positions?id=${positionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete position');

      // Manuální state update - BEZ router.refresh()
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            positions: (event.positions || []).filter(p => p.id !== positionId)
          };
        }
        return event;
      }));
    } catch (error) {
      alert('Chyba při mazání pozice');
    } finally {
      setLoading(null);
    }
  };

  // Smaž všechny pozice dané role
  const handleRemoveAllPositionsForRole = async (rolePositions: any[], roleName: string, eventId: string) => {
    const totalAssignments = rolePositions.reduce(
      (sum, p) => sum + (p.assignments?.length || 0),
      0
    );

    const message =
      totalAssignments > 0
        ? `Opravdu chcete smazat roli "${roleName}"? Bude smazáno ${rolePositions.length} pozic a ${totalAssignments} přiřazení.`
        : `Opravdu chcete smazat roli "${roleName}"? Bude smazáno ${rolePositions.length} pozic.`;

    if (!confirm(message)) {
      return;
    }

    setLoading(`role-${rolePositions[0]?.role_type}`);
    try {
      // Smaž všechny pozice pro tuto roli
      await Promise.all(
        rolePositions.map((pos) =>
          fetch(`/api/positions?id=${pos.id}`, {
            method: 'DELETE',
          })
        )
      );

      // Manuální state update - BEZ router.refresh()
      const positionIds = rolePositions.map(p => p.id);
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            positions: (event.positions || []).filter(p => !positionIds.includes(p.id))
          };
        }
        return event;
      }));
    } catch (error) {
      alert('Chyba při mazání role');
    } finally {
      setLoading(null);
    }
  };

  // Pro každou akci zjisti obsazenost podle POTVRZENÝCH rolí
  const getEventStats = (event: typeof events[0]) => {
    const positions = event.positions || [];
    const total = positions.length;
    // Počítej pouze potvrzené (accepted) assignments
    const filled = positions.filter(
      (p) => p.assignments && p.assignments.some((a) => a.attendance_status === 'accepted')
    ).length;
    return { total, filled, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 };
  };

  // Barva podle statusu
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'tentative':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  // Změna statusu přiřazení
  const handleStatusChange = async (assignmentId: string, newStatus: string, eventId: string, positionId: string) => {
    // Backup starého statusu pro rollback
    const oldStatus = events
      .find(e => e.id === eventId)
      ?.positions?.find(p => p.id === positionId)
      ?.assignments?.find(a => a.id === assignmentId)?.attendance_status;

    // OPTIMISTIC UPDATE - okamžitě změň status v UI
    setEvents(prev => prev.map(event => {
      if (event.id === eventId) {
        return {
          ...event,
          positions: (event.positions || []).map(pos => {
            if (pos.id === positionId) {
              return {
                ...pos,
                assignments: (pos.assignments || []).map(a =>
                  a.id === assignmentId ? { ...a, attendance_status: newStatus as any } : a
                )
              };
            }
            return pos;
          })
        };
      }
      return event;
    }) as any);

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');
    } catch (error) {
      // ROLLBACK - vrať starý status
      if (oldStatus) {
        setEvents(prev => prev.map(event => {
          if (event.id === eventId) {
            return {
              ...event,
              positions: (event.positions || []).map(pos => {
                if (pos.id === positionId) {
                  return {
                    ...pos,
                    assignments: (pos.assignments || []).map(a =>
                      a.id === assignmentId ? { ...a, attendance_status: oldStatus as any } : a
                    )
                  };
                }
                return pos;
              })
            };
          }
          return event;
        }) as any);
      }
      alert('Chyba při aktualizaci statusu');
    }
  };

  const handleAddRole = async (eventId: string, roleValue: string) => {
    if (!roleValue) return;

    const roleLabel = ROLE_TYPES.find((t) => t.value === roleValue)?.label || roleValue;

    try {
      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          title: roleLabel,
          role_type: roleValue,
        }),
      });

      if (!response.ok) throw new Error('Failed to create position');
      const { position } = await response.json();

      // Manuální state update - BEZ router.refresh()
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            positions: [
              ...(event.positions || []),
              { ...position, assignments: [] }
            ]
          };
        }
        return event;
      }));
    } catch (error) {
      alert('Chyba při vytváření role');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="overflow-x-auto overflow-y-visible">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] sticky left-0 bg-white z-10">Akce</TableHead>
              <TableHead className="w-[100px]">Datum</TableHead>
              <TableHead className="min-w-[600px]">Pozice a přiřazení (role rozbalené horizontálně)</TableHead>
              <TableHead className="w-[80px] text-center text-xs sticky right-0 bg-white z-10">Obsaz.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const positions = event.positions || [];
              const stats = getEventStats(event);

              // Zjisti které role tato akce používá
              const usedRoleTypes = [...new Set(positions.map((p) => p.role_type))];

              return (
                <TableRow key={event.id} className="hover:bg-slate-50">
                  {/* Název akce */}
                  <TableCell className="font-medium text-sm sticky left-0 bg-white">
                    <div className="line-clamp-2">{event.title}</div>
                  </TableCell>

                  {/* Datum */}
                  <TableCell className="text-xs text-slate-600">
                    {format(new Date(event.start_time), 'd. M. yyyy', { locale: cs })}
                  </TableCell>

                  {/* Všechny role v jedné buňce, horizontálně */}
                  <TableCell className="p-2">
                    <div className="flex gap-3 items-start flex-nowrap">
                      {/* Pro každou roli zobraz sekci */}
                      {usedRoleTypes.map((roleValue) => {
                        const role = ROLE_TYPES.find((r) => r.value === roleValue);
                        if (!role) return null;

                        // Najdi všechny pozice pro tuto roli
                        const rolePositions = positions.filter((p) => p.role_type === roleValue);

                        return (
                          <div key={roleValue} className="border border-slate-200 rounded p-2 min-w-[180px]">
                            {/* Název role s tlačítkem pro smazání celé role */}
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-semibold text-xs text-slate-700">{role.label}</div>
                              {isAdmin && (
                                <button
                                  onClick={() => handleRemoveAllPositionsForRole(rolePositions, role.label, event.id)}
                                  disabled={loading === `role-${roleValue}`}
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                  title={`Smazat celou roli ${role.label}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="space-y-1">
                              {/* Zobraz každou pozici jako samostatnou kartu */}
                              {rolePositions.map((position) => {
                                const posAssignments = position.assignments || [];

                                return (
                                  <div key={position.id} className="space-y-1">
                                    {/* Přiřazení pro tuto konkrétní pozici */}
                                    {posAssignments.map((assignment) => {
                                      const isMyAssignment = assignment.technician_id === userId;
                                      const canChangeStatus = isMyAssignment || isAdmin;

                                      return (
                                        <div
                                          key={assignment.id}
                                          className={`flex items-center justify-between px-2 py-1 rounded text-xs border ${getStatusColor(assignment.attendance_status)}`}
                                        >
                                          <span className="truncate font-medium">{assignment.technician?.full_name || 'N/A'}</span>
                                          <div className="flex items-center gap-1">
                                            {/* Dropdown pro změnu statusu - vidí admin nebo přiřazený technik */}
                                            {canChangeStatus && (
                                              <Select
                                                value={assignment.attendance_status}
                                                onValueChange={(value) => handleStatusChange(assignment.id, value, event.id, position.id)}
                                                disabled={loading === assignment.id}
                                              >
                                                <SelectTrigger className="h-5 w-5 p-0 border-none bg-transparent hover:bg-black/10 [&>svg]:hidden">
                                                  <svg className="w-4 h-4 text-black" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                  </svg>
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="pending">Čeká na odpověď</SelectItem>
                                                  <SelectItem value="accepted">Přijato</SelectItem>
                                                  <SelectItem value="declined">Odmítnuto</SelectItem>
                                                  <SelectItem value="tentative">Možná</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            )}
                                            {isAdmin && (
                                              <button
                                                onClick={() => handleRemoveAssignment(assignment.id, event.id, position.id)}
                                                disabled={loading === assignment.id}
                                                className="hover:opacity-70"
                                                title="Odebrat technika z této pozice"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}

                              {/* Dropdown pro přidání technika */}
                              {isAdmin && (
                                <Select
                                  value=""
                                  onValueChange={(technicianId) =>
                                    handleAssignToRole(event.id, roleValue, technicianId)
                                  }
                                  disabled={loading === `${event.id}-${roleValue}`}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="+ Přidat" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allTechnicians.map((tech) => (
                                      <SelectItem key={tech.id} value={tech.id}>
                                        {tech.full_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Tlačítko pro přidání nové role */}
                      {isAdmin && (
                        <div className="border border-dashed border-slate-300 rounded p-2 min-w-[120px]">
                          <Select
                            value=""
                            onValueChange={(value) => handleAddRole(event.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs border-none">
                              <SelectValue placeholder="+ Role" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_TYPES.filter((r) => !usedRoleTypes.includes(r.value)).map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Obsazenost */}
                  <TableCell className="text-center sticky right-0 bg-white">
                    {stats.total > 0 ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-xs font-semibold ${
                          stats.percentage === 100
                            ? 'text-green-600'
                            : stats.percentage >= 50
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}>
                          {stats.filled}/{stats.total}
                        </span>
                        <div className="w-10 bg-slate-200 rounded-full h-1">
                          <div
                            className={`h-full rounded-full transition-all ${
                              stats.percentage === 100
                                ? 'bg-green-600'
                                : stats.percentage >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
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
      {events.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          Žádné akce k zobrazení
        </div>
      )}
    </div>
  );
}
