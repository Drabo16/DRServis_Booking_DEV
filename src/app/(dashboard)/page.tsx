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

  // Check user permissions directly from database
  let canSeeAllEvents = isAdmin || isSupervisor;

  if (!canSeeAllEvents && profile?.id) {
    // Check if user has any booking permission that allows seeing all events
    const { data: userPermissions } = await supabase
      .from('user_permissions')
      .select('permission_code')
      .eq('user_id', profile.id)
      .in('permission_code', ['booking_view', 'booking_manage_events', 'booking_manage_positions', 'booking_invite']);

    canSeeAllEvents = !!(userPermissions && userPermissions.length > 0);
  }

  // Pass canSeeAllEvents calculated on server
  return (
    <EventsClientWrapper
      isAdmin={isAdmin}
      userId={profile?.id || ''}
      canSeeAllEvents={canSeeAllEvents}
    />
  );
}
