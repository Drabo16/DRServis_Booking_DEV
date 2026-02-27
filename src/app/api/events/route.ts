import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/events
 * Fetch all events with positions and assignments
 * Query params:
 *   - showPast: 'true' to show past events instead of upcoming
 *   - daysBack: number of days back to show (default 30, max 365)
 *   - daysAhead: number of days ahead to show (default 365, max 365)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const showPast = searchParams.get('showPast') === 'true';
    const daysBack = Math.min(Math.max(parseInt(searchParams.get('daysBack') || '30') || 30, 1), 365);
    const daysAhead = Math.min(Math.max(parseInt(searchParams.get('daysAhead') || '365') || 365, 1), 365);

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = profile?.role === 'admin';
    const isManager = profile?.role === 'manager';

    // Manager (Správce) has full booking access - sees all events
    // Admin and Supervisor also see all events
    const canSeeAllEvents = isAdmin || isManager || isSupervisor;

    // Calculate date range based on showPast flag
    const now = new Date();
    // Start of today (midnight) for filtering - events should show on their day
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    // Yesterday midnight - to show events until second day after end
    const yesterdayMidnight = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    let query;

    if (showPast) {
      // Past events: events that ended before yesterday (truly past)
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      query = supabase
        .from('events')
        .select(`
          *,
          positions (
            id,
            title,
            role_type,
            shift_start,
            shift_end,
            requirements,
            assignments (
              id,
              attendance_status,
              technician_id,
              technician:profiles!assignments_technician_id_fkey(*)
            )
          )
        `)
        .gte('start_time', startDate.toISOString())
        .lt('end_time', yesterdayMidnight.toISOString())
        .order('start_time', { ascending: false })
        .limit(100);
    } else {
      // Upcoming/current events: events that haven't ended yet (end_time >= yesterday midnight)
      // This means events are shown until the SECOND day after they end
      const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      query = supabase
        .from('events')
        .select(`
          *,
          positions (
            id,
            title,
            role_type,
            shift_start,
            shift_end,
            requirements,
            assignments (
              id,
              attendance_status,
              technician_id,
              technician:profiles!assignments_technician_id_fkey(*)
            )
          )
        `)
        .gte('end_time', yesterdayMidnight.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true })
        .limit(100);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Events fetch error:', error);
      throw error;
    }

    // For users without booking permissions, filter to show only their assigned events
    const filteredEvents = canSeeAllEvents
      ? events
      : events?.filter((event) =>
          event.positions?.some((position: { assignments?: Array<{ technician_id: string }> }) =>
            position.assignments?.some((assignment) => assignment.technician_id === profile?.id)
          )
        );

    return NextResponse.json(filteredEvents || []);
  } catch (error) {
    console.error('Events API error:', error);
    return apiError('Failed to fetch events');
  }
}
