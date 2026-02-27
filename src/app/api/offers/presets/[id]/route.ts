import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
import { updatePresetSchema } from '@/lib/validations/offers';

/**
 * GET /api/offers/presets/[id]
 * Get preset with all items
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: preset, error } = await supabase
      .from('offer_presets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !preset) {
      return apiError('Preset not found', 404);
    }

    const { data: items } = await supabase
      .from('offer_preset_items')
      .select('*')
      .eq('preset_id', id)
      .order('sort_order', { ascending: true });

    return NextResponse.json({ ...preset, items: items || [] });
  } catch (error) {
    console.error('Error fetching preset:', error);
    return apiError('Failed to fetch preset');
  }
}

/**
 * PATCH /api/offers/presets/[id]
 * Update preset metadata and/or items
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile || profile.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = updatePresetSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid preset update data', 400);
    }

    const { name, description, discount_percent, is_vat_payer, items } = parsed.data;

    // Update preset metadata
    const updateData: Record<string, string | number | boolean> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description ?? '';
    if (discount_percent !== undefined) updateData.discount_percent = discount_percent;
    if (is_vat_payer !== undefined) updateData.is_vat_payer = is_vat_payer;

    const { error: updateError } = await supabase
      .from('offer_presets')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    // If items are provided, replace all items
    if (items !== undefined) {
      // Delete existing items
      await supabase
        .from('offer_preset_items')
        .delete()
        .eq('preset_id', id);

      // Insert new items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index: number) => ({
          preset_id: id,
          template_item_id: item.template_item_id || null,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory || null,
          unit: item.unit || 'ks',
          unit_price: item.unit_price || 0,
          days_hours: item.days_hours || 1,
          quantity: item.quantity || 1,
          sort_order: item.sort_order ?? index,
        }));

        const { error: insertError } = await supabase
          .from('offer_preset_items')
          .insert(itemsToInsert);

        if (insertError) throw insertError;
      }
    }

    // Return updated preset with items
    const { data: preset } = await supabase
      .from('offer_presets')
      .select('*')
      .eq('id', id)
      .single();

    const { data: updatedItems } = await supabase
      .from('offer_preset_items')
      .select('*')
      .eq('preset_id', id)
      .order('sort_order', { ascending: true });

    return NextResponse.json({ success: true, preset: { ...preset, items: updatedItems || [] } });
  } catch (error) {
    console.error('Error updating preset:', error);
    return apiError('Failed to update preset');
  }
}

/**
 * DELETE /api/offers/presets/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile || profile.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const { error } = await supabase
      .from('offer_presets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting preset:', error);
    return apiError('Failed to delete preset');
  }
}
