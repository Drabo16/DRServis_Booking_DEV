import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/offers/users-with-access
 * Returns all users who have offers module access (for the share picker).
 * Admin/supervisor only.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Only admins/supervisors can see the user list for sharing
    const isSupervisor = await supabase
      .from('supervisor_emails')
      .select('email')
      .ilike('email', profile.email)
      .maybeSingle()
      .then(r => !!r.data);

    if (profile.role !== 'admin' && !isSupervisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = createServiceRoleClient();

    // Get all profiles that have offers module access (via user_module_access)
    const { data, error } = await db
      .from('user_module_access')
      .select('user_id, profiles!user_module_access_user_id_fkey(id, full_name, email)')
      .eq('module_code', 'offers');

    if (error) throw error;

    type ProfileRow = { id: string; full_name: string; email: string };
    // Supabase returns profiles as array via FK join - take first element
    const users = (data || [])
      .map((row: { profiles: ProfileRow | ProfileRow[] | null }) => {
        const p = row.profiles;
        if (!p) return null;
        return Array.isArray(p) ? p[0] : p;
      })
      .filter((p): p is ProfileRow => p != null)
      // deduplicate by id
      .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users with offers access:', error);
    return apiError('Failed to fetch users');
  }
}
