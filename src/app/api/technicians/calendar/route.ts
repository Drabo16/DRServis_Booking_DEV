import { NextResponse } from 'next/server';
import { createClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const technician_id = searchParams.get('technician_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    if (!technician_id) {
      return NextResponse.json({ error: 'technician_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization: users can view own calendar, admins/managers/supervisors can view any
    const profile = await getProfileWithFallback(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const isOwnCalendar = profile.id === technician_id;
    if (!isOwnCalendar) {
      const canViewOthers = await hasBookingAccess(supabase, profile, ['booking_view']);
      if (!canViewOthers) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Build query for assignments with their events and positions
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        id,
        attendance_status,
        start_date,
        end_date,
        position:positions!inner (
          id,
          title,
          role_type,
          event:events!inner (
            id,
            title,
            start_time,
            end_time,
            location,
            status
          )
        )
      `)
      .eq('technician_id', technician_id);

    if (error) throw error;

    // Transform and filter the data
    interface CalendarAssignment {
      id: string;
      attendance_status: string;
      start_date: string | null;
      end_date: string | null;
      position: {
        id: string;
        title: string;
        role_type: string;
        event: {
          id: string;
          title: string;
          start_time: string;
          end_time: string;
          location: string | null;
          status: string;
        };
      };
    }
    let transformedAssignments = ((assignments || []) as unknown as CalendarAssignment[]).map((a) => ({
      id: a.id,
      attendance_status: a.attendance_status,
      start_date: a.start_date,
      end_date: a.end_date,
      position: {
        id: a.position.id,
        title: a.position.title,
        role_type: a.position.role_type,
      },
      event: {
        id: a.position.event.id,
        title: a.position.event.title,
        start_time: a.position.event.start_time,
        end_time: a.position.event.end_time,
        location: a.position.event.location,
        status: a.position.event.status,
      },
    }));

    // Filter by date range if provided (do this in JS since we can't use nested filters)
    if (start_date) {
      transformedAssignments = transformedAssignments.filter(
        (a) => new Date(a.event.end_time) >= new Date(start_date)
      );
    }
    if (end_date) {
      transformedAssignments = transformedAssignments.filter(
        (a) => new Date(a.event.start_time) <= new Date(end_date)
      );
    }

    // Sort by event start time
    transformedAssignments.sort((a, b) =>
      new Date(a.event.start_time).getTime() - new Date(b.event.start_time).getTime()
    );

    return NextResponse.json({ assignments: transformedAssignments });
  } catch (error) {
    console.error('[API] Error fetching technician calendar:', error);
    return apiError('Failed to fetch technician calendar');
  }
}
