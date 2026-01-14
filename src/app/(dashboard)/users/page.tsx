import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CreateUserDialog from '@/components/users/CreateUserDialog';
import EditUserDialog from '@/components/users/EditUserDialog';

export default async function UsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Načti profil pro kontrolu role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    redirect('/');
  }

  // Načti všechny uživatele
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Uživatelé</h1>
          <p className="text-slate-600 mt-1">Správa uživatelských účtů a oprávnění</p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users?.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{user.full_name}</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">{user.email}</p>
                </div>
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role === 'admin' ? 'Admin' : 'Technik'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {user.phone && (
                <div className="text-sm">
                  <span className="text-slate-500">Telefon:</span>{' '}
                  <span className="text-slate-900">{user.phone}</span>
                </div>
              )}
              {user.specialization && user.specialization.length > 0 && (
                <div className="text-sm">
                  <span className="text-slate-500">Specializace:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.specialization.map((spec: string) => (
                      <Badge key={spec} variant="outline" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2 flex items-center justify-between">
                <Badge variant={user.is_active ? 'default' : 'destructive'} className="text-xs">
                  {user.is_active ? 'Aktivní' : 'Neaktivní'}
                </Badge>
                <EditUserDialog user={user} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!users || users.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600">Žádní uživatelé v systému</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
