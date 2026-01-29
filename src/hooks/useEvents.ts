'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Event, Position, Assignment, Profile } from '@/types';

// Query keys for cache management
export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...eventKeys.lists(), filters] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
  files: (id: string) => [...eventKeys.all, 'files', id] as const,
  syncStatus: (id: string) => [...eventKeys.all, 'sync-status', id] as const,
};

// Type definitions for better type safety
type EventWithPositions = Event & {
  positions?: Array<
    Position & {
      assignments?: Array<Assignment & { technician: Profile }>;
    }
  >;
};

// Fetch all events
// showPast: true = past events, false = upcoming events
export function useEvents(showPast: boolean = false) {
  return useQuery({
    queryKey: eventKeys.list({ showPast }),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (showPast) params.set('showPast', 'true');
      const response = await fetch(`/api/events?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json() as Promise<EventWithPositions[]>;
    },
    // Keep previous data while fetching new data for smoother UX
    placeholderData: (previousData) => previousData,
  });
}

// Fetch single event with prefetch support
export function useEvent(eventId: string) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) throw new Error('Failed to fetch event');
      return response.json() as Promise<{ event: EventWithPositions }>;
    },
    enabled: !!eventId,
    // Keep previous data while fetching new data for smoother UX
    placeholderData: (previousData) => previousData,
  });
}

// Prefetch hook for hovering over event cards
export function usePrefetchEvent() {
  const queryClient = useQueryClient();

  return useCallback(
    (eventId: string) => {
      // Only prefetch if not already cached
      const cached = queryClient.getQueryData(eventKeys.detail(eventId));
      if (!cached) {
        queryClient.prefetchQuery({
          queryKey: eventKeys.detail(eventId),
          queryFn: async () => {
            const response = await fetch(`/api/events/${eventId}`);
            if (!response.ok) throw new Error('Failed to fetch event');
            return response.json() as Promise<{ event: EventWithPositions }>;
          },
          staleTime: 5 * 60 * 1000, // 5 minutes
        });
      }
    },
    [queryClient]
  );
}

// Fetch event files from Drive
export function useEventFiles(eventId: string) {
  return useQuery({
    queryKey: eventKeys.files(eventId),
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/files`);
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json() as Promise<{
        files: Array<{
          id: string;
          name: string;
          mimeType: string;
          thumbnailLink?: string;
          webViewLink: string;
        }>;
      }>;
    },
    enabled: !!eventId,
    // Files don't change often, cache longer
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Fetch sync status
export function useEventSyncStatus(eventId: string) {
  return useQuery({
    queryKey: eventKeys.syncStatus(eventId),
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/sync-status`);
      if (!response.ok) throw new Error('Failed to fetch sync status');
      return response.json();
    },
    enabled: !!eventId,
    // Check sync status every 30 seconds
    refetchInterval: 30000,
  });
}

// Create event mutation
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventData: Partial<Event>) => {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) throw new Error('Failed to create event');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate events list to trigger refetch
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

// Update event mutation with optimistic updates
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Event> }) => {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update event');
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventKeys.detail(id) });

      // Snapshot the previous value
      const previousEvent = queryClient.getQueryData(eventKeys.detail(id));

      // Optimistically update the cache
      queryClient.setQueryData(eventKeys.detail(id), (old: { event: EventWithPositions } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          event: { ...old.event, ...data },
        };
      });

      return { previousEvent };
    },
    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previousEvent) {
        queryClient.setQueryData(eventKeys.detail(id), context.previousEvent);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

// Delete event mutation
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

// Sync calendar mutation
export function useSyncCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sync/calendar', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to sync calendar');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

// Send invite mutation
export function useSendInvite() {
  return useMutation({
    mutationFn: async ({ eventId, assignmentId }: { eventId: string; assignmentId: string }) => {
      const response = await fetch(`/api/events/${eventId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });
      if (!response.ok) throw new Error('Failed to send invite');
      return response.json();
    },
  });
}
