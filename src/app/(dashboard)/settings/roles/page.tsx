import { createClient, getAuthContext, hasPermission } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import RoleTypesManager from '@/components/settings/RoleTypesManager';

export default async function RoleSettingsPage() {
  const supabase = await createClient();

  const { user, profile, isSupervisor } = await getAuthContext(supabase);

  if (!user) {
    redirect('/login');
  }

  if (!profile) {
    notFound();
  }

  // Check permission to manage roles
  const canManageRoles = await hasPermission(profile, 'users_settings_manage_roles', isSupervisor);

  if (!canManageRoles) {
    notFound();
  }

  // Načtení role types
  const { data: roleTypes } = await supabase
    .from('role_types')
    .select('id, value, label, created_at')
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
