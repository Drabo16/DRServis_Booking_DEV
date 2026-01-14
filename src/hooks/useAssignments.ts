'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventKeys } from './useEvents';

// Create assignment with optimistic update
export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { position_id: string; technician_id: string; notes?: string }) => {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create assignment');
      }
      return response.json();
    },
    // Optimistic update - immediately update cache
    onMutate: async (newAssignment) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventKeys.all });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(eventKeys.list());

      // Optimistically update cache (if needed)
      // This is handled by components with local state for instant feedback

      return { previousEvents };
    },
    onError: (_error, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousEvents) {
        queryClient.setQueryData(eventKeys.list(), context.previousEvents);
      }
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

// Update assignment status
export function useUpdateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { attendance_status: string } }) => {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update assignment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

// Delete assignment
export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete assignment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
