import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
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

    const { data: set, error } = await supabase
      .from('offer_sets')
      .select(`
        *,
        offers (
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
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!set) {
      return NextResponse.json({ error: 'Offer set not found' }, { status: 404 });
    }

    return NextResponse.json(set);
  } catch (error: any) {
    console.error('Error fetching offer set:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    const { name, description, event_id, status, valid_until, notes, discount_percent } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (event_id !== undefined) updateData.event_id = event_id;
    if (status !== undefined) updateData.status = status;
    if (valid_until !== undefined) updateData.valid_until = valid_until;
    if (notes !== undefined) updateData.notes = notes;
    if (discount_percent !== undefined) updateData.discount_percent = discount_percent;

    const { data: updated, error } = await supabase
      .from('offer_sets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating offer set:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    console.error('Error deleting offer set:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
