import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { createPositionSchema } from '@/lib/validations/positions';
import { apiError } from '@/lib/api-response';

/**
 * POST /api/positions
 * Vytvoreni nove pozice
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Kontrola pristupu - admin, supervisor, nebo manager
    const profile = await getProfileWithFallback(supabase, user);
    const canManagePositions = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);

    if (!canManagePositions) {
      return apiError('Forbidden', 403);
    }

    // Use service role client for database operations to bypass RLS
    const serviceClient = createServiceRoleClient();

    const body = await request.json();
    const parsed = createPositionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { event_id, title, role_type, requirements, shift_start, shift_end } = parsed.data;

    const { data, error } = await serviceClient
      .from('positions')
      .insert({
        event_id,
        title,
        role_type,
        requirements,
        shift_start,
        shift_end,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, position: data });
  } catch (error) {
    console.error('Position creation error:', error);
    return apiError('Failed to create position');
  }
}

/**
 * DELETE /api/positions?id=xxx
 * Smazani pozice
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Kontrola pristupu - admin, supervisor, nebo manager
    const profile = await getProfileWithFallback(supabase, user);
    const canManagePositions = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);

    if (!canManagePositions) {
      return apiError('Forbidden', 403);
    }

    // Use service role client for database operations to bypass RLS
    const serviceClient = createServiceRoleClient();

    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get('id');

    if (!positionId) {
      return apiError('Position ID is required', 400);
    }

    const { error } = await serviceClient
      .from('positions')
      .delete()
      .eq('id', positionId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Position deleted' });
  } catch (error) {
    console.error('Position deletion error:', error);
    return apiError('Failed to delete position');
  }
}
