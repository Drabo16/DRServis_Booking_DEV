import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateWarehouseItemSchema } from '@/lib/validations/warehouse';
import { apiError } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/warehouse/items/:id
 * Get a single warehouse item with category
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
      .from('warehouse_items')
      .select(`
        *,
        category:warehouse_categories(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiError('Item not found', 404);
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Warehouse item fetch error:', error);
    return apiError('Failed to fetch item');
  }
}

/**
 * PATCH /api/warehouse/items/:id
 * Update a warehouse item (admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can update items
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = updateWarehouseItemSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { name, category_id, quantity_total, is_rent, description, sku, unit, notes, image_url } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (quantity_total !== undefined) updateData.quantity_total = quantity_total;
    if (is_rent !== undefined) updateData.is_rent = is_rent;
    if (description !== undefined) updateData.description = description;
    if (sku !== undefined) updateData.sku = sku;
    if (unit !== undefined) updateData.unit = unit;
    if (notes !== undefined) updateData.notes = notes;
    if (image_url !== undefined) updateData.image_url = image_url;

    if (Object.keys(updateData).length === 0) {
      return apiError('No fields to update', 400);
    }

    // Check for duplicate SKU if changing
    if (sku) {
      const { data: existing } = await supabase
        .from('warehouse_items')
        .select('id')
        .eq('sku', sku)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return apiError('Another item with this SKU already exists', 400);
      }
    }

    const { data, error } = await supabase
      .from('warehouse_items')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        category:warehouse_categories(*)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiError('Item not found', 404);
      }
      throw error;
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Warehouse item update error:', error);
    return apiError('Failed to update item');
  }
}

/**
 * DELETE /api/warehouse/items/:id
 * Delete a warehouse item (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can delete items
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    // Check if item has reservations
    const { data: reservations } = await supabase
      .from('warehouse_reservations')
      .select('id')
      .eq('item_id', id)
      .limit(1);

    if (reservations && reservations.length > 0) {
      return apiError('Cannot delete item with existing reservations', 400);
    }

    const { error } = await supabase
      .from('warehouse_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Warehouse item delete error:', error);
    return apiError('Failed to delete item');
  }
}
