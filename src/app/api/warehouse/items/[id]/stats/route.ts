import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/warehouse/items/:id/stats
 * Get utilization statistics for a warehouse item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Get item details
    const { data: item, error: itemError } = await supabase
      .from('warehouse_items')
      .select('id, name, quantity_total')
      .eq('id', id)
      .single();

    if (itemError) {
      if (itemError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      throw itemError;
    }

    // Get all reservations for this item
    const { data: reservations, error: resError } = await supabase
      .from('warehouse_reservations')
      .select('quantity, start_date, end_date')
      .eq('item_id', id);

    if (resError) throw resError;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate stats
    const totalReservations = reservations?.length || 0;
    const totalQuantityReserved = reservations?.reduce((sum, r) => sum + r.quantity, 0) || 0;
    const upcomingReservations = reservations?.filter(r => new Date(r.start_date) > now).length || 0;

    // Calculate utilization (past 30 days)
    let totalDaysReserved = 0;
    reservations?.forEach(r => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);

      // Only count reservations that overlap with last 30 days
      if (end >= thirtyDaysAgo && start <= now) {
        const effectiveStart = start < thirtyDaysAgo ? thirtyDaysAgo : start;
        const effectiveEnd = end > now ? now : end;
        const days = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (24 * 60 * 60 * 1000));
        totalDaysReserved += days;
      }
    });

    const utilizationPercentage = Math.round((totalDaysReserved / 30) * 100);

    return NextResponse.json({
      item_id: item.id,
      item_name: item.name,
      total_reservations: totalReservations,
      total_quantity_reserved: totalQuantityReserved,
      upcoming_reservations: upcomingReservations,
      utilization_percentage: Math.min(utilizationPercentage, 100),
    });
  } catch (error) {
    console.error('Warehouse item stats fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item stats' },
      { status: 500 }
    );
  }
}
