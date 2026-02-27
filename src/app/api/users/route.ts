import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext, hasPermission, createServiceRoleClient } from '@/lib/supabase/server';
import { createUserSchema } from '@/lib/validations/users';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/users
 * Naciteni vsech uzivatelu (pro uzivatele s opravnenim users_settings_manage_users)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    // Check permission to manage users
    const canManageUsers = await hasPermission(profile, 'users_settings_manage_users', isSupervisor);

    if (!canManageUsers) {
      return apiError('Forbidden', 403);
    }

    // Use service client to bypass RLS for listing all users
    const serviceClient = createServiceRoleClient();

    // Naciteni vsech uzivatelu
    const { data: users, error } = await serviceClient
      .from('profiles')
      .select('id, auth_user_id, email, full_name, phone, role, specialization, avatar_url, is_active, has_warehouse_access, is_drservis, company, note, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users fetch error:', error);
    return apiError('Failed to fetch users');
  }
}

/**
 * POST /api/users
 * Vytvoreni noveho uzivatele (pro uzivatele s opravnenim users_settings_manage_users)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    // Check permission to manage users
    const canManageUsers = await hasPermission(profile, 'users_settings_manage_users', isSupervisor);

    if (!canManageUsers) {
      return apiError('Forbidden', 403);
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { email, full_name, phone, role, specialization, is_drservis, company, note } = parsed.data;

    // SECURITY: Non-admins (managers with users_settings permission) can only create technicians
    const isAdmin = profile.role === 'admin';

    // Only admins and supervisors can create admin or manager roles
    if (!isAdmin && !isSupervisor && (role === 'admin' || role === 'manager')) {
      return apiError('Forbidden', 403);
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Kontrola zda email jiz neexistuje
    const { data: existingUser } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return apiError('User with this email already exists', 409);
    }

    // Vytvoreni noveho profilu
    const { data: newUser, error } = await serviceClient
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        email,
        full_name,
        phone: phone || null,
        role,
        specialization: specialization || null,
        is_active: true,
        is_drservis: is_drservis,
        company: company || null,
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error) {
    console.error('User creation error:', error);
    return apiError('Failed to create user');
  }
}
