import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/permissions/me - Get current user's permissions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if supervisor
    const { data: supervisorCheck } = await supabase
      .from('supervisor_emails')
      .select('email')
      .ilike('email', profile.email)
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
      .eq('user_id', profile.id);

    const grantedCodes = new Set(userPermissions?.map(p => p.permission_code) || []);

    // Get user's module access
    const { data: moduleAccess } = await supabase
      .from('user_module_access')
      .select('module_code')
      .eq('user_id', profile.id);

    const accessedModules = new Set(moduleAccess?.map(m => m.module_code) || []);

    // Get all modules
    const { data: allModules } = await supabase
      .from('app_modules')
      .select('code, name')
      .eq('is_active', true)
      .order('sort_order');

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
