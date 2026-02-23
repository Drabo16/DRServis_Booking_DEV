import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/permissions - Get all permission types
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: permissions, error } = await supabase
      .from('permission_types')
      .select('code, name, description, module_code, sort_order')
      .order('module_code')
      .order('sort_order');

    if (error) throw error;

    return NextResponse.json(permissions);
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}
