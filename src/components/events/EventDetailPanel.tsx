'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, ExternalLink, FolderOpen, X, Loader2, Link, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDateRange } from '@/lib/utils';
import PositionsManager from '@/components/positions/PositionsManager';
import CreateDriveFolderButton from '@/components/events/CreateDriveFolderButton';
import SyncStatusButton from '@/components/events/SyncStatusButton';
import DriveFilesList from '@/components/events/DriveFilesList';
import { EventDetailSkeleton } from '@/components/events/EventDetailSkeleton';
import { useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/hooks/useEvents';
import type { EventWithAssignments, Profile } from '@/types';

interface EventDetailPanelProps {
  eventId: string;
  onClose: () => void;
  isAdmin: boolean;
}

export default function EventDetailPanel({ eventId, onClose, isAdmin }: EventDetailPanelProps) {
  const queryClient = useQueryClient();
  const [event, setEvent] = useState<EventWithAssignments | null>(null);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attachingDrive, setAttachingDrive] = useState(false);
  const [deletingDrive, setDeletingDrive] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchEventDetail = useCallback(async () => {
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Fetch event detail
      const eventRes = await fetch(`/api/events/${eventId}`, {
        signal: abortControllerRef.current.signal,
      });
      if (!eventRes.ok) {
        throw new Error(eventRes.status === 404 ? 'Akce nebyla nalezena' : 'Nepodařilo se načíst detail akce');
      }
      const eventData = await eventRes.json();
      setEvent(eventData.event);

      // Fetch technicians if admin
      if (isAdmin) {
        const techRes = await fetch('/api/technicians', {
          signal: abortControllerRef.current.signal,
        });
        if (techRes.ok) {
          const techData = await techRes.json();
          setTechnicians(techData.technicians || []);
        }
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Error fetching event detail:', err);
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst detail akce');
    } finally {
      setLoading(false);
    }
  }, [eventId, isAdmin]);

  useEffect(() => {
    fetchEventDetail();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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

  // Smazání Drive složky
  const handleDeleteDriveFolder = async () => {
    if (!event?.drive_folder_id) return;
    if (!confirm('Opravdu chcete smazat Drive složku? Tato akce je nevratná!')) return;

    setDeletingDrive(true);
    try {
      const res = await fetch(`/api/events/${eventId}/drive`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      // Refresh data
      handleRefresh();
    } catch (error) {
      console.error('Error deleting Drive folder:', error);
    } finally {
      setDeletingDrive(false);
    }
  };

  if (loading) {
    return <EventDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchEventDetail}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Zkusit znovu
        </Button>
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
              {event.drive_folder_url && event.google_event_id && !event.calendar_attachment_synced && (
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
                  Připojit přílohy
                </Button>
              )}
              {event.drive_folder_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteDriveFolder}
                  disabled={deletingDrive}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {deletingDrive ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Smazat podklady
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
