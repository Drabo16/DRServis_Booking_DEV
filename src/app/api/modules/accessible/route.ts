// =====================================================
// MODULE SYSTEM API - Get accessible modules for current user
// =====================================================
// To remove: delete this file

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/modules/accessible
 * Get modules accessible to the current user (for sidebar navigation)
 *
 * Note: Only SUPERVISORS have automatic access to all modules.
 * Admins must also have modules explicitly assigned.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is supervisor (has all access)
    const { data: supervisorCheck } = await supabase
      .from('supervisor_emails')
      .select('email')
      .ilike('email', profile.email)
      .maybeSingle();

    const isSupervisor = !!supervisorCheck;

    // Supervisors have access to all active modules
    if (isSupervisor) {
      const { data: modules, error } = await supabase
        .from('app_modules')
        .select('code, name, icon, route, is_core, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return NextResponse.json({
        modules: modules?.map((m) => ({ ...m, has_access: true })) || [],
      });
    }

    // For everyone else (including admins), get modules they have access to
    const { data: accessibleModules, error } = await supabase
      .from('user_module_access')
      .select(
        `
        module_code,
        app_modules!inner (
          code,
          name,
          icon,
          route,
          is_core,
          sort_order,
          is_active
        )
      `
      )
      .eq('user_id', profile.id);

    if (error) throw error;

    // Also include core modules that everyone has access to
    const { data: coreModules } = await supabase
      .from('app_modules')
      .select('code, name, icon, route, is_core, sort_order')
      .eq('is_core', true)
      .eq('is_active', true);

    // Combine and deduplicate
    const moduleMap = new Map();

    // Add core modules first
    coreModules?.forEach((m) => {
      moduleMap.set(m.code, { ...m, has_access: true });
    });

    // Add user's accessible modules
    accessibleModules?.forEach((access) => {
      const mod = access.app_modules as any;
      if (mod.is_active) {
        moduleMap.set(mod.code, {
          code: mod.code,
          name: mod.name,
          icon: mod.icon,
          route: mod.route,
          is_core: mod.is_core,
          sort_order: mod.sort_order,
          has_access: true,
        });
      }
    });

    // Convert to sorted array
    const modules = Array.from(moduleMap.values()).sort(
      (a, b) => a.sort_order - b.sort_order
    );

    return NextResponse.json({ modules });
  } catch (error) {
    console.error('Accessible modules fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch accessible modules',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
