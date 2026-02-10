import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kontrola přístupu - admin, supervisor, nebo manager
    const profile = await getProfileWithFallback(supabase, user);
    const canManagePositions = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);

    if (!canManagePositions) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role client for database operations to bypass RLS
    const serviceClient = createServiceRoleClient();

    const body = await request.json();
    const { attendance_status, start_date, end_date } = body;

    // Build update object with provided fields
    const updates: Record<string, any> = {};

    if (attendance_status !== undefined) {
      // Validate attendance_status
      const validStatuses = ['pending', 'accepted', 'declined', 'tentative'];
      if (!validStatuses.includes(attendance_status)) {
        return NextResponse.json(
          { error: 'Invalid attendance_status' },
          { status: 400 }
        );
      }
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
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
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
    return NextResponse.json(
      {
        error: 'Failed to update assignment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kontrola přístupu - admin, supervisor, nebo manager
    const profile = await getProfileWithFallback(supabase, user);
    const canManagePositions = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);

    if (!canManagePositions) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    return NextResponse.json(
      {
        error: 'Failed to delete assignment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
