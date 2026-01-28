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
 * This handles the case where auth_user_id is not yet linked to the profile.
 * Also attempts to link auth_user_id if profile is found by email but not linked.
 */
export async function getProfileWithFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null | undefined }
): Promise<Profile | null> {
  // First try to find profile by auth_user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (profile) {
    return profile as Profile;
  }

  // Fallback: try to find profile by email if not linked yet
  if (user.email) {
    const { data: profileByEmail } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .single();

    if (profileByEmail) {
      // Try to link auth_user_id if not already set
      if (!profileByEmail.auth_user_id) {
        console.log('[getProfileWithFallback] Linking auth_user_id to profile:', user.id, 'for email:', user.email);
        await supabase
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
