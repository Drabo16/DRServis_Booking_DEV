import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { createEventFolderStructure, updateInfoFile, deleteFolder } from '@/lib/google/drive';
import { removeDriveFolderFromEvent } from '@/lib/google/calendar';
import { apiError } from '@/lib/api-response';

/**
 * POST /api/events/[id]/drive
 * Vytvoření struktury složek na Google Drive pro akci
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

    // Kontrola přístupu - admin, supervisor, nebo uživatel s booking_manage_folders
    const profile = await getProfileWithFallback(supabase, user);
    const canManageFolders = await hasBookingAccess(supabase, profile, ['booking_manage_folders']);

    if (!canManageFolders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role client for database operations to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Načtení eventu s pozicemi a přiřazenými techniky
    // Použití explicitního foreign key pro disambiguaci vztahu profiles
    const { data: event, error: eventError } = await serviceClient
      .from('events')
      .select(`
        *,
        positions (
          id,
          role_type,
          title,
          assignments (
            id,
            attendance_status,
            technician:profiles!assignments_technician_id_fkey (
              full_name
            )
          )
        )
      `)
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return apiError('Event not found', 404);
    }

    // Kontrola, jestli už složka neexistuje
    if (event.drive_folder_id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Drive folder already exists',
          folderId: event.drive_folder_id,
          folderUrl: event.drive_folder_url,
        },
        { status: 400 }
      );
    }

    // Připravíme data o potvrzených technicích
    const confirmedTechnicians = (event.positions || []).flatMap((pos: any) =>
      (pos.assignments || [])
        .filter((a: any) => a.attendance_status === 'accepted')
        .map((a: any) => ({
          name: a.technician?.full_name || 'Neznámý',
          role: pos.title || pos.role_type,
          status: 'Potvrzeno',
        }))
    );

    // Vytvoření složky s info souborem
    const folderResult = await createEventFolderStructure(
      event.title,
      new Date(event.start_time),
      {
        endTime: event.end_time ? new Date(event.end_time) : undefined,
        location: event.location,
        description: event.description,
        confirmedTechnicians,
      }
    );

    // Uložení odkazu do DB
    await serviceClient
      .from('events')
      .update({
        drive_folder_id: folderResult.folderId,
        drive_folder_url: folderResult.folderUrl,
      })
      .eq('id', eventId);

    return NextResponse.json({
      success: true,
      message: folderResult.infoFileCreated
        ? 'Drive folder created successfully with info file'
        : `Drive folder created (info file failed: ${folderResult.infoFileError})`,
      folderId: folderResult.folderId,
      folderUrl: folderResult.folderUrl,
      folderName: folderResult.folderName,
      infoFileCreated: folderResult.infoFileCreated,
      infoFileError: folderResult.infoFileError,
    });
  } catch (error) {
    console.error('Drive folder creation error:', error);
    return apiError('Failed to create Drive folder');
  }
}

/**
 * PATCH /api/events/[id]/drive
 * Aktualizace info souboru v existující Drive složce
 */
export async function PATCH(
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

    // Kontrola přístupu - admin, supervisor, nebo uživatel s booking_manage_folders
    const profile = await getProfileWithFallback(supabase, user);
    const canManageFolders = await hasBookingAccess(supabase, profile, ['booking_manage_folders']);

    if (!canManageFolders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role client for database operations to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Načtení eventu s pozicemi a techniky
    // Použití explicitního foreign key pro disambiguaci vztahu profiles
    const { data: event, error: eventError } = await serviceClient
      .from('events')
      .select(`
        *,
        positions (
          id,
          role_type,
          title,
          assignments (
            id,
            attendance_status,
            technician:profiles!assignments_technician_id_fkey (
              full_name
            )
          )
        )
      `)
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.drive_folder_id) {
      return NextResponse.json(
        { error: 'No Drive folder exists for this event' },
        { status: 400 }
      );
    }

    // Připravíme data o potvrzených technicích
    const confirmedTechnicians = (event.positions || []).flatMap((pos: any) =>
      (pos.assignments || [])
        .filter((a: any) => a.attendance_status === 'accepted')
        .map((a: any) => ({
          name: a.technician?.full_name || 'Neznámý',
          role: pos.title || pos.role_type,
          status: 'Potvrzeno',
        }))
    );

    // Aktualizujeme info soubor
    await updateInfoFile(event.drive_folder_id, {
      title: event.title,
      startTime: new Date(event.start_time),
      endTime: event.end_time ? new Date(event.end_time) : undefined,
      location: event.location,
      description: event.description,
      confirmedTechnicians,
    });

    return NextResponse.json({
      success: true,
      message: 'Info file updated successfully',
    });
  } catch (error) {
    console.error('Drive info update error:', error);
    return apiError('Failed to update info file');
  }
}

/**
 * DELETE /api/events/[id]/drive
 * Smazání Drive složky pro akci
 */
export async function DELETE(
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

    // Kontrola přístupu - admin, supervisor, nebo uživatel s booking_manage_folders
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
      .select('id, title, drive_folder_id, drive_folder_url, google_event_id, calendar_attachment_synced')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.drive_folder_id) {
      return NextResponse.json(
        { error: 'No Drive folder exists for this event' },
        { status: 400 }
      );
    }

    // Vždy zkusit odebrat přílohu z kalendáře (pokud existuje google_event_id)
    // Neřídíme se jen flagem calendar_attachment_synced - příloha mohla být přidána ručně
    let calendarAttachmentRemoved = false;
    if (event.google_event_id && event.drive_folder_id) {
      try {
        await removeDriveFolderFromEvent(event.google_event_id, event.drive_folder_id);
        calendarAttachmentRemoved = true;
      } catch (calendarError) {
        console.error('[Drive API] Failed to remove calendar attachment:', calendarError);
        // Pokračujeme dál i když se nepodaří odebrat přílohu z kalendáře
      }
    }

    // Smazání složky na Google Drive
    const deleteResult = await deleteFolder(event.drive_folder_id);

    // Vymazání odkazu z DB
    await serviceClient
      .from('events')
      .update({
        drive_folder_id: null,
        drive_folder_url: null,
        calendar_attachment_synced: false,
      })
      .eq('id', eventId);

    return NextResponse.json({
      success: true,
      message: deleteResult.alreadyDeleted
        ? 'Folder was already deleted, DB reference cleared'
        : 'Drive folder deleted successfully',
      alreadyDeleted: deleteResult.alreadyDeleted || false,
      calendarAttachmentRemoved,
    });
  } catch (error) {
    console.error('Drive folder deletion error:', error);
    return apiError('Failed to delete Drive folder');
  }
}
