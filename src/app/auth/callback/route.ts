import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    // Create a response that we'll add cookies to
    let response = NextResponse.redirect(`${requestUrl.origin}/`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Exchange code for session
    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      console.error('[OAuth Callback] Auth error:', authError);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed&message=${encodeURIComponent(authError.message)}`);
    }

    // Handle case where data might be stringified (Vercel edge case)
    let sessionData = data as { user?: { email?: string; id?: string }; [key: string]: unknown };
    if (typeof data === 'string') {
      try {
        sessionData = JSON.parse(data as string);
      } catch (e) {
        console.error('[OAuth Callback] Failed to parse session data:', e);
        return NextResponse.redirect(`${requestUrl.origin}/login?error=parse_failed`);
      }
    }

    const user = sessionData?.user;

    if (!user || !user.email) {
      console.error('[OAuth Callback] No user or email in session');
      return NextResponse.redirect(`${requestUrl.origin}/login?error=no_user`);
    }

    // Use service role client to bypass RLS for profile lookup and linking
    const serviceClient = createServiceRoleClient();

    // Check if user's email exists in profiles table (using service role to bypass RLS)
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, email, is_active, auth_user_id')
      .eq('email', user.email)
      .single();

    if (profileError || !profile) {
      console.warn('[OAuth Callback] Profile not found for email:', user.email, profileError);
      // User authenticated via Google but not in our profiles DB
      return NextResponse.redirect(`${requestUrl.origin}/auth/unauthorized`);
    }

    if (!profile.is_active) {
      console.warn('[OAuth Callback] User account is inactive:', user.email);
      return NextResponse.redirect(`${requestUrl.origin}/auth/unauthorized?reason=inactive`);
    }

    // Link auth.users.id to profile if not already linked (using service role)
    if (!profile.auth_user_id) {
      const { error: updateError } = await serviceClient
        .from('profiles')
        .update({ auth_user_id: user.id })
        .eq('id', profile.id);

      if (updateError) {
        console.error('[OAuth Callback] Failed to link auth_user_id:', updateError);
      }
    }

    // Profile exists and is active → redirect to dashboard
    // Return the response with session cookies attached
    return response;
  }

  // No code provided
  console.error('[OAuth Callback] No code in URL');
  return NextResponse.redirect(`${requestUrl.origin}/login?error=no_code`);
}
