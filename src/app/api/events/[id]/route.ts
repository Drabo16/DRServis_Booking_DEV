import { NextRequest, NextResponse } from 'next/server';
import { createClient, getProfileWithFallback, hasAnyPermission } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Kontrola autentizace
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Check permissions
    const profile = await getProfileWithFallback(supabase, user);
    if (!profile) {
      return apiError('Forbidden', 403);
    }

    // Admin and manager skip permission check
    const isAdminOrManager = profile.role === 'admin' || profile.role === 'manager';
    if (!isAdminOrManager) {
      const hasAccess = await hasAnyPermission(profile, [
        'booking_view',
        'booking_manage_events',
        'booking_manage_positions',
        'booking_invite',
      ]);
      if (!hasAccess) {
        return apiError('Forbidden', 403);
      }
    }

    // Načti detail akce s pozicemi a assignments
    const { data: event, error } = await supabase
      .from('events')
      .select(
        `
        id, google_event_id, google_calendar_id, title, description, location, start_time, end_time, status, drive_folder_url, drive_folder_id, calendar_attachment_synced, html_link, created_by, last_synced_at, created_at, updated_at,
        positions (
          id, event_id, title, role_type, requirements, shift_start, shift_end, created_at, updated_at,
          assignments (
            id, position_id, event_id, technician_id, attendance_status, response_time, notes, assigned_by, assigned_at, updated_at, start_date, end_date,
            technician:profiles!assignments_technician_id_fkey (id, auth_user_id, email, full_name, phone, role, specialization, avatar_url, is_active, has_warehouse_access, is_drservis, company, note, created_at, updated_at)
          )
        )
      `
      )
      .eq('id', id)
      .single();

    if (error || !event) {
      return apiError('Event not found', 404);
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error('[API] Error fetching event:', error);
    return apiError('Failed to fetch event');
  }
}
