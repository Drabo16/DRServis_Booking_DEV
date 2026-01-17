'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventKeys } from './useEvents';

// Create position
export function useCreatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { event_id: string; title: string; role_type: string }) => {
      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create position');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

// Delete position
export function useDeletePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/positions?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete position');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
