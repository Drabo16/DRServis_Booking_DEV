import { createClient, getAuthContext, hasPermission } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase } from 'lucide-react';

export default async function SettingsPage() {
  const supabase = await createClient();

  const { user, profile, isSupervisor } = await getAuthContext(supabase);

  if (!user) {
    redirect('/login');
  }

  if (!profile) {
    redirect('/login');
  }

  // Check permission - allow admins OR users with users_settings_manage_roles permission
  const canManageRoles = await hasPermission(profile, 'users_settings_manage_roles', isSupervisor);

  if (!canManageRoles) {
    redirect('/');
  }

  // Parallel fetch: all statistics + last sync
  const [
    { count: eventsCount },
    { count: techniciansCount },
    { count: positionsCount },
    { count: assignmentsCount },
    { data: lastSync },
  ] = await Promise.all([
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('positions').select('*', { count: 'exact', head: true }),
    supabase.from('assignments').select('*', { count: 'exact', head: true }),
    supabase.from('sync_logs').select('status, sync_type, events_processed, errors_count, created_at').order('created_at', { ascending: false }).limit(1).single(),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Nastavení</h1>
        <p className="text-slate-600">
          Správa systému a přehled statistik
        </p>
      </div>

      {/* Konfigurace */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Konfigurace</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/settings/roles">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Typy rolí</CardTitle>
                    <CardDescription className="text-sm">Spravujte typy rolí pro pozice</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>

      {/* Statistiky */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Statistiky</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Celkem akcí
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {eventsCount ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Aktivní technici
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {techniciansCount ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Celkem pozic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {positionsCount ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Přiřazení
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {assignmentsCount ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Poslední synchronizace */}
      <Card>
        <CardHeader>
          <CardTitle>Poslední synchronizace</CardTitle>
          <CardDescription>
            Informace o poslední synchronizaci s Google Calendar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lastSync ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Status:</span>
                <Badge
                  variant={
                    lastSync.status === 'success'
                      ? 'default'
                      : lastSync.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {lastSync.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Typ:</span>
                <span className="font-medium">{lastSync.sync_type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Zpracováno:</span>
                <span className="font-medium">{lastSync.events_processed} akcí</span>
              </div>
              {lastSync.errors_count > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Chyby:</span>
                  <span className="font-medium text-red-600">
                    {lastSync.errors_count}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Čas:</span>
                <span className="font-medium">
                  {new Date(lastSync.created_at).toLocaleString('cs-CZ')}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 italic">
              Zatím neproběhla žádná synchronizace
            </p>
          )}
        </CardContent>
      </Card>

      {/* Informace o systému - pouze pro supervisory */}
      {isSupervisor && (
        <Card>
          <CardHeader>
            <CardTitle>Informace o systému</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-slate-600">Verze aplikace</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-slate-600">Databáze</span>
              <span className="font-medium">Supabase PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-slate-600">Framework</span>
              <span className="font-medium">Next.js 14</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">Tvůj email</span>
              <span className="font-medium">{user.email}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Poznámka */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            💡 <strong>Tip:</strong> Pro synchronizaci nových akcí z Google Calendar
            použijte tlačítko "Synchronizovat" v hlavičce aplikace.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
