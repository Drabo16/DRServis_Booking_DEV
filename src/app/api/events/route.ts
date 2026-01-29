import { NextResponse } from 'next/server';
import { createClient, getProfileWithFallback } from '@/lib/supabase/server';

/**
 * GET /api/events
 * Fetch all events with positions and assignments
 */
export async function GET() {
  try {
    const supabase = await createClient();

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
      .gte('start_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true })
      .limit(50);

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
