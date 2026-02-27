// =====================================================
// OFFERS API - Offer Items Route
// =====================================================
// Manage items within an offer
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
import { calculateItemTotal } from '@/types/offers';
import {
  createOfferItemSchema,
  bulkAddOfferItemsSchema,
  updateOfferItemSchema,
  batchUpdateOfferItemsSchema,
} from '@/lib/validations/offers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/offers/[id]/items
 * Get all items for an offer
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('offer_items')
      .select('id, offer_id, category, subcategory, name, days_hours, quantity, unit_price, total_price, sort_order, template_item_id, created_at')
      .eq('offer_id', id)
      .order('category')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Offer items fetch error:', error);
    return apiError('Failed to fetch offer items');
  }
}

/**
 * POST /api/offers/[id]/items
 * Add item(s) to offer
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: offer_id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Support both single item and bulk add
    if (Array.isArray(body.items)) {
      // Bulk mode
      const parsed = bulkAddOfferItemsSchema.safeParse(body);
      if (!parsed.success) {
        return apiError('Invalid bulk items data', 400);
      }

      // OPTIMIZED: Batch fetch templates to avoid N+1 query problem
      const templateIds = parsed.data.items.map((item) => item.template_item_id).filter(Boolean);

      // Single query to get all templates at once
      const { data: templates } = await supabase
        .from('offer_template_items')
        .select('*, category:offer_template_categories(name)')
        .in('id', templateIds);

      // Create a map for quick lookup
      const templatesMap = new Map<string, Record<string, unknown>>();
      (templates || []).forEach((t: Record<string, unknown>) => {
        templatesMap.set(t.id as string, t);
      });

      // Build items array with template data
      const items = parsed.data.items.map((item) => {
        const template = templatesMap.get(item.template_item_id);
        if (!template) return null;

        const categoryName = (template.category as { name?: string })?.name || 'Ostatní';
        const days_hours = item.days_hours ?? 1;
        const quantity = item.quantity ?? 1;
        // Use custom unit_price if provided, otherwise use template default
        const unit_price = item.unit_price ?? (template.default_price as number);
        const total_price = calculateItemTotal({ days_hours, quantity, unit_price });

        return {
          offer_id,
          category: categoryName,
          subcategory: template.subcategory as string | null,
          name: template.name as string,
          days_hours,
          quantity,
          unit_price,
          total_price,
          template_item_id: template.id as string,
          sort_order: template.sort_order as number,
        };
      });

      const validItems = items.filter(Boolean);

      if (validItems.length === 0) {
        return apiError('No valid items to add', 400);
      }

      const { data, error } = await supabase
        .from('offer_items')
        .insert(validItems)
        .select();

      if (error) throw error;

      // Trigger offer recalculation
      await recalculateOfferTotals(supabase, offer_id);

      return NextResponse.json({ success: true, items: data });
    } else {
      // Single item add
      const parsed = createOfferItemSchema.safeParse(body);
      if (!parsed.success) {
        return apiError('Invalid item data', 400);
      }

      const { category, subcategory, name, days_hours, quantity, unit_price, sort_order, template_item_id } = parsed.data;

      const total_price = calculateItemTotal({ days_hours, quantity, unit_price });

      const { data, error } = await supabase
        .from('offer_items')
        .insert({
          offer_id,
          category,
          subcategory: subcategory || null,
          name,
          days_hours,
          quantity,
          unit_price,
          total_price,
          sort_order,
          template_item_id: template_item_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger offer recalculation
      await recalculateOfferTotals(supabase, offer_id);

      return NextResponse.json({ success: true, item: data });
    }
  } catch (error) {
    console.error('Offer item creation error:', error);
    return apiError('Failed to add offer item');
  }
}

/**
 * PATCH /api/offers/[id]/items
 * Update item(s) in offer - supports both single and batch update
 * Single: { item_id, days_hours, quantity, unit_price }
 * Batch: { items: [{ id, days_hours, quantity, unit_price }, ...] }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: offer_id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // BATCH UPDATE - OPTIMIZED: parallel updates instead of sequential
    if (Array.isArray(body.items)) {
      const parsed = batchUpdateOfferItemsSchema.safeParse(body);
      if (!parsed.success) {
        return apiError('Invalid batch update data', 400);
      }

      // First, get all current items in one query
      const itemIds = parsed.data.items.map((item) => item.id);
      const { data: currentItems } = await supabase
        .from('offer_items')
        .select('id, offer_id, category, subcategory, name, days_hours, quantity, unit_price, total_price, sort_order, template_item_id')
        .in('id', itemIds)
        .eq('offer_id', offer_id);

      const currentItemsMap = new Map<string, Record<string, number>>();
      (currentItems || []).forEach((item: Record<string, number>) => {
        currentItemsMap.set(item.id as unknown as string, item);
      });

      // Prepare all updates in parallel
      const updatePromises = parsed.data.items.map(async (item) => {
        const { id: item_id, days_hours, quantity, unit_price } = item;
        const currentItem = currentItemsMap.get(item_id);

        if (!currentItem) return null;

        // Calculate new total
        const newDaysHours = days_hours ?? currentItem.days_hours;
        const newQuantity = quantity ?? currentItem.quantity;
        const newUnitPrice = unit_price ?? currentItem.unit_price;
        const total_price = calculateItemTotal({
          days_hours: newDaysHours,
          quantity: newQuantity,
          unit_price: newUnitPrice,
        });

        const updateData: Record<string, number> = { total_price };
        if (days_hours !== undefined) updateData.days_hours = days_hours;
        if (quantity !== undefined) updateData.quantity = quantity;
        if (unit_price !== undefined) updateData.unit_price = unit_price;

        const { data, error } = await supabase
          .from('offer_items')
          .update(updateData)
          .eq('id', item_id)
          .select()
          .single();

        return error ? null : data;
      });

      const results = (await Promise.all(updatePromises)).filter(Boolean);

      // Trigger offer recalculation once
      await recalculateOfferTotals(supabase, offer_id);

      return NextResponse.json({ success: true, items: results });
    }

    // SINGLE UPDATE (original logic)
    const parsed = updateOfferItemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid update data', 400);
    }

    const { item_id, days_hours, quantity, unit_price, sort_order } = parsed.data;

    // Get current item
    const { data: currentItem } = await supabase
      .from('offer_items')
      .select('id, offer_id, days_hours, quantity, unit_price, total_price, sort_order')
      .eq('id', item_id)
      .eq('offer_id', offer_id)
      .single();

    if (!currentItem) {
      return apiError('Item not found', 404);
    }

    // Calculate new total
    const newDaysHours = days_hours ?? currentItem.days_hours;
    const newQuantity = quantity ?? currentItem.quantity;
    const newUnitPrice = unit_price ?? currentItem.unit_price;
    const total_price = calculateItemTotal({
      days_hours: newDaysHours,
      quantity: newQuantity,
      unit_price: newUnitPrice,
    });

    const updateData: Record<string, number> = { total_price };
    if (days_hours !== undefined) updateData.days_hours = days_hours;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (unit_price !== undefined) updateData.unit_price = unit_price;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    const { data, error } = await supabase
      .from('offer_items')
      .update(updateData)
      .eq('id', item_id)
      .select()
      .single();

    if (error) throw error;

    // Trigger offer recalculation
    await recalculateOfferTotals(supabase, offer_id);

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Offer item update error:', error);
    return apiError('Failed to update offer item');
  }
}

/**
 * DELETE /api/offers/[id]/items
 * Delete item from offer (item_id in query or body)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: offer_id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let item_id = searchParams.get('item_id');

    if (!item_id) {
      const body = await request.json().catch(() => ({}));
      item_id = body.item_id;
    }

    if (!item_id) {
      return apiError('item_id is required', 400);
    }

    const { error } = await supabase
      .from('offer_items')
      .delete()
      .eq('id', item_id)
      .eq('offer_id', offer_id);

    if (error) throw error;

    // Trigger offer recalculation
    await recalculateOfferTotals(supabase, offer_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Offer item delete error:', error);
    return apiError('Failed to delete offer item');
  }
}

async function recalculateOfferTotals(supabase: Awaited<ReturnType<typeof createClient>>, offer_id: string) {
  const { data: items } = await supabase
    .from('offer_items')
    .select('id, offer_id, category, total_price')
    .eq('offer_id', offer_id);

  const { data: offer } = await supabase
    .from('offers')
    .select('discount_percent')
    .eq('id', offer_id)
    .single();

  const discount_percent = offer?.discount_percent || 0;

  let subtotal_equipment = 0;
  let subtotal_personnel = 0;
  let subtotal_transport = 0;

  for (const item of items || []) {
    const cat = item.category;
    if (cat === 'Technický personál') {
      subtotal_personnel += item.total_price;
    } else if (cat === 'Doprava') {
      subtotal_transport += item.total_price;
    } else {
      subtotal_equipment += item.total_price;
    }
  }

  const discount_amount = Math.round(subtotal_equipment * (discount_percent / 100));
  const total_amount = subtotal_equipment + subtotal_personnel + subtotal_transport - discount_amount;

  await supabase
    .from('offers')
    .update({
      subtotal_equipment,
      subtotal_personnel,
      subtotal_transport,
      discount_amount,
      total_amount,
    })
    .eq('id', offer_id);
}
