'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getRoleTypeLabel, getAttendanceStatusLabel, getAttendanceStatusColor } from '@/lib/utils';
import { UserPlus, Mail } from 'lucide-react';
import type { Position, Assignment, Profile, AttendanceStatus } from '@/types';
import { useState } from 'react';
import { useSendInvite } from '@/hooks/useEvents';
import { useUpdateAssignment } from '@/hooks/useAssignments';
import AssignTechnicianDialog from './AssignTechnicianDialog';

interface PositionCardProps {
  position: Position & {
    assignments: (Assignment & { technician: Profile })[];
  };
  isAdmin: boolean;
}

export default function PositionCard({ position, isAdmin }: PositionCardProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const sendInvite = useSendInvite();
  const updateAssignment = useUpdateAssignment();

  const handleInvite = async (assignmentId: string) => {
    sendInvite.mutate(
      { eventId: position.event_id, assignmentId },
      {
        onSuccess: () => {
          alert('Pozvánka odeslána!');
        },
        onError: () => {
          alert('Chyba při odesílání pozvánky');
        },
      }
    );
  };

  const handleStatusChange = async (assignmentId: string, newStatus: AttendanceStatus) => {
    setUpdatingStatus(assignmentId);
    updateAssignment.mutate(
      { id: assignmentId, data: { attendance_status: newStatus } },
      {
        onError: () => {
          alert('Chyba při aktualizaci statusu');
        },
        onSettled: () => {
          setUpdatingStatus(null);
        },
      }
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{position.title}</CardTitle>
              <Badge variant="outline" className="mt-2">
                {getRoleTypeLabel(position.role_type)}
              </Badge>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAssignDialogOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Přiřadit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium text-slate-700">Přiřazení technici:</p>

            {position.assignments.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                Zatím nikdo nepřiřazen
              </p>
            ) : (
              <div className="space-y-2">
                {position.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg gap-3"
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
                      ) : (
                        <Badge
                          className={getAttendanceStatusColor(assignment.attendance_status)}
                        >
                          {getAttendanceStatusLabel(assignment.attendance_status)}
                        </Badge>
                      )}
                      {isAdmin && assignment.attendance_status === 'pending' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleInvite(assignment.id)}
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <AssignTechnicianDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          positionId={position.id}
          eventId={position.event_id}
        />
      )}
    </>
  );
}
