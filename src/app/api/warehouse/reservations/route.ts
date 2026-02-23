import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/warehouse/reservations
 * List warehouse reservations with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const itemId = searchParams.get('item_id');
    const kitId = searchParams.get('kit_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('warehouse_reservations')
      .select(`
        *,
        item:warehouse_items(id, name, sku, is_rent, unit, category:warehouse_categories(id, name, color)),
        event:events(id, title, start_time, end_time, location),
        kit:warehouse_kits(id, name),
        creator:profiles!warehouse_reservations_created_by_fkey(id, full_name)
      `)
      .order('start_date', { ascending: true });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    if (kitId) {
      query = query.eq('kit_id', kitId);
    }

    if (startDate) {
      query = query.gte('start_date', startDate);
    }

    if (endDate) {
      query = query.lte('end_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Warehouse reservations fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/warehouse/reservations
 * Create a new warehouse reservation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check warehouse access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, has_warehouse_access')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && !profile?.has_warehouse_access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { event_id, item_id, quantity, start_date, end_date, notes } = body;

    if (!item_id || !quantity || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: item_id, quantity, start_date, end_date' },
        { status: 400 }
      );
    }

    if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json(
        { error: 'Quantity must be a positive integer' },
        { status: 400 }
      );
    }

    // Validate dates
    const startDateTime = new Date(start_date);
    const endDateTime = new Date(end_date);
    if (endDateTime <= startDateTime) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Verify item exists
    const { data: item, error: itemError } = await supabase
      .from('warehouse_items')
      .select('id, quantity_total')
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check quantity
    if (quantity > item.quantity_total) {
      return NextResponse.json(
        { error: `Requested quantity (${quantity}) exceeds available (${item.quantity_total})` },
        { status: 400 }
      );
    }

    // Verify event exists if provided
    if (event_id) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('id', event_id)
        .single();

      if (eventError || !event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from('warehouse_reservations')
      .insert({
        event_id: event_id || null,
        item_id,
        quantity,
        start_date,
        end_date,
        notes: notes || null,
        created_by: profile?.id || null,
      })
      .select(`
        *,
        item:warehouse_items(id, name, sku, is_rent, unit),
        event:events(id, title, start_time, end_time, location),
        creator:profiles!warehouse_reservations_created_by_fkey(id, full_name)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, reservation: data });
  } catch (error) {
    console.error('Warehouse reservation creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    );
  }
}
