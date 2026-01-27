// =====================================================
// OFFERS API - Duplicate Offer Route
// =====================================================
// Duplicate an existing offer with all its items

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
 * POST /api/offers/[id]/duplicate
 * Duplicate offer with all items
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Get original offer
    const { data: originalOffer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', id)
      .single();

    if (offerError || !originalOffer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Get original items
    const { data: originalItems, error: itemsError } = await supabase
      .from('offer_items')
      .select('*')
      .eq('offer_id', id);

    if (itemsError) throw itemsError;

    // Get next offer number for current year
    const currentYear = new Date().getFullYear();
    const { data: maxNumber } = await supabase
      .from('offers')
      .select('offer_number')
      .eq('year', currentYear)
      .order('offer_number', { ascending: false })
      .limit(1)
      .single();

    const nextNumber = (maxNumber?.offer_number || 0) + 1;

    // Create new offer (copy of original)
    const { data: newOffer, error: createError } = await supabase
      .from('offers')
      .insert({
        offer_number: nextNumber,
        year: currentYear,
        title: `${originalOffer.title} (kopie)`,
        event_id: originalOffer.event_id,
        valid_until: originalOffer.valid_until,
        notes: originalOffer.notes,
        discount_percent: originalOffer.discount_percent,
        is_vat_payer: originalOffer.is_vat_payer,
        status: 'draft', // Always start as draft
        created_by: profile.id,
        // Don't copy offer_set_id or set_label - new offer is independent
      })
      .select()
      .single();

    if (createError) throw createError;

    // Copy items if any
    if (originalItems && originalItems.length > 0) {
      const newItems = originalItems.map(item => ({
        offer_id: newOffer.id,
        template_item_id: item.template_item_id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        unit: item.unit,
        unit_price: item.unit_price,
        quantity: item.quantity,
        days_hours: item.days_hours,
        sort_order: item.sort_order,
      }));

      const { error: insertItemsError } = await supabase
        .from('offer_items')
        .insert(newItems);

      if (insertItemsError) throw insertItemsError;

      // Recalculate totals
      const { data: items } = await supabase
        .from('offer_items')
        .select('*')
        .eq('offer_id', newOffer.id);

      const totals = calculateOfferTotals(items || []);
      const discount_amount = calculateDiscountAmount(totals.subtotal_equipment, newOffer.discount_percent || 0);
      const total_amount = calculateFinalTotal(
        totals.subtotal_equipment,
        totals.subtotal_personnel,
        totals.subtotal_transport,
        newOffer.discount_percent || 0
      );

      await supabase
        .from('offers')
        .update({
          subtotal_equipment: totals.subtotal_equipment,
          subtotal_personnel: totals.subtotal_personnel,
          subtotal_transport: totals.subtotal_transport,
          discount_amount,
          total_amount,
        })
        .eq('id', newOffer.id);
    }

    // Get final offer with event
    const { data: finalOffer } = await supabase
      .from('offers')
      .select(`
        *,
        event:events(id, title, start_time, location)
      `)
      .eq('id', newOffer.id)
      .single();

    return NextResponse.json({ success: true, offer: finalOffer });
  } catch (error) {
    console.error('Offer duplicate error:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate offer' },
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
