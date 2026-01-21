import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// GET /api/permissions/user/[userId] - Get user's permissions
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if current user is admin or supervisor
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!currentProfile || currentProfile.role !== 'admin') {
      // Non-admins can only view their own permissions
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('auth_user_id')
        .eq('id', userId)
        .single();

      if (targetProfile?.auth_user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get target user info
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if target is supervisor
    const { data: supervisorCheck } = await supabase
      .from('supervisor_emails')
      .select('email')
      .ilike('email', targetUser.email)
      .single();

    const isSupervisor = !!supervisorCheck;

    // Get all permission types
    const { data: allPermissions } = await supabase
      .from('permission_types')
      .select('*')
      .order('module_code')
      .order('sort_order');

    // Get user's granted permissions
    const { data: userPermissions } = await supabase
      .from('user_permissions')
      .select('permission_code')
      .eq('user_id', userId);

    const grantedCodes = new Set(userPermissions?.map(p => p.permission_code) || []);

    // Get user's module access
    const { data: moduleAccess } = await supabase
      .from('user_module_access')
      .select('module_code')
      .eq('user_id', userId);

    const accessedModules = new Set(moduleAccess?.map(m => m.module_code) || []);

    // Get all modules
    const { data: allModules } = await supabase
      .from('app_modules')
      .select('code, name')
      .eq('is_active', true)
      .order('sort_order');

    // Build response
    const response = {
      id: targetUser.id,
      email: targetUser.email,
      full_name: targetUser.full_name,
      role: targetUser.role,
      is_supervisor: isSupervisor,
      modules: (allModules || []).map(m => ({
        code: m.code,
        name: m.name,
        has_access: targetUser.role === 'admin' || isSupervisor || accessedModules.has(m.code),
      })),
      permissions: (allPermissions || []).map(p => ({
        code: p.code,
        name: p.name,
        module_code: p.module_code,
        has_permission: targetUser.role === 'admin' || isSupervisor || grantedCodes.has(p.code),
      })),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching user permissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/permissions/user/[userId] - Update user's permissions
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if current user is admin
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!currentProfile || currentProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if current user is supervisor
    const { data: currentSupervisor } = await supabase
      .from('supervisor_emails')
      .select('email')
      .ilike('email', currentProfile.email)
      .single();

    const currentIsSupervisor = !!currentSupervisor;

    // Get target user
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only supervisors can modify admin permissions/modules
    if (targetUser.role === 'admin' && !currentIsSupervisor) {
      return NextResponse.json(
        { error: 'Only supervisors can modify admin permissions' },
        { status: 403 }
      );
    }

    const { permissions, modules } = body;

    // Update permissions if provided
    if (permissions !== undefined) {
      // Delete all existing permissions
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert new permissions
      if (permissions.length > 0) {
        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(
            permissions.map((code: string) => ({
              user_id: userId,
              permission_code: code,
              granted_by: currentProfile.id,
            }))
          );

        if (insertError) throw insertError;
      }
    }

    // Update module access if provided
    if (modules !== undefined) {
      // Delete all existing module access
      await supabase
        .from('user_module_access')
        .delete()
        .eq('user_id', userId);

      // Insert new module access
      if (modules.length > 0) {
        const { error: insertError } = await supabase
          .from('user_module_access')
          .insert(
            modules.map((code: string) => ({
              user_id: userId,
              module_code: code,
              granted_by: currentProfile.id,
            }))
          );

        if (insertError) throw insertError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating user permissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
