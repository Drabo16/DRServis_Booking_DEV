import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

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
      .select('*')
      .eq('id', versionId)
      .single();

    if (error || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    return NextResponse.json(version);
  } catch (error) {
    console.error('Error fetching version:', error);
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 });
  }
}
