import { createClient } from '@/lib/supabase/server';
import EventsWithSidebar from '@/components/events/EventsWithSidebar';

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

  // Načti profil pro kontrolu role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('auth_user_id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  let events;
  let technicians = [];

  if (isAdmin) {
    // Admin vidí všechny akce
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        positions (
          id,
          title,
          role_type,
          shift_start,
          shift_end,
          requirements,
          assignments (
            id,
            attendance_status,
            technician:profiles!assignments_technician_id_fkey(*)
          )
        )
      `)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(50);

    if (error) {
      console.error('[HomePage] Error fetching events:', error);
    }
    events = data;

    // Načti všechny techniky pro Excel view
    const { data: techData } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['technician', 'admin'])
      .eq('is_active', true)
      .order('full_name');

    technicians = techData || [];
  } else {
    // Technik vidí pouze akce, na které je přiřazen
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        positions (
          id,
          title,
          role_type,
          shift_start,
          shift_end,
          requirements,
          assignments (
            id,
            attendance_status,
            technician_id
          )
        )
      `)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(50);

    if (error) {
      console.error('[HomePage] Error fetching events:', error);
    }

    // Filtruj pouze akce kde má technik assignment
    events = data?.filter((event) =>
      event.positions?.some((position) =>
        position.assignments?.some((assignment) => assignment.technician_id === profile?.id)
      )
    );
  }

  return (
    <EventsWithSidebar
      events={events || []}
      isAdmin={isAdmin}
      userId={profile?.id || ''}
      allTechnicians={technicians}
    />
  );
}
