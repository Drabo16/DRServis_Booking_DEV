import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // CRITICAL FIX: Explicitly query offers with offer_set_id filter
    // Supabase relation syntax may not work correctly, so we do it manually
    const { data: set, error } = await supabase
      .from('offer_sets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!set) {
      return NextResponse.json({ error: 'Offer set not found' }, { status: 404 });
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
      console.error('❌ Error fetching offers for set:', offersError);
    }

    return NextResponse.json({ ...set, offers: offers || [] });
  } catch (error: any) {
    console.error('❌ Error fetching offer set:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offer set' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SECURITY: Check ownership if not admin
    if (profile.role !== 'admin') {
      const { data: set } = await supabase
        .from('offer_sets')
        .select('created_by')
        .eq('id', id)
        .single();

      if (!set || set.created_by !== profile.id) {
        return NextResponse.json({ error: 'Forbidden - not owner' }, { status: 403 });
      }
    }

    const { name, description, event_id, status, valid_until, notes, discount_percent, is_vat_payer } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (event_id !== undefined) updateData.event_id = event_id;
    if (status !== undefined) updateData.status = status;
    if (valid_until !== undefined) updateData.valid_until = valid_until;
    if (notes !== undefined) updateData.notes = notes;
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
  } catch (error: any) {
    console.error('❌ Error updating offer set:', error);
    return NextResponse.json(
      { error: 'Failed to update offer set' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const hasAccess = profile.role === 'admin' || await checkOffersAccess(supabase, profile.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SECURITY: Only admin can delete
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
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
  } catch (error: any) {
    console.error('❌ Error deleting offer set:', error);
    return NextResponse.json(
      { error: 'Failed to delete offer set' },
      { status: 500 }
    );
  }
}
