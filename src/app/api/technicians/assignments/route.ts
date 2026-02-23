import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext, hasPermission, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/technicians/assignments
 * Get all technicians with their assignments for a date range
 * Used for the technician overview view to see conflicts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check permission - need booking access at minimum
    const canView = await hasPermission(profile, 'booking_view', isSupervisor);
    if (!canView && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Use service client for complete data access
    const serviceClient = createServiceRoleClient();

    // Get all active technicians
    const { data: technicians, error: techError } = await serviceClient
      .from('profiles')
      .select('id, full_name, email, phone, specialization, is_active, is_drservis, company')
      .eq('is_active', true)
      .order('full_name');

    if (techError) {
      throw techError;
    }

    // Build the assignments query
    let assignmentsQuery = serviceClient
      .from('assignments')
      .select(`
        id,
        position_id,
        technician_id,
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
      .in('attendance_status', ['pending', 'accepted', 'tentative']);

    // Filter by date range if provided
    if (startDate && endDate) {
      // Get assignments where event overlaps with the requested date range
      assignmentsQuery = assignmentsQuery
        .gte('position.event.end_time', startDate)
        .lte('position.event.start_time', endDate);
    }

    const { data: assignments, error: assignError } = await assignmentsQuery;

    if (assignError) {
      throw assignError;
    }

    // Group assignments by technician
    const technicianAssignments = new Map<string, any[]>();

    (assignments || []).forEach((assignment: any) => {
      const techId = assignment.technician_id;
      if (!technicianAssignments.has(techId)) {
        technicianAssignments.set(techId, []);
      }
      technicianAssignments.get(techId)!.push({
        id: assignment.id,
        attendance_status: assignment.attendance_status,
        start_date: assignment.start_date,
        end_date: assignment.end_date,
        position: {
          id: assignment.position.id,
          title: assignment.position.title,
          role_type: assignment.position.role_type,
        },
        event: assignment.position.event,
      });
    });

    // Find conflicts for each technician
    const result = (technicians || []).map((tech: any) => {
      const techAssignments = technicianAssignments.get(tech.id) || [];

      // Sort assignments by event start time
      techAssignments.sort((a, b) =>
        new Date(a.event.start_time).getTime() - new Date(b.event.start_time).getTime()
      );

      // Find overlapping assignments (conflicts)
      const conflicts: { assignment1: string; assignment2: string; overlap: string }[] = [];

      for (let i = 0; i < techAssignments.length; i++) {
        for (let j = i + 1; j < techAssignments.length; j++) {
          const a1 = techAssignments[i];
          const a2 = techAssignments[j];

          // Use assignment dates if set, otherwise use event dates
          const a1Start = new Date(a1.start_date || a1.event.start_time);
          const a1End = new Date(a1.end_date || a1.event.end_time);
          const a2Start = new Date(a2.start_date || a2.event.start_time);
          const a2End = new Date(a2.end_date || a2.event.end_time);

          // Check for overlap
          if (a1Start < a2End && a1End > a2Start) {
            conflicts.push({
              assignment1: a1.id,
              assignment2: a2.id,
              overlap: `${a1.event.title} x ${a2.event.title}`,
            });
          }
        }
      }

      return {
        ...tech,
        assignments: techAssignments,
        conflicts,
        hasConflicts: conflicts.length > 0,
        assignmentCount: techAssignments.length,
      };
    });

    // Sort: technicians with conflicts first, then by assignment count
    result.sort((a, b) => {
      if (a.hasConflicts !== b.hasConflicts) {
        return a.hasConflicts ? -1 : 1;
      }
      return b.assignmentCount - a.assignmentCount;
    });

    return NextResponse.json({
      technicians: result,
      totalTechnicians: result.length,
      techniciansWithConflicts: result.filter(t => t.hasConflicts).length,
    });
  } catch (error) {
    console.error('Technician assignments fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch technician assignments',
      },
      { status: 500 }
    );
  }
}
