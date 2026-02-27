import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { updateAssignmentSchema } from '@/lib/validations/assignments';
import { apiError } from '@/lib/api-response';

/**
 * PATCH /api/assignments/[id]
 * Update assignment attendance status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
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
    const parsed = updateAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { attendance_status, start_date, end_date } = parsed.data;

    // Build update object with provided fields
    const updates: Record<string, unknown> = {};

    if (attendance_status !== undefined) {
      updates.attendance_status = attendance_status;
    }

    // Allow updating dates for partial assignments
    if (start_date !== undefined) {
      updates.start_date = start_date;
    }
    if (end_date !== undefined) {
      updates.end_date = end_date;
    }

    if (Object.keys(updates).length === 0) {
      return apiError('No valid fields to update', 400);
    }

    const { data, error } = await serviceClient
      .from('assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Assignment update error:', error);
    return apiError('Failed to update assignment');
  }
}

/**
 * DELETE /api/assignments/[id]
 * Delete assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
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

    // Delete assignment
    const { error } = await serviceClient
      .from('assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Assignment deleted' });
  } catch (error) {
    console.error('Assignment deletion error:', error);
    return apiError('Failed to delete assignment');
  }
}
