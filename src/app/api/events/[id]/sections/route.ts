import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasBookingAccess } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/sections
 * List all sections for an event
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('event_sections')
      .select('id, event_id, name, sort_order, created_at')
      .eq('event_id', id)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching event sections:', error);
    return apiError('Failed to fetch sections');
  }
}

/**
 * POST /api/events/[id]/sections
 * Create a new section for an event
 * Body: { name: string }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const profile = await getProfileWithFallback(supabase, user);
    const canManage = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);
    if (!canManage) return apiError('Forbidden', 403);

    const body = await request.json();
    const { name } = body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError('Section name is required', 400);
    }

    const db = createServiceRoleClient();

    // Get next sort order
    const { data: existing } = await db
      .from('event_sections')
      .select('sort_order')
      .eq('event_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (existing?.sort_order ?? -1) + 1;

    const { data, error } = await db
      .from('event_sections')
      .insert({ event_id: id, name: name.trim(), sort_order: nextOrder })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, section: data });
  } catch (error) {
    console.error('Error creating event section:', error);
    return apiError('Failed to create section');
  }
}

/**
 * PATCH /api/events/[id]/sections
 * Update a section (rename or reorder)
 * Body: { section_id: string, name?: string, sort_order?: number }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await params; // consume params
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const profile = await getProfileWithFallback(supabase, user);
    const canManage = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);
    if (!canManage) return apiError('Forbidden', 403);

    const body = await request.json();
    const { section_id, name, sort_order } = body;
    if (!section_id) return apiError('section_id is required', 400);

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    if (Object.keys(updateData).length === 0) {
      return apiError('No fields to update', 400);
    }

    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('event_sections')
      .update(updateData)
      .eq('id', section_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, section: data });
  } catch (error) {
    console.error('Error updating event section:', error);
    return apiError('Failed to update section');
  }
}

/**
 * DELETE /api/events/[id]/sections?section_id=...
 * Delete a section (positions in this section get section_id set to null)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await params; // consume params
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const profile = await getProfileWithFallback(supabase, user);
    const canManage = await hasBookingAccess(supabase, profile, ['booking_manage_positions']);
    if (!canManage) return apiError('Forbidden', 403);

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('section_id');
    if (!sectionId) return apiError('section_id is required', 400);

    const db = createServiceRoleClient();

    // Clear section_id from positions first
    await db
      .from('positions')
      .update({ section_id: null })
      .eq('section_id', sectionId);

    // Delete the section
    const { error } = await db
      .from('event_sections')
      .delete()
      .eq('id', sectionId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event section:', error);
    return apiError('Failed to delete section');
  }
}
