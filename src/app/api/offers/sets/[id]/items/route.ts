// =====================================================
// OFFERS API - Project Items Route
// =====================================================
// CRUD for items directly on offer sets (projects)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
import {
  createSetItemSchema,
  createSetItemFromTemplateSchema,
  bulkAddSetItemsSchema,
  updateSetItemSchema,
} from '@/lib/validations/offers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function to check offers module access
async function checkOffersAccess(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', profileId)
    .eq('module_code', 'offers')
    .single();
  return !!data;
}

/**
 * GET /api/offers/sets/[id]/items
 * Get all items for a project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Check offers module access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    const { data: items, error } = await supabase
      .from('offer_set_items')
      .select('*')
      .eq('offer_set_id', id)
      .order('category')
      .order('sort_order');

    if (error) throw error;

    return NextResponse.json(items || []);
  } catch (error) {
    console.error('Fetch set items error:', error);
    return apiError('Failed to fetch items');
  }
}

/**
 * POST /api/offers/sets/[id]/items
 * Add item(s) to a project
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Check offers module access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();

    // Batch create
    if (body.items && Array.isArray(body.items)) {
      const parsed = bulkAddSetItemsSchema.safeParse(body);
      if (!parsed.success) {
        return apiError('Invalid batch items data', 400);
      }

      const toInsert = parsed.data.items.map((item) => ({
        offer_set_id: id,
        template_item_id: item.template_item_id || null,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory || null,
        unit: item.unit || 'ks',
        unit_price: item.unit_price || 0,
        quantity: item.quantity || 1,
        days_hours: item.days_hours || 1,
        sort_order: item.sort_order || 0,
      }));

      const { data, error } = await supabase
        .from('offer_set_items')
        .insert(toInsert)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, items: data });
    }

    // Single item from template
    if (body.template_item_id) {
      const parsed = createSetItemFromTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return apiError('Invalid template item data', 400);
      }

      const { data: template } = await supabase
        .from('offer_template_items')
        .select('*, category:offer_template_categories(name)')
        .eq('id', parsed.data.template_item_id)
        .single();

      if (!template) {
        return apiError('Template not found', 404);
      }

      const { data, error } = await supabase
        .from('offer_set_items')
        .insert({
          offer_set_id: id,
          template_item_id: parsed.data.template_item_id,
          name: template.name,
          category: (template.category as { name?: string })?.name || 'Ostatní',
          subcategory: template.subcategory,
          unit: template.unit,
          unit_price: template.default_price,
          quantity: parsed.data.quantity || 1,
          days_hours: parsed.data.days_hours || 1,
          sort_order: template.sort_order || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, item: data });
    }

    // Custom item without template (e.g., "Ploty na akci")
    const parsed = createSetItemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid item data - name and category are required', 400);
    }

    const { name, category, unit_price, unit, subcategory, sort_order, quantity, days_hours } = parsed.data;

    const { data, error } = await supabase
      .from('offer_set_items')
      .insert({
        offer_set_id: id,
        template_item_id: null,
        name,
        category,
        subcategory: subcategory || null,
        unit: unit || 'ks',
        unit_price: unit_price || 0,
        quantity: quantity || 1,
        days_hours: days_hours || 1,
        sort_order: sort_order || 999,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Create set item error:', error);
    return apiError('Failed to create item');
  }
}

/**
 * PATCH /api/offers/sets/[id]/items
 * Update an item
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Check offers module access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = updateSetItemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid update data', 400);
    }

    const { item_id, quantity, days_hours, unit_price } = parsed.data;

    const updateData: Record<string, string | number> = { updated_at: new Date().toISOString() };
    if (quantity !== undefined) updateData.quantity = quantity;
    if (days_hours !== undefined) updateData.days_hours = days_hours;
    if (unit_price !== undefined) updateData.unit_price = unit_price;

    const { data, error } = await supabase
      .from('offer_set_items')
      .update(updateData)
      .eq('id', item_id)
      .eq('offer_set_id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Update set item error:', error);
    return apiError('Failed to update item');
  }
}

/**
 * DELETE /api/offers/sets/[id]/items?item_id=xxx
 * Delete an item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Check offers module access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return apiError('item_id required', 400);
    }

    const { error } = await supabase
      .from('offer_set_items')
      .delete()
      .eq('id', itemId)
      .eq('offer_set_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete set item error:', error);
    return apiError('Failed to delete item');
  }
}
