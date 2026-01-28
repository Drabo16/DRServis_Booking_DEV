'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Pencil, Package, Calendar, FileText, Loader2, ChevronDown, Shield, Check, Crown, UserCog, User } from 'lucide-react';
import { ROLE_TYPES } from '@/lib/constants';
import {
  Profile,
  UserRole,
  ModuleCode,
  PermissionCode,
  PERMISSION_LABELS,
  PERMISSIONS_BY_MODULE,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_PRESETS,
} from '@/types';
import { useUserPermissions, useUpdateUserPermissions, useMyPermissions } from '@/hooks/usePermissions';

const MODULE_NAMES: Record<ModuleCode, string> = {
  booking: 'Booking',
  warehouse: 'Sklad',
  offers: 'Nabídky',
};

const MODULE_ICONS: Record<ModuleCode, React.ReactNode> = {
  booking: <Calendar className="w-4 h-4" />,
  warehouse: <Package className="w-4 h-4" />,
  offers: <FileText className="w-4 h-4" />,
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <Crown className="w-4 h-4" />,
  manager: <UserCog className="w-4 h-4" />,
  technician: <User className="w-4 h-4" />,
};

interface EditUserDialogProps {
  user: Profile;
}

export default function EditUserDialog({ user }: EditUserDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    phone: user.phone || '',
    role: user.role as UserRole,
    specialization: user.specialization || [],
    is_active: user.is_active,
  });

  // Current user permissions (to check if supervisor)
  const { data: myPermissions } = useMyPermissions();
  const isSupervisor = myPermissions?.is_supervisor ?? false;
  const isMyAdmin = myPermissions?.is_admin ?? false;

  // Target user permissions
  const { data: userPermissions, refetch: refetchPermissions } = useUserPermissions(open ? user.id : null);
  const updatePermissions = useUpdateUserPermissions();

  // Local state for permissions and modules
  const [localModules, setLocalModules] = useState<Set<ModuleCode>>(new Set());
  const [localPermissions, setLocalPermissions] = useState<Set<PermissionCode>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<ModuleCode>>(new Set(['booking']));
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Initialize local state from fetched data
  useEffect(() => {
    if (userPermissions) {
      const modules = new Set<ModuleCode>();
      const permissions = new Set<PermissionCode>();

      userPermissions.modules.forEach((m) => {
        if (m.has_access) modules.add(m.code as ModuleCode);
      });
      userPermissions.permissions.forEach((p) => {
        if (p.has_permission) permissions.add(p.code as PermissionCode);
      });

      setLocalModules(modules);
      setLocalPermissions(permissions);
    }
  }, [userPermissions]);

  // Refetch when dialog opens
  useEffect(() => {
    if (open) {
      refetchPermissions();
      setFormData({
        full_name: user.full_name,
        phone: user.phone || '',
        role: user.role as UserRole,
        specialization: user.specialization || [],
        is_active: user.is_active,
      });
    }
  }, [open, refetchPermissions, user]);

  // Handle role change - apply preset
  const handleRoleChange = (newRole: UserRole) => {
    setFormData({ ...formData, role: newRole });

    // Apply preset for non-admin roles
    if (newRole !== 'admin') {
      const preset = ROLE_PRESETS[newRole];
      if (preset) {
        setLocalModules(new Set(preset.modules));
        setLocalPermissions(new Set(preset.permissions));
      }
    }
  };

  const handleModuleToggle = (moduleCode: ModuleCode) => {
    setLocalModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleCode)) {
        next.delete(moduleCode);
        // Also remove all permissions for this module
        setLocalPermissions((prevPerms) => {
          const nextPerms = new Set(prevPerms);
          PERMISSIONS_BY_MODULE[moduleCode].forEach((p) => nextPerms.delete(p));
          return nextPerms;
        });
      } else {
        next.add(moduleCode);
        // Add view permission by default
        const viewPerm = PERMISSIONS_BY_MODULE[moduleCode].find(p => p.includes('_view'));
        if (viewPerm) {
          setLocalPermissions((prevPerms) => new Set([...prevPerms, viewPerm]));
        }
      }
      return next;
    });
  };

  const handlePermissionToggle = (permission: PermissionCode) => {
    setLocalPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  const savePermissions = async () => {
    setPermissionsLoading(true);
    try {
      await updatePermissions.mutateAsync({
        userId: user.id,
        data: {
          modules: Array.from(localModules),
          permissions: Array.from(localPermissions),
        },
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Chyba při ukládání oprávnění');
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          specialization: formData.specialization.length > 0 ? formData.specialization : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      // Save permissions if changed
      await savePermissions();

      setOpen(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Chyba při aktualizaci uživatele');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Opravdu chcete smazat uživatele ${user.full_name}? Tato akce je nevratná.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Chyba při mazání uživatele');
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialization = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      specialization: prev.specialization.includes(value)
        ? prev.specialization.filter((s) => s !== value)
        : [...prev.specialization, value],
    }));
  };

  const toggleModuleExpansion = (moduleCode: ModuleCode) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleCode)) {
        next.delete(moduleCode);
      } else {
        next.add(moduleCode);
      }
      return next;
    });
  };

  // Can current user edit this user's permissions?
  const canEditPermissions = isSupervisor || (isMyAdmin && user.role !== 'admin');
  const isTargetAdmin = formData.role === 'admin';
  const isTargetSupervisor = userPermissions?.is_supervisor ?? false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="w-4 h-4 mr-2" />
          Upravit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upravit uživatele</DialogTitle>
          <DialogDescription>
            {user.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Celé jméno</Label>
              <Input
                id="full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+420 123 456 789"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          {/* Specialization */}
          <div className="space-y-2">
            <Label>Specializace</Label>
            <div className="flex flex-wrap gap-2">
              {ROLE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => toggleSpecialization(type.value)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    formData.specialization.includes(type.value)
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  disabled={loading}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Role Selection - Card style */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Role a oprávnění
              </Label>
              {isTargetSupervisor && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  Supervisor
                </Badge>
              )}
            </div>

            {/* Role Cards */}
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'manager', 'technician'] as UserRole[]).map((role) => {
                const isSelected = formData.role === role;
                const canSelect = role !== 'admin' || isSupervisor || (isMyAdmin && user.role === 'admin');

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => canSelect && handleRoleChange(role)}
                    disabled={loading || !canSelect}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : canSelect
                        ? 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={isSelected ? 'text-blue-600' : 'text-slate-500'}>
                        {ROLE_ICONS[role]}
                      </span>
                      <span className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                        {ROLE_LABELS[role]}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permissions Section */}
          {isTargetAdmin ? (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Administrátor má automaticky plný přístup ke všem modulům a oprávněním.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Upravte přístup k modulům a jednotlivá oprávnění
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (formData.role !== 'admin') {
                      const preset = ROLE_PRESETS[formData.role];
                      if (preset) {
                        setLocalModules(new Set(preset.modules));
                        setLocalPermissions(new Set(preset.permissions));
                      }
                    }
                  }}
                  className="text-xs"
                >
                  Obnovit výchozí
                </Button>
              </div>

              {/* Modules with permissions */}
              <div className="space-y-2">
                {(['booking', 'warehouse', 'offers'] as ModuleCode[]).map((moduleCode) => {
                  const hasAccess = localModules.has(moduleCode);
                  const isExpanded = expandedModules.has(moduleCode);
                  const modulePermissions = PERMISSIONS_BY_MODULE[moduleCode];
                  const activePermCount = modulePermissions.filter(p => localPermissions.has(p)).length;

                  return (
                    <div
                      key={moduleCode}
                      className={`border rounded-lg overflow-hidden transition-colors ${
                        hasAccess ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'
                      }`}
                    >
                      {/* Module header */}
                      <div className="flex items-center justify-between p-3 bg-white">
                        <button
                          type="button"
                          onClick={() => toggleModuleExpansion(moduleCode)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                          <span className={hasAccess ? 'text-blue-600' : 'text-slate-500'}>
                            {MODULE_ICONS[moduleCode]}
                          </span>
                          <span className="font-medium">{MODULE_NAMES[moduleCode]}</span>
                          {hasAccess && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {activePermCount}/{modulePermissions.length} oprávnění
                            </Badge>
                          )}
                        </button>
                        <Switch
                          checked={hasAccess}
                          onCheckedChange={() => handleModuleToggle(moduleCode)}
                          disabled={loading || permissionsLoading}
                        />
                      </div>

                      {/* Permissions */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t bg-slate-50/50">
                          <div className="grid grid-cols-2 gap-1">
                            {modulePermissions.map((permission) => {
                              const hasPerm = localPermissions.has(permission);
                              return (
                                <label
                                  key={permission}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                    hasAccess
                                      ? hasPerm
                                        ? 'bg-blue-100 text-blue-900'
                                        : 'hover:bg-slate-100'
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={hasPerm}
                                    onChange={() => handlePermissionToggle(permission)}
                                    disabled={loading || permissionsLoading || !hasAccess}
                                    className="rounded border-slate-300"
                                  />
                                  <span className="text-sm">{PERMISSION_LABELS[permission]}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Stav účtu</Label>
              <p className="text-xs text-slate-500">Neaktivní uživatelé se nemohou přihlásit</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${formData.is_active ? 'text-green-600' : 'text-slate-500'}`}>
                {formData.is_active ? 'Aktivní' : 'Neaktivní'}
              </span>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                disabled={loading}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button type="submit" disabled={loading || permissionsLoading} className="flex-1">
              {loading || permissionsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ukládání...
                </>
              ) : (
                'Uložit změny'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Zrušit
            </Button>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="w-full"
            >
              Smazat uživatele
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
