// =====================================================
// OFFERS API - Offer Items Route
// =====================================================
// Manage items within an offer
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateItemTotal } from '@/types/offers';

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
      .select('*')
      .eq('offer_id', id)
      .order('category')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Offer items fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offer items' },
      { status: 500 }
    );
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
      // Bulk add from template items
      const items = await Promise.all(
        body.items.map(async (item: any) => {
          // Get template item details
          const { data: template } = await supabase
            .from('offer_template_items')
            .select('*, category:offer_template_categories(name)')
            .eq('id', item.template_item_id)
            .single();

          if (!template) return null;

          const categoryName = (template.category as any)?.name || 'Ostatní';
          const days_hours = item.days_hours ?? 1;
          const quantity = item.quantity ?? 1;
          // Use custom unit_price if provided, otherwise use template default
          const unit_price = item.unit_price ?? template.default_price;
          const total_price = calculateItemTotal({ days_hours, quantity, unit_price });

          return {
            offer_id,
            category: categoryName,
            subcategory: template.subcategory,
            name: template.name,
            days_hours,
            quantity,
            unit_price,
            total_price,
            template_item_id: template.id,
            sort_order: template.sort_order,
          };
        })
      );

      const validItems = items.filter(Boolean);

      if (validItems.length === 0) {
        return NextResponse.json({ error: 'No valid items to add' }, { status: 400 });
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
      const { category, subcategory, name, days_hours = 1, quantity = 0, unit_price = 0, sort_order = 0, template_item_id } = body;

      if (!category || !name) {
        return NextResponse.json(
          { error: 'Category and name are required' },
          { status: 400 }
        );
      }

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
    return NextResponse.json(
      { error: 'Failed to add offer item' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/offers/[id]/items
 * Update item in offer (by item_id in body)
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
    const { item_id, days_hours, quantity, unit_price, sort_order } = body;

    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    // Get current item
    const { data: currentItem } = await supabase
      .from('offer_items')
      .select('*')
      .eq('id', item_id)
      .eq('offer_id', offer_id)
      .single();

    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
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

    const updateData: Record<string, any> = { total_price };
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
    return NextResponse.json(
      { error: 'Failed to update offer item' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
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
    return NextResponse.json(
      { error: 'Failed to delete offer item' },
      { status: 500 }
    );
  }
}

async function recalculateOfferTotals(supabase: any, offer_id: string) {
  const { data: items } = await supabase
    .from('offer_items')
    .select('*')
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
