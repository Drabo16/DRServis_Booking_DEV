import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to check offers module access
async function checkOffersAccess(supabase: any, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', profileId)
    .eq('module_code', 'offers')
    .single();
  return !!data;
}

// GET /api/offers/sets - List all offer sets with their offers
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Check offers module access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Determine if user can view ALL sets (same rules as offers)
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

    // Fetch offer sets with their offers
    let setsQuery = supabase
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

    // Non-supervisors/non-admins see only their own sets
    if (!canViewAll) {
      setsQuery = setsQuery.eq('created_by', profile.id);
    }

    const { data: sets, error } = await setsQuery;

    if (error) throw error;

    // Add offers_count
    const setsWithCount = (sets || []).map(set => ({
      ...set,
      offers_count: set.offers?.length || 0,
    }));

    return NextResponse.json(setsWithCount);
  } catch (error: any) {
    console.error('❌ Error fetching offer sets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offer sets' },
      { status: 500 }
    );
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

    // SECURITY: Check offers module access
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

    const { name, description, event_id, status, valid_until, notes } = body;

    // Input validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: newSet, error } = await supabase
      .from('offer_sets')
      .insert({
        name: name.trim(),
        description,
        event_id,
        status: status || 'draft',
        valid_until,
        notes,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newSet, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error creating offer set:', error);
    return NextResponse.json(
      { error: 'Failed to create offer set' },
      { status: 500 }
    );
  }
}
