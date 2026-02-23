// =====================================================
// OFFERS MODULE - React Query Hooks
// =====================================================
// Hooks for offers and templates management
// To remove: delete this file

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Offer,
  OfferWithItems,
  OfferWithDetails,
  OfferItem,
  OfferTemplateCategory,
  OfferTemplateItemWithCategory,
  OfferPresetWithCount,
  OfferPresetWithItems,
  OffersFilter,
  CreateOfferInput,
  UpdateOfferInput,
  CreateOfferItemInput,
  UpdateOfferItemInput,
  BulkAddOfferItemsInput,
} from '@/types/offers';

// =====================================================
// Query Keys
// =====================================================

export const offerKeys = {
  all: ['offers'] as const,
  lists: () => [...offerKeys.all, 'list'] as const,
  list: (filters: OffersFilter) => [...offerKeys.lists(), filters] as const,
  details: () => [...offerKeys.all, 'detail'] as const,
  detail: (id: string) => [...offerKeys.details(), id] as const,
  items: (offerId: string) => [...offerKeys.all, 'items', offerId] as const,
  templates: {
    all: ['offer-templates'] as const,
    categories: () => [...offerKeys.templates.all, 'categories'] as const,
    items: (categoryId?: string) => [...offerKeys.templates.all, 'items', categoryId] as const,
  },
  presets: {
    all: ['offer-presets'] as const,
    lists: () => [...offerKeys.presets.all, 'list'] as const,
    detail: (id: string) => [...offerKeys.presets.all, 'detail', id] as const,
  },
};

// =====================================================
// Template Categories Hooks
// =====================================================

export function useOfferTemplateCategories() {
  return useQuery({
    queryKey: offerKeys.templates.categories(),
    queryFn: async () => {
      const response = await fetch('/api/offers/templates/categories');
      if (!response.ok) throw new Error('Failed to fetch template categories');
      return response.json() as Promise<OfferTemplateCategory[]>;
    },
  });
}

// =====================================================
// Template Items Hooks
// =====================================================

export function useOfferTemplateItems(categoryId?: string) {
  return useQuery({
    queryKey: offerKeys.templates.items(categoryId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryId) params.set('category_id', categoryId);
      const response = await fetch(`/api/offers/templates/items?${params}`);
      if (!response.ok) throw new Error('Failed to fetch template items');
      return response.json() as Promise<OfferTemplateItemWithCategory[]>;
    },
  });
}

export function useCreateOfferTemplateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<OfferTemplateItemWithCategory>) => {
      const response = await fetch('/api/offers/templates/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create template item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offerKeys.templates.all });
    },
  });
}

export function useUpdateOfferTemplateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<OfferTemplateItemWithCategory>) => {
      const response = await fetch(`/api/offers/templates/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update template item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offerKeys.templates.all });
    },
  });
}

export function useDeleteOfferTemplateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/offers/templates/items/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offerKeys.templates.all });
    },
  });
}

// =====================================================
// Offers Hooks
// =====================================================

export function useOffers(filters: OffersFilter = {}) {
  return useQuery({
    queryKey: offerKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.year) params.set('year', filters.year.toString());
      if (filters.event_id) params.set('event_id', filters.event_id);
      if (filters.search) params.set('search', filters.search);
      const response = await fetch(`/api/offers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch offers');
      return response.json() as Promise<OfferWithDetails[]>;
    },
    staleTime: 1000 * 60 * 2, // Data stays fresh for 2 minutes
    gcTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useOffer(id: string | null) {
  return useQuery({
    queryKey: offerKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`/api/offers/${id}`);
      if (!response.ok) throw new Error('Failed to fetch offer');
      return response.json() as Promise<OfferWithItems>;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // Data stays fresh for 2 minutes
    gcTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateOfferInput) => {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create offer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

export function useUpdateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpdateOfferInput & { recalculate?: boolean }) => {
      const response = await fetch(`/api/offers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update offer');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

export function useDeleteOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/offers/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete offer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

export function useDuplicateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/offers/${id}/duplicate`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to duplicate offer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

// =====================================================
// Offer Items Hooks
// =====================================================

export function useOfferItems(offerId: string | null) {
  return useQuery({
    queryKey: offerKeys.items(offerId || ''),
    queryFn: async () => {
      if (!offerId) return [];
      const response = await fetch(`/api/offers/${offerId}/items`);
      if (!response.ok) throw new Error('Failed to fetch offer items');
      return response.json() as Promise<OfferItem[]>;
    },
    enabled: !!offerId,
  });
}

export function useAddOfferItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateOfferItemInput) => {
      const response = await fetch(`/api/offers/${data.offer_id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to add offer item');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(variables.offer_id) });
      queryClient.invalidateQueries({ queryKey: offerKeys.items(variables.offer_id) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

export function useBulkAddOfferItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BulkAddOfferItemsInput) => {
      const response = await fetch(`/api/offers/${data.offer_id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data.items }),
      });
      if (!response.ok) throw new Error('Failed to add offer items');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(variables.offer_id) });
      queryClient.invalidateQueries({ queryKey: offerKeys.items(variables.offer_id) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

export function useUpdateOfferItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ offerId, itemId, ...data }: { offerId: string; itemId: string } & UpdateOfferItemInput) => {
      const response = await fetch(`/api/offers/${offerId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, ...data }),
      });
      if (!response.ok) throw new Error('Failed to update offer item');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(variables.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.items(variables.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

export function useDeleteOfferItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ offerId, itemId }: { offerId: string; itemId: string }) => {
      const response = await fetch(`/api/offers/${offerId}/items?item_id=${itemId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete offer item');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(variables.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.items(variables.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

// =====================================================
// Offer Presets Hooks (Vzorové nabídky)
// =====================================================

export function useOfferPresets() {
  return useQuery({
    queryKey: offerKeys.presets.lists(),
    queryFn: async () => {
      const response = await fetch('/api/offers/presets');
      if (!response.ok) throw new Error('Failed to fetch presets');
      return response.json() as Promise<OfferPresetWithCount[]>;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useOfferPreset(id: string | null) {
  return useQuery({
    queryKey: offerKeys.presets.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`/api/offers/presets/${id}`);
      if (!response.ok) throw new Error('Failed to fetch preset');
      return response.json() as Promise<OfferPresetWithItems>;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateOfferPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch('/api/offers/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create preset');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offerKeys.presets.all });
    },
  });
}

export function useUpdateOfferPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const response = await fetch(`/api/offers/presets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update preset');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.presets.all });
      queryClient.invalidateQueries({ queryKey: offerKeys.presets.detail(variables.id) });
    },
  });
}

export function useDeleteOfferPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/offers/presets/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete preset');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offerKeys.presets.all });
    },
  });
}
