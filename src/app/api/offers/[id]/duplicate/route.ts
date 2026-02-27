// =====================================================
// OFFERS API - Duplicate Offer Route
// =====================================================
// Duplicate an existing offer with all its items

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
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

    // Use service role client for all data operations to bypass RLS
    // (auth already verified above via anon client)
    const db = createServiceRoleClient();

    // Get original offer
    const { data: originalOffer, error: offerError } = await db
      .from('offers')
      .select('id, offer_number, year, title, event_id, status, valid_until, notes, discount_percent, is_vat_payer, created_by')
      .eq('id', id)
      .single();

    if (offerError || !originalOffer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Get original items
    const { data: originalItems, error: itemsError } = await db
      .from('offer_items')
      .select('id, offer_id, category, subcategory, name, days_hours, quantity, unit_price, total_price, sort_order, template_item_id')
      .eq('offer_id', id);

    if (itemsError) throw itemsError;

    // Get next offer number for current year (with retry on unique constraint violation)
    const currentYear = new Date().getFullYear();
    let newOffer = null;
    let lastCreateError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: maxRow } = await db
        .from('offers')
        .select('offer_number')
        .eq('year', currentYear)
        .order('offer_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = (maxRow?.offer_number || 0) + 1;

      const { data: inserted, error: createError } = await db
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

      if (!createError) { newOffer = inserted; break; }
      if (createError.code !== '23505') throw createError;
      lastCreateError = createError;
    }
    if (!newOffer) throw lastCreateError ?? new Error('Failed to generate unique offer number');

    // Copy items if any
    if (originalItems && originalItems.length > 0) {
      const newItems = originalItems.map((item: any) => ({
        offer_id: newOffer!.id,
        template_item_id: item.template_item_id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        unit_price: item.unit_price,
        quantity: item.quantity,
        days_hours: item.days_hours,
        sort_order: item.sort_order,
        total_price: item.total_price,
      }));

      const { error: insertItemsError } = await db
        .from('offer_items')
        .insert(newItems);

      if (insertItemsError) {
        // Clean up orphaned offer on failure
        await db.from('offers').delete().eq('id', newOffer.id);
        throw insertItemsError;
      }

      // Recalculate totals
      const { data: items } = await db
        .from('offer_items')
        .select('id, offer_id, category, subcategory, name, days_hours, quantity, unit_price, total_price, sort_order, template_item_id')
        .eq('offer_id', newOffer.id);

      const totals = calculateOfferTotals(items || []);
      const discount_amount = calculateDiscountAmount(totals.subtotal_equipment, newOffer.discount_percent || 0);
      const total_amount = calculateFinalTotal(
        totals.subtotal_equipment,
        totals.subtotal_personnel,
        totals.subtotal_transport,
        newOffer.discount_percent || 0
      );

      await db
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
    const { data: finalOffer } = await db
      .from('offers')
      .select(`
        id, offer_number, year, title, event_id, status, valid_until, notes, subtotal_equipment, subtotal_personnel, subtotal_transport, discount_percent, discount_amount, total_amount, is_vat_payer, created_by, created_at, updated_at, offer_set_id, set_label,
        event:events(id, title, start_time, location)
      `)
      .eq('id', newOffer.id)
      .single();

    return NextResponse.json({ success: true, offer: finalOffer });
  } catch (error) {
    console.error('Offer duplicate error:', error);
    return apiError('Failed to duplicate offer');
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
