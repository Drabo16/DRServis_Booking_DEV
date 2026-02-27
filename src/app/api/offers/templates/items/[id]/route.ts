// =====================================================
// OFFERS API - Single Template Item Route
// =====================================================
// Update and delete template items
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
import { updateTemplateItemSchema } from '@/lib/validations/offers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/offers/templates/items/[id]
 * Update template item (admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = updateTemplateItemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid template item update data', 400);
    }

    const { name, subcategory, default_price, unit, sort_order, is_active, category_id } = parsed.data;

    const updateData: Record<string, string | number | boolean | null> = {};
    if (name !== undefined) updateData.name = name;
    if (subcategory !== undefined) updateData.subcategory = subcategory ?? null;
    if (default_price !== undefined) updateData.default_price = default_price;
    if (unit !== undefined) updateData.unit = unit;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (category_id !== undefined) updateData.category_id = category_id;

    if (Object.keys(updateData).length === 0) {
      return apiError('No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('offer_template_items')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        category:offer_template_categories(id, name, sort_order)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Template item update error:', error);
    return apiError('Failed to update template item');
  }
}

/**
 * DELETE /api/offers/templates/items/[id]
 * Delete template item (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const { error } = await supabase
      .from('offer_template_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Template item delete error:', error);
    return apiError('Failed to delete template item');
  }
}
