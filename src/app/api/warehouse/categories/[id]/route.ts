import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateWarehouseCategorySchema } from '@/lib/validations/warehouse';
import { apiError } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/warehouse/categories/:id
 * Get a single warehouse category
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
      .from('warehouse_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiError('Category not found', 404);
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Warehouse category fetch error:', error);
    return apiError('Failed to fetch category');
  }
}

/**
 * PATCH /api/warehouse/categories/:id
 * Update a warehouse category (admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can update categories
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = updateWarehouseCategorySchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { name, description, color, sort_order } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    if (Object.keys(updateData).length === 0) {
      return apiError('No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('warehouse_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiError('Category not found', 404);
      }
      throw error;
    }

    return NextResponse.json({ success: true, category: data });
  } catch (error) {
    console.error('Warehouse category update error:', error);
    return apiError('Failed to update category');
  }
}

/**
 * DELETE /api/warehouse/categories/:id
 * Delete a warehouse category (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can delete categories
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const { error } = await supabase
      .from('warehouse_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Warehouse category delete error:', error);
    return apiError('Failed to delete category');
  }
}
