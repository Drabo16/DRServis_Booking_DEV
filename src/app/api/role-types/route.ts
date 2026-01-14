import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/role-types - Načíst všechny typy rolí
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('role_types')
      .select('*')
      .order('label');

    if (error) throw error;

    return NextResponse.json({ roleTypes: data || [] });
  } catch (error) {
    console.error('[API] Error fetching role types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch role types' },
      { status: 500 }
    );
  }
}

// POST /api/role-types - Vytvořit nový typ role (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Kontrola autentizace
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kontrola admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { value, label } = body;

    if (!value || !label) {
      return NextResponse.json(
        { error: 'Value and label are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('role_types')
      .insert({ value, label })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique violation
        return NextResponse.json(
          { error: 'Role type with this value already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ roleType: data });
  } catch (error) {
    console.error('[API] Error creating role type:', error);
    return NextResponse.json(
      { error: 'Failed to create role type' },
      { status: 500 }
    );
  }
}
