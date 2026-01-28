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

    // Get profile and check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Admin has full access
    const isAdmin = profile.role === 'admin';

    // Check booking_manage_events permission if not admin
    let hasPermission = isAdmin;
    if (!isAdmin) {
      const { data: permission } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', profile.id)
        .eq('permission_code', 'booking_manage_events')
        .single();
      hasPermission = !!permission;
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parsování parametrů s validací
    let body: { daysAhead?: number } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is OK, use defaults
    }

    // Validace daysAhead - min 1, max 365 dní
    const rawDaysAhead = body.daysAhead;
    const daysAhead = typeof rawDaysAhead === 'number' && rawDaysAhead > 0 && rawDaysAhead <= 365
      ? Math.floor(rawDaysAhead)
      : 90; // Default 90 dní dopředu

    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + daysAhead);

    // Log start
    const syncLogStart = new Date();

    // Načtení eventů z Google Calendar
    const calendarEvents = await fetchCalendarEvents(timeMin, timeMax);

    let successCount = 0;
    let errorCount = 0;
    let deletedCount = 0;
    const errors: any[] = [];

    // Získáme ID všech událostí z Google Calendar
    const googleEventIds = calendarEvents
      .filter(e => e.id)
      .map(e => e.id as string);

    // Najdeme události v DB, které mají google_event_id a jsou v daném časovém rozmezí
    const { data: existingEvents } = await supabase
      .from('events')
      .select('id, google_event_id, title')
      .not('google_event_id', 'is', null)
      .gte('start_time', timeMin.toISOString())
      .lte('start_time', timeMax.toISOString());

    // Smažeme události, které už nejsou v Google Calendar
    if (existingEvents) {
      for (const dbEvent of existingEvents) {
        if (dbEvent.google_event_id && !googleEventIds.includes(dbEvent.google_event_id)) {
          // Událost byla smazána z Google Calendar - smažeme ji i z DB
          // Nejdřív smažeme assignments a positions (kvůli foreign keys)
          const { data: positions } = await supabase
            .from('positions')
            .select('id')
            .eq('event_id', dbEvent.id);

          if (positions) {
            for (const pos of positions) {
              await supabase.from('assignments').delete().eq('position_id', pos.id);
            }
            await supabase.from('positions').delete().eq('event_id', dbEvent.id);
          }

          // Pak smažeme samotnou událost
          const { error: deleteError } = await supabase
            .from('events')
            .delete()
            .eq('id', dbEvent.id);

          if (!deleteError) {
            deletedCount++;
            console.log(`[Sync] Deleted event: ${dbEvent.title} (removed from Google Calendar)`);
          } else {
            console.error(`[Sync] Error deleting event ${dbEvent.id}:`, deleteError);
          }
        }
      }
    }

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
      message: `Synced ${successCount} events, deleted ${deletedCount} removed events`,
      processed: successCount,
      deleted: deletedCount,
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
