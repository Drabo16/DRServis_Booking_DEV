import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/reporting
 * Aggregated stats for supervisor reporting dashboard.
 * Supervisor-only access.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check supervisor or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) return apiError('Profile not found', 404);

    let isSupervisor = profile.role === 'admin';
    if (!isSupervisor) {
      const { data: supRow } = await supabase
        .from('supervisor_emails')
        .select('email')
        .ilike('email', profile.email)
        .maybeSingle();
      isSupervisor = !!supRow;
    }

    if (!isSupervisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = createServiceRoleClient();

    // Run all queries in parallel
    const [
      offersResult,
      eventsResult,
      clientsResult,
      assignmentsResult,
      warehouseResult,
    ] = await Promise.all([
      // --- OFFERS ---
      db.from('offers').select('id, status, total_amount, custom_price, subtotal_equipment, subtotal_personnel, subtotal_transport, discount_amount, year, created_at, client_id, event_id'),

      // --- EVENTS ---
      db.from('events').select('id, title, start_time, end_time, status, location'),

      // --- CLIENTS ---
      db.from('clients').select('id, name'),

      // --- ASSIGNMENTS (technician utilization) ---
      db.from('assignments').select('id, technician_id, attendance_status, position_id'),

      // --- WAREHOUSE STATS ---
      db.from('warehouse_items').select('id, ownership_type, purchase_price, rental_price_per_day'),
    ]);

    const offers = offersResult.data || [];
    const events = eventsResult.data || [];
    const clients = clientsResult.data || [];
    const assignments = assignmentsResult.data || [];
    const warehouseItems = warehouseResult.data || [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // ========== OFFERS STATS ==========
    const offersThisYear = offers.filter(o => o.year === currentYear);
    const offersByStatus: Record<string, number> = {};
    const revenueByStatus: Record<string, number> = {};
    for (const o of offers) {
      offersByStatus[o.status] = (offersByStatus[o.status] || 0) + 1;
      revenueByStatus[o.status] = (revenueByStatus[o.status] || 0) + ((o.custom_price ?? o.total_amount) || 0);
    }

    const acceptedOffers = offers.filter(o => o.status === 'accepted');
    const rejectedOffers = offers.filter(o => o.status === 'rejected');
    const conversionRate = (acceptedOffers.length + rejectedOffers.length) > 0
      ? Math.round((acceptedOffers.length / (acceptedOffers.length + rejectedOffers.length)) * 100)
      : 0;

    const totalRevenue = acceptedOffers.reduce((sum, o) => sum + ((o.custom_price ?? o.total_amount) || 0), 0);
    const avgOfferValue = acceptedOffers.length > 0
      ? Math.round(totalRevenue / acceptedOffers.length)
      : 0;

    // Monthly revenue trend (last 12 months)
    const monthlyRevenue: { month: string; revenue: number; expenses: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      const monthOffers = acceptedOffers.filter(o => {
        const created = new Date(o.created_at);
        return created.getFullYear() === year && created.getMonth() === month;
      });

      const revenue = monthOffers.reduce((s, o) => s + ((o.custom_price ?? o.total_amount) || 0), 0);
      const equipment = monthOffers.reduce((s, o) => s + (o.subtotal_equipment || 0), 0);
      const personnel = monthOffers.reduce((s, o) => s + (o.subtotal_personnel || 0), 0);
      const transport = monthOffers.reduce((s, o) => s + (o.subtotal_transport || 0), 0);

      monthlyRevenue.push({
        month: monthKey,
        revenue,
        expenses: personnel + transport,
        count: monthOffers.length,
      });
    }

    // Revenue by category (equipment vs personnel vs transport)
    const revenueByCategory = {
      equipment: acceptedOffers.reduce((s, o) => s + (o.subtotal_equipment || 0), 0),
      personnel: acceptedOffers.reduce((s, o) => s + (o.subtotal_personnel || 0), 0),
      transport: acceptedOffers.reduce((s, o) => s + (o.subtotal_transport || 0), 0),
      discounts: acceptedOffers.reduce((s, o) => s + (o.discount_amount || 0), 0),
    };

    // Top clients by revenue
    const clientRevenueMap = new Map<string, { name: string; revenue: number; count: number }>();
    for (const o of acceptedOffers) {
      if (!o.client_id) continue;
      const existing = clientRevenueMap.get(o.client_id);
      if (existing) {
        existing.revenue += (o.custom_price ?? o.total_amount) || 0;
        existing.count += 1;
      } else {
        const client = clients.find(c => c.id === o.client_id);
        clientRevenueMap.set(o.client_id, {
          name: client?.name || 'Neznámý',
          revenue: (o.custom_price ?? o.total_amount) || 0,
          count: 1,
        });
      }
    }
    const topClients = Array.from(clientRevenueMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ========== EVENTS STATS ==========
    const upcomingEvents = events.filter(e => new Date(e.start_time) >= now);
    const pastEvents = events.filter(e => new Date(e.start_time) < now);
    const confirmedEvents = events.filter(e => e.status === 'confirmed');

    // Events by month (last 12)
    const eventsByMonth: { month: string; count: number; confirmed: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      const monthEvents = events.filter(e => {
        const start = new Date(e.start_time);
        return start.getFullYear() === year && start.getMonth() === month;
      });

      eventsByMonth.push({
        month: monthKey,
        count: monthEvents.length,
        confirmed: monthEvents.filter(e => e.status === 'confirmed').length,
      });
    }

    // ========== TECHNICIAN STATS ==========
    const techUtilization = new Map<string, { total: number; accepted: number; declined: number; pending: number }>();
    for (const a of assignments) {
      const existing = techUtilization.get(a.technician_id) || { total: 0, accepted: 0, declined: 0, pending: 0 };
      existing.total += 1;
      if (a.attendance_status === 'accepted') existing.accepted += 1;
      else if (a.attendance_status === 'declined') existing.declined += 1;
      else existing.pending += 1;
      techUtilization.set(a.technician_id, existing);
    }

    const acceptanceRate = assignments.length > 0
      ? Math.round((assignments.filter(a => a.attendance_status === 'accepted').length / assignments.length) * 100)
      : 0;

    // ========== WAREHOUSE STATS ==========
    const ownedItems = warehouseItems.filter(i => i.ownership_type === 'own' || i.ownership_type === 'ours');
    const rentItems = warehouseItems.filter(i => i.ownership_type === 'rent');

    return NextResponse.json({
      offers: {
        total: offers.length,
        thisYear: offersThisYear.length,
        byStatus: offersByStatus,
        revenueByStatus,
        totalRevenue,
        avgOfferValue,
        conversionRate,
        revenueByCategory,
        monthlyRevenue,
        topClients,
      },
      events: {
        total: events.length,
        upcoming: upcomingEvents.length,
        past: pastEvents.length,
        confirmed: confirmedEvents.length,
        byMonth: eventsByMonth,
      },
      technicians: {
        totalAssignments: assignments.length,
        acceptanceRate,
        utilizationByTech: Array.from(techUtilization.entries()).map(([id, stats]) => ({
          technicianId: id,
          ...stats,
        })),
      },
      warehouse: {
        totalItems: warehouseItems.length,
        ownedItems: ownedItems.length,
        rentItems: rentItems.length,
      },
    });
  } catch (error) {
    console.error('Reporting API error:', error);
    return apiError('Failed to fetch reporting data');
  }
}
