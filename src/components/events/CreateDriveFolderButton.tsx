'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreateDriveFolderButtonProps {
  eventId: string;
}

export default function CreateDriveFolderButton({
  eventId,
}: CreateDriveFolderButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateFolder = async () => {
    if (!confirm('Opravdu chcete vytvořit složku na Google Drive?')) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/drive`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert('Složka úspěšně vytvořena!');
        router.refresh();
      } else {
        alert(data.message || 'Chyba při vytváření složky');
      }
    } catch (error) {
      alert('Chyba při vytváření složky');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleCreateFolder}
      disabled={loading}
    >
      <FolderPlus className="w-4 h-4 mr-2" />
      {loading ? 'Vytváření...' : 'Vytvořit podklady na Drive'}
    </Button>
  );
}
