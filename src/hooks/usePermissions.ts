'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PermissionCode, ModuleCode, UserWithPermissions } from '@/types/modules';

interface MyPermissions {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_supervisor: boolean;
  is_admin: boolean;
  modules: { code: ModuleCode; name: string; has_access: boolean }[];
  permissions: { code: PermissionCode; name: string; module_code: ModuleCode; has_permission: boolean }[];
}

// Fetch current user's permissions
async function fetchMyPermissions(): Promise<MyPermissions> {
  const res = await fetch('/api/permissions/me');
  if (!res.ok) throw new Error('Failed to fetch permissions');
  return res.json();
}

// Fetch specific user's permissions (for admin panel)
async function fetchUserPermissions(userId: string): Promise<UserWithPermissions> {
  const res = await fetch(`/api/permissions/user/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch user permissions');
  return res.json();
}

// Update user permissions
async function updateUserPermissions(
  userId: string,
  data: { permissions?: PermissionCode[]; modules?: ModuleCode[] }
): Promise<void> {
  const res = await fetch(`/api/permissions/user/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update permissions');
  }
}

// Hook for current user's permissions
export function useMyPermissions() {
  return useQuery({
    queryKey: ['myPermissions'],
    queryFn: fetchMyPermissions,
    staleTime: 1000 * 30, // 30 seconds - refresh more often for permission changes
  });
}

// Hook for checking specific permission
export function useHasPermission(permission: PermissionCode): boolean {
  const { data } = useMyPermissions();
  if (!data) return false;
  if (data.is_admin || data.is_supervisor) return true;
  return data.permissions.find(p => p.code === permission)?.has_permission ?? false;
}

// Hook for checking module access
export function useHasModuleAccess(module: ModuleCode): boolean {
  const { data } = useMyPermissions();
  if (!data) return false;
  if (data.is_admin || data.is_supervisor) return true;
  return data.modules.find(m => m.code === module)?.has_access ?? false;
}

// Hook for admin: fetch user permissions
export function useUserPermissions(userId: string | null) {
  return useQuery({
    queryKey: ['userPermissions', userId],
    queryFn: () => fetchUserPermissions(userId!),
    enabled: !!userId,
  });
}

// Hook for admin: update user permissions
export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { permissions?: PermissionCode[]; modules?: ModuleCode[] } }) =>
      updateUserPermissions(userId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['userPermissions', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Also invalidate myPermissions in case user updated their own permissions
      queryClient.invalidateQueries({ queryKey: ['myPermissions'] });
    },
  });
}

// Helper to check if user can perform action
export function canPerformAction(
  permissions: MyPermissions | undefined,
  requiredPermission: PermissionCode
): boolean {
  if (!permissions) return false;
  if (permissions.is_admin || permissions.is_supervisor) return true;
  return permissions.permissions.find(p => p.code === requiredPermission)?.has_permission ?? false;
}
