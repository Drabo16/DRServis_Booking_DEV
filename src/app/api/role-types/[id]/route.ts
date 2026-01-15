import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// PATCH /api/role-types/[id] - Aktualizovat typ role (admin only)
export async function PATCH(
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

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient();

    const { data, error } = await serviceClient
      .from('role_types')
      .update({ value, label })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ roleType: data });
  } catch (error) {
    console.error('[API] Error updating role type:', error);
    return NextResponse.json(
      { error: 'Failed to update role type' },
      { status: 500 }
    );
  }
}

// DELETE /api/role-types/[id] - Smazat typ role (admin only)
export async function DELETE(
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

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Nejdříve získáme hodnotu role type pro aktualizaci pozic
    const { data: roleType } = await serviceClient
      .from('role_types')
      .select('value')
      .eq('id', id)
      .single();

    // Smazání role type
    const { error } = await serviceClient
      .from('role_types')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Aktualizace pozic které měly tuto roli - nastavit na 'other'
    if (roleType?.value) {
      await serviceClient
        .from('positions')
        .update({ role_type: 'other' })
        .eq('role_type', roleType.value);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting role type:', error);
    return NextResponse.json(
      { error: 'Failed to delete role type' },
      { status: 500 }
    );
  }
}
