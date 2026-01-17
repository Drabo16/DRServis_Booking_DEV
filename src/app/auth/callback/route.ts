import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();

    // Exchange code for session
    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    console.log('[OAuth Callback] Raw data type:', typeof data);

    if (authError) {
      console.error('[OAuth Callback] Auth error:', authError);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
    }

    // Handle case where data might be stringified (Vercel edge case)
    let sessionData: any = data;
    if (typeof data === 'string') {
      console.log('[OAuth Callback] Data is string, parsing JSON...');
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

    console.log('[OAuth Callback] User authenticated:', user.email);

    // Use service role client to bypass RLS for profile lookup and linking
    const serviceClient = createServiceRoleClient();

    // Check if user's email exists in profiles table (using service role to bypass RLS)
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, email, is_active, auth_user_id')
      .eq('email', user.email)
      .single();

    console.log('[OAuth Callback] Profile lookup result:', { profile, profileError });

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
      console.log('[OAuth Callback] Linking auth_user_id to profile:', user.id);
      const { error: updateError } = await serviceClient
        .from('profiles')
        .update({ auth_user_id: user.id })
        .eq('id', profile.id);

      if (updateError) {
        console.error('[OAuth Callback] Failed to link auth_user_id:', updateError);
      } else {
        console.log('[OAuth Callback] Successfully linked auth_user_id');
      }
    }

    console.log('[OAuth Callback] Profile found, redirecting to dashboard');
    // Profile exists and is active → redirect to dashboard
    return NextResponse.redirect(`${requestUrl.origin}/`);
  }

  // No code provided
  console.error('[OAuth Callback] No code in URL');
  return NextResponse.redirect(`${requestUrl.origin}/login?error=no_code`);
}
