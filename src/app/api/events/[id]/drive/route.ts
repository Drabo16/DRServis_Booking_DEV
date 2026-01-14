import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createEventFolderStructure } from '@/lib/google/drive';

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

    // Načtení eventu
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
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

    // Vytvoření složky
    const folderResult = await createEventFolderStructure(
      event.title,
      new Date(event.start_time)
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
