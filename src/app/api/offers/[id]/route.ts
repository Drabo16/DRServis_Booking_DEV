// =====================================================
// OFFERS API - Single Offer Route
// =====================================================
// Get, update, delete single offer
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateOfferTotals,
  calculateDiscountAmount,
  calculateFinalTotal,
} from '@/types/offers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/offers/[id]
 * Get single offer with all items
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Get offer with items
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(`
        *,
        event:events(id, title, start_time, location)
      `)
      .eq('id', id)
      .single();

    if (offerError) throw offerError;
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('offer_items')
      .select('*')
      .eq('offer_id', id)
      .order('sort_order', { ascending: true });

    if (itemsError) throw itemsError;

    return NextResponse.json({ ...offer, items: items || [] });
  } catch (error) {
    console.error('Offer fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offer' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/offers/[id]
 * Update offer (metadata or recalculate totals)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const body = await request.json();
    const { title, event_id, status, valid_until, notes, discount_percent, offer_set_id, set_label, recalculate } = body;

    // If recalculate is true, recalculate all totals from items
    if (recalculate) {
      // First get current offer to preserve discount if not provided
      const { data: currentOffer } = await supabase
        .from('offers')
        .select('discount_percent')
        .eq('id', id)
        .single();

      const { data: items } = await supabase
        .from('offer_items')
        .select('*')
        .eq('offer_id', id);

      const totals = calculateOfferTotals(items || []);
      const currentDiscount = discount_percent !== undefined ? discount_percent : (currentOffer?.discount_percent ?? 0);
      const discount_amount = calculateDiscountAmount(totals.subtotal_equipment, currentDiscount);
      const total_amount = calculateFinalTotal(
        totals.subtotal_equipment,
        totals.subtotal_personnel,
        totals.subtotal_transport,
        currentDiscount
      );

      // Build update data with all fields
      const updateData: Record<string, any> = {
        subtotal_equipment: totals.subtotal_equipment,
        subtotal_personnel: totals.subtotal_personnel,
        subtotal_transport: totals.subtotal_transport,
        discount_percent: currentDiscount,
        discount_amount,
        total_amount,
      };

      // Also update status and set fields if provided
      if (status !== undefined) updateData.status = status;
      if (offer_set_id !== undefined) updateData.offer_set_id = offer_set_id;
      if (set_label !== undefined) updateData.set_label = set_label;

      console.log(`💾 Updating offer ${id}:`, {
        offer_set_id: updateData.offer_set_id,
        set_label: updateData.set_label,
        hasSetId: offer_set_id !== undefined
      });

      const { data, error } = await supabase
        .from('offers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Update failed:', error);
        return NextResponse.json(
          { error: `Database update failed: ${error.message}` },
          { status: 500 }
        );
      }

      console.log('✅ Offer updated successfully:', {
        id: data.id,
        offer_set_id: data.offer_set_id,
        offer_number: data.offer_number
      });

      return NextResponse.json({ success: true, offer: data });
    }

    // Regular update
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (event_id !== undefined) updateData.event_id = event_id;
    if (status !== undefined) updateData.status = status;
    if (valid_until !== undefined) updateData.valid_until = valid_until;
    if (notes !== undefined) updateData.notes = notes;
    if (offer_set_id !== undefined) updateData.offer_set_id = offer_set_id;
    if (set_label !== undefined) updateData.set_label = set_label;

    // If discount changed, recalculate
    if (discount_percent !== undefined) {
      const { data: offer } = await supabase
        .from('offers')
        .select('subtotal_equipment, subtotal_personnel, subtotal_transport')
        .eq('id', id)
        .single();

      if (offer) {
        const discount_amount = calculateDiscountAmount(offer.subtotal_equipment, discount_percent);
        const total_amount = calculateFinalTotal(
          offer.subtotal_equipment,
          offer.subtotal_personnel,
          offer.subtotal_transport,
          discount_percent
        );
        updateData.discount_percent = discount_percent;
        updateData.discount_amount = discount_amount;
        updateData.total_amount = total_amount;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('offers')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        event:events(id, title, start_time, location)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, offer: data });
  } catch (error) {
    console.error('Offer update error:', error);
    return NextResponse.json(
      { error: 'Failed to update offer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/offers/[id]
 * Delete offer (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('offers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Offer delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete offer' },
      { status: 500 }
    );
  }
}

async function checkOffersAccess(supabase: any, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', profileId)
    .eq('module_code', 'offers')
    .single();
  return !!data;
}
