'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { ROLE_TYPES } from '@/lib/constants';
import { useCreatePosition } from '@/hooks/usePositions';

interface CreatePositionDialogProps {
  eventId: string;
}

export default function CreatePositionDialog({ eventId }: CreatePositionDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    role_type: 'sound',
    description: '',
    hourly_rate: '',
  });

  const createPosition = useCreatePosition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    createPosition.mutate(
      {
        event_id: eventId,
        title: formData.title,
        role_type: formData.role_type,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setFormData({ title: '', role_type: 'sound', description: '', hourly_rate: '' });
        },
        onError: () => {
          alert('Chyba při vytváření pozice');
        },
      }
    );
  };

  const loading = createPosition.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Přidat pozici
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vytvořit novou pozici</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Název pozice</Label>
            <Input
              id="title"
              placeholder="např. Hlavní zvukař"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="role_type">Typ role</Label>
            <Select
              value={formData.role_type}
              onValueChange={(value) => setFormData({ ...formData, role_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Popis (volitelné)</Label>
            <Input
              id="description"
              placeholder="Detaily pozice..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="hourly_rate">Hodinová sazba (Kč) (volitelné)</Label>
            <Input
              id="hourly_rate"
              type="number"
              step="0.01"
              placeholder="500"
              value={formData.hourly_rate}
              onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Vytváření...' : 'Vytvořit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
