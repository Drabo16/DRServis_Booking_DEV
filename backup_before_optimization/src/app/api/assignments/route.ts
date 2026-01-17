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
    const { data: position, error: positionError } = await supabase
      .from('positions')
      .select('event_id')
      .eq('id', position_id)
      .single();

    if (positionError) {
      console.error('Position lookup error:', {
        code: positionError.code,
        message: positionError.message,
        details: positionError.details,
        hint: positionError.hint,
        position_id,
      });
      return NextResponse.json(
        {
          error: 'Position lookup failed',
          details: positionError.message,
          code: positionError.code,
        },
        { status: 404 }
      );
    }

    if (!position) {
      console.error('Position not found:', { position_id });
      return NextResponse.json(
        { error: 'Position not found', position_id },
        { status: 404 }
      );
    }

    // Ověř, že technician existuje
    const { data: technicianExists, error: techError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', technician_id)
      .single();

    if (techError || !technicianExists) {
      console.error('Technician validation error:', {
        technician_id,
        error: techError,
      });
      return NextResponse.json(
        {
          error: 'Technician not found',
          technician_id,
          details: techError?.message,
        },
        { status: 404 }
      );
    }

    // Zkontroluj duplicitní přiřazení
    const { data: existing } = await supabase
      .from('assignments')
      .select('id')
      .eq('position_id', position_id)
      .eq('technician_id', technician_id)
      .maybeSingle();

    if (existing) {
      console.warn('Duplicate assignment attempt:', {
        position_id,
        technician_id,
        existing_id: existing.id,
      });
      return NextResponse.json(
        {
          error: 'Assignment already exists',
          existing_assignment_id: existing.id,
        },
        { status: 409 }
      );
    }

    console.log('Creating assignment:', {
      position_id,
      event_id: position.event_id,
      technician_id,
      assigned_by: profile.id,
    });

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
      console.error('Assignment insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        data: {
          position_id,
          event_id: position.event_id,
          technician_id,
          assigned_by: profile.id,
        },
      });
      throw error;
    }

    console.log('Assignment created successfully:', { assignment_id: data.id });
    return NextResponse.json({ success: true, assignment: data });
  } catch (error: any) {
    console.error('Assignment creation error (catch):', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: 'Failed to create assignment',
        message: error?.message || 'Unknown error',
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      },
      { status: 500 }
    );
  }
}
