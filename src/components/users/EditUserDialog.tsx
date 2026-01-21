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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Pencil, Package, Calendar, FileText, Loader2, ChevronDown, Shield } from 'lucide-react';
import { ROLE_TYPES } from '@/lib/constants';
import { Profile, ModuleCode, PermissionCode, PERMISSION_LABELS, PERMISSIONS_BY_MODULE } from '@/types';
import { useUserPermissions, useUpdateUserPermissions, useMyPermissions } from '@/hooks/usePermissions';

// Icon map for module display
const moduleIconMap: Record<string, React.ReactNode> = {
  Calendar: <Calendar className="w-4 h-4" />,
  Package: <Package className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
};

const MODULE_NAMES: Record<ModuleCode, string> = {
  booking: 'Booking',
  warehouse: 'Sklad',
  offers: 'Nabídky',
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
    role: user.role,
    specialization: user.specialization || [],
    is_active: user.is_active,
  });

  // Current user permissions (to check if supervisor)
  const { data: myPermissions } = useMyPermissions();
  const isSupervisor = myPermissions?.is_supervisor ?? false;

  // Target user permissions
  const { data: userPermissions, refetch: refetchPermissions } = useUserPermissions(open ? user.id : null);
  const updatePermissions = useUpdateUserPermissions();

  // Local state for permissions and modules
  const [localModules, setLocalModules] = useState<Set<ModuleCode>>(new Set());
  const [localPermissions, setLocalPermissions] = useState<Set<PermissionCode>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<ModuleCode>>(new Set());
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
    }
  }, [open, refetchPermissions]);

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
  const canEditPermissions = isSupervisor || (myPermissions?.is_admin && user.role !== 'admin');
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upravit uživatele</DialogTitle>
          <DialogDescription>
            Upravte údaje uživatele. Email nelze změnit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Celé jméno *</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Jan Novák"
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

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value: 'admin' | 'technician') =>
                setFormData({ ...formData, role: value })
              }
              disabled={loading || (user.role === 'admin' && !isSupervisor)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Technik</SelectItem>
                <SelectItem value="admin">Administrátor</SelectItem>
              </SelectContent>
            </Select>
            {user.role === 'admin' && !isSupervisor && (
              <p className="text-xs text-amber-600">
                Pouze supervisor může měnit roli administrátora.
              </p>
            )}
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="is_active">Stav účtu *</Label>
            <Select
              value={formData.is_active ? 'active' : 'inactive'}
              onValueChange={(value) =>
                setFormData({ ...formData, is_active: value === 'active' })
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktivní</SelectItem>
                <SelectItem value="inactive">Neaktivní</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Permissions Section */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              <Label>Moduly a oprávnění</Label>
              {isTargetSupervisor && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  Supervisor
                </span>
              )}
            </div>

            {isTargetAdmin || isTargetSupervisor ? (
              <p className="text-sm text-slate-500">
                {isTargetSupervisor
                  ? 'Supervisor má plný přístup ke všem modulům a oprávněním.'
                  : 'Administrátoři mají automaticky přístup ke všem modulům a oprávněním.'}
              </p>
            ) : !canEditPermissions ? (
              <p className="text-sm text-amber-600">
                Nemáte oprávnění měnit moduly a oprávnění tohoto uživatele.
              </p>
            ) : (
              <div className="space-y-2">
                {(['booking', 'warehouse', 'offers'] as ModuleCode[]).map((moduleCode) => {
                  const hasAccess = localModules.has(moduleCode);
                  const isExpanded = expandedModules.has(moduleCode);
                  const modulePermissions = PERMISSIONS_BY_MODULE[moduleCode];

                  return (
                    <div key={moduleCode} className="border rounded-lg">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          {moduleCode === 'booking' && <Calendar className="w-4 h-4" />}
                          {moduleCode === 'warehouse' && <Package className="w-4 h-4" />}
                          {moduleCode === 'offers' && <FileText className="w-4 h-4" />}
                          <span className="font-medium text-sm">{MODULE_NAMES[moduleCode]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={hasAccess}
                            onCheckedChange={() => handleModuleToggle(moduleCode)}
                            disabled={loading || permissionsLoading}
                          />
                          {hasAccess && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleModuleExpansion(moduleCode)}
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </Button>
                          )}
                        </div>
                      </div>

                      {hasAccess && isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t bg-slate-50">
                          <p className="text-xs text-slate-500 mb-2">Oprávnění v modulu:</p>
                          <div className="space-y-1.5">
                            {modulePermissions.map((permission) => (
                              <label
                                key={permission}
                                className="flex items-center gap-2 text-sm cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={localPermissions.has(permission)}
                                  onChange={() => handlePermissionToggle(permission)}
                                  disabled={loading || permissionsLoading}
                                  className="rounded border-slate-300"
                                />
                                <span>{PERMISSION_LABELS[permission]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
              {loading ? 'Mazání...' : 'Smazat uživatele'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
