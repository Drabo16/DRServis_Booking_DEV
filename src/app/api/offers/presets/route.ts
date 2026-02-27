import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
import { createPresetSchema } from '@/lib/validations/offers';

async function checkOffersAccess(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string): Promise<boolean> {
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
    if (!profile) return apiError('Profile not found', 404);

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) return apiError('Forbidden', 403);

    // Fetch presets with item count
    const { data: presets, error } = await supabase
      .from('offer_presets')
      .select('id, name, description, discount_percent, is_vat_payer, created_by, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get item counts in batch
    const presetIds = (presets || []).map((p: { id: string }) => p.id);
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

    const result = (presets || []).map((p: { id: string }) => ({
      ...p,
      items_count: itemCounts[p.id] || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching presets:', error);
    return apiError('Failed to fetch presets');
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
    if (!profile) return apiError('Profile not found', 404);
    if (profile.role !== 'admin') return apiError('Forbidden', 403);

    const body = await request.json();
    const parsed = createPresetSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid preset data', 400);
    }

    const { name, description } = parsed.data;

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
    return apiError('Failed to create preset');
  }
}
