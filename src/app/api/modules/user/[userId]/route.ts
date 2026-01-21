// =====================================================
// MODULE SYSTEM API - Get module access for specific user
// =====================================================
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/modules/user/[userId]
 * Get all modules with access status for a specific user (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get target user's profile
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all active modules
    const { data: allModules, error: modulesError } = await supabase
      .from('app_modules')
      .select('code, name, icon, route, is_core, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (modulesError) throw modulesError;

    // Get user's module access
    const { data: userAccess, error: accessError } = await supabase
      .from('user_module_access')
      .select('module_code')
      .eq('user_id', userId);

    if (accessError) throw accessError;

    const accessSet = new Set(userAccess?.map((a) => a.module_code) || []);

    // Build response with access status
    const modules = allModules?.map((m) => ({
      module_code: m.code,
      module_name: m.name,
      icon: m.icon,
      route: m.route,
      is_core: m.is_core,
      // Admins have access to all, core modules are always accessible, otherwise check user_module_access
      has_access: targetUser.role === 'admin' || m.is_core || accessSet.has(m.code),
    }));

    return NextResponse.json({ modules, user_role: targetUser.role });
  } catch (error) {
    console.error('User module access fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user module access',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
