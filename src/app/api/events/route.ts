import { NextRequest, NextResponse } from 'next/server';
import { createClient, getProfileWithFallback } from '@/lib/supabase/server';

/**
 * GET /api/events
 * Fetch all events with positions and assignments
 * Query params:
 *   - showPast: 'true' to show past events instead of upcoming
 *   - daysBack: number of days back to show (default 30, max 365)
 *   - daysAhead: number of days ahead to show (default 90, max 365)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const showPast = searchParams.get('showPast') === 'true';
    const daysBack = Math.min(Math.max(parseInt(searchParams.get('daysBack') || '30'), 1), 365);
    const daysAhead = Math.min(Math.max(parseInt(searchParams.get('daysAhead') || '90'), 1), 365);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Načti profil s fallbackem na email lookup
    const profile = await getProfileWithFallback(supabase, user);

    const isAdmin = profile?.role === 'admin';
    const isManager = profile?.role === 'manager';

    // Check if supervisor
    let isSupervisor = false;
    if (profile?.email) {
      const { data: supervisorCheck } = await supabase
        .from('supervisor_emails')
        .select('email')
        .ilike('email', profile.email)
        .single();
      isSupervisor = !!supervisorCheck;
    }

    // Manager (Správce) has full booking access - sees all events
    // Admin and Supervisor also see all events
    const canSeeAllEvents = isAdmin || isManager || isSupervisor;

    // Calculate date range based on showPast flag
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (showPast) {
      // Past events: from X days ago until now
      startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      endDate = now;
    } else {
      // Upcoming events: from now until X days ahead
      startDate = now;
      endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    }

    // Fetch events based on role
    const query = supabase
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
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: !showPast }) // Past events: newest first
      .limit(100);

    const { data: events, error } = await query;

    if (error) {
      console.error('Events fetch error:', error);
      throw error;
    }

    // For users without booking permissions, filter to show only their assigned events
    const filteredEvents = canSeeAllEvents
      ? events
      : events?.filter((event) =>
          event.positions?.some((position: any) =>
            position.assignments?.some((assignment: any) => assignment.technician_id === profile?.id)
          )
        );

    return NextResponse.json(filteredEvents || []);
  } catch (error: any) {
    console.error('Events API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch events',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
