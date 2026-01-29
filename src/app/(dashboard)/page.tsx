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
  const isManager = profile?.role === 'manager';

  // Check if supervisor
  let isSupervisor = false;
  if (profile?.email) {
    const { data: supervisorCheck } = await supabase
      .from('supervisor_emails')
      .select('email')
      .ilike('email', profile.email)
      .single();
    isSupervisor = !!supervisorCheck;
  }

  // Manager (Správce) has FULL booking access - same as admin for booking module
  const canSeeAllEvents = isAdmin || isManager || isSupervisor;

  // For booking module, manager has same rights as admin
  const hasFullBookingAccess = isAdmin || isManager || isSupervisor;

  // Pass canSeeAllEvents calculated on server
  return (
    <EventsClientWrapper
      isAdmin={hasFullBookingAccess}
      userId={profile?.id || ''}
      canSeeAllEvents={canSeeAllEvents}
    />
  );
}
