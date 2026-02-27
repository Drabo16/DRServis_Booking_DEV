import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

interface RentPurchaseRecommendation {
  item_id: string;
  item_name: string;
  sku: string | null;
  category_name: string | null;
  total_reservations: number;
  reservations_last_30_days: number;
  reservations_last_90_days: number;
  total_days_rented: number;
  avg_days_per_reservation: number;
  utilization_score: number;
  recommendation_level: 'high' | 'medium' | 'low';
  recommendation_reason: string;
}

/**
 * Calculate purchase recommendations for rent items
 */
function calculateRecommendations(
  rentItems: { id: string; name: string; sku: string | null; category_name: string | null }[],
  reservations: { item_id: string; start_date: string; end_date: string }[]
): RentPurchaseRecommendation[] {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const recommendations: RentPurchaseRecommendation[] = [];

  for (const item of rentItems) {
    const itemReservations = reservations.filter((r) => r.item_id === item.id);

    if (itemReservations.length === 0) continue;

    // Calculate metrics
    const totalReservations = itemReservations.length;

    const reservationsLast30Days = itemReservations.filter(
      (r) => new Date(r.start_date) >= thirtyDaysAgo
    ).length;

    const reservationsLast90Days = itemReservations.filter(
      (r) => new Date(r.start_date) >= ninetyDaysAgo
    ).length;

    // Calculate total days rented
    let totalDaysRented = 0;
    for (const res of itemReservations) {
      const start = new Date(res.start_date);
      const end = new Date(res.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      totalDaysRented += days;
    }

    const avgDaysPerReservation = totalDaysRented / totalReservations;

    // Calculate utilization score (0-100)
    // Based on: frequency of use, recent activity, and duration
    const frequencyScore = Math.min(totalReservations * 5, 40); // Max 40 points for frequency
    const recentActivityScore = Math.min(reservationsLast30Days * 15, 35); // Max 35 points for recent activity
    const durationScore = Math.min(avgDaysPerReservation * 2, 25); // Max 25 points for longer rentals

    const utilizationScore = Math.round(frequencyScore + recentActivityScore + durationScore);

    // Determine recommendation level and reason
    let recommendationLevel: 'high' | 'medium' | 'low';
    let recommendationReason: string;

    if (utilizationScore >= 70 || (reservationsLast30Days >= 3 && totalReservations >= 5)) {
      recommendationLevel = 'high';
      if (reservationsLast30Days >= 3) {
        recommendationReason = `Velmi časté využití (${reservationsLast30Days}x za posledních 30 dní). Nákup se vyplatí.`;
      } else {
        recommendationReason = `Vysoké celkové využití (${totalReservations} rezervací, ${totalDaysRented} dní). Zvažte nákup.`;
      }
    } else if (utilizationScore >= 40 || (reservationsLast90Days >= 4 && totalReservations >= 3)) {
      recommendationLevel = 'medium';
      recommendationReason = `Pravidelné využití (${reservationsLast90Days}x za 90 dní). Nákup může být výhodný.`;
    } else {
      recommendationLevel = 'low';
      recommendationReason = `Občasné využití. Sledujte vývoj před rozhodnutím.`;
    }

    recommendations.push({
      item_id: item.id,
      item_name: item.name,
      sku: item.sku,
      category_name: item.category_name,
      total_reservations: totalReservations,
      reservations_last_30_days: reservationsLast30Days,
      reservations_last_90_days: reservationsLast90Days,
      total_days_rented: totalDaysRented,
      avg_days_per_reservation: Math.round(avgDaysPerReservation * 10) / 10,
      utilization_score: utilizationScore,
      recommendation_level: recommendationLevel,
      recommendation_reason: recommendationReason,
    });
  }

  // Sort by utilization score descending
  recommendations.sort((a, b) => b.utilization_score - a.utilization_score);

  return recommendations;
}

/**
 * GET /api/warehouse/stats
 * Get overall warehouse statistics
 */
export async function GET() {
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

    const now = new Date().toISOString();

    // Parallel fetch for better performance
    const [
      itemsResult,
      categoriesResult,
      kitsResult,
      reservationsResult,
      activeReservationsResult,
      rentItemsResult,
    ] = await Promise.all([
      supabase.from('warehouse_items').select('id, is_rent', { count: 'exact' }),
      supabase.from('warehouse_categories').select('id', { count: 'exact', head: true }),
      supabase.from('warehouse_kits').select('id', { count: 'exact', head: true }),
      supabase.from('warehouse_reservations').select('id', { count: 'exact', head: true }),
      supabase.from('warehouse_reservations').select('id', { count: 'exact', head: true }).gte('end_date', now),
      supabase.from('warehouse_items').select('id, name, sku, category:warehouse_categories(name)').eq('is_rent', true),
    ]);

    const items = itemsResult.data || [];
    const oursCount = items.filter(i => !i.is_rent).length;
    const rentCount = items.filter(i => i.is_rent).length;
    const rentItems = rentItemsResult.data || [];

    // Get all reservations for rent items (for utilization and recommendations)
    // Only fetch if there are rent items
    const allRentReservations = rentItems.length > 0
      ? (await supabase
          .from('warehouse_reservations')
          .select('item_id, start_date, end_date')
          .in('item_id', rentItems.map(i => i.id))
        ).data || []
      : [];

    // Build reservation counts map once for efficiency
    const reservationCounts = new Map<string, number>();
    for (const res of allRentReservations) {
      reservationCounts.set(res.item_id, (reservationCounts.get(res.item_id) || 0) + 1);
    }

    // Calculate rent utilization using the map
    const rentUtilization = rentItems
      .map(item => ({
        item_id: item.id,
        item_name: item.name,
        reservation_count: reservationCounts.get(item.id) || 0,
      }))
      .filter(item => item.reservation_count > 0)
      .sort((a, b) => b.reservation_count - a.reservation_count)
      .slice(0, 10);

    // Calculate purchase recommendations
    const rentItemsForRecommendations = rentItems.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category_name: (item.category as { name?: string } | null)?.name || null,
    }));

    const purchaseRecommendations = calculateRecommendations(
      rentItemsForRecommendations,
      allRentReservations
    );

    return NextResponse.json({
      total_items: items.length,
      total_categories: categoriesResult.count || 0,
      total_kits: kitsResult.count || 0,
      total_reservations: reservationsResult.count || 0,
      items_by_ownership: {
        ours: oursCount,
        rent: rentCount,
      },
      active_reservations: activeReservationsResult.count || 0,
      rent_utilization: rentUtilization,
      purchase_recommendations: purchaseRecommendations,
    });
  } catch (error) {
    console.error('Warehouse stats fetch error:', error);
    return apiError('Failed to fetch warehouse stats');
  }
}
