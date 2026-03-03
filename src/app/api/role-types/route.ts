import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasPermission } from '@/lib/supabase/server';
import { createRoleTypeSchema } from '@/lib/validations/role-types';
import { apiError } from '@/lib/api-response';
import { z } from 'zod';

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

// GET /api/role-types - Nacist vsechny typy roli (verejne pro vsechny prihlasene)
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { data, error } = await supabase
      .from('role_types')
      .select('id, value, label, sort_order, created_at')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ roleTypes: data || [] });
  } catch (error) {
    console.error('[API] Error fetching role types:', error);
    return apiError('Failed to fetch role types');
  }
}

// POST /api/role-types - Vytvorit novy typ role (pro uzivatele s opravnenim users_settings_manage_roles)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Kontrola autentizace
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Get profile with fallback
    const profile = await getProfileWithFallback(supabase, user);

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    // Check permission to manage roles
    const canManageRoles = await hasPermission(profile, 'users_settings_manage_roles');

    if (!canManageRoles) {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = createRoleTypeSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { value, label } = parsed.data;

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Get max sort_order to append new role at the end
    const { data: maxRow } = await serviceClient
      .from('role_types')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();
    const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data, error } = await serviceClient
      .from('role_types')
      .insert({ value, label, sort_order: nextSortOrder })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique violation
        return apiError('Role type with this value already exists', 409);
      }
      throw error;
    }

    return NextResponse.json({ roleType: data });
  } catch (error) {
    console.error('[API] Error creating role type:', error);
    return apiError('Failed to create role type');
  }
}

// PUT /api/role-types - Reorder role types
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const profile = await getProfileWithFallback(supabase, user);
    if (!profile) return apiError('Profile not found', 404);

    const canManageRoles = await hasPermission(profile, 'users_settings_manage_roles');
    if (!canManageRoles) return apiError('Forbidden', 403);

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', 400);

    const { orderedIds } = parsed.data;
    const serviceClient = createServiceRoleClient();

    // Update sort_order for each role type
    const updates = orderedIds.map((id, index) =>
      serviceClient
        .from('role_types')
        .update({ sort_order: index })
        .eq('id', id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error reordering role types:', error);
    return apiError('Failed to reorder role types');
  }
}
