import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { attachDriveFolderToEvent } from '@/lib/google/calendar';
import { listFilesInFolder } from '@/lib/google/drive';
import { apiError } from '@/lib/api-response';

/**
 * POST /api/events/[id]/attach-drive
 * Připojí existující Drive složku A její soubory ke Google Calendar události
 * Přidává složku + jednotlivé dokumenty (Docs, Sheets, PDF, Office soubory)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    const supabase = await createClient();

    // Ověření autentizace
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kontrola přístupu - admin, supervisor, nebo manager
    const profile = await getProfileWithFallback(supabase, user);
    const canManageFolders = await hasBookingAccess(supabase, profile, ['booking_manage_folders']);

    if (!canManageFolders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role client for database operations to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Načtení eventu
    const { data: event, error: eventError } = await serviceClient
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Kontrola, jestli má event Drive složku
    if (!event.drive_folder_id || !event.drive_folder_url) {
      return NextResponse.json(
        { error: 'Event does not have a Drive folder. Create one first.' },
        { status: 400 }
      );
    }

    // Kontrola, jestli má event Google Calendar ID
    if (!event.google_event_id) {
      return NextResponse.json(
        { error: 'Event is not synced with Google Calendar yet.' },
        { status: 400 }
      );
    }

    // Získáme seznam souborů ve složce
    let folderFiles: Array<{ id: string; name: string; mimeType: string; webViewLink: string }> = [];
    try {
      const files = await listFilesInFolder(event.drive_folder_id);
      folderFiles = files.map((f: any) => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        webViewLink: f.webViewLink!,
      }));
      // Files found in folder
    } catch (listError) {
      console.warn('[Attach Drive] Could not list files in folder:', listError);
      // Pokračujeme bez souborů - připojíme alespoň složku
    }

    // Připojíme Drive složku a její soubory ke kalendáři jako přílohy
    const result = await attachDriveFolderToEvent(
      event.google_event_id,
      event.drive_folder_url,
      event.drive_folder_id,
      `Podklady - ${event.title}`,
      folderFiles
    );

    // Aktualizujeme stav synchronizace v DB
    await serviceClient
      .from('events')
      .update({ calendar_attachment_synced: true })
      .eq('id', eventId);

    return NextResponse.json({
      success: true,
      message: `Drive folder and ${result.attachedCount} files attached to calendar event`,
      attachedCount: result.attachedCount,
      filesFound: folderFiles.length,
    });
  } catch (error) {
    console.error('Attach Drive folder error:', error);
    return apiError('Failed to attach Drive folder to calendar');
  }
}
