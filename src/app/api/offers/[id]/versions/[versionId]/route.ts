import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/offers/[id]/versions/[versionId]
 * Get a specific version with full items data (for restoring)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createServiceRoleClient();
    const { data: version, error } = await db
      .from('offer_versions')
      .select('id, offer_id, version_number, title, status, discount_percent, is_vat_payer, notes, items, created_by, created_at')
      .eq('id', versionId)
      .single();

    if (error || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    return NextResponse.json(version);
  } catch (error) {
    console.error('Error fetching version:', error);
    return apiError('Failed to fetch version');
  }
}

/**
 * PATCH /api/offers/[id]/versions/[versionId]
 * Update version name label
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name } = body;
    if (name !== undefined && typeof name !== 'string' && name !== null) {
      return apiError('Invalid name', 400);
    }

    const db = createServiceRoleClient();
    const { data: version, error } = await db
      .from('offer_versions')
      .update({ name: name || null })
      .eq('id', versionId)
      .select('id, version_number, name')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, version });
  } catch (error) {
    console.error('Error updating version name:', error);
    return apiError('Failed to update version name');
  }
}
