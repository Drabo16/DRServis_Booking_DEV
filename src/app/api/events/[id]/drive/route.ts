import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createEventFolderStructure, updateInfoFile } from '@/lib/google/drive';

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

    // Kontrola admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Načtení eventu s pozicemi a přiřazenými techniky
    const { data: event, error: eventError } = await supabase
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
            technician:profiles (
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
    await supabase
      .from('events')
      .update({
        drive_folder_id: folderResult.folderId,
        drive_folder_url: folderResult.folderUrl,
      })
      .eq('id', eventId);

    return NextResponse.json({
      success: true,
      message: 'Drive folder created successfully',
      folderId: folderResult.folderId,
      folderUrl: folderResult.folderUrl,
      folderName: folderResult.folderName,
    });
  } catch (error) {
    console.error('Drive folder creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create Drive folder',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
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

    // Načtení eventu s pozicemi a techniky
    const { data: event, error: eventError } = await supabase
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
            technician:profiles (
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
    return NextResponse.json(
      {
        error: 'Failed to update info file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
