import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createClientSchema } from '@/lib/validations/clients';
import { apiError } from '@/lib/api-response';

async function checkClientsAccess(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string, profileRole: string): Promise<boolean> {
  if (profileRole === 'admin') return true;
  const { data } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', profileId)
    .eq('module_code', 'clients')
    .single();
  return !!data;
}

/**
 * GET /api/clients
 * List all clients with optional search
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    const hasAccess = await checkClientsAccess(supabase, profile.id, profile.role);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    const serviceClient = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = serviceClient
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${sanitized}%,ico.ilike.%${sanitized}%,contact_person.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[API] Clients fetch error:', error);
    return apiError('Failed to fetch clients');
  }
}

/**
 * POST /api/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return apiError('Profile not found', 404);
    }

    const hasAccess = await checkClientsAccess(supabase, profile.id, profile.role);
    if (!hasAccess) {
      return apiError('Forbidden', 403);
    }

    const serviceClient = createServiceRoleClient();
    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { data, error } = await serviceClient
      .from('clients')
      .insert(parsed.data)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, client: data });
  } catch (error) {
    console.error('[API] Client creation error:', error);
    return apiError('Failed to create client');
  }
}
