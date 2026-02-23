// =====================================================
// OFFERS API - Template Items Route
// =====================================================
// Manage offer template items (price list items)
// To remove: delete this file

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    return NextResponse.json(
      { error: 'Failed to fetch template items' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { category_id, name, subcategory, default_price, unit, sort_order, is_active } = body;

    if (!category_id || !name) {
      return NextResponse.json(
        { error: 'category_id and name are required' },
        { status: 400 }
      );
    }

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
    return NextResponse.json(
      { error: 'Failed to create template item' },
      { status: 500 }
    );
  }
}
