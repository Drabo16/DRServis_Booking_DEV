import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { createAssignmentSchema } from '@/lib/validations/assignments';
import { apiError } from '@/lib/api-response';

/**
 * POST /api/assignments
 * Vytvoreni noveho assignment (prirazeni technika na pozici)
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

    // Kontrola pristupu - admin, supervisor, nebo uzivatel s booking_manage_positions
    const profile = await getProfileWithFallback(supabase, user);
    const canManagePositions = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);

    if (!canManagePositions) {
      return apiError('Forbidden', 403);
    }

    // Use service role client for database operations to bypass RLS
    const serviceClient = createServiceRoleClient();

    const body = await request.json();
    const parsed = createAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { position_id, technician_id, notes, start_date, end_date } = parsed.data;

    // Ziskej event_id z pozice
    const { data: position, error: positionError } = await serviceClient
      .from('positions')
      .select('event_id')
      .eq('id', position_id)
      .single();

    if (positionError || !position) {
      return apiError('Position not found', 404);
    }

    // Over, ze technician existuje
    const { data: technicianExists, error: techError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', technician_id)
      .single();

    if (techError || !technicianExists) {
      return apiError('Technician not found', 404);
    }

    // Zkontroluj duplicitni prirazeni
    const { data: existing } = await serviceClient
      .from('assignments')
      .select('id')
      .eq('position_id', position_id)
      .eq('technician_id', technician_id)
      .maybeSingle();

    if (existing) {
      return apiError('Assignment already exists', 409);
    }

    const { data, error } = await serviceClient
      .from('assignments')
      .insert({
        position_id,
        event_id: position.event_id,
        technician_id,
        notes,
        start_date: start_date || null,
        end_date: end_date || null,
        attendance_status: 'pending',
        assigned_by: profile?.id,
      })
      .select('*, position:positions(*), technician:profiles!assignments_technician_id_fkey(*)')
      .single();

    if (error) {
      console.error('Assignment insert error:', error);
      throw error;
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (error) {
    console.error('Assignment creation error:', error);
    return apiError('Failed to create assignment');
  }
}
