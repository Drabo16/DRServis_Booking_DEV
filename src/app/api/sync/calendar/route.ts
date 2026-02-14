import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext, hasPermission, createServiceRoleClient } from '@/lib/supabase/server';
import { fetchCalendarEvents } from '@/lib/google/calendar';

/**
 * POST /api/sync/calendar
 * Synchronizace událostí z Google Calendar do Supabase
 *
 * Access rules (same as main booking page):
 * - Admins: always allowed
 * - Supervisors: always allowed
 * - Managers (správce): always allowed - they have FULL booking access
 * - Others: need explicit booking_manage_events permission
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check access - same logic as main booking page
    const isAdmin = profile.role === 'admin';
    const isManager = profile.role === 'manager';

    // Use service client for DB operations (bypasses RLS)
    const serviceClient = createServiceRoleClient();

    // Managers have FULL booking access (same as admin for booking module)
    const hasFullBookingAccess = isAdmin || isManager || isSupervisor;

    // Check explicit permission only if not admin/manager/supervisor
    let canManageEvents = hasFullBookingAccess;
    if (!canManageEvents) {
      canManageEvents = await hasPermission(profile, 'booking_manage_events', isSupervisor);
    }

    console.log('[Sync] Permission check:', {
      userId: user.id,
      email: profile.email,
      role: profile.role,
      isAdmin,
      isManager,
      isSupervisor,
      hasFullBookingAccess,
      canManageEvents,
    });

    if (!canManageEvents) {
      return NextResponse.json({
        error: 'Forbidden - nemáte oprávnění spravovat akce (booking_manage_events)'
      }, { status: 403 });
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
    console.log('[Sync] Fetching events from Google Calendar:', {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      daysAhead,
    });

    const calendarEvents = await fetchCalendarEvents(timeMin, timeMax);

    console.log('[Sync] Fetched from Google Calendar:', {
      count: calendarEvents.length,
      events: calendarEvents.slice(0, 5).map(e => ({ id: e.id, summary: e.summary })),
    });

    let successCount = 0;
    let errorCount = 0;
    let deletedCount = 0;
    const errors: { eventId: string | null | undefined; error: string }[] = [];

    // Získáme ID všech událostí z Google Calendar
    const googleEventIds = calendarEvents
      .filter(e => e.id)
      .map(e => e.id as string);

    // Use service client for all DB operations (bypasses RLS - we already verified permissions)
    // This is important because managers might not have direct RLS permission to insert/update events

    // Najdeme události v DB, které mají google_event_id a jsou v daném časovém rozmezí
    const { data: existingEvents } = await serviceClient
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
          const { data: positions } = await serviceClient
            .from('positions')
            .select('id')
            .eq('event_id', dbEvent.id);

          if (positions) {
            for (const pos of positions) {
              await serviceClient.from('assignments').delete().eq('position_id', pos.id);
            }
            await serviceClient.from('positions').delete().eq('event_id', dbEvent.id);
          }

          // Pak smažeme samotnou událost
          const { error: deleteError } = await serviceClient
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

        // Upsert do databáze (using service client to bypass RLS)
        const { error } = await serviceClient.from('events').upsert(
          {
            google_event_id: calEvent.id,
            google_calendar_id: process.env.GOOGLE_CALENDAR_ID || 'primary',
            title: calEvent.summary,
            description: calEvent.description || null,
            location: calEvent.location || null,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            status: (calEvent.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
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

    // Uložení sync logu (using service client)
    await serviceClient.from('sync_logs').insert({
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
