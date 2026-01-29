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

    // Check user permissions - users with booking permissions can see all events
    let hasBookingPermissions = false;
    if (profile?.id) {
      const { data: userPermissions } = await supabase
        .from('user_permissions')
        .select('permission_code')
        .eq('user_id', profile.id)
        .in('permission_code', ['booking_view', 'booking_manage_events', 'booking_manage_positions', 'booking_invite']);
      hasBookingPermissions = !!(userPermissions && userPermissions.length > 0);
    }

    // User can see all events if admin, supervisor, or has booking permissions
    const canSeeAllEvents = isAdmin || isSupervisor || hasBookingPermissions;

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
