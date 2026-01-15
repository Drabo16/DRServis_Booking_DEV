'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, ExternalLink, FolderOpen, X, Loader2, FileText, Link } from 'lucide-react';
import { formatDateRange } from '@/lib/utils';
import PositionsManager from '@/components/positions/PositionsManager';
import CreateDriveFolderButton from '@/components/events/CreateDriveFolderButton';
import SyncStatusButton from '@/components/events/SyncStatusButton';
import DriveFilesList from '@/components/events/DriveFilesList';
import { useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/hooks/useEvents';

interface EventDetailPanelProps {
  eventId: string;
  onClose: () => void;
  isAdmin: boolean;
}

export default function EventDetailPanel({ eventId, onClose, isAdmin }: EventDetailPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [event, setEvent] = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachingDrive, setAttachingDrive] = useState(false);

  const fetchEventDetail = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch event detail
      const eventRes = await fetch(`/api/events/${eventId}`);
      if (!eventRes.ok) throw new Error('Failed to fetch event');
      const eventData = await eventRes.json();
      setEvent(eventData.event);

      // Fetch technicians if admin
      if (isAdmin) {
        const techRes = await fetch('/api/technicians');
        if (techRes.ok) {
          const techData = await techRes.json();
          setTechnicians(techData.technicians || []);
        }
      }
    } catch (error) {
      console.error('Error fetching event detail:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId, isAdmin]);

  useEffect(() => {
    fetchEventDetail();
  }, [fetchEventDetail]);

  // Auto-refresh po synchronizaci (volané z child komponent)
  const handleRefresh = useCallback(() => {
    fetchEventDetail();
    queryClient.invalidateQueries({ queryKey: eventKeys.list() });
  }, [fetchEventDetail, queryClient]);

  // Připojení Drive složky ke kalendáři
  const handleAttachDriveToCalendar = async () => {
    if (!event?.drive_folder_url || !event?.google_event_id) return;

    setAttachingDrive(true);
    try {
      const res = await fetch(`/api/events/${eventId}/attach-drive`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to attach');
      }

      // Refresh data
      handleRefresh();
    } catch (error) {
      console.error('Error attaching Drive to calendar:', error);
    } finally {
      setAttachingDrive(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Nepodařilo se načíst detail akce</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Close button */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Event Header */}
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-2xl">{event.title}</CardTitle>
            {event.description && (
              <CardDescription>{event.description}</CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center gap-3 text-slate-700">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-500">Datum</p>
                <p className="font-medium">{formatDateRange(event.start_time, event.end_time)}</p>
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-3 text-slate-700">
                <MapPin className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Místo</p>
                  <p className="font-medium">{event.location}</p>
                </div>
              </div>
            )}

            {event.drive_folder_url && (
              <div className="flex items-start gap-3 text-slate-700">
                <FolderOpen className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-500 mb-2">Google Drive</p>
                  <a
                    href={event.drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1 mb-3"
                  >
                    Otevřít složku
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <DriveFilesList
                    eventId={event.id}
                    driveFolderId={event.drive_folder_id}
                    compact={true}
                  />
                </div>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {!event.drive_folder_url && (
                <CreateDriveFolderButton eventId={event.id} onSuccess={handleRefresh} />
              )}
              {event.drive_folder_url && event.google_event_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAttachDriveToCalendar}
                  disabled={attachingDrive}
                >
                  {attachingDrive ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4 mr-2" />
                  )}
                  Připojit složku do kalendáře
                </Button>
              )}
              <SyncStatusButton eventId={event.id} onSync={handleRefresh} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Positions Section */}
      <PositionsManager
        positions={event.positions || []}
        eventId={event.id}
        isAdmin={isAdmin}
        allTechnicians={technicians}
      />
    </div>
  );
}
