import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWarehouseCategorySchema } from '@/lib/validations/warehouse';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/warehouse/categories
 * List all warehouse categories
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Check warehouse access
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, has_warehouse_access')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && !profile?.has_warehouse_access) {
      return apiError('Forbidden', 403);
    }

    const { data, error } = await supabase
      .from('warehouse_categories')
      .select('id, name, description, color, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Warehouse categories fetch error:', error);
    return apiError('Failed to fetch categories');
  }
}

/**
 * POST /api/warehouse/categories
 * Create a new warehouse category (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can create categories
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = createWarehouseCategorySchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { name, description, color, sort_order } = parsed.data;

    const { data, error } = await supabase
      .from('warehouse_categories')
      .insert({
        name,
        description: description || null,
        color,
        sort_order,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, category: data });
  } catch (error) {
    console.error('Warehouse category creation error:', error);
    return apiError('Failed to create category');
  }
}
