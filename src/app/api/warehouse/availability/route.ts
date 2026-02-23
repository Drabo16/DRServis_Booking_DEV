// =====================================================
// WAREHOUSE AVAILABILITY API
// =====================================================
// Check material availability for specific date ranges
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/warehouse/availability
 * Check item availability for a date range
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check warehouse access
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, has_warehouse_access')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && !profile?.has_warehouse_access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { start_date, end_date, item_ids, category_id } = body;

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }

    // Fetch items with optional filters
    let itemsQuery = supabase
      .from('warehouse_items')
      .select(`
        id,
        name,
        sku,
        quantity_total,
        is_rent,
        category:warehouse_categories (
          name,
          color
        )
      `);

    if (item_ids && item_ids.length > 0) {
      itemsQuery = itemsQuery.in('id', item_ids);
    }

    if (category_id) {
      itemsQuery = itemsQuery.eq('category_id', category_id);
    }

    const { data: items, error: itemsError } = await itemsQuery;

    if (itemsError) throw itemsError;

    if (!items || items.length === 0) {
      return NextResponse.json({
        start_date,
        end_date,
        items: [],
        summary: {
          total_items_checked: 0,
          fully_available: 0,
          partially_available: 0,
          unavailable: 0,
        },
      });
    }

    // Fetch conflicting reservations for the date range
    const { data: reservations, error: reservationsError } = await supabase
      .from('warehouse_reservations')
      .select(`
        id,
        item_id,
        quantity,
        start_date,
        end_date,
        event:events (
          id,
          title
        )
      `)
      .in('item_id', items.map((i) => i.id))
      .lte('start_date', end_date)
      .gte('end_date', start_date);

    if (reservationsError) throw reservationsError;

    // Calculate availability for each item
    const itemAvailability = items.map((item) => {
      const itemReservations = (reservations || []).filter(
        (r) => r.item_id === item.id
      );

      const quantityReserved = itemReservations.reduce(
        (sum, r) => sum + r.quantity,
        0
      );

      // Supabase may return category as array or object depending on the relationship
      const categoryData = item.category;
      const category = Array.isArray(categoryData) ? categoryData[0] : categoryData;

      return {
        item_id: item.id,
        item_name: item.name,
        sku: item.sku,
        category_name: category?.name || null,
        category_color: category?.color || null,
        is_rent: item.is_rent,
        quantity_total: item.quantity_total,
        quantity_reserved: quantityReserved,
        quantity_available: Math.max(0, item.quantity_total - quantityReserved),
        conflicting_reservations: itemReservations.map((r) => ({
          reservation_id: r.id,
          event_title: (r.event as any)?.title || null,
          event_id: (r.event as any)?.id || null,
          quantity: r.quantity,
          start_date: r.start_date,
          end_date: r.end_date,
        })),
      };
    });

    // Calculate summary
    const summary = {
      total_items_checked: itemAvailability.length,
      fully_available: itemAvailability.filter(
        (i) => i.quantity_available === i.quantity_total
      ).length,
      partially_available: itemAvailability.filter(
        (i) => i.quantity_available > 0 && i.quantity_available < i.quantity_total
      ).length,
      unavailable: itemAvailability.filter(
        (i) => i.quantity_available === 0
      ).length,
    };

    return NextResponse.json({
      start_date,
      end_date,
      items: itemAvailability,
      summary,
    });
  } catch (error) {
    console.error('Availability check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check availability',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/warehouse/availability
 * Quick availability check using query params
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const start_date = searchParams.get('start_date');
  const end_date = searchParams.get('end_date');
  const item_id = searchParams.get('item_id');
  const category_id = searchParams.get('category_id');

  // Convert to POST request internally
  const body: any = { start_date, end_date };
  if (item_id) body.item_ids = [item_id];
  if (category_id) body.category_id = category_id;

  // Create a mock request for POST handler
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: request.headers,
  });

  return POST(mockRequest);
}
