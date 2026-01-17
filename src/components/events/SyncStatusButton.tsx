'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SyncStatusButtonProps {
  eventId: string;
  onSync?: () => void;
  iconOnly?: boolean;
}

export default function SyncStatusButton({ eventId, onSync, iconOnly = false }: SyncStatusButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/sync-status`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Aktualizováno ${data.updated} statusů`);
        if (onSync) {
          onSync();
        } else {
          router.refresh();
        }
      } else {
        alert('Chyba při synchronizaci statusů');
      }
    } catch (error) {
      alert('Chyba při synchronizaci statusů');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size={iconOnly ? 'sm' : 'default'} onClick={handleSync} disabled={loading}>
      <RefreshCw className={`w-4 h-4 ${iconOnly ? '' : 'mr-2'} ${loading ? 'animate-spin' : ''}`} />
      {!iconOnly && (loading ? 'Synchronizuji...' : 'Obnovit statusy')}
    </Button>
  );
}
