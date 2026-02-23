import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function checkOffersAccess(supabase: any, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', profileId)
    .eq('module_code', 'offers')
    .single();
  return !!data;
}

/**
 * GET /api/offers/presets
 * List all offer presets
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch presets with item count
    const { data: presets, error } = await supabase
      .from('offer_presets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get item counts in batch
    const presetIds = (presets || []).map((p: any) => p.id);
    let itemCounts: Record<string, number> = {};
    if (presetIds.length > 0) {
      const { data: counts } = await supabase
        .from('offer_preset_items')
        .select('preset_id')
        .in('preset_id', presetIds);

      if (counts) {
        for (const row of counts) {
          itemCounts[row.preset_id] = (itemCounts[row.preset_id] || 0) + 1;
        }
      }
    }

    const result = (presets || []).map((p: any) => ({
      ...p,
      items_count: itemCounts[p.id] || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching presets:', error);
    return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 });
  }
}

/**
 * POST /api/offers/presets
 * Create a new preset
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: preset, error } = await supabase
      .from('offer_presets')
      .insert({
        name,
        description: description || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preset });
  } catch (error) {
    console.error('Error creating preset:', error);
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 });
  }
}
