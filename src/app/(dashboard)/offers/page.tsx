import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OffersMain from '@/components/offers/OffersMain';

export const dynamic = 'force-dynamic';

export default async function OffersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check offers access - admins or users with module access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    redirect('/');
  }

  // Check if user has offers module access
  let hasAccess = profile.role === 'admin';

  if (!hasAccess) {
    const { data: moduleAccess } = await supabase
      .from('user_module_access')
      .select(`
        id,
        module:app_modules!inner(code)
      `)
      .eq('user_id', profile.id)
      .eq('module.code', 'offers')
      .maybeSingle();

    hasAccess = !!moduleAccess;
  }

  if (!hasAccess) {
    redirect('/');
  }

  return (
    <OffersMain isAdmin={profile.role === 'admin'} />
  );
}
