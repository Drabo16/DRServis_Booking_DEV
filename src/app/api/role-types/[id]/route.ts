import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasPermission } from '@/lib/supabase/server';
import { updateRoleTypeSchema } from '@/lib/validations/role-types';
import { apiError } from '@/lib/api-response';

// PATCH /api/role-types/[id] - Aktualizovat typ role (pro uzivatele s opravnenim users_settings_manage_roles)
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
      return apiError('Unauthorized', 401);
    }

    // Get profile with fallback
    const profile = await getProfileWithFallback(supabase, user);

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    // Check permission to manage roles
    const canManageRoles = await hasPermission(profile, 'users_settings_manage_roles');

    if (!canManageRoles) {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = updateRoleTypeSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { value, label } = parsed.data;

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
    return apiError('Failed to update role type');
  }
}

// DELETE /api/role-types/[id] - Smazat typ role (pro uzivatele s opravnenim users_settings_manage_roles)
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
      return apiError('Unauthorized', 401);
    }

    // Get profile with fallback
    const profile = await getProfileWithFallback(supabase, user);

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    // Check permission to manage roles
    const canManageRoles = await hasPermission(profile, 'users_settings_manage_roles');

    if (!canManageRoles) {
      return apiError('Forbidden', 403);
    }

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Nejdrive ziskame hodnotu role type pro aktualizaci pozic
    const { data: roleType } = await serviceClient
      .from('role_types')
      .select('value')
      .eq('id', id)
      .single();

    // Aktualizace pozic ktere mely tuto roli - nastavit na 'other' (PRED smazanim role type)
    if (roleType?.value) {
      await serviceClient
        .from('positions')
        .update({ role_type: 'other' })
        .eq('role_type', roleType.value);
    }

    // Smazani role type (po aktualizaci pozic)
    const { error } = await serviceClient
      .from('role_types')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting role type:', error);
    return apiError('Failed to delete role type');
  }
}
