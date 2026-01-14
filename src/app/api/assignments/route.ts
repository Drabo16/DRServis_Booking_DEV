import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/assignments
 * Vytvoření nového assignment (přiřazení technika na pozici)
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

    // Kontrola admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { position_id, technician_id, notes } = body;

    if (!position_id || !technician_id) {
      return NextResponse.json(
        { error: 'Missing required fields: position_id and technician_id' },
        { status: 400 }
      );
    }

    // Získej event_id z pozice
    const { data: position } = await supabase
      .from('positions')
      .select('event_id')
      .eq('id', position_id)
      .single();

    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        position_id,
        event_id: position.event_id,
        technician_id,
        notes,
        attendance_status: 'pending',
        assigned_by: profile.id,
      })
      .select('*, position:positions(*), technician:profiles!assignments_technician_id_fkey(*)')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (error) {
    console.error('Assignment creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create assignment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
