import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {},
    }
  )
}

import type { Profile } from '@/types';

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

  console.log('[getProfileWithFallback] Looking up profile for user:', { id: user.id, email: user.email });

  // First try to find profile by auth_user_id
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  console.log('[getProfileWithFallback] auth_user_id lookup result:', {
    found: !!profile,
    role: profile?.role,
    error: profileError?.message
  });

  if (profile) {
    return profile as Profile;
  }

  // Fallback: try to find profile by email if not linked yet
  if (user.email) {
    const { data: profileByEmail, error: emailError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .single();

    console.log('[getProfileWithFallback] email lookup result:', {
      found: !!profileByEmail,
      role: profileByEmail?.role,
      error: emailError?.message
    });

    if (profileByEmail) {
      // Try to link auth_user_id if not already set
      if (!profileByEmail.auth_user_id) {
        console.log('[getProfileWithFallback] Linking auth_user_id to profile:', user.id, 'for email:', user.email);
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

  console.log('[getProfileWithFallback] No profile found for user');
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
  console.log('[hasBookingAccess] Checking access for profile:', {
    id: profile?.id,
    email: profile?.email,
    role: profile?.role,
  });

  // Admin always has access
  if (profile?.role === 'admin') {
    console.log('[hasBookingAccess] User is admin, granting access');
    return true;
  }

  // Manager (Správce) has FULL booking access - same as admin for booking module
  if (profile?.role === 'manager') {
    console.log('[hasBookingAccess] User is manager, granting access');
    return true;
  }

  if (!profile?.id) {
    console.log('[hasBookingAccess] No profile found, denying access');
    return false;
  }

  // Check supervisor - use service role client to bypass RLS
  if (profile.email) {
    const serviceClient = createServiceRoleClient();
    const { data: supervisorCheck } = await serviceClient
      .from('supervisor_emails')
      .select('email')
      .ilike('email', profile.email)
      .single();
    if (supervisorCheck) {
      console.log('[hasBookingAccess] User is supervisor, granting access');
      return true;
    }
  }

  console.log('[hasBookingAccess] No access granted, denying');
  return false;
}

import type { PermissionCode } from '@/types/modules';

/**
 * Check if user has a specific permission.
 * Returns true if user is admin, supervisor, or has the permission granted.
 */
export async function hasPermission(
  profile: Profile | null,
  permissionCode: PermissionCode
): Promise<boolean> {
  if (!profile?.id) {
    return false;
  }

  // Admin always has all permissions
  if (profile.role === 'admin') {
    return true;
  }

  // Check supervisor
  if (profile.email) {
    const serviceClient = createServiceRoleClient();
    const { data: supervisorCheck } = await serviceClient
      .from('supervisor_emails')
      .select('email')
      .ilike('email', profile.email)
      .single();
    if (supervisorCheck) {
      return true;
    }
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
 * Check multiple permissions - returns true if user has ALL specified permissions.
 */
export async function hasAllPermissions(
  profile: Profile | null,
  permissionCodes: PermissionCode[]
): Promise<boolean> {
  for (const code of permissionCodes) {
    if (!(await hasPermission(profile, code))) {
      return false;
    }
  }
  return true;
}

/**
 * Check multiple permissions - returns true if user has ANY of the specified permissions.
 */
export async function hasAnyPermission(
  profile: Profile | null,
  permissionCodes: PermissionCode[]
): Promise<boolean> {
  for (const code of permissionCodes) {
    if (await hasPermission(profile, code)) {
      return true;
    }
  }
  return false;
}
