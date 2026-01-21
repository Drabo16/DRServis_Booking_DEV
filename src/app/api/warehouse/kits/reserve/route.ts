import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/warehouse/kits/reserve
 * Reserve all items from a kit for an event
 * Creates individual reservations for each item in the kit
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
    const { kit_id, event_id, start_date, end_date, notes } = body;

    if (!kit_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: kit_id, start_date, end_date' },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Get kit items
    const { data: kitItems, error: kitError } = await supabase
      .from('warehouse_kit_items')
      .select(`
        item_id,
        quantity,
        item:warehouse_items(id, name, quantity_total)
      `)
      .eq('kit_id', kit_id);

    if (kitError) throw kitError;

    if (!kitItems || kitItems.length === 0) {
      return NextResponse.json(
        { error: 'Kit has no items or does not exist' },
        { status: 400 }
      );
    }

    // Check availability for each item (optional, for future)
    // For now, just create reservations

    // Create reservations for each item
    const reservations = kitItems.map(ki => ({
      event_id: event_id || null,
      item_id: ki.item_id,
      quantity: ki.quantity,
      start_date,
      end_date,
      kit_id,
      notes: notes || null,
      created_by: profile?.id || null,
    }));

    const { data, error } = await supabase
      .from('warehouse_reservations')
      .insert(reservations)
      .select(`
        *,
        item:warehouse_items(id, name),
        event:events(id, title)
      `);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Reserved ${reservations.length} items from kit`,
      reservations: data,
    });
  } catch (error) {
    console.error('Kit reservation error:', error);
    return NextResponse.json(
      { error: 'Failed to reserve kit' },
      { status: 500 }
    );
  }
}
