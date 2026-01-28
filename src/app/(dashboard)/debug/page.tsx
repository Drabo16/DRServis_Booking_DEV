import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DebugPage() {
  const supabase = await createClient();

  // Test 1: Zkontroluj připojení k Supabase
  const { data: { user } } = await supabase.auth.getUser();

  // Test 2: Zkontroluj profil - use auth_user_id not id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user?.id || '')
    .single();

  // DEBUG: Also try to find profile by email (to check if it exists but isn't linked)
  const { data: profileByEmail, error: profileByEmailError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', user?.email || '')
    .single();

  // Use profile by email as fallback for the rest of the debug info
  const effectiveProfile = profile || profileByEmail;

  // Get user permissions from database
  const { data: userPermissions } = await supabase
    .from('user_permissions')
    .select('permission_code, granted_at')
    .eq('user_id', effectiveProfile?.id || '');

  // Get user module access
  const { data: userModules } = await supabase
    .from('user_module_access')
    .select('module_code, granted_at')
    .eq('user_id', effectiveProfile?.id || '');

  // Check if supervisor
  const { data: supervisorCheck } = await supabase
    .from('supervisor_emails')
    .select('email')
    .ilike('email', effectiveProfile?.email || '')
    .single();

  // DEBUG: Get permission_types table content (this is what /api/permissions/me uses)
  const { data: permissionTypes, error: permissionTypesError } = await supabase
    .from('permission_types')
    .select('*')
    .order('module_code')
    .order('sort_order');

  // Build "API simulation" - what /api/permissions/me would return
  const grantedCodes = new Set(userPermissions?.map(p => p.permission_code) || []);
  const isSupervisor = !!supervisorCheck;
  const isAdmin = effectiveProfile?.role === 'admin';

  const simulatedApiPermissions = (permissionTypes || []).map(p => ({
    code: p.code,
    name: p.name,
    module_code: p.module_code,
    has_permission: isAdmin || isSupervisor || grantedCodes.has(p.code),
  }));

  // Test 3: Načti VŠECHNY eventy (ne jen budoucí)
  const { data: allEvents, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(10);

  // Test 4: Počet eventů
  const { count: totalEventsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });

  // Test 5: Načti sync logs
  const { data: syncLogs, error: syncLogsError } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // Test 6: Environment variables (pouze kontrola existence)
  const envCheck = {
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    GOOGLE_CALENDAR_ID: !!process.env.GOOGLE_CALENDAR_ID,
    GOOGLE_DRIVE_PARENT_FOLDER_ID: !!process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">🔍 Debug stránka</h1>
        <p className="text-slate-600">
          Diagnostika problémů s aplikací
        </p>
      </div>

      {/* User info */}
      <Card>
        <CardHeader>
          <CardTitle>👤 Přihlášený uživatel</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify({ id: user?.id, email: user?.email }, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>👔 Profil (lookup by auth_user_id)</CardTitle>
        </CardHeader>
        <CardContent>
          {profileError ? (
            <div className="text-red-600">
              <strong>Chyba:</strong> {profileError.message}
            </div>
          ) : (
            <pre className="bg-slate-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(profile, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Profile by Email - DEBUG */}
      <Card className="border-orange-300 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-700">🔶 DEBUG: Profil (lookup by email: {user?.email})</CardTitle>
        </CardHeader>
        <CardContent>
          {profileByEmailError ? (
            <div className="space-y-2">
              <div className="text-red-600">
                <strong>Chyba:</strong> {profileByEmailError.message}
              </div>
              {profileByEmailError.message.includes('JSON object') && (
                <div className="p-3 bg-red-100 border border-red-300 rounded text-red-800 text-sm">
                  <strong>⚠️ PROBLÉM:</strong> Pro tento email neexistuje profil v databázi!<br />
                  Uživatel musí být nejprve vytvořen adminem v sekci Uživatelé.
                </div>
              )}
            </div>
          ) : profileByEmail ? (
            <div className="space-y-3">
              <pre className="bg-white p-4 rounded text-sm overflow-auto border">
                {JSON.stringify(profileByEmail, null, 2)}
              </pre>
              {!profileByEmail.auth_user_id && (
                <div className="p-3 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 text-sm">
                  <strong>⚠️ PROBLÉM:</strong> Profil existuje, ale <code>auth_user_id</code> není nastaven!<br />
                  OAuth callback měl provést linking, ale selhal. Nutno opravit manuálně v Supabase:<br />
                  <code className="block mt-2 p-2 bg-yellow-200 rounded">
                    UPDATE profiles SET auth_user_id = &apos;{user?.id}&apos; WHERE email = &apos;{user?.email}&apos;;
                  </code>
                </div>
              )}
              {profileByEmail.auth_user_id && profileByEmail.auth_user_id !== user?.id && (
                <div className="p-3 bg-red-100 border border-red-300 rounded text-red-800 text-sm">
                  <strong>⚠️ KONFLIKT:</strong> Profil má jiný auth_user_id!<br />
                  V profilu: {profileByEmail.auth_user_id}<br />
                  Aktuální user: {user?.id}
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-600">Žádný profil nenalezen</div>
          )}
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>🔐 Vaše oprávnění</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="font-medium mb-2">Role: <span className="text-blue-600">{effectiveProfile?.role || 'N/A'}</span></div>
              <div className="font-medium mb-2">
                Supervisor: {supervisorCheck ? <span className="text-green-600">ANO</span> : <span className="text-slate-500">NE</span>}
              </div>
              <div className="font-medium mb-2">
                Admin: {effectiveProfile?.role === 'admin' ? <span className="text-green-600">ANO</span> : <span className="text-slate-500">NE</span>}
              </div>
            </div>

            <div>
              <div className="font-medium mb-2">Moduly ({userModules?.length || 0}):</div>
              {userModules && userModules.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {userModules.map((m) => (
                    <span key={m.module_code} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {m.module_code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">Žádné přidělené moduly</p>
              )}
            </div>

            <div>
              <div className="font-medium mb-2">Oprávnění ({userPermissions?.length || 0}):</div>
              {userPermissions && userPermissions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {userPermissions.map((p) => (
                    <span key={p.permission_code} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      {p.permission_code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-red-500 font-medium">⚠️ Žádná oprávnění! Jako admin přidělte oprávnění v sekci Uživatelé.</p>
              )}
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
              <p className="text-sm text-amber-800">
                <strong>Pro zobrazení všech akcí potřebujete:</strong><br />
                • Být admin NEBO<br />
                • Být supervisor NEBO<br />
                • Mít oprávnění: <code className="bg-amber-100 px-1">booking_view</code>, <code className="bg-amber-100 px-1">booking_manage_events</code>, <code className="bg-amber-100 px-1">booking_manage_positions</code>, nebo <code className="bg-amber-100 px-1">booking_invite</code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Simulation - what /api/permissions/me returns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">🔴 DEBUG: Simulace /api/permissions/me</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3 bg-slate-100 rounded">
              <div className="font-medium mb-2">permission_types tabulka ({permissionTypes?.length || 0} záznamů):</div>
              {permissionTypesError ? (
                <div className="text-red-600">Chyba: {permissionTypesError.message}</div>
              ) : permissionTypes && permissionTypes.length > 0 ? (
                <div className="text-xs font-mono max-h-40 overflow-auto">
                  {permissionTypes.map((pt) => (
                    <div key={pt.code} className="py-1 border-b border-slate-200">
                      {pt.code} | {pt.name} | {pt.module_code}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-red-600 font-bold">⚠️ TABULKA JE PRÁZDNÁ! To je problém - API nemá co vrátit.</div>
              )}
            </div>

            <div className="p-3 bg-slate-100 rounded">
              <div className="font-medium mb-2">grantedCodes Set (vaše uložená oprávnění):</div>
              <div className="text-xs font-mono">
                {Array.from(grantedCodes).length > 0
                  ? Array.from(grantedCodes).join(', ')
                  : '(prázdné)'}
              </div>
            </div>

            <div className="p-3 bg-slate-100 rounded">
              <div className="font-medium mb-2">Simulovaná API odpověď (has_permission = true):</div>
              <div className="flex flex-wrap gap-2">
                {simulatedApiPermissions.filter(p => p.has_permission).length > 0 ? (
                  simulatedApiPermissions.filter(p => p.has_permission).map((p) => (
                    <span key={p.code} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      {p.code}
                    </span>
                  ))
                ) : (
                  <span className="text-red-600">Žádná oprávnění by nebyla vrácena jako true!</span>
                )}
              </div>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="font-medium text-yellow-800 mb-2">Výsledek pro canSeeAllEvents:</div>
              <div className="text-sm">
                <div>isAdmin: <span className={isAdmin ? 'text-green-600' : 'text-red-600'}>{isAdmin ? 'ANO' : 'NE'}</span></div>
                <div>isSupervisor: <span className={isSupervisor ? 'text-green-600' : 'text-red-600'}>{isSupervisor ? 'ANO' : 'NE'}</span></div>
                <div>has booking_view: <span className={simulatedApiPermissions.find(p => p.code === 'booking_view')?.has_permission ? 'text-green-600' : 'text-red-600'}>
                  {simulatedApiPermissions.find(p => p.code === 'booking_view')?.has_permission ? 'ANO' : 'NE'}
                </span></div>
                <div>has booking_manage_events: <span className={simulatedApiPermissions.find(p => p.code === 'booking_manage_events')?.has_permission ? 'text-green-600' : 'text-red-600'}>
                  {simulatedApiPermissions.find(p => p.code === 'booking_manage_events')?.has_permission ? 'ANO' : 'NE'}
                </span></div>
                <div>has booking_manage_positions: <span className={simulatedApiPermissions.find(p => p.code === 'booking_manage_positions')?.has_permission ? 'text-green-600' : 'text-red-600'}>
                  {simulatedApiPermissions.find(p => p.code === 'booking_manage_positions')?.has_permission ? 'ANO' : 'NE'}
                </span></div>
                <div>has booking_invite: <span className={simulatedApiPermissions.find(p => p.code === 'booking_invite')?.has_permission ? 'text-green-600' : 'text-red-600'}>
                  {simulatedApiPermissions.find(p => p.code === 'booking_invite')?.has_permission ? 'ANO' : 'NE'}
                </span></div>
                <div className="mt-2 font-bold">
                  canSeeAllEvents: <span className={
                    isAdmin || isSupervisor ||
                    simulatedApiPermissions.find(p => p.code === 'booking_view')?.has_permission ||
                    simulatedApiPermissions.find(p => p.code === 'booking_manage_events')?.has_permission ||
                    simulatedApiPermissions.find(p => p.code === 'booking_manage_positions')?.has_permission ||
                    simulatedApiPermissions.find(p => p.code === 'booking_invite')?.has_permission
                    ? 'text-green-600' : 'text-red-600'
                  }>
                    {isAdmin || isSupervisor ||
                    simulatedApiPermissions.find(p => p.code === 'booking_view')?.has_permission ||
                    simulatedApiPermissions.find(p => p.code === 'booking_manage_events')?.has_permission ||
                    simulatedApiPermissions.find(p => p.code === 'booking_manage_positions')?.has_permission ||
                    simulatedApiPermissions.find(p => p.code === 'booking_invite')?.has_permission
                    ? 'ANO - MĚLI BYSTE VIDĚT VŠECHNY AKCE' : 'NE - VIDÍTE JEN SVÉ AKCE'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment variables */}
      <Card>
        <CardHeader>
          <CardTitle>🔐 Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(envCheck).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-mono text-sm">{key}</span>
                <span className="text-slate-500">{value ? '✓ Nastaveno' : '✗ Chybí'}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Events count */}
      <Card>
        <CardHeader>
          <CardTitle>📅 Počet akcí v databázi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-slate-900">
            {totalEventsCount ?? 0}
          </div>
          <p className="text-slate-600 mt-2">
            {totalEventsCount === 0 && 'Žádné akce v databázi. Klikni na "Synchronizovat" v hlavičce.'}
          </p>
        </CardContent>
      </Card>

      {/* Recent events */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Posledních 10 akcí</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsError ? (
            <div className="text-red-600">
              <strong>Chyba:</strong> {eventsError.message}
            </div>
          ) : allEvents && allEvents.length > 0 ? (
            <div className="space-y-2">
              {allEvents.map((event) => (
                <div key={event.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-slate-50">
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm text-slate-600">
                    {new Date(event.start_time).toLocaleString('cs-CZ')}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    Google ID: {event.google_event_id}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 italic">Žádné akce</p>
          )}
        </CardContent>
      </Card>

      {/* Sync logs */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Poslední synchronizace</CardTitle>
        </CardHeader>
        <CardContent>
          {syncLogsError ? (
            <div className="text-red-600">
              <strong>Chyba:</strong> {syncLogsError.message}
            </div>
          ) : syncLogs && syncLogs.length > 0 ? (
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div key={log.id} className="border rounded p-3 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{log.sync_type}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      log.status === 'success' ? 'bg-green-100 text-green-800' :
                      log.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <div>Zpracováno: {log.events_processed}</div>
                    <div>Chyby: {log.errors_count}</div>
                    <div className="text-xs">
                      {new Date(log.created_at).toLocaleString('cs-CZ')}
                    </div>
                  </div>
                  {log.error_details && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-600 cursor-pointer">
                        Detaily chyb
                      </summary>
                      <pre className="mt-2 text-xs bg-red-50 p-2 rounded overflow-auto">
                        {JSON.stringify(log.error_details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 italic">Žádné synchronizace zatím neproběhly</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
