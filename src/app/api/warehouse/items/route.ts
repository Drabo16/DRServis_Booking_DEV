import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWarehouseItemSchema } from '@/lib/validations/warehouse';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/warehouse/items
 * List all warehouse items with optional filters
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const isRent = searchParams.get('is_rent');
    const search = searchParams.get('search');

    // Select only needed fields for performance
    let query = supabase
      .from('warehouse_items')
      .select(`
        id,
        name,
        sku,
        description,
        quantity_total,
        is_rent,
        unit,
        notes,
        category_id,
        category:warehouse_categories(id, name, color)
      `)
      .order('name', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (isRent !== null && isRent !== '') {
      query = query.eq('is_rent', isRent === 'true');
    }

    if (search) {
      // Escape special PostgREST characters instead of removing them
      const sanitized = search.replace(/[%_\\]/g, '\\$&');
      if (sanitized) {
        query = query.or(`name.ilike.%${sanitized}%,sku.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
      }
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Warehouse items fetch error:', error);
    return apiError('Failed to fetch items');
  }
}

/**
 * POST /api/warehouse/items
 * Create a new warehouse item (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can create items
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = createWarehouseItemSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { name, category_id, quantity_total, is_rent, description, sku, unit, notes, image_url } = parsed.data;

    // Check for duplicate SKU if provided
    if (sku) {
      const { data: existing } = await supabase
        .from('warehouse_items')
        .select('id')
        .eq('sku', sku)
        .maybeSingle();

      if (existing) {
        return apiError('Item with this SKU already exists', 400);
      }
    }

    const { data, error } = await supabase
      .from('warehouse_items')
      .insert({
        name,
        category_id: category_id || null,
        quantity_total,
        is_rent,
        description: description || null,
        sku: sku || null,
        unit,
        notes: notes || null,
        image_url: image_url || null,
      })
      .select(`
        *,
        category:warehouse_categories(*)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Warehouse item creation error:', error);
    return apiError('Failed to create item');
  }
}
