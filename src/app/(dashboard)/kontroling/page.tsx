import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReportingDashboard from '@/components/reporting/ReportingDashboard';

export const dynamic = 'force-dynamic';

export default async function KontrolingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check supervisor or admin access
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, email')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    redirect('/');
  }

  let isSupervisor = profile.role === 'admin';
  if (!isSupervisor) {
    const { data: supRow } = await supabase
      .from('supervisor_emails')
      .select('email')
      .ilike('email', profile.email)
      .maybeSingle();
    isSupervisor = !!supRow;
  }

  if (!isSupervisor) {
    redirect('/');
  }

  return <ReportingDashboard />;
}
