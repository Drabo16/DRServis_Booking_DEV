import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createKitSchema } from '@/lib/validations/warehouse';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/warehouse/kits
 * List all warehouse kits with their items
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Check warehouse access
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, has_warehouse_access')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && !profile?.has_warehouse_access) {
      return apiError('Forbidden', 403);
    }

    const { data, error } = await supabase
      .from('warehouse_kits')
      .select(`
        *,
        items:warehouse_kit_items(
          id,
          kit_id,
          item_id,
          quantity,
          created_at,
          item:warehouse_items(*)
        )
      `)
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Warehouse kits fetch error:', error);
    return apiError('Failed to fetch kits');
  }
}

/**
 * POST /api/warehouse/kits
 * Create a new warehouse kit with items (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Only admins can create kits
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = createKitSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { name, description, items } = parsed.data;

    // Create kit
    const { data: kit, error: kitError } = await supabase
      .from('warehouse_kits')
      .insert({
        name,
        description: description || null,
      })
      .select()
      .single();

    if (kitError) throw kitError;

    // Add items to kit
    if (items && items.length > 0) {
      const kitItems = items.map((item) => ({
        kit_id: kit.id,
        item_id: item.item_id,
        quantity: item.quantity || 1,
      }));

      const { error: itemsError } = await supabase
        .from('warehouse_kit_items')
        .insert(kitItems);

      if (itemsError) {
        // Rollback: delete the kit if items insertion fails
        await supabase.from('warehouse_kits').delete().eq('id', kit.id);
        throw itemsError;
      }
    }

    // Fetch the complete kit with items
    const { data: completeKit, error: fetchError } = await supabase
      .from('warehouse_kits')
      .select(`
        *,
        items:warehouse_kit_items(
          id,
          kit_id,
          item_id,
          quantity,
          created_at,
          item:warehouse_items(*)
        )
      `)
      .eq('id', kit.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ success: true, kit: completeKit });
  } catch (error) {
    console.error('Warehouse kit creation error:', error);
    return apiError('Failed to create kit');
  }
}
