import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/offers/sets - List all offer sets with their offers
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch offer sets with their offers
    const { data: sets, error } = await supabase
      .from('offer_sets')
      .select(`
        id,
        name,
        description,
        event_id,
        status,
        total_equipment,
        total_personnel,
        total_transport,
        total_discount,
        total_amount,
        created_at,
        offers (
          id,
          offer_number,
          year,
          title,
          set_label,
          total_amount,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add offers_count
    const setsWithCount = (sets || []).map(set => ({
      ...set,
      offers_count: set.offers?.length || 0,
    }));

    return NextResponse.json(setsWithCount);
  } catch (error: any) {
    console.error('Error fetching offer sets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/offers/sets - Create a new offer set
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { name, description, event_id, valid_until, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: newSet, error } = await supabase
      .from('offer_sets')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        event_id: event_id || null,
        valid_until: valid_until || null,
        notes: notes || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newSet);
  } catch (error: any) {
    console.error('Error creating offer set:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
