import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createReservationSchema } from '@/lib/validations/warehouse';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/warehouse/reservations
 * List warehouse reservations with optional filters
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

    const { data, error } = await query.limit(100);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Warehouse reservations fetch error:', error);
    return apiError('Failed to fetch reservations');
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
      return apiError('Unauthorized', 401);
    }

    // Check warehouse access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, has_warehouse_access')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && !profile?.has_warehouse_access) {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = createReservationSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { event_id, item_id, quantity, start_date, end_date, notes } = parsed.data;

    // Validate dates
    const startDateTime = new Date(start_date);
    const endDateTime = new Date(end_date);
    if (endDateTime <= startDateTime) {
      return apiError('End date must be after start date', 400);
    }

    // Verify item exists
    const { data: item, error: itemError } = await supabase
      .from('warehouse_items')
      .select('id, quantity_total')
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      return apiError('Item not found', 404);
    }

    // Check quantity
    if (quantity > item.quantity_total) {
      return apiError('Requested quantity exceeds available stock', 400);
    }

    // Verify event exists if provided
    if (event_id) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('id', event_id)
        .single();

      if (eventError || !event) {
        return apiError('Event not found', 404);
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
    return apiError('Failed to create reservation');
  }
}
