// =====================================================
// OFFERS API - Main Route
// =====================================================
// List and create offers
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createOfferSchema } from '@/lib/validations/offers';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/offers
 * List all offers with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check offers access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user has offers module access
    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Determine if user can view ALL offers (supervisor/admin/offers_edit_all permission)
    const { data: supervisorRow } = await supabase
      .from('supervisor_emails')
      .select('email')
      .ilike('email', profile.email)
      .maybeSingle();
    const isSupervisor = !!supervisorRow;

    const { data: editAllPerm } = await supabase
      .from('user_permissions')
      .select('id')
      .eq('user_id', profile.id)
      .eq('permission_code', 'offers_edit_all')
      .maybeSingle();

    const canViewAll = isSupervisor || profile.role === 'admin' || !!editAllPerm;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const year = searchParams.get('year');
    const event_id = searchParams.get('event_id');
    const search = searchParams.get('search');

    let query = supabase
      .from('offers')
      .select(`
        id,
        offer_number,
        year,
        title,
        status,
        valid_until,
        subtotal_equipment,
        subtotal_personnel,
        subtotal_transport,
        discount_percent,
        total_amount,
        created_at,
        updated_at,
        event:events(id, title, start_time, location),
        created_by_profile:profiles!offers_created_by_fkey(id, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100); // OPTIMIZED: Limit to 100 most recent offers

    if (status) {
      query = query.eq('status', status);
    }

    if (year) {
      query = query.eq('year', parseInt(year));
    }

    if (event_id) {
      query = query.eq('event_id', event_id);
    }

    if (search) {
      const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
      query = query.ilike('title', `%${sanitizedSearch}%`);
    }

    // Non-supervisors/non-admins see their own offers OR offers explicitly shared with them
    if (!canViewAll) {
      const { data: sharedRows } = await supabase
        .from('offer_shares')
        .select('offer_id')
        .eq('user_id', profile.id);
      const sharedIds = (sharedRows || []).map((r: { offer_id: string }) => r.offer_id);

      if (sharedIds.length > 0) {
        query = query.or(`created_by.eq.${profile.id},id.in.(${sharedIds.join(',')})`);
      } else {
        query = query.eq('created_by', profile.id);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    // OPTIMIZED: Batch fetch items count to avoid N+1 query problem
    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    const offerIds = data.map(o => o.id);

    // Single query to get all counts at once
    const { data: itemsCounts } = await supabase
      .from('offer_items')
      .select('offer_id')
      .in('offer_id', offerIds);

    // Count items per offer
    const countsMap = new Map<string, number>();
    (itemsCounts || []).forEach((item: { offer_id: string }) => {
      countsMap.set(item.offer_id, (countsMap.get(item.offer_id) || 0) + 1);
    });

    // Add counts to offers
    const offersWithCount = data.map(offer => ({
      ...offer,
      items_count: countsMap.get(offer.id) || 0,
    }));

    return NextResponse.json(offersWithCount);
  } catch (error) {
    console.error('[API] Offers fetch error:', error);
    return apiError('Failed to fetch offers');
  }
}

/**
 * POST /api/offers
 * Create a new offer
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createOfferSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }
    const { title, event_id, valid_until, notes } = parsed.data;

    // Get next offer number for current year (with retry on unique constraint violation)
    const currentYear = new Date().getFullYear();
    let data = null;
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: maxRow } = await supabase
        .from('offers')
        .select('offer_number')
        .eq('year', currentYear)
        .order('offer_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = (maxRow?.offer_number || 0) + 1;

      const { data: inserted, error } = await supabase
        .from('offers')
        .insert({
          offer_number: nextNumber,
          year: currentYear,
          title,
          event_id: event_id || null,
          valid_until: valid_until || null,
          notes: notes || null,
          created_by: profile.id,
        })
        .select(`
          *,
          event:events(id, title, start_time, location)
        `)
        .single();

      if (!error) { data = inserted; break; }
      if (error.code !== '23505') throw error; // Not a unique constraint violation
      lastError = error;
    }
    if (!data) throw lastError ?? new Error('Failed to generate unique offer number');

    return NextResponse.json({ success: true, offer: data });
  } catch (error) {
    console.error('[API] Offer creation error:', error);
    return apiError('Failed to create offer');
  }
}

async function checkOffersAccess(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', profileId)
    .eq('module_code', 'offers')
    .single();
  return !!data;
}
