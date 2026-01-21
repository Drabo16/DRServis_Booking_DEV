'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  WarehouseCategory,
  WarehouseItemWithCategory,
  WarehouseKitWithItems,
  WarehouseReservationWithDetails,
  WarehouseItemStats,
  WarehouseOverallStats,
  CreateWarehouseCategoryInput,
  UpdateWarehouseCategoryInput,
  CreateWarehouseItemInput,
  UpdateWarehouseItemInput,
  CreateWarehouseKitInput,
  UpdateWarehouseKitInput,
  CreateWarehouseReservationInput,
  ReserveWarehouseKitInput,
  WarehouseItemsFilter,
  WarehouseReservationsFilter,
  AvailabilityCheckInput,
  AvailabilityCheckResult,
} from '@/types/warehouse';

// =====================================================
// QUERY KEYS
// =====================================================
export const warehouseKeys = {
  all: ['warehouse'] as const,

  // Categories
  categories: () => [...warehouseKeys.all, 'categories'] as const,
  category: (id: string) => [...warehouseKeys.categories(), id] as const,

  // Items
  items: () => [...warehouseKeys.all, 'items'] as const,
  itemsList: (filters?: WarehouseItemsFilter) => [...warehouseKeys.items(), 'list', filters] as const,
  itemDetail: (id: string) => [...warehouseKeys.items(), 'detail', id] as const,
  itemHistory: (id: string) => [...warehouseKeys.items(), 'history', id] as const,
  itemStats: (id: string) => [...warehouseKeys.items(), 'stats', id] as const,

  // Kits
  kits: () => [...warehouseKeys.all, 'kits'] as const,
  kitDetail: (id: string) => [...warehouseKeys.kits(), id] as const,

  // Reservations
  reservations: () => [...warehouseKeys.all, 'reservations'] as const,
  reservationsList: (filters?: WarehouseReservationsFilter) => [...warehouseKeys.reservations(), 'list', filters] as const,
  reservationsByEvent: (eventId: string) => [...warehouseKeys.reservations(), 'event', eventId] as const,

  // Stats
  stats: () => [...warehouseKeys.all, 'stats'] as const,

  // Availability
  availability: (input: AvailabilityCheckInput) => [...warehouseKeys.all, 'availability', input] as const,
};

// =====================================================
// CATEGORIES HOOKS
// =====================================================
export function useWarehouseCategories() {
  return useQuery({
    queryKey: warehouseKeys.categories(),
    queryFn: async () => {
      const response = await fetch('/api/warehouse/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json() as Promise<WarehouseCategory[]>;
    },
  });
}

export function useCreateWarehouseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateWarehouseCategoryInput) => {
      const response = await fetch('/api/warehouse/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.categories() });
    },
  });
}

export function useUpdateWarehouseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateWarehouseCategoryInput }) => {
      const response = await fetch(`/api/warehouse/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.categories() });
    },
  });
}

export function useDeleteWarehouseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/warehouse/categories/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.categories() });
    },
  });
}

// =====================================================
// ITEMS HOOKS
// =====================================================
export function useWarehouseItems(filters?: WarehouseItemsFilter) {
  return useQuery({
    queryKey: warehouseKeys.itemsList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category_id) params.set('category_id', filters.category_id);
      if (filters?.is_rent !== undefined) params.set('is_rent', String(filters.is_rent));
      if (filters?.search) params.set('search', filters.search);

      const response = await fetch(`/api/warehouse/items?${params}`);
      if (!response.ok) throw new Error('Failed to fetch items');
      return response.json() as Promise<WarehouseItemWithCategory[]>;
    },
    placeholderData: (prev) => prev,
  });
}

export function useWarehouseItem(id: string | null) {
  return useQuery({
    queryKey: warehouseKeys.itemDetail(id || ''),
    queryFn: async () => {
      const response = await fetch(`/api/warehouse/items/${id}`);
      if (!response.ok) throw new Error('Failed to fetch item');
      return response.json() as Promise<WarehouseItemWithCategory>;
    },
    enabled: !!id,
  });
}

export function useWarehouseItemHistory(id: string | null) {
  return useQuery({
    queryKey: warehouseKeys.itemHistory(id || ''),
    queryFn: async () => {
      const response = await fetch(`/api/warehouse/items/${id}/history`);
      if (!response.ok) throw new Error('Failed to fetch item history');
      return response.json() as Promise<WarehouseReservationWithDetails[]>;
    },
    enabled: !!id,
  });
}

export function useWarehouseItemStats(id: string | null) {
  return useQuery({
    queryKey: warehouseKeys.itemStats(id || ''),
    queryFn: async () => {
      const response = await fetch(`/api/warehouse/items/${id}/stats`);
      if (!response.ok) throw new Error('Failed to fetch item stats');
      return response.json() as Promise<WarehouseItemStats>;
    },
    enabled: !!id,
  });
}

export function useCreateWarehouseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateWarehouseItemInput) => {
      const response = await fetch('/api/warehouse/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.items() });
    },
  });
}

export function useUpdateWarehouseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateWarehouseItemInput }) => {
      const response = await fetch(`/api/warehouse/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update item');
      }
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.itemDetail(id) });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.items() });
    },
  });
}

export function useDeleteWarehouseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/warehouse/items/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.items() });
    },
  });
}

export function useBulkUpdateWarehouseItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Partial<UpdateWarehouseItemInput> }) => {
      // Update items one by one (no bulk endpoint)
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/warehouse/items/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to update item ${id}`);
          }
          return response.json();
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.items() });
    },
  });
}

export function useBulkDeleteWarehouseItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete items one by one
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/warehouse/items/${id}`, { method: 'DELETE' });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to delete item ${id}`);
          }
          return response.json();
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.items() });
    },
  });
}

// =====================================================
// KITS HOOKS
// =====================================================
export function useWarehouseKits() {
  return useQuery({
    queryKey: warehouseKeys.kits(),
    queryFn: async () => {
      const response = await fetch('/api/warehouse/kits');
      if (!response.ok) throw new Error('Failed to fetch kits');
      return response.json() as Promise<WarehouseKitWithItems[]>;
    },
  });
}

export function useWarehouseKit(id: string | null) {
  return useQuery({
    queryKey: warehouseKeys.kitDetail(id || ''),
    queryFn: async () => {
      const response = await fetch(`/api/warehouse/kits/${id}`);
      if (!response.ok) throw new Error('Failed to fetch kit');
      return response.json() as Promise<WarehouseKitWithItems>;
    },
    enabled: !!id,
  });
}

export function useCreateWarehouseKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateWarehouseKitInput) => {
      const response = await fetch('/api/warehouse/kits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create kit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.kits() });
    },
  });
}

export function useUpdateWarehouseKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateWarehouseKitInput }) => {
      const response = await fetch(`/api/warehouse/kits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update kit');
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.kitDetail(id) });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.kits() });
    },
  });
}

export function useDeleteWarehouseKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/warehouse/kits/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete kit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.kits() });
    },
  });
}

export function useReserveWarehouseKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ReserveWarehouseKitInput) => {
      const response = await fetch('/api/warehouse/kits/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to reserve kit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.reservations() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.items() });
    },
  });
}

// =====================================================
// RESERVATIONS HOOKS
// =====================================================
export function useWarehouseReservations(filters?: WarehouseReservationsFilter) {
  return useQuery({
    queryKey: warehouseKeys.reservationsList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.event_id) params.set('event_id', filters.event_id);
      if (filters?.item_id) params.set('item_id', filters.item_id);
      if (filters?.kit_id) params.set('kit_id', filters.kit_id);
      if (filters?.start_date) params.set('start_date', filters.start_date);
      if (filters?.end_date) params.set('end_date', filters.end_date);

      const response = await fetch(`/api/warehouse/reservations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch reservations');
      return response.json() as Promise<WarehouseReservationWithDetails[]>;
    },
  });
}

export function useCreateWarehouseReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateWarehouseReservationInput) => {
      const response = await fetch('/api/warehouse/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create reservation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.reservations() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.items() });
    },
  });
}

export function useUpdateWarehouseReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateWarehouseReservationInput> }) => {
      const response = await fetch(`/api/warehouse/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update reservation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.reservations() });
    },
  });
}

export function useDeleteWarehouseReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/warehouse/reservations/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete reservation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.reservations() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.items() });
    },
  });
}

// =====================================================
// STATS HOOKS
// =====================================================
export function useWarehouseStats() {
  return useQuery({
    queryKey: warehouseKeys.stats(),
    queryFn: async () => {
      const response = await fetch('/api/warehouse/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<WarehouseOverallStats>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

// =====================================================
// AVAILABILITY HOOKS
// =====================================================
export function useCheckAvailability(input: AvailabilityCheckInput | null) {
  return useQuery({
    queryKey: input ? warehouseKeys.availability(input) : ['warehouse', 'availability', 'disabled'],
    queryFn: async () => {
      if (!input) return null;
      const response = await fetch('/api/warehouse/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to check availability');
      return response.json() as Promise<AvailabilityCheckResult>;
    },
    enabled: !!input && !!input.start_date && !!input.end_date,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

export function useCheckAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AvailabilityCheckInput) => {
      const response = await fetch('/api/warehouse/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to check availability');
      return response.json() as Promise<AvailabilityCheckResult>;
    },
    // Cache the result for future use
    onSuccess: (data, variables) => {
      queryClient.setQueryData(warehouseKeys.availability(variables), data);
    },
  });
}
