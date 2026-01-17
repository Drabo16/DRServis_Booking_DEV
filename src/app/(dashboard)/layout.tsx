import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { SidebarProvider } from '@/contexts/SidebarContext';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Načti profil uživatele (linked by auth_user_id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-slate-50">
        <Sidebar user={user} profile={profile} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header user={user} profile={profile} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
