'use client';

import { useState, useMemo } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  UserPlus,
  Loader2,
  Filter,
} from 'lucide-react';
import { getRoleTypeLabel } from '@/lib/utils';
import type { Event, Position, Assignment, Profile, AttendanceStatus, RoleType } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/hooks/useEvents';

interface EventWithPositions extends Event {
  positions: (Position & {
    assignments: (Assignment & { technician: Profile })[];
  })[];
}

interface InviteResponsesTabProps {
  events: EventWithPositions[];
  isAdmin: boolean;
  allTechnicians: Profile[];
  onEventClick: (eventId: string) => void;
}

// Ikony a barvy pro jednotlivé stavy
const statusConfig: Record<AttendanceStatus, {
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  textColor: string;
  label: string;
}> = {
  accepted: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    label: 'Přijato'
  },
  declined: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    label: 'Odmítnuto'
  },
  pending: {
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800',
    label: 'Čeká'
  },
  tentative: {
    icon: HelpCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    label: 'Předběžně'
  },
};

type FilterStatus = AttendanceStatus | 'all';

export default function InviteResponsesTab({
  events,
  isAdmin,
  allTechnicians,
  onEventClick,
}: InviteResponsesTabProps) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [replacingId, setReplacingId] = useState<string | null>(null);

  // Všechny odpovědi jako flat list
  const allResponses = useMemo(() => {
    const responses: Array<{
      id: string;
      assignmentId: string;
      positionId: string;
      eventId: string;
      eventTitle: string;
      eventDate: string;
      technicianId: string;
      technicianName: string;
      technicianEmail: string;
      roleType: RoleType;
      status: AttendanceStatus;
      responseTime: string | null;
    }> = [];

    events.forEach(event => {
      (event.positions || []).forEach(position => {
        (position.assignments || []).forEach(assignment => {
          responses.push({
            id: `${assignment.id}`,
            assignmentId: assignment.id,
            positionId: position.id,
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.start_time,
            technicianId: assignment.technician_id,
            technicianName: assignment.technician.full_name,
            technicianEmail: assignment.technician.email,
            roleType: position.role_type,
            status: assignment.attendance_status,
            responseTime: assignment.response_time,
          });
        });
      });
    });

    // Seřazení: odmítnuté první, pak čekající, pak ostatní; v rámci toho podle data akce
    return responses.sort((a, b) => {
      const statusOrder: Record<AttendanceStatus, number> = {
        declined: 0,
        pending: 1,
        tentative: 2,
        accepted: 3,
      };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    });
  }, [events]);

  // Filtrované odpovědi
  const filteredResponses = useMemo(() => {
    if (filterStatus === 'all') return allResponses;
    return allResponses.filter(r => r.status === filterStatus);
  }, [allResponses, filterStatus]);

  // Statistiky
  const stats = useMemo(() => ({
    total: allResponses.length,
    accepted: allResponses.filter(r => r.status === 'accepted').length,
    declined: allResponses.filter(r => r.status === 'declined').length,
    pending: allResponses.filter(r => r.status === 'pending').length,
    tentative: allResponses.filter(r => r.status === 'tentative').length,
  }), [allResponses]);

  // Náhrada technika - jednoduchá verze jako v Excelu
  const handleReplace = async (response: typeof allResponses[0], newTechnicianId: string) => {
    setReplacingId(response.assignmentId);
    try {
      // 1. Odeber staré přiřazení
      const deleteRes = await fetch(`/api/assignments/${response.assignmentId}`, {
        method: 'DELETE',
      });
      if (!deleteRes.ok) throw new Error('Nepodařilo se odebrat přiřazení');

      // 2. Přidej nové přiřazení
      const createRes = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_id: response.positionId,
          technician_id: newTechnicianId,
        }),
      });
      if (!createRes.ok) throw new Error('Nepodařilo se přiřadit náhradu');

      // Invalidate cache
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      console.error('Error replacing technician:', error);
      alert('Chyba při nahrazování technika');
    } finally {
      setReplacingId(null);
    }
  };

  // Dostupní technici pro náhradu (pro konkrétní response)
  const getAvailableTechnicians = (response: typeof allResponses[0]) => {
    const event = events.find(e => e.id === response.eventId);
    const position = event?.positions?.find(p => p.id === response.positionId);
    const assignedIds = position?.assignments.map(a => a.technician_id) || [];
    return allTechnicians.filter(t => !assignedIds.includes(t.id));
  };

  // Formátování data
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (allResponses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">
          Zatím nejsou žádné odpovědi na pozvánky.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Statistiky a filtr - min-h matches other tab headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-3 bg-slate-50 rounded-lg border min-h-[52px]">
        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap">
          <span className="text-slate-600 font-medium">Celkem: {stats.total}</span>
          <span className="text-green-600">✓ {stats.accepted}</span>
          <span className="text-red-600">✗ {stats.declined}</span>
          <span className="text-amber-600">◷ {stats.pending}</span>
          {stats.tentative > 0 && <span className="text-blue-600">? {stats.tentative}</span>}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger className="w-32 sm:w-40 h-8 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny ({stats.total})</SelectItem>
              <SelectItem value="declined">Odmítnuto ({stats.declined})</SelectItem>
              <SelectItem value="pending">Čeká ({stats.pending})</SelectItem>
              <SelectItem value="tentative">Předběžně ({stats.tentative})</SelectItem>
              <SelectItem value="accepted">Přijato ({stats.accepted})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile: Card layout */}
      <div className="md:hidden space-y-3">
        {filteredResponses.map((response) => {
          const config = statusConfig[response.status];
          const Icon = config.icon;
          const availableTechs = response.status === 'declined' ? getAvailableTechnicians(response) : [];

          return (
            <div key={response.id} className="border rounded-lg p-3 bg-white">
              {/* Header: Status + Actions */}
              <div className="flex items-center justify-between mb-2">
                <Badge className={`${config.bgColor} ${config.textColor} gap-1 text-xs`}>
                  <Icon className="w-3 h-3" />
                  {config.label}
                </Badge>
                {isAdmin && response.status === 'declined' && (
                  replacingId === response.assignmentId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 h-7 px-2"
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          Nahradit
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1" align="end">
                        <div className="text-xs font-medium text-slate-500 px-2 py-1">
                          Vyberte náhradu
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {availableTechs.map(tech => (
                            <button
                              key={tech.id}
                              onClick={() => handleReplace(response, tech.id)}
                              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100"
                            >
                              {tech.full_name}
                            </button>
                          ))}
                          {availableTechs.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-slate-400">
                              Žádní dostupní technici
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )
                )}
              </div>

              {/* Technician */}
              <p className="font-medium text-sm text-slate-900">{response.technicianName}</p>

              {/* Event - clickable */}
              <button
                onClick={() => onEventClick(response.eventId)}
                className="text-left text-blue-600 hover:underline text-sm mt-1"
              >
                {response.eventTitle}
              </button>

              {/* Meta info */}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span>{formatDate(response.eventDate)}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{getRoleTypeLabel(response.roleType)}</Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="min-w-[120px]">Technik</TableHead>
              <TableHead className="min-w-[150px]">Akce</TableHead>
              <TableHead className="w-[120px]">Datum</TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead className="w-[120px]">Odpověď</TableHead>
              {isAdmin && <TableHead className="w-[120px] text-right">Nahradit</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResponses.map((response) => {
              const config = statusConfig[response.status];
              const Icon = config.icon;
              const availableTechs = response.status === 'declined' ? getAvailableTechnicians(response) : [];

              return (
                <TableRow key={response.id} className="hover:bg-slate-50">
                  <TableCell>
                    <Badge className={`${config.bgColor} ${config.textColor} gap-1`}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{response.technicianName}</p>
                      <p className="text-xs text-slate-500">{response.technicianEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => onEventClick(response.eventId)}
                      className="text-left hover:text-blue-600 transition-colors"
                    >
                      <p className="font-medium">{response.eventTitle}</p>
                    </button>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {formatDate(response.eventDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getRoleTypeLabel(response.roleType)}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {response.responseTime
                      ? formatDate(response.responseTime)
                      : '-'}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {response.status === 'declined' && (
                        replacingId === response.assignmentId ? (
                          <Loader2 className="w-4 h-4 animate-spin inline" />
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50 h-7 px-2"
                              >
                                <UserPlus className="w-3 h-3 mr-1" />
                                Nahradit
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-1" align="end">
                              <div className="text-xs font-medium text-slate-500 px-2 py-1">
                                Vyberte náhradu
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {availableTechs.map(tech => (
                                  <button
                                    key={tech.id}
                                    onClick={() => handleReplace(response, tech.id)}
                                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100"
                                  >
                                    {tech.full_name}
                                  </button>
                                ))}
                                {availableTechs.length === 0 && (
                                  <div className="px-2 py-1.5 text-sm text-slate-400">
                                    Žádní dostupní technici
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredResponses.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          Žádné odpovědi s vybraným filtrem.
        </div>
      )}
    </>
  );
}
