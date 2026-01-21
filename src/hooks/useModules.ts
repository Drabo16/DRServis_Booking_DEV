'use client';

// =====================================================
// MODULE SYSTEM HOOKS
// =====================================================
// Hooks for managing module access.
// To remove: delete this file

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppModule, AccessibleModule, ModuleCode } from '@/types';

export const moduleKeys = {
  all: ['modules'] as const,
  list: () => [...moduleKeys.all, 'list'] as const,
  accessible: () => [...moduleKeys.all, 'accessible'] as const,
  userAccess: (userId: string) => [...moduleKeys.all, 'user', userId] as const,
};

// Fetch all available modules
export function useModules() {
  return useQuery({
    queryKey: moduleKeys.list(),
    queryFn: async () => {
      const response = await fetch('/api/modules');
      if (!response.ok) throw new Error('Failed to fetch modules');
      const data = await response.json();
      return data.modules as AppModule[];
    },
  });
}

// Fetch modules accessible to current user (for sidebar)
export function useAccessibleModules() {
  return useQuery({
    queryKey: moduleKeys.accessible(),
    queryFn: async () => {
      const response = await fetch('/api/modules/accessible');
      if (!response.ok) throw new Error('Failed to fetch accessible modules');
      const data = await response.json();
      return data.modules as AccessibleModule[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch module access for a specific user (admin view)
export function useUserModuleAccess(userId: string) {
  return useQuery({
    queryKey: moduleKeys.userAccess(userId),
    queryFn: async () => {
      const response = await fetch(`/api/modules/user/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user module access');
      const data = await response.json();
      return data.modules as {
        module_code: ModuleCode;
        module_name: string;
        icon: string;
        route: string;
        is_core: boolean;
        has_access: boolean;
      }[];
    },
    enabled: !!userId,
  });
}

// Grant module access to user
export function useGrantModuleAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, moduleCode }: { userId: string; moduleCode: ModuleCode }) => {
      const response = await fetch('/api/modules/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, module_code: moduleCode }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to grant module access');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.userAccess(variables.userId) });
      queryClient.invalidateQueries({ queryKey: moduleKeys.accessible() });
    },
  });
}

// Revoke module access from user
export function useRevokeModuleAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, moduleCode }: { userId: string; moduleCode: ModuleCode }) => {
      const response = await fetch('/api/modules/access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, module_code: moduleCode }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke module access');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.userAccess(variables.userId) });
      queryClient.invalidateQueries({ queryKey: moduleKeys.accessible() });
    },
  });
}
