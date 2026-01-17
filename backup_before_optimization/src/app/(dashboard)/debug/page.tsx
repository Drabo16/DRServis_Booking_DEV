import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DebugPage() {
  const supabase = await createClient();

  // Test 1: Zkontroluj připojení k Supabase
  const { data: { user } } = await supabase.auth.getUser();

  // Test 2: Zkontroluj profil
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id || '')
    .single();

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
          <CardTitle>👔 Profil</CardTitle>
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
