'use client';

import { useState, useEffect } from 'react';
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
import { Pencil, Package, Calendar, FileText, Loader2, ChevronDown, Shield, Check, Crown, UserCog, User, Users, AlertTriangle } from 'lucide-react';
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
import { useUpdateUser, useDeleteUser } from '@/hooks/useUsers';

const MODULE_NAMES: Record<ModuleCode, string> = {
  booking: 'Booking',
  warehouse: 'Sklad',
  offers: 'Nabídky',
  users_settings: 'Uživatelé a nastavení',
};

const MODULE_ICONS: Record<ModuleCode, React.ReactNode> = {
  booking: <Calendar className="w-4 h-4" />,
  warehouse: <Package className="w-4 h-4" />,
  offers: <FileText className="w-4 h-4" />,
  users_settings: <Users className="w-4 h-4" />,
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
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    email: user.email,
    phone: user.phone || '',
    role: user.role as UserRole,
    specialization: user.specialization || [],
    is_active: user.is_active,
    is_drservis: user.is_drservis ?? true,
    company: user.company || '',
    note: user.note || '',
  });

  // Mutation hooks for user CRUD
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // Current user permissions (to check if supervisor/admin)
  const { data: myPermissions } = useMyPermissions();
  const isSupervisor = myPermissions?.is_supervisor ?? false;
  const isMyAdmin = myPermissions?.is_admin ?? false;

  // SECURITY: Only admins and supervisors can manage permissions
  // Managers can ONLY edit basic info of technicians
  const canManagePermissions = isSupervisor || isMyAdmin;

  // SECURITY: Check if current user can edit this target user
  // Managers can only edit technicians (not admins, not managers, not themselves)
  const isTargetTechnician = user.role === 'technician';
  const isTargetAdmin = user.role === 'admin';
  const isTargetManager = user.role === 'manager';
  const isEditingSelf = myPermissions?.id === user.id;

  // Manager restrictions
  const isManager = !isMyAdmin && !isSupervisor;
  const managerCanEdit = isManager && isTargetTechnician && !isEditingSelf;

  // Overall can edit check
  const canEdit = canManagePermissions || managerCanEdit;

  // SECURITY: Only admins/supervisors can delete users
  const canDelete = canManagePermissions;

  // SECURITY: Only admins/supervisors can change roles
  const canChangeRole = canManagePermissions;

  // Target user permissions (only fetch if we can manage permissions)
  const { data: userPermissions, refetch: refetchPermissions } = useUserPermissions(
    open && canManagePermissions ? user.id : null
  );
  const updatePermissions = useUpdateUserPermissions();

  // Combined loading state
  const loading = updateUser.isPending || deleteUser.isPending;

  // Local state for permissions and modules (only used by admins/supervisors)
  const [localModules, setLocalModules] = useState<Set<ModuleCode>>(new Set());
  const [localPermissions, setLocalPermissions] = useState<Set<PermissionCode>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<ModuleCode>>(new Set(['booking']));
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Initialize local state from fetched data
  useEffect(() => {
    if (userPermissions && canManagePermissions) {
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
  }, [userPermissions, canManagePermissions]);

  // Refetch when dialog opens
  useEffect(() => {
    if (open) {
      if (canManagePermissions) {
        refetchPermissions();
      }
      setFormData({
        full_name: user.full_name,
        email: user.email,
        phone: user.phone || '',
        role: user.role as UserRole,
        specialization: user.specialization || [],
        is_active: user.is_active,
        is_drservis: user.is_drservis ?? true,
        company: user.company || '',
        note: user.note || '',
      });
    }
  }, [open, refetchPermissions, user, canManagePermissions]);

  // Handle role change - apply preset (only for admins/supervisors)
  const handleRoleChange = (newRole: UserRole) => {
    if (!canChangeRole) return;

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
    if (!canManagePermissions) return;

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
    if (!canManagePermissions) return;

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
    if (!canManagePermissions) return;

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

    if (!canEdit) return;

    try {
      // For managers, only update basic info (not role)
      const updateData = isManager
        ? {
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone || null,
            specialization: formData.specialization.length > 0 ? formData.specialization : null,
            is_active: formData.is_active,
            is_drservis: formData.is_drservis,
            company: formData.company || null,
            note: formData.note || null,
          }
        : {
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone || null,
            role: formData.role,
            specialization: formData.specialization.length > 0 ? formData.specialization : null,
            is_active: formData.is_active,
            is_drservis: formData.is_drservis,
            company: formData.company || null,
            note: formData.note || null,
          };

      // Update user via mutation hook
      await updateUser.mutateAsync({
        id: user.id,
        data: updateData,
      });

      // Save permissions if admin/supervisor and changed
      if (canManagePermissions) {
        await savePermissions();
      }

      setOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Chyba při aktualizaci uživatele');
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    if (!confirm(`Opravdu chcete smazat uživatele ${user.full_name}? Tato akce je nevratná.`)) {
      return;
    }

    deleteUser.mutate(user.id, {
      onSuccess: () => {
        setOpen(false);
      },
      onError: (error) => {
        alert(error instanceof Error ? error.message : 'Chyba při mazání uživatele');
      },
    });
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

  const isTargetAdminRole = formData.role === 'admin';
  const isTargetSupervisor = userPermissions?.is_supervisor ?? false;

  // SECURITY: Don't show edit button if manager can't edit this user
  if (isManager && (!isTargetTechnician || isEditingSelf)) {
    return null;
  }

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

        {/* Warning for managers */}
        {isManager && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              Jako správce můžete upravit pouze základní informace technika (jméno, telefon, specializace, stav účtu).
            </p>
          </div>
        )}

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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="722929473"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Firma</Label>
              <Input
                id="company"
                type="text"
                placeholder="Název externí firmy"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                disabled={loading || formData.is_drservis}
              />
            </div>
          </div>

          {/* DRServis membership toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Člen DRServis</Label>
              <p className="text-xs text-slate-500">Je členem firmy DRServis</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${formData.is_drservis ? 'text-green-600' : 'text-slate-500'}`}>
                {formData.is_drservis ? 'Ano' : 'Ne'}
              </span>
              <Switch
                checked={formData.is_drservis}
                onCheckedChange={(checked) => setFormData({ ...formData, is_drservis: checked, company: checked ? '' : formData.company })}
                disabled={loading}
              />
            </div>
          </div>

          {/* Note field */}
          <div className="space-y-2">
            <Label htmlFor="note">Poznámka</Label>
            <Input
              id="note"
              type="text"
              placeholder="Rychlá poznámka k uživateli..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              disabled={loading}
            />
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

          {/* Role Selection - Only for admins/supervisors */}
          {canChangeRole && (
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
          )}

          {/* Permissions Section - Only for admins/supervisors */}
          {canManagePermissions && (
            <>
              {isTargetAdminRole ? (
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
                    {(['booking', 'warehouse', 'offers', 'users_settings'] as ModuleCode[]).map((moduleCode) => {
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
            </>
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

          {/* Delete button - only for admins/supervisors */}
          {canDelete && (
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
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
