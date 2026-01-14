import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import RoleTypesManager from '@/components/settings/RoleTypesManager';

export default async function RoleSettingsPage() {
  const supabase = await createClient();

  // Kontrola autentizace
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Kontrola admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    notFound();
  }

  // Načtení role types
  const { data: roleTypes } = await supabase
    .from('role_types')
    .select('*')
    .order('label');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Správa typů rolí</h1>
        <p className="text-slate-600 mt-1">
          Spravujte typy rolí pro pozice na akcích
        </p>
      </div>

      <RoleTypesManager initialRoleTypes={roleTypes || []} />
    </div>
  );
}
