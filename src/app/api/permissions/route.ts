import { NextRequest, NextResponse } from 'next/server';
import { createClient, getProfileWithFallback, checkIsSupervisor } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

// GET /api/permissions - Get all permission types (admin/supervisor only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Check admin or supervisor
    const profile = await getProfileWithFallback(supabase, user);
    if (!profile) {
      return apiError('Forbidden', 403);
    }

    const isAdmin = profile.role === 'admin';
    const isSupervisor = await checkIsSupervisor(profile.email);

    if (!isAdmin && !isSupervisor) {
      return apiError('Forbidden', 403);
    }

    const { data: permissions, error } = await supabase
      .from('permission_types')
      .select('code, name, description, module_code, sort_order')
      .order('module_code')
      .order('sort_order');

    if (error) throw error;

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return apiError('Failed to fetch permissions');
  }
}
