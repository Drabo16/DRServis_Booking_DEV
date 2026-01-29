import { NextRequest, NextResponse } from 'next/server';
import { createClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { addAttendeeToEvent } from '@/lib/google/calendar';

/**
 * POST /api/events/[id]/invite
 * Přidání technika jako attendee do Google Calendar eventu
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    const supabase = await createClient();

    // Ověření autentizace
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kontrola přístupu - admin, supervisor, nebo uživatel s booking_invite
    const profile = await getProfileWithFallback(supabase, user);
    const canInvite = await hasBookingAccess(supabase, profile, ['booking_invite']);

    if (!canInvite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { assignmentId } = body;

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    // Načtení assignment s detaily
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('*, event:events(*), technician:profiles!assignments_technician_id_fkey(*)')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Přidání attendee do Google Calendar
    await addAttendeeToEvent(
      assignment.event.google_event_id,
      assignment.technician.email,
      assignment.technician.full_name
    );

    // Aktualizace assignment statusu na pending (čeká na odpověď)
    await supabase
      .from('assignments')
      .update({
        attendance_status: 'pending',
      })
      .eq('id', assignmentId);

    // Log do sync_logs
    await supabase.from('sync_logs').insert({
      sync_type: 'attendee_update',
      status: 'success',
      events_processed: 1,
      errors_count: 0,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${assignment.technician.email}`,
    });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send invitation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
