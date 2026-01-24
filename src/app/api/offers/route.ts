// =====================================================
// OFFERS API - Main Route
// =====================================================
// List and create offers
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      .select('id, role')
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
      .order('created_at', { ascending: false });

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
      query = query.ilike('title', `%${search}%`);
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
    (itemsCounts || []).forEach((item: any) => {
      countsMap.set(item.offer_id, (countsMap.get(item.offer_id) || 0) + 1);
    });

    // Add counts to offers
    const offersWithCount = data.map(offer => ({
      ...offer,
      items_count: countsMap.get(offer.id) || 0,
    }));

    return NextResponse.json(offersWithCount);
  } catch (error) {
    console.error('Offers fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    );
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
    const { title, event_id, valid_until, notes } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Get next offer number for current year
    const currentYear = new Date().getFullYear();
    const { data: maxNumber } = await supabase
      .from('offers')
      .select('offer_number')
      .eq('year', currentYear)
      .order('offer_number', { ascending: false })
      .limit(1)
      .single();

    const nextNumber = (maxNumber?.offer_number || 0) + 1;

    const { data, error } = await supabase
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

    if (error) throw error;

    return NextResponse.json({ success: true, offer: data });
  } catch (error) {
    console.error('Offer creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create offer' },
      { status: 500 }
    );
  }
}

async function checkOffersAccess(supabase: any, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', profileId)
    .eq('module_code', 'offers')
    .single();
  return !!data;
}
