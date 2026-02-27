import { NextRequest, NextResponse } from 'next/server';
import { createClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { getAttendeeStatuses } from '@/lib/google/calendar';
import { apiError } from '@/lib/api-response';

/**
 * POST /api/events/[id]/sync-status
 * Synchronizace statusů attendees z Google Calendar
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

    // Kontrola přístupu k bookingu
    const profile = await getProfileWithFallback(supabase, user);
    const canAccess = await hasBookingAccess(supabase, profile, ['booking_view']);

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Načtení eventu z DB
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, assignments(*, technician:profiles!assignments_technician_id_fkey(*))')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Získání statusů z Google Calendar
    const attendeeStatuses = await getAttendeeStatuses(event.google_event_id);

    let updatedCount = 0;
    const updates: any[] = [];

    // Aktualizace každého assignment podle emailu
    for (const assignment of event.assignments) {
      const attendee = attendeeStatuses.find(
        (a) => a.email === assignment.technician.email
      );

      if (attendee) {
        // Mapování Google Calendar status na naše status
        const statusMap: Record<string, string> = {
          needsAction: 'pending',
          accepted: 'accepted',
          declined: 'declined',
          tentative: 'tentative',
        };

        const newStatus = statusMap[attendee.responseStatus] || 'pending';

        // Aktualizuj pouze pokud se status změnil
        if (assignment.attendance_status !== newStatus) {
          const { error } = await supabase
            .from('assignments')
            .update({
              attendance_status: newStatus,
              response_time:
                attendee.responseStatus !== 'needsAction'
                  ? new Date().toISOString()
                  : null,
            })
            .eq('id', assignment.id);

          if (!error) {
            updatedCount++;
            updates.push({
              assignmentId: assignment.id,
              technicianEmail: assignment.technician.email,
              oldStatus: assignment.attendance_status,
              newStatus,
            });
          }
        }
      }
    }

    // Aktualizuj last_synced_at
    await supabase
      .from('events')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', eventId);

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} attendance statuses`,
      updated: updatedCount,
      updates,
    });
  } catch (error) {
    console.error('Status sync error:', error);
    return apiError('Failed to sync statuses');
  }
}
