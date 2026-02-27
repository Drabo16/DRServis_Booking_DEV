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

  // OPTIMIZED: Single query with join to check both profile and access
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      role,
      id,
      module_access:user_module_access!user_module_access_user_id_fkey(
        module_code
      )
    `)
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    redirect('/');
  }

  // Check access: admin OR has 'offers' module access
  const hasAccess = profile.role === 'admin' ||
    (profile.module_access as Array<{ module_code: string }> | null)?.some((ma) => ma.module_code === 'offers');

  if (!hasAccess) {
    redirect('/');
  }

  return (
    <OffersMain isAdmin={profile.role === 'admin'} />
  );
}
