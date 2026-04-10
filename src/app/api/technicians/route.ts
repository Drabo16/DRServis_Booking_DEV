import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

export async function GET() {
  try {
    const supabase = await createClient();

    // Kontrola autentizace
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Načti všechny aktivní uživatele (service role bypasses RLS)
    const serviceClient = createServiceRoleClient();
    const { data: technicians, error } = await serviceClient
      .from('profiles')
      .select('id, auth_user_id, full_name, email, phone, role, specialization, avatar_url, is_active, has_warehouse_access, is_drservis, company, note, rank, driver_license, created_at, updated_at')
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    return NextResponse.json({ technicians: technicians || [] });
  } catch (error) {
    console.error('[API] Error fetching technicians:', error);
    return apiError('Failed to fetch technicians');
  }
}
