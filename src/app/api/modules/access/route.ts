// =====================================================
// MODULE SYSTEM API - Grant/Revoke module access
// =====================================================
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

/**
 * POST /api/modules/access
 * Grant module access to a user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
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
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, module_code } = body;

    if (!user_id || !module_code) {
      return NextResponse.json(
        { error: 'user_id and module_code are required' },
        { status: 400 }
      );
    }

    // Check if module exists and is active
    const { data: module } = await supabase
      .from('app_modules')
      .select('code, is_active')
      .eq('code', module_code)
      .single();

    if (!module || !module.is_active) {
      return NextResponse.json(
        { error: 'Module not found or inactive' },
        { status: 404 }
      );
    }

    // Grant access
    const { data: access, error } = await supabase
      .from('user_module_access')
      .upsert(
        {
          user_id,
          module_code,
          granted_by: profile.id,
        },
        { onConflict: 'user_id,module_code' }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, access }, { status: 201 });
  } catch (error) {
    console.error('Grant module access error:', error);
    return apiError('Failed to grant module access');
  }
}

/**
 * DELETE /api/modules/access
 * Revoke module access from a user (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { user_id, module_code } = body;

    if (!user_id || !module_code) {
      return NextResponse.json(
        { error: 'user_id and module_code are required' },
        { status: 400 }
      );
    }

    // Check if it's a core module (cannot revoke core module access)
    const { data: module } = await supabase
      .from('app_modules')
      .select('is_core')
      .eq('code', module_code)
      .single();

    if (module?.is_core) {
      return NextResponse.json(
        { error: 'Cannot revoke access to core modules' },
        { status: 400 }
      );
    }

    // Revoke access
    const { error } = await supabase
      .from('user_module_access')
      .delete()
      .eq('user_id', user_id)
      .eq('module_code', module_code);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke module access error:', error);
    return apiError('Failed to revoke module access');
  }
}
