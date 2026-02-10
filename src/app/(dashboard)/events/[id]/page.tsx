import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, ExternalLink, FolderOpen } from 'lucide-react';
import { formatDateRange } from '@/lib/utils';
import PositionsManager from '@/components/positions/PositionsManager';
import DriveFilesList from '@/components/events/DriveFilesList';
import CreateDriveFolderButton from '@/components/events/CreateDriveFolderButton';
import SyncStatusButton from '@/components/events/SyncStatusButton';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // V Next.js 14+ jsou params Promise
  const { id } = await params;

  console.log('[EventDetailPage] Loading event:', id);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error('[EventDetailPage] No user found');
    notFound();
  }

  console.log('[EventDetailPage] User:', user.email);

  // Načti profil pro kontrolu role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  console.log('[EventDetailPage] Profile role:', profile?.role);

  const isAdmin = profile?.role === 'admin';

  // Načti detail akce s pozicemi a assignments
  // Musíme specifikovat relationship kvůli více foreign keys na profiles
  const { data: event, error } = await supabase
    .from('events')
    .select(
      `
      *,
      positions (
        *,
        assignments (
          *,
          technician:profiles!assignments_technician_id_fkey (*)
        )
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('[EventDetailPage] Error loading event:', error);
    notFound();
  }

  if (!event) {
    console.warn('[EventDetailPage] Event not found:', id);
    notFound();
  }

  console.log('[EventDetailPage] Event loaded:', event.title, 'with', event.positions?.length || 0, 'positions');

  // Načti všechny aktivní techniky pro dropdown
  const { data: allTechnicians } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'technician')
    .eq('is_active', true)
    .order('full_name');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Event Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{event.title}</CardTitle>
              {event.description && (
                <CardDescription>{event.description}</CardDescription>
              )}
            </div>
            <Badge variant={event.status === 'confirmed' ? 'default' : 'secondary'}>
              {event.status === 'confirmed' ? 'Potvrzeno' : 'Předběžně'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="flex items-center gap-3 text-slate-700">
                <FolderOpen className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Google Drive</p>
                  <a
                    href={event.drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Otevřít složku
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex gap-3 pt-4 border-t">
              {!event.drive_folder_url && (
                <CreateDriveFolderButton eventId={event.id} />
              )}
              <SyncStatusButton eventId={event.id} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Positions Section */}
      <PositionsManager
        positions={event.positions || []}
        eventId={event.id}
        isAdmin={isAdmin}
        allTechnicians={allTechnicians || []}
        eventStartDate={event.start_time}
        eventEndDate={event.end_time}
      />

      {/* Drive Files Section */}
      <DriveFilesList eventId={event.id} driveFolderId={event.drive_folder_id} />
    </div>
  );
}
