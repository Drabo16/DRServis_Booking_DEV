import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reserveKitSchema } from '@/lib/validations/warehouse';
import { apiError } from '@/lib/api-response';

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
    const parsed = reserveKitSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { kit_id, event_id, start_date, end_date, notes } = parsed.data;

    // Validate dates
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    if (endDateObj <= startDateObj) {
      return apiError('End date must be after start date', 400);
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
      return apiError('Kit has no items or does not exist', 400);
    }

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
    return apiError('Failed to reserve kit');
  }
}
