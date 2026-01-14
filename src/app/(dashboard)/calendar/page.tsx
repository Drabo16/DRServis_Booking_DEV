import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CalendarView from '@/components/calendar/CalendarView';

export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Načti všechny akce pro kalendář
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('start_time', { ascending: true });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Kalendář akcí</h1>
        <p className="text-slate-600 mt-1">Přehled všech nadcházejících akcí</p>
      </div>

      <CalendarView events={events || []} />
    </div>
  );
}
