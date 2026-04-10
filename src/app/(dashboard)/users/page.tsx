'use client';

import { useState } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useMyPermissions, canPerformAction } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import CreateUserDialog from '@/components/users/CreateUserDialog';
import EditUserDialog from '@/components/users/EditUserDialog';
import ImportUsersDialog from '@/components/users/ImportUsersDialog';
import { Loader2, Crown, UserCog, User, ShieldAlert, Car, Search } from 'lucide-react';
import { ROLE_LABELS } from '@/types/modules';
import { useRoleTypes } from '@/hooks/useRoleTypes';
import { getRoleTypeLabel } from '@/lib/utils';

export default function UsersPage() {
  const { data: users = [], isLoading, error } = useUsers();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const { data: roleTypes = [] } = useRoleTypes();
  const [search, setSearch] = useState('');

  // Check permission to manage users
  const canManageUsers = canPerformAction(permissions, 'users_settings_manage_users');

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600">Načítání uživatelů...</p>
        </div>
      </div>
    );
  }

  // Show access denied if user doesn't have permission
  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Přístup odepřen</h2>
          <p className="text-slate-600">Nemáte oprávnění spravovat uživatele.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Chyba při načítání uživatelů</p>
          <p className="text-sm text-slate-500">{error.message}</p>
        </div>
      </div>
    );
  }

  const filteredUsers = search.trim()
    ? users.filter(u => {
        const q = search.toLowerCase();
        const specLabels = u.specialization?.map((s: string) => getRoleTypeLabel(s, roleTypes).toLowerCase()).join(' ') ?? '';
        const roleLabel = (ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role).toLowerCase();
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.company?.toLowerCase().includes(q) ?? false) ||
          roleLabel.includes(q) ||
          specLabels.includes(q) ||
          (u.driver_license?.toLowerCase().includes(q) ?? false) ||
          (u.rank != null && `rank ${u.rank}`.includes(q))
        );
      })
    : users;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Uživatelé</h1>
          <p className="text-slate-600 mt-1">Správa uživatelských účtů a oprávnění</p>
        </div>
        <div className="flex gap-2">
          {(permissions?.is_admin || permissions?.is_supervisor) && (
            <ImportUsersDialog />
          )}
          <CreateUserDialog />
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Hledat (jméno, email, firma, pozice, rank...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{user.full_name}</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">{user.email}</p>
                </div>
                <Badge
                  variant={user.role === 'admin' ? 'default' : 'secondary'}
                  className={`flex items-center gap-1 ${
                    user.role === 'admin' ? 'bg-amber-500' :
                    user.role === 'manager' ? 'bg-blue-500 text-white' : ''
                  }`}
                >
                  {user.role === 'admin' && <Crown className="w-3 h-3" />}
                  {user.role === 'manager' && <UserCog className="w-3 h-3" />}
                  {user.role === 'technician' && <User className="w-3 h-3" />}
                  {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
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
              {!user.is_drservis && user.company && (
                <div className="text-sm">
                  <span className="text-slate-500">Firma:</span>{' '}
                  <span className="text-slate-900">{user.company}</span>
                </div>
              )}
              {user.specialization && user.specialization.length > 0 && (
                <div className="text-sm">
                  <span className="text-slate-500">Pozice:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.specialization.map((spec: string) => (
                      <Badge key={spec} variant="outline" className="text-xs">
                        {getRoleTypeLabel(spec, roleTypes)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(user.driver_license || user.rank) && (
                <div className="text-sm flex items-center gap-2">
                  {user.rank && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      user.rank === 1 ? 'bg-green-100 text-green-700' :
                      user.rank === 2 ? 'bg-blue-100 text-blue-700' :
                      user.rank === 3 ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      Rank {user.rank}
                    </span>
                  )}
                  {user.driver_license && (
                    <span className="text-slate-500 flex items-center gap-1">
                      <Car className="w-3 h-3" />{user.driver_license}
                    </span>
                  )}
                </div>
              )}
              {user.note && (
                <div className="text-sm">
                  <span className="text-slate-500">Poznámka:</span>{' '}
                  <span className="text-slate-900 italic">{user.note}</span>
                </div>
              )}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex gap-1">
                  <Badge variant={user.is_active ? 'default' : 'destructive'} className="text-xs">
                    {user.is_active ? 'Aktivní' : 'Neaktivní'}
                  </Badge>
                  {user.is_drservis === false && (
                    <Badge variant="outline" className="text-xs">
                      Externí
                    </Badge>
                  )}
                </div>
                <EditUserDialog user={user} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600">
              {search.trim() ? 'Žádní uživatelé neodpovídají hledání' : 'Žádní uživatelé v systému'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
