import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { updateClientSchema } from '@/lib/validations/clients';
import { apiError } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
 * GET /api/clients/[id]
 * Get single client with stats
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const { data: client, error } = await serviceClient
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!client) {
      return apiError('Client not found', 404);
    }

    // Get stats: offers count, accepted count, total revenue
    const { data: offers } = await serviceClient
      .from('offers')
      .select('id, status, total_amount, custom_price')
      .eq('client_id', id);

    const offersArr = offers || [];
    const stats = {
      offers_count: offersArr.length,
      accepted_count: offersArr.filter(o => o.status === 'accepted').length,
      total_revenue: offersArr
        .filter(o => o.status === 'accepted')
        .reduce((sum, o) => sum + ((o.custom_price ?? o.total_amount) || 0), 0),
    };

    return NextResponse.json({ ...client, ...stats });
  } catch (error) {
    console.error('[API] Client fetch error:', error);
    return apiError('Failed to fetch client');
  }
}

/**
 * PATCH /api/clients/[id]
 * Update a client
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Validation failed', 400);
    }

    const { data, error } = await serviceClient
      .from('clients')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, client: data });
  } catch (error) {
    console.error('[API] Client update error:', error);
    return apiError('Failed to update client');
  }
}

/**
 * DELETE /api/clients/[id]
 * Delete a client
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const { error } = await serviceClient
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Client delete error:', error);
    return apiError('Failed to delete client');
  }
}
