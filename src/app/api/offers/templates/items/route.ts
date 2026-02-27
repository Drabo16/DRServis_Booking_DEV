// =====================================================
// OFFERS API - Template Items Route
// =====================================================
// Manage offer template items (price list items)
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
import { createTemplateItemSchema } from '@/lib/validations/offers';

/**
 * GET /api/offers/templates/items
 * Get all template items with optional category filter
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category_id = searchParams.get('category_id');
    const search = searchParams.get('search');
    const active_only = searchParams.get('active_only') !== 'false';

    let query = supabase
      .from('offer_template_items')
      .select(`
        *,
        category:offer_template_categories(id, name, sort_order)
      `)
      .order('sort_order', { ascending: true });

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (active_only) {
      query = query.eq('is_active', true);
    }

    if (search) {
      const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
      query = query.ilike('name', `%${sanitizedSearch}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Template items fetch error:', error);
    return apiError('Failed to fetch template items');
  }
}

/**
 * POST /api/offers/templates/items
 * Create new template item (admin only)
 */
export async function POST(request: NextRequest) {
  try {
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
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = createTemplateItemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid template item data', 400);
    }

    const { category_id, name, subcategory, default_price, unit, sort_order, is_active } = parsed.data;

    const { data, error } = await supabase
      .from('offer_template_items')
      .insert({
        category_id,
        name,
        subcategory: subcategory || null,
        default_price: default_price || 0,
        unit: unit || 'ks',
        sort_order: sort_order || 0,
        is_active: is_active !== false,
      })
      .select(`
        *,
        category:offer_template_categories(id, name, sort_order)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Template item creation error:', error);
    return apiError('Failed to create template item');
  }
}
