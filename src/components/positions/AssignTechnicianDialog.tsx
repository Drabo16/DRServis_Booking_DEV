'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

interface AssignTechnicianDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionId: string;
  eventId: string;
}

export default function AssignTechnicianDialog({
  open,
  onOpenChange,
  positionId,
  eventId,
}: AssignTechnicianDialogProps) {
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [notes, setNotes] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      loadTechnicians();
    }
  }, [open]);

  const loadTechnicians = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name');

    if (data) {
      setTechnicians(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechnicianId) return;

    setLoading(true);

    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_id: positionId,
          event_id: eventId,
          technician_id: selectedTechnicianId,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        setSelectedTechnicianId('');
        setNotes('');
        router.refresh();
      } else {
        alert('Chyba při přiřazování technika');
      }
    } catch (error) {
      alert('Chyba při přiřazování technika');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Přiřadit technika na pozici</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="technician">Vyberte technika</Label>
            <Select
              value={selectedTechnicianId}
              onValueChange={setSelectedTechnicianId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte technika..." />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.full_name} ({tech.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Poznámky (volitelné)</Label>
            <Input
              id="notes"
              placeholder="Speciální instrukce..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={loading || !selectedTechnicianId}>
              {loading ? 'Přiřazování...' : 'Přiřadit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
