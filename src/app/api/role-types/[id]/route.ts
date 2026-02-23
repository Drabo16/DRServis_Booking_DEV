import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasPermission } from '@/lib/supabase/server';

// PATCH /api/role-types/[id] - Aktualizovat typ role (pro uživatele s oprávněním users_settings_manage_roles)
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

    // Get profile with fallback
    const profile = await getProfileWithFallback(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check permission to manage roles
    const canManageRoles = await hasPermission(profile, 'users_settings_manage_roles');

    if (!canManageRoles) {
      return NextResponse.json({ error: 'Forbidden - nemáte oprávnění spravovat typy rolí' }, { status: 403 });
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

// DELETE /api/role-types/[id] - Smazat typ role (pro uživatele s oprávněním users_settings_manage_roles)
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

    // Get profile with fallback
    const profile = await getProfileWithFallback(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check permission to manage roles
    const canManageRoles = await hasPermission(profile, 'users_settings_manage_roles');

    if (!canManageRoles) {
      return NextResponse.json({ error: 'Forbidden - nemáte oprávnění spravovat typy rolí' }, { status: 403 });
    }

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Nejdříve získáme hodnotu role type pro aktualizaci pozic
    const { data: roleType } = await serviceClient
      .from('role_types')
      .select('value')
      .eq('id', id)
      .single();

    // Aktualizace pozic které měly tuto roli - nastavit na 'other' (PŘED smazáním role type)
    if (roleType?.value) {
      await serviceClient
        .from('positions')
        .update({ role_type: 'other' })
        .eq('role_type', roleType.value);
    }

    // Smazání role type (po aktualizaci pozic)
    const { error } = await serviceClient
      .from('role_types')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting role type:', error);
    return NextResponse.json(
      { error: 'Failed to delete role type' },
      { status: 500 }
    );
  }
}
