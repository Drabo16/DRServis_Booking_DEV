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
        *,
        positions (
          *,
          assignments (
            *,
            technician:profiles!assignments_technician_id_fkey (*)
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
