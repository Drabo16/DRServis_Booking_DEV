'use client';

import { useQuery } from '@tanstack/react-query';
import type { Profile } from '@/types';

export const technicianKeys = {
  all: ['technicians'] as const,
  lists: () => [...technicianKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...technicianKeys.lists(), filters] as const,
};

export function useTechnicians() {
  return useQuery({
    queryKey: technicianKeys.list(),
    queryFn: async () => {
      const response = await fetch('/api/technicians');
      if (!response.ok) throw new Error('Failed to fetch technicians');
      const data = await response.json();
      return data.technicians as Profile[];
    },
  });
}
