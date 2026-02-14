import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext } from '@/lib/supabase/server';

// GET /api/permissions/me - Get current user's permissions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Parallel fetch: 4 independent queries
    const [
      { data: allPermissions },
      { data: userPermissions },
      { data: moduleAccess },
      { data: allModules },
    ] = await Promise.all([
      supabase
        .from('permission_types')
        .select('code, name, module_code, sort_order')
        .order('module_code')
        .order('sort_order'),
      supabase
        .from('user_permissions')
        .select('permission_code')
        .eq('user_id', profile.id),
      supabase
        .from('user_module_access')
        .select('module_code')
        .eq('user_id', profile.id),
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
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      is_supervisor: isSupervisor,
      is_admin: profile.role === 'admin',
      modules: (allModules || []).map(m => ({
        code: m.code,
        name: m.name,
        has_access: profile.role === 'admin' || isSupervisor || accessedModules.has(m.code),
      })),
      permissions: (allPermissions || []).map(p => ({
        code: p.code,
        name: p.name,
        module_code: p.module_code,
        has_permission: profile.role === 'admin' || isSupervisor || grantedCodes.has(p.code),
      })),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching my permissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
