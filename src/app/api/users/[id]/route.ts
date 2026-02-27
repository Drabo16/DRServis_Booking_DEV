import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext, hasPermission, createServiceRoleClient } from '@/lib/supabase/server';
import { updateUserSchema } from '@/lib/validations/users';
import { apiError } from '@/lib/api-response';

/**
 * PATCH /api/users/[id]
 * Aktualizace uzivatele (pro uzivatele s opravnenim users_settings_manage_users)
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
      return apiError('Unauthorized', 401);
    }

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    // Check permission to manage users
    const canManageUsers = await hasPermission(profile, 'users_settings_manage_users', isSupervisor);

    if (!canManageUsers) {
      return apiError('Forbidden', 403);
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
      return apiError('User not found', 404);
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { full_name, email, phone, role, specialization, is_active, is_drservis, company, note } = parsed.data;

    // SECURITY: Manager restrictions
    if (!isPrivileged) {
      // Managers cannot edit themselves
      if (userId === profile.id) {
        return apiError('Forbidden', 403);
      }

      // Managers can only edit technicians
      if (targetUser.role !== 'technician') {
        return apiError('Forbidden', 403);
      }

      // Managers cannot change roles
      if (role !== undefined && role !== targetUser.role) {
        return apiError('Forbidden', 403);
      }
    }

    // Sestavit update objekt pouze s poskytnutymi poli
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
      return apiError('No fields to update', 400);
    }

    // Aktualizace uzivatele
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
    return apiError('Failed to update user');
  }
}

/**
 * DELETE /api/users/[id]
 * Smazani uzivatele (POUZE pro adminy a supervisory)
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
      return apiError('Unauthorized', 401);
    }

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    // SECURITY: Only admins and supervisors can delete users
    const isAdmin = profile.role === 'admin';
    const serviceClient = createServiceRoleClient();

    if (!isAdmin && !isSupervisor) {
      return apiError('Forbidden', 403);
    }

    // Zabranit smazani vlastniho uctu
    if (userId === profile.id) {
      return apiError('Cannot delete your own account', 400);
    }

    // Smazani uzivatele (cascade smaze i vsechny assignments)
    const { error } = await serviceClient.from('profiles').delete().eq('id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('User deletion error:', error);
    return apiError('Failed to delete user');
  }
}
