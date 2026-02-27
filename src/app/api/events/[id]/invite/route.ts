import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { addAttendeeToEvent } from '@/lib/google/calendar';
import { inviteSchema } from '@/lib/validations/events';
import { apiError } from '@/lib/api-response';

/**
 * POST /api/events/[id]/invite
 * Pridani technika jako attendee do Google Calendar eventu
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    const supabase = await createClient();

    // Overeni autentizace
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Kontrola pristupu - admin, supervisor, nebo manager
    const profile = await getProfileWithFallback(supabase, user);
    const canInvite = await hasBookingAccess(supabase, profile, ['booking_invite']);

    if (!canInvite) {
      return apiError('Forbidden', 403);
    }

    // Use service role client for database operations to bypass RLS
    const serviceClient = createServiceRoleClient();

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { assignmentId } = parsed.data;

    // Nacteni assignment s detaily
    const { data: assignment, error: assignmentError } = await serviceClient
      .from('assignments')
      .select('*, event:events(*), technician:profiles!assignments_technician_id_fkey(*)')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      return apiError('Assignment not found', 404);
    }

    // Pridani attendee do Google Calendar
    await addAttendeeToEvent(
      assignment.event.google_event_id,
      assignment.technician.email,
      assignment.technician.full_name
    );

    // Aktualizace assignment statusu na pending (ceka na odpoved)
    await serviceClient
      .from('assignments')
      .update({
        attendance_status: 'pending',
      })
      .eq('id', assignmentId);

    // Log do sync_logs
    await serviceClient.from('sync_logs').insert({
      sync_type: 'attendee_update',
      status: 'success',
      events_processed: 1,
      errors_count: 0,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    console.error('Invite error:', error);
    return apiError('Failed to send invitation');
  }
}
