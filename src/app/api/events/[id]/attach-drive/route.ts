import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { attachDriveFolderToEvent } from '@/lib/google/calendar';

/**
 * POST /api/events/[id]/attach-drive
 * Připojí existující Drive složku ke Google Calendar události
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

    // Připojíme Drive složku ke kalendáři
    await attachDriveFolderToEvent(
      event.google_event_id,
      event.drive_folder_url,
      event.title
    );

    return NextResponse.json({
      success: true,
      message: 'Drive folder attached to calendar event successfully',
    });
  } catch (error) {
    console.error('Attach Drive folder error:', error);
    return NextResponse.json(
      {
        error: 'Failed to attach Drive folder to calendar',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
