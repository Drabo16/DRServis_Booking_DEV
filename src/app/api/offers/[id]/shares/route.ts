import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/offers/[id]/shares
 * List users this offer is shared with
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
    const { data, error } = await db
      .from('offer_shares')
      .select('id, user_id, profiles!offer_shares_user_id_fkey(id, full_name, email)')
      .eq('offer_id', id);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching offer shares:', error);
    return apiError('Failed to fetch shares');
  }
}

/**
 * POST /api/offers/[id]/shares
 * Share offer with a user (admin only)
 * Body: { user_id: string }
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
      .select('role')
      .eq('auth_user_id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      // Also allow supervisors
      const { data: supRow } = await supabase
        .from('supervisor_emails')
        .select('email')
        .ilike('email', profile?.role ?? '')
        .maybeSingle();
      if (!supRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id } = body;
    if (!user_id || typeof user_id !== 'string') {
      return apiError('user_id is required', 400);
    }

    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('offer_shares')
      .insert({ offer_id: id, user_id })
      .select('id, user_id, profiles!offer_shares_user_id_fkey(id, full_name, email)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already shared with this user' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, share: data });
  } catch (error) {
    console.error('Error creating offer share:', error);
    return apiError('Failed to share offer');
  }
}

/**
 * DELETE /api/offers/[id]/shares?user_id=...
 * Remove share for a specific user (admin only)
 */
export async function DELETE(
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
      .select('role')
      .eq('auth_user_id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    if (!user_id) return apiError('user_id is required', 400);

    const db = createServiceRoleClient();
    const { error } = await db
      .from('offer_shares')
      .delete()
      .eq('offer_id', id)
      .eq('user_id', user_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting offer share:', error);
    return apiError('Failed to remove share');
  }
}
