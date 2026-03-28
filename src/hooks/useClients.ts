'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Client, ClientWithStats } from '@/types/clients';
import { toast } from 'sonner';

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  detail: (id: string) => [...clientKeys.all, 'detail', id] as const,
};

export function useClients(search?: string) {
  return useQuery<Client[]>({
    queryKey: [...clientKeys.lists(), search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/clients?${params}`);
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    },
  });
}

export function useClient(id: string | null) {
  return useQuery<ClientWithStats>({
    queryKey: clientKeys.detail(id || ''),
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error('Failed to fetch client');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; ico?: string; contact_person?: string; email?: string; phone?: string }) => {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create client');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      toast.success('Klient byl vytvořen.');
    },
    onError: () => {
      toast.error('Nepodařilo se vytvořit klienta.');
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; ico?: string; contact_person?: string; email?: string; phone?: string }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update client');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
      toast.success('Klient byl upraven.');
    },
    onError: () => {
      toast.error('Nepodařilo se upravit klienta.');
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete client');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      toast.success('Klient byl smazán.');
    },
    onError: () => {
      toast.error('Nepodařilo se smazat klienta.');
    },
  });
}
