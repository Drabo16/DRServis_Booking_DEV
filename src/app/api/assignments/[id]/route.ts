import { NextRequest, NextResponse } from 'next/server';
import { createClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';

/**
 * PATCH /api/assignments/[id]
 * Update assignment attendance status (admin only)
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

    // Kontrola přístupu - admin, supervisor, nebo uživatel s booking_manage_positions
    const profile = await getProfileWithFallback(supabase, user);
    const canManagePositions = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);

    if (!canManagePositions) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { attendance_status } = body;

    if (!attendance_status) {
      return NextResponse.json(
        { error: 'attendance_status is required' },
        { status: 400 }
      );
    }

    // Validate attendance_status
    const validStatuses = ['pending', 'accepted', 'declined', 'tentative'];
    if (!validStatuses.includes(attendance_status)) {
      return NextResponse.json(
        { error: 'Invalid attendance_status' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('assignments')
      .update({ attendance_status })
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
 * Delete assignment (admin only)
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

    // Kontrola přístupu - admin, supervisor, nebo uživatel s booking_manage_positions
    const profile = await getProfileWithFallback(supabase, user);
    const canManagePositions = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);

    if (!canManagePositions) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete assignment
    const { error } = await supabase
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
