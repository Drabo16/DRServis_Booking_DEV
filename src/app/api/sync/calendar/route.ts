import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchCalendarEvents } from '@/lib/google/calendar';

/**
 * POST /api/sync/calendar
 * Synchronizace událostí z Google Calendar do Supabase
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parsování parametrů
    const body = await request.json();
    const daysAhead = body.daysAhead || 90; // Default 90 dní dopředu

    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + daysAhead);

    // Log start
    const syncLogStart = new Date();

    // Načtení eventů z Google Calendar
    const calendarEvents = await fetchCalendarEvents(timeMin, timeMax);

    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Zpracování každého eventu
    for (const calEvent of calendarEvents) {
      try {
        if (!calEvent.id || !calEvent.summary) {
          errorCount++;
          errors.push({ eventId: calEvent.id, error: 'Missing required fields' });
          continue;
        }

        const startTime = calEvent.start?.dateTime || calEvent.start?.date;
        const endTime = calEvent.end?.dateTime || calEvent.end?.date;

        if (!startTime || !endTime) {
          errorCount++;
          errors.push({ eventId: calEvent.id, error: 'Missing start or end time' });
          continue;
        }

        // Upsert do databáze
        const { error } = await supabase.from('events').upsert(
          {
            google_event_id: calEvent.id,
            google_calendar_id: process.env.GOOGLE_CALENDAR_ID || 'primary',
            title: calEvent.summary,
            description: calEvent.description || null,
            location: calEvent.location || null,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            status: (calEvent.status as any) || 'confirmed',
            html_link: calEvent.htmlLink || null,
            last_synced_at: new Date().toISOString(),
          },
          {
            onConflict: 'google_event_id',
          }
        );

        if (error) {
          errorCount++;
          errors.push({ eventId: calEvent.id, error: error.message });
        } else {
          successCount++;
        }
      } catch (err) {
        errorCount++;
        errors.push({
          eventId: calEvent.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Uložení sync logu
    await supabase.from('sync_logs').insert({
      sync_type: 'calendar_ingest',
      status: errorCount === 0 ? 'success' : errorCount === successCount ? 'failed' : 'partial',
      events_processed: successCount,
      errors_count: errorCount,
      error_details: errors.length > 0 ? errors : null,
      started_at: syncLogStart.toISOString(),
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${successCount} events successfully`,
      processed: successCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync calendar',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
