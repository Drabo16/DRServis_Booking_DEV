'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Calendar,
  MapPin,
  Search,
  Users,
  RefreshCw,
} from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import Link from 'next/link';

interface TechnicianAssignment {
  id: string;
  attendance_status: string;
  start_date: string | null;
  end_date: string | null;
  position: {
    id: string;
    title: string;
    role_type: string;
  };
  event: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: string | null;
    status: string;
  };
}

interface TechnicianWithAssignments {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  specialization: string[] | null;
  is_active: boolean;
  is_drservis: boolean;
  company: string | null;
  assignments: TechnicianAssignment[];
  conflicts: { assignment1: string; assignment2: string; overlap: string }[];
  hasConflicts: boolean;
  assignmentCount: number;
}

interface TechnicianOverviewProps {
  daysAhead?: number;
}

export default function TechnicianOverview({ daysAhead = 30 }: TechnicianOverviewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTechnicians, setExpandedTechnicians] = useState<Set<string>>(new Set());
  const [showOnlyWithAssignments, setShowOnlyWithAssignments] = useState(true);
  const [showOnlyConflicts, setShowOnlyConflicts] = useState(false);

  // Calculate date range
  const dateRange = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addDays(start, daysAhead);
    return {
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
    };
  }, [daysAhead]);

  // Fetch technicians with assignments
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['technicians', 'assignments', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
      });
      const response = await fetch(`/api/technicians/assignments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json() as Promise<{
        technicians: TechnicianWithAssignments[];
        totalTechnicians: number;
        techniciansWithConflicts: number;
      }>;
    },
  });

  // Filter technicians
  const filteredTechnicians = useMemo(() => {
    if (!data?.technicians) return [];

    return data.technicians.filter((tech) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !tech.full_name.toLowerCase().includes(search) &&
          !tech.email.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      // Assignment filter
      if (showOnlyWithAssignments && tech.assignmentCount === 0) {
        return false;
      }

      // Conflict filter
      if (showOnlyConflicts && !tech.hasConflicts) {
        return false;
      }

      return true;
    });
  }, [data, searchTerm, showOnlyWithAssignments, showOnlyConflicts]);

  const toggleTechnician = (techId: string) => {
    setExpandedTechnicians((prev) => {
      const next = new Set(prev);
      if (next.has(techId)) {
        next.delete(techId);
      } else {
        next.add(techId);
      }
      return next;
    });
  };

  const formatEventDate = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Check if all-day event
    const isAllDay =
      start.getUTCHours() === 0 &&
      start.getUTCMinutes() === 0 &&
      end.getUTCHours() === 0 &&
      end.getUTCMinutes() === 0;

    if (isAllDay) {
      const endMinusOne = new Date(end.getTime() - 86400000);
      const startStr = `${start.getUTCDate()}. ${start.getUTCMonth() + 1}.`;
      const endStr = `${endMinusOne.getUTCDate()}. ${endMinusOne.getUTCMonth() + 1}.`;
      return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
    }

    return `${format(start, 'd. M.', { locale: cs })} - ${format(end, 'd. M.', { locale: cs })}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'tentative':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Potvrzeno';
      case 'pending':
        return 'Čeká';
      case 'tentative':
        return 'Předběžně';
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Přehled techniků
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              Období: {daysAhead} dní
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Stats and filters */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {data && (
            <div className="flex gap-2">
              <Badge variant="secondary">
                {data.totalTechnicians} techniků
              </Badge>
              {data.techniciansWithConflicts > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {data.techniciansWithConflicts} s konflikty
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder="Hledat technika..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showOnlyWithAssignments ? 'default' : 'outline'}
              onClick={() => setShowOnlyWithAssignments(!showOnlyWithAssignments)}
              className="text-xs"
            >
              S přiřazeními
            </Button>
            <Button
              size="sm"
              variant={showOnlyConflicts ? 'destructive' : 'outline'}
              onClick={() => setShowOnlyConflicts(!showOnlyConflicts)}
              className="text-xs"
            >
              Pouze konflikty
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filteredTechnicians.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Žádní technici nenalezeni</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTechnicians.map((tech) => (
              <Collapsible
                key={tech.id}
                open={expandedTechnicians.has(tech.id)}
                onOpenChange={() => toggleTechnician(tech.id)}
              >
                <div
                  className={`border rounded-lg overflow-hidden ${
                    tech.hasConflicts ? 'border-red-300 bg-red-50/30' : ''
                  }`}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        {expandedTechnicians.has(tech.id) ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{tech.full_name}</span>
                            {tech.hasConflicts && (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <AlertTriangle className="w-3 h-3" />
                                Konflikt
                              </Badge>
                            )}
                            {!tech.is_drservis && (
                              <Badge variant="outline" className="text-xs">
                                Externí
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-500">
                            {tech.email}
                            {tech.specialization && tech.specialization.length > 0 && (
                              <span className="ml-2">
                                • {tech.specialization.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {tech.assignmentCount} {tech.assignmentCount === 1 ? 'akce' : 'akcí'}
                        </Badge>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t px-3 py-2 bg-white">
                      {tech.assignments.length === 0 ? (
                        <p className="text-sm text-slate-500 py-2">
                          Žádné přiřazení v tomto období
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {/* Conflict warning */}
                          {tech.hasConflicts && (
                            <div className="p-2 bg-red-100 rounded-md text-sm text-red-800 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <strong>Konflikty:</strong>
                                <ul className="mt-1">
                                  {tech.conflicts.map((c, idx) => (
                                    <li key={idx}>• {c.overlap}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {/* Assignments list */}
                          {tech.assignments.map((assignment) => {
                            const isConflict = tech.conflicts.some(
                              (c) =>
                                c.assignment1 === assignment.id ||
                                c.assignment2 === assignment.id
                            );

                            return (
                              <Link
                                key={assignment.id}
                                href={`/events/${assignment.event.id}`}
                                className={`block p-2 rounded-md border hover:bg-slate-50 transition-colors ${
                                  isConflict ? 'border-red-300 bg-red-50' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm truncate">
                                        {assignment.event.title}
                                      </span>
                                      {isConflict && (
                                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatEventDate(
                                          assignment.event.start_time,
                                          assignment.event.end_time
                                        )}
                                      </span>
                                      {assignment.event.location && (
                                        <span className="flex items-center gap-1 truncate">
                                          <MapPin className="w-3 h-3" />
                                          {assignment.event.location}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant="outline" className="text-xs">
                                      {assignment.position.title}
                                    </Badge>
                                    <Badge
                                      className={`text-xs ${getStatusColor(
                                        assignment.attendance_status
                                      )}`}
                                    >
                                      {getStatusLabel(assignment.attendance_status)}
                                    </Badge>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
