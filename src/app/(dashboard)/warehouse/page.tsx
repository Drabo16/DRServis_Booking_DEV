import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import WarehouseMain from '@/components/warehouse/WarehouseMain';

export const dynamic = 'force-dynamic';

export default async function WarehousePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check warehouse access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, has_warehouse_access, id')
    .eq('auth_user_id', user.id)
    .single();

  const hasAccess = profile?.role === 'admin' || profile?.has_warehouse_access === true;

  if (!hasAccess) {
    redirect('/');
  }

  return (
    <WarehouseMain
      isAdmin={profile?.role === 'admin'}
      userId={profile?.id || ''}
    />
  );
}
