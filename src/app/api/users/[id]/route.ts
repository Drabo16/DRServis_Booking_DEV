import { NextRequest, NextResponse } from 'next/server';
import { createClient, getProfileWithFallback, hasPermission, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * PATCH /api/users/[id]
 * Aktualizace uživatele (pro uživatele s oprávněním users_settings_manage_users)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    const supabase = await createClient();

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

    // Check permission to manage users
    const canManageUsers = await hasPermission(profile, 'users_settings_manage_users');

    if (!canManageUsers) {
      return NextResponse.json({ error: 'Forbidden - nemáte oprávnění spravovat uživatele' }, { status: 403 });
    }

    const body = await request.json();
    const { full_name, phone, role, specialization, is_active } = body;

    // Sestavit update objekt pouze s poskytnutými poli
    const updates: Record<string, unknown> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;
    if (specialization !== undefined) updates.specialization = specialization;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Aktualizace uživatele
    const { data: updatedUser, error } = await serviceClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Smazání uživatele (pro uživatele s oprávněním users_settings_manage_users)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    const supabase = await createClient();

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

    // Check permission to manage users
    const canManageUsers = await hasPermission(profile, 'users_settings_manage_users');

    if (!canManageUsers) {
      return NextResponse.json({ error: 'Forbidden - nemáte oprávnění spravovat uživatele' }, { status: 403 });
    }

    // Zabránit smazání vlastního účtu
    if (userId === profile.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Smazání uživatele (cascade smaže i všechny assignments)
    const { error } = await serviceClient.from('profiles').delete().eq('id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('User deletion error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
