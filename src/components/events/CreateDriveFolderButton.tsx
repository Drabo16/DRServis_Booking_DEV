'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreateDriveFolderButtonProps {
  eventId: string;
  onSuccess?: () => void;
}

export default function CreateDriveFolderButton({
  eventId,
  onSuccess,
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
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } else {
        console.error('Drive folder creation error:', response.status, data);
        alert(data.message || data.error || `Chyba při vytváření složky (${response.status})`);
      }
    } catch (error) {
      console.error('Drive folder creation exception:', error);
      alert('Chyba při vytváření složky - zkontrolujte konzoli pro detaily');
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
