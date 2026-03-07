import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ClientsPage from '@/components/clients/ClientsPage';

export const dynamic = 'force-dynamic';

export default async function ClientsRoute() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

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

  const hasAccess = profile.role === 'admin' ||
    (profile.module_access as Array<{ module_code: string }> | null)?.some((ma) => ma.module_code === 'clients');

  if (!hasAccess) {
    redirect('/');
  }

  return (
    <ClientsPage isAdmin={profile.role === 'admin'} />
  );
}
