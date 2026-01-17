'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/hooks/useEvents';

interface BulkActionResult {
  total: number;
  success: number;
  failed: string[];
}

export function useBulkDriveActions() {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Bulk create Drive folders
  const bulkCreateFolders = useCallback(async (
    eventIds: string[],
    events: Array<{ id: string; drive_folder_id?: string | null }>
  ): Promise<BulkActionResult> => {
    const eventsWithoutFolder = eventIds.filter(id => {
      const event = events.find(e => e.id === id);
      return event && !event.drive_folder_id;
    });

    if (eventsWithoutFolder.length === 0) {
      return { total: 0, success: 0, failed: [] };
    }

    setIsProcessing(true);
    const failed: string[] = [];
    let success = 0;

    try {
      for (const id of eventsWithoutFolder) {
        try {
          const res = await fetch(`/api/events/${id}/drive`, { method: 'POST' });
          if (res.ok) {
            success++;
          } else {
            failed.push(id);
          }
        } catch {
          failed.push(id);
        }
      }

      queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    } finally {
      setIsProcessing(false);
    }

    return { total: eventsWithoutFolder.length, success, failed };
  }, [queryClient]);

  // Bulk attach Drive folders to calendar
  const bulkAttachToCalendar = useCallback(async (
    eventIds: string[],
    events: Array<{
      id: string;
      drive_folder_id?: string | null;
      google_event_id?: string | null;
      calendar_attachment_synced?: boolean;
    }>
  ): Promise<BulkActionResult> => {
    const eligibleEvents = eventIds.filter(id => {
      const event = events.find(e => e.id === id);
      return event && event.drive_folder_id && event.google_event_id && !event.calendar_attachment_synced;
    });

    if (eligibleEvents.length === 0) {
      return { total: 0, success: 0, failed: [] };
    }

    setIsProcessing(true);
    const failed: string[] = [];
    let success = 0;

    try {
      for (const id of eligibleEvents) {
        try {
          const res = await fetch(`/api/events/${id}/attach-drive`, { method: 'POST' });
          if (res.ok) {
            success++;
          } else {
            failed.push(id);
          }
        } catch {
          failed.push(id);
        }
      }

      queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    } finally {
      setIsProcessing(false);
    }

    return { total: eligibleEvents.length, success, failed };
  }, [queryClient]);

  // Bulk delete Drive folders
  const bulkDeleteFolders = useCallback(async (
    eventIds: string[],
    events: Array<{ id: string; drive_folder_id?: string | null }>
  ): Promise<BulkActionResult> => {
    const eventsWithFolder = eventIds.filter(id => {
      const event = events.find(e => e.id === id);
      return event && event.drive_folder_id;
    });

    if (eventsWithFolder.length === 0) {
      return { total: 0, success: 0, failed: [] };
    }

    setIsProcessing(true);
    const failed: string[] = [];
    let success = 0;

    try {
      for (const id of eventsWithFolder) {
        try {
          const res = await fetch(`/api/events/${id}/drive`, { method: 'DELETE' });
          if (res.ok) {
            success++;
          } else {
            failed.push(id);
          }
        } catch {
          failed.push(id);
        }
      }

      queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    } finally {
      setIsProcessing(false);
    }

    return { total: eventsWithFolder.length, success, failed };
  }, [queryClient]);

  // Validate Drive folders
  const validateFolders = useCallback(async (): Promise<{ validated: number; invalidated: number }> => {
    setIsValidating(true);
    try {
      const res = await fetch('/api/events/validate-drive', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        queryClient.invalidateQueries({ queryKey: eventKeys.list() });
        return { validated: data.validated || 0, invalidated: data.invalidated || 0 };
      }
      return { validated: 0, invalidated: 0 };
    } catch {
      return { validated: 0, invalidated: 0 };
    } finally {
      setIsValidating(false);
    }
  }, [queryClient]);

  return {
    isProcessing,
    isValidating,
    bulkCreateFolders,
    bulkAttachToCalendar,
    bulkDeleteFolders,
    validateFolders,
  };
}
