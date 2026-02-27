import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Server component can't set cookies
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Server component can't remove cookies
          }
        },
      },
    }
  )
}

// Service role client pro admin operace (POUZE server-side!)
export function createServiceRoleClient() {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {},
    }
  )
}

import type { Profile } from '@/types';

// Explicit column list for profiles table - avoids SELECT * overhead
const PROFILE_COLUMNS = 'id, auth_user_id, email, full_name, phone, role, specialization, avatar_url, is_active, has_warehouse_access, is_drservis, company, note, created_at, updated_at';

/**
 * Check if an email belongs to a supervisor.
 * Single query replacing 15+ duplicate supervisor lookups across API routes.
 */
export async function checkIsSupervisor(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from('supervisor_emails')
    .select('email')
    .ilike('email', email)
    .single();
  return !!data;
}

/**
 * Get user profile with fallback to email lookup.
 * Uses SERVICE ROLE client to bypass RLS restrictions.
 * This handles the case where auth_user_id is not yet linked to the profile.
 * Also attempts to link auth_user_id if profile is found by email but not linked.
 */
export async function getProfileWithFallback(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null | undefined }
): Promise<Profile | null> {
  // Use service role client to bypass RLS
  const serviceClient = createServiceRoleClient();

  // First try to find profile by auth_user_id
  const { data: profile } = await serviceClient
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('auth_user_id', user.id)
    .single();

  if (profile) {
    return profile as Profile;
  }

  // Fallback: try to find profile by email if not linked yet
  if (user.email) {
    const { data: profileByEmail } = await serviceClient
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('email', user.email)
      .single();

    if (profileByEmail) {
      // Try to link auth_user_id if not already set
      if (!profileByEmail.auth_user_id) {
        await serviceClient
          .from('profiles')
          .update({ auth_user_id: user.id })
          .eq('id', profileByEmail.id);

        // Return with updated auth_user_id
        return { ...profileByEmail, auth_user_id: user.id } as Profile;
      }

      return profileByEmail as Profile;
    }
  }

  return null;
}

/**
 * Check if user has full booking access (can do everything admin can in booking module).
 * Returns true if user is admin, manager, or supervisor.
 * Manager role has FULL booking access automatically - same as admin for booking module.
 */
export async function hasBookingAccess(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Profile | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _requiredPermissions?: string[]
): Promise<boolean> {
  // Admin always has access
  if (profile?.role === 'admin') return true;

  // Manager (Správce) has FULL booking access - same as admin for booking module
  if (profile?.role === 'manager') return true;

  if (!profile?.id) return false;

  // Check supervisor - single query via helper
  const isSupervisor = await checkIsSupervisor(profile.email);
  if (isSupervisor) return true;

  return false;
}

import type { PermissionCode } from '@/types/modules';

/**
 * Check if user has a specific permission.
 * Returns true if user is admin, supervisor, or has the permission granted.
 * Accepts optional isSupervisor flag to avoid re-checking when already known.
 */
export async function hasPermission(
  profile: Profile | null,
  permissionCode: PermissionCode,
  isSupervisor?: boolean
): Promise<boolean> {
  if (!profile?.id) {
    return false;
  }

  // Admin always has all permissions
  if (profile.role === 'admin') {
    return true;
  }

  // Check supervisor (use provided value or query)
  const supervisorStatus = isSupervisor ?? await checkIsSupervisor(profile.email);
  if (supervisorStatus) {
    return true;
  }

  // Check specific permission in database
  const serviceClient = createServiceRoleClient();
  const { data: permissionCheck } = await serviceClient
    .from('user_permissions')
    .select('id')
    .eq('user_id', profile.id)
    .eq('permission_code', permissionCode)
    .single();

  return !!permissionCheck;
}

/**
 * Batch check permissions - single query instead of N+1.
 * Returns the set of permission codes the user actually has.
 */
async function getGrantedPermissions(
  profile: Profile,
  permissionCodes: PermissionCode[]
): Promise<Set<string>> {
  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from('user_permissions')
    .select('permission_code')
    .eq('user_id', profile.id)
    .in('permission_code', permissionCodes);

  return new Set((data || []).map((row: { permission_code: string }) => row.permission_code));
}

/**
 * Check multiple permissions - returns true if user has ALL specified permissions.
 * Uses single batch query instead of N+1 sequential queries.
 */
export async function hasAllPermissions(
  profile: Profile | null,
  permissionCodes: PermissionCode[]
): Promise<boolean> {
  if (!profile?.id || permissionCodes.length === 0) return permissionCodes.length === 0;

  if (profile.role === 'admin') return true;

  const isSupervisor = await checkIsSupervisor(profile.email);
  if (isSupervisor) return true;

  const granted = await getGrantedPermissions(profile, permissionCodes);
  return permissionCodes.every(code => granted.has(code));
}

/**
 * Check multiple permissions - returns true if user has ANY of the specified permissions.
 * Uses single batch query instead of N+1 sequential queries.
 */
export async function hasAnyPermission(
  profile: Profile | null,
  permissionCodes: PermissionCode[]
): Promise<boolean> {
  if (!profile?.id || permissionCodes.length === 0) return false;

  if (profile.role === 'admin') return true;

  const isSupervisor = await checkIsSupervisor(profile.email);
  if (isSupervisor) return true;

  const granted = await getGrantedPermissions(profile, permissionCodes);
  return permissionCodes.some(code => granted.has(code));
}

/**
 * Combined auth context helper.
 * Replaces the repeated 3-step pattern: getUser() + getProfileWithFallback() + supervisorCheck
 * used in ~20 API routes.
 */
export async function getAuthContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, isSupervisor: false };

  const profile = await getProfileWithFallback(supabase, user);
  if (!profile) return { user, profile: null, isSupervisor: false };

  const isSupervisor = await checkIsSupervisor(profile.email);

  return { user, profile, isSupervisor };
}
