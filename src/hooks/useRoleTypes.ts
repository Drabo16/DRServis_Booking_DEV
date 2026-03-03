'use client';

import { useQuery } from '@tanstack/react-query';

export interface RoleTypeDB {
  id: string;
  value: string;
  label: string;
  sort_order?: number;
}

export const roleTypeKeys = {
  all: ['roleTypes'] as const,
};

export function useRoleTypes() {
  return useQuery<RoleTypeDB[]>({
    queryKey: roleTypeKeys.all,
    queryFn: async () => {
      const res = await fetch('/api/role-types');
      const data = await res.json();
      return data.roleTypes || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - role types rarely change
  });
}
