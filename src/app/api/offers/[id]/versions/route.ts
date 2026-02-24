import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/offers/[id]/versions
 * List all versions of an offer (newest first)
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createServiceRoleClient();
    const { data: versions, error } = await db
      .from('offer_versions')
      .select('id, version_number, title, status, discount_percent, created_at, created_by')
      .eq('offer_id', id)
      .order('version_number', { ascending: false });

    if (error) throw error;

    return NextResponse.json(versions || []);
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}

/**
 * POST /api/offers/[id]/versions
 * Save a new version snapshot of an offer
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const body = await request.json();
    const { title, status, discount_percent, is_vat_payer, notes, items } = body;

    const db = createServiceRoleClient();

    // Get next version number
    const { data: maxRow } = await db
      .from('offer_versions')
      .select('version_number')
      .eq('offer_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (maxRow?.version_number || 0) + 1;

    // Keep only last 20 versions per offer
    const { data: allVersions } = await db
      .from('offer_versions')
      .select('id, version_number')
      .eq('offer_id', id)
      .order('version_number', { ascending: true });

    if (allVersions && allVersions.length >= 20) {
      // Delete oldest versions to keep only 19 (making room for the new one)
      const toDelete = allVersions.slice(0, allVersions.length - 19).map((v: any) => v.id);
      await db.from('offer_versions').delete().in('id', toDelete);
    }

    const { data: version, error } = await db
      .from('offer_versions')
      .insert({
        offer_id: id,
        version_number: nextVersion,
        title: title || 'Bez názvu',
        status: status || 'draft',
        discount_percent: discount_percent || 0,
        is_vat_payer: is_vat_payer ?? true,
        notes: notes || null,
        items: items || [],
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, version });
  } catch (error) {
    console.error('Error saving version:', error);
    return NextResponse.json({ error: 'Failed to save version' }, { status: 500 });
  }
}
