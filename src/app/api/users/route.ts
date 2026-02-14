import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext, hasPermission, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/users
 * Načtení všech uživatelů (pro uživatele s oprávněním users_settings_manage_users)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check permission to manage users
    const canManageUsers = await hasPermission(profile, 'users_settings_manage_users', isSupervisor);

    if (!canManageUsers) {
      return NextResponse.json({ error: 'Forbidden - nemáte oprávnění spravovat uživatele' }, { status: 403 });
    }

    // Use service client to bypass RLS for listing all users
    const serviceClient = createServiceRoleClient();

    // Načtení všech uživatelů
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
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Vytvoření nového uživatele (pro uživatele s oprávněním users_settings_manage_users)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check permission to manage users
    const canManageUsers = await hasPermission(profile, 'users_settings_manage_users', isSupervisor);

    if (!canManageUsers) {
      return NextResponse.json({ error: 'Forbidden - nemáte oprávnění spravovat uživatele' }, { status: 403 });
    }

    const body = await request.json();
    const { email, full_name, phone, role, specialization, is_drservis, company, note } = body;

    // Validace povinných polí
    if (!email || !full_name || !role) {
      return NextResponse.json(
        { error: 'Email, full name, and role are required' },
        { status: 400 }
      );
    }

    // Validace email formátu
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // SECURITY: Non-admins (managers with users_settings permission) can only create technicians
    const isAdmin = profile.role === 'admin';

    // Only admins and supervisors can create admin or manager roles
    if (!isAdmin && !isSupervisor && (role === 'admin' || role === 'manager')) {
      return NextResponse.json(
        { error: 'Forbidden - nemáte oprávnění vytvářet uživatele s rolí admin nebo správce' },
        { status: 403 }
      );
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Kontrola zda email již neexistuje
    const { data: existingUser } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Vytvoření nového profilu
    // Note: User se vytvoří v profiles tabulce, ale ne v auth.users
    // Uživatel se bude moci přihlásit přes Google OAuth pomocí tohoto emailu
    const { data: newUser, error } = await serviceClient
      .from('profiles')
      .insert({
        id: crypto.randomUUID(), // Vygeneruj UUID pro profil
        email,
        full_name,
        phone: phone || null,
        role,
        specialization: specialization || null,
        is_active: true,
        is_drservis: is_drservis ?? true,
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
    return NextResponse.json(
      {
        error: 'Failed to create user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
