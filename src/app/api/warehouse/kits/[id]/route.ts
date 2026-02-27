import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateKitSchema } from '@/lib/validations/warehouse';
import { apiError } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/warehouse/kits/:id
 * Get a single warehouse kit with items
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
      .from('warehouse_kits')
      .select(`
        *,
        items:warehouse_kit_items(
          id,
          kit_id,
          item_id,
          quantity,
          created_at,
          item:warehouse_items(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiError('Kit not found', 404);
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Warehouse kit fetch error:', error);
    return apiError('Failed to fetch kit');
  }
}

/**
 * PATCH /api/warehouse/kits/:id
 * Update a warehouse kit (admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can update kits
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = updateKitSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { name, description, items } = parsed.data;

    // Update kit basic info if provided
    if (name !== undefined || description !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const { error: updateError } = await supabase
        .from('warehouse_kits')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;
    }

    // Update items if provided
    if (items !== undefined && Array.isArray(items)) {
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('warehouse_kit_items')
        .delete()
        .eq('kit_id', id);

      if (deleteError) throw deleteError;

      // Insert new items
      if (items.length > 0) {
        const kitItems = items.map((item) => ({
          kit_id: id,
          item_id: item.item_id,
          quantity: item.quantity || 1,
        }));

        const { error: insertError } = await supabase
          .from('warehouse_kit_items')
          .insert(kitItems);

        if (insertError) throw insertError;
      }
    }

    // Fetch the updated kit
    const { data: kit, error: fetchError } = await supabase
      .from('warehouse_kits')
      .select(`
        *,
        items:warehouse_kit_items(
          id,
          kit_id,
          item_id,
          quantity,
          created_at,
          item:warehouse_items(*)
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return apiError('Kit not found', 404);
      }
      throw fetchError;
    }

    return NextResponse.json({ success: true, kit });
  } catch (error) {
    console.error('Warehouse kit update error:', error);
    return apiError('Failed to update kit');
  }
}

/**
 * DELETE /api/warehouse/kits/:id
 * Delete a warehouse kit (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can delete kits
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    // Delete kit (cascade will delete kit_items)
    const { error } = await supabase
      .from('warehouse_kits')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Warehouse kit delete error:', error);
    return apiError('Failed to delete kit');
  }
}
