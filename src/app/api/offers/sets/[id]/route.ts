import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
import { updateOfferSetSchema } from '@/lib/validations/offers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper function to check offers module access
async function checkOffersAccess(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', profileId)
    .eq('module_code', 'offers')
    .single();
  return !!data;
}

// GET /api/offers/sets/[id] - Get a single offer set with its offers
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

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
      return apiError('Profile not found', 404);
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    // CRITICAL FIX: Explicitly query offers with offer_set_id filter
    // Supabase relation syntax may not work correctly, so we do it manually
    const { data: set, error } = await supabase
      .from('offer_sets')
      .select('id, name, description, event_id, status, valid_until, notes, total_equipment, total_personnel, total_transport, total_discount, total_amount, discount_percent, offer_number, year, is_vat_payer, created_by, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!set) {
      return apiError('Offer set not found', 404);
    }

    // Manually fetch offers for this set
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select(`
        id,
        offer_number,
        year,
        title,
        set_label,
        total_amount,
        status,
        subtotal_equipment,
        subtotal_personnel,
        subtotal_transport,
        discount_percent,
        discount_amount
      `)
      .eq('offer_set_id', id)
      .order('created_at', { ascending: false });

    if (offersError) {
      console.error('Error fetching offers for set:', offersError);
    }

    return NextResponse.json({ ...set, offers: offers || [] });
  } catch (error) {
    console.error('Error fetching offer set:', error);
    return apiError('Failed to fetch offer set');
  }
}

// PATCH /api/offers/sets/[id] - Update an offer set
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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
      return apiError('Profile not found', 404);
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    // SECURITY: Check ownership if not admin
    if (profile.role !== 'admin') {
      const { data: set } = await supabase
        .from('offer_sets')
        .select('created_by')
        .eq('id', id)
        .single();

      if (!set || set.created_by !== profile.id) {
        return apiError('Forbidden', 403);
      }
    }

    const parsed = updateOfferSetSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid offer set update data', 400);
    }

    const { name, description, event_id, status, valid_until, notes, discount_percent, is_vat_payer } = parsed.data;

    const updateData: Record<string, string | number | boolean | null> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description ?? null;
    if (event_id !== undefined) updateData.event_id = event_id ?? null;
    if (status !== undefined) updateData.status = status;
    if (valid_until !== undefined) updateData.valid_until = valid_until ?? null;
    if (notes !== undefined) updateData.notes = notes ?? null;
    if (discount_percent !== undefined) updateData.discount_percent = discount_percent;
    if (is_vat_payer !== undefined) updateData.is_vat_payer = is_vat_payer;

    const { data: updated, error } = await supabase
      .from('offer_sets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating offer set:', error);
    return apiError('Failed to update offer set');
  }
}

// DELETE /api/offers/sets/[id] - Delete an offer set (unlinks offers but doesn't delete them)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

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
      return apiError('Profile not found', 404);
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    // SECURITY: Only admin can delete
    if (profile.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    // First, unlink any offers from this set
    await supabase
      .from('offers')
      .update({ offer_set_id: null, set_label: null })
      .eq('offer_set_id', id);

    // Then delete the set
    const { error } = await supabase
      .from('offer_sets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting offer set:', error);
    return apiError('Failed to delete offer set');
  }
}
