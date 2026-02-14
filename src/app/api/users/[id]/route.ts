import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext, hasPermission, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * PATCH /api/users/[id]
 * Aktualizace uživatele (pro uživatele s oprávněním users_settings_manage_users)
 *
 * SECURITY RULES:
 * - Admins/Supervisors: Can edit any user, change roles, edit everything
 * - Managers: Can ONLY edit basic info (name, phone, specialization, is_active) of TECHNICIANS
 *   - Cannot change roles
 *   - Cannot edit admins or other managers
 *   - Cannot edit themselves
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check permission to manage users
    const canManageUsers = await hasPermission(profile, 'users_settings_manage_users', isSupervisor);

    if (!canManageUsers) {
      return NextResponse.json({ error: 'Forbidden - nemáte oprávnění spravovat uživatele' }, { status: 403 });
    }

    // SECURITY: Determine if current user is admin or supervisor
    const isAdmin = profile.role === 'admin';
    const isPrivileged = isAdmin || isSupervisor;

    // Get target user info
    const serviceClient = createServiceRoleClient();
    const { data: targetUser, error: targetError } = await serviceClient
      .from('profiles')
      .select('id, role, email')
      .eq('id', userId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { full_name, email, phone, role, specialization, is_active, is_drservis, company, note } = body;

    // SECURITY: Manager restrictions
    if (!isPrivileged) {
      // Managers cannot edit themselves
      if (userId === profile.id) {
        return NextResponse.json(
          { error: 'Forbidden - nemůžete editovat svůj vlastní účet' },
          { status: 403 }
        );
      }

      // Managers can only edit technicians
      if (targetUser.role !== 'technician') {
        return NextResponse.json(
          { error: 'Forbidden - můžete editovat pouze techniky' },
          { status: 403 }
        );
      }

      // Managers cannot change roles
      if (role !== undefined && role !== targetUser.role) {
        return NextResponse.json(
          { error: 'Forbidden - nemáte oprávnění měnit role uživatelů' },
          { status: 403 }
        );
      }
    }

    // Sestavit update objekt pouze s poskytnutými poli
    const updates: Record<string, unknown> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (specialization !== undefined) updates.specialization = specialization;
    if (is_active !== undefined) updates.is_active = is_active;
    if (is_drservis !== undefined) updates.is_drservis = is_drservis;
    if (company !== undefined) updates.company = company;
    if (note !== undefined) updates.note = note;

    // Only privileged users can change role
    if (role !== undefined && isPrivileged) {
      updates.role = role;
    }
    // Email can be changed by anyone with edit permission
    if (email !== undefined) {
      updates.email = email;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

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
 * Smazání uživatele (POUZE pro adminy a supervisory)
 *
 * SECURITY: Managers CANNOT delete users - only admins and supervisors can
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // SECURITY: Only admins and supervisors can delete users
    const isAdmin = profile.role === 'admin';
    const serviceClient = createServiceRoleClient();

    if (!isAdmin && !isSupervisor) {
      return NextResponse.json(
        { error: 'Forbidden - pouze administrátoři mohou mazat uživatele' },
        { status: 403 }
      );
    }

    // Zabránit smazání vlastního účtu
    if (userId === profile.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

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
