import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Načti profil pro kontrolu role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('auth_user_id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

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

    // For non-admin, filter on server side for better security
    // Client can also filter but this ensures data security
    const filteredEvents = isAdmin
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
