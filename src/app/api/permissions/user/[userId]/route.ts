import { NextRequest, NextResponse } from 'next/server';
import { createClient, checkIsSupervisor } from '@/lib/supabase/server';

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

    // Parallel fetch: supervisor check + all permission data
    const [
      isSupervisor,
      { data: allPermissions },
      { data: userPermissions },
      { data: moduleAccess },
      { data: allModules },
    ] = await Promise.all([
      checkIsSupervisor(targetUser.email),
      supabase
        .from('permission_types')
        .select('code, name, module_code, sort_order')
        .order('module_code')
        .order('sort_order'),
      supabase
        .from('user_permissions')
        .select('permission_code')
        .eq('user_id', userId),
      supabase
        .from('user_module_access')
        .select('module_code')
        .eq('user_id', userId),
      supabase
        .from('app_modules')
        .select('code, name')
        .eq('is_active', true)
        .order('sort_order'),
    ]);

    const grantedCodes = new Set(userPermissions?.map(p => p.permission_code) || []);
    const accessedModules = new Set(moduleAccess?.map(m => m.module_code) || []);

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/permissions/user/[userId] - Update user's permissions
// SECURITY: Only admins and supervisors can update permissions
// Managers CANNOT update any permissions (including their own)
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

    if (!currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if current user is supervisor
    const currentIsSupervisor = await checkIsSupervisor(currentProfile.email);
    const currentIsAdmin = currentProfile.role === 'admin';

    // SECURITY: Only admins and supervisors can modify permissions
    if (!currentIsAdmin && !currentIsSupervisor) {
      return NextResponse.json(
        { error: 'Forbidden - pouze administrátoři a supervizoři mohou měnit oprávnění' },
        { status: 403 }
      );
    }

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
