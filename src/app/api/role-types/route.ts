import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient, getProfileWithFallback, hasPermission } from '@/lib/supabase/server';
import { createRoleTypeSchema } from '@/lib/validations/role-types';
import { apiError } from '@/lib/api-response';

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
      .select('id, value, label, created_at')
      .order('label');

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

    const { data, error } = await serviceClient
      .from('role_types')
      .insert({ value, label })
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
