import { createClient, getProfileWithFallback } from '@/lib/supabase/server';
import EventsClientWrapper from '@/components/events/EventsClientWrapper';

// Disable SSR caching - let React Query handle it
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();

  // Zjisti aktuálního uživatele a jeho roli
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="w-full">
        <div className="text-center py-12">
          <p className="text-slate-600">Přihlaste se pro zobrazení akcí</p>
        </div>
      </div>
    );
  }

  // Načti profil s fallbackem na email lookup
  const profile = await getProfileWithFallback(supabase, user);

  const isAdmin = profile?.role === 'admin';

  // Pass minimal data - let client handle fetching with React Query
  return (
    <EventsClientWrapper
      isAdmin={isAdmin}
      userId={profile?.id || ''}
    />
  );
}
