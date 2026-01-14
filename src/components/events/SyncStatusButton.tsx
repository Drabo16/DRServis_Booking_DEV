'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SyncStatusButtonProps {
  eventId: string;
}

export default function SyncStatusButton({ eventId }: SyncStatusButtonProps) {
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
        router.refresh();
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
    <Button variant="outline" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Synchronizuji...' : 'Obnovit statusy'}
    </Button>
  );
}
