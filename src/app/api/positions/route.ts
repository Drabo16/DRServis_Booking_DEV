import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';

/**
 * POST /api/positions
 * Vytvoření nové pozice
 */
export async function POST(request: NextRequest) {
  try {
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
    const {
      event_id,
      title,
      role_type,
      requirements,
      shift_start,
      shift_end,
    } = body;

    if (!event_id || !title || !role_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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
    return NextResponse.json(
      {
        error: 'Failed to create position',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/positions?id=xxx
 * Smazání pozice
 */
export async function DELETE(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get('id');

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID is required' },
        { status: 400 }
      );
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
    return NextResponse.json(
      {
        error: 'Failed to delete position',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
