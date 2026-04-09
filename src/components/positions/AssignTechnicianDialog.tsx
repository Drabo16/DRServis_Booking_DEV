'use client';

import { useState, useEffect } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useCreateAssignment } from '@/hooks/useAssignments';
import type { Profile } from '@/types';

const RANK_COLORS: Record<number, string> = {
  1: 'bg-slate-200 text-slate-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-green-100 text-green-700',
  4: 'bg-amber-100 text-amber-700',
};

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
}: AssignTechnicianDialogProps) {
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [notes, setNotes] = useState('');
  const supabase = createClient();

  const createAssignment = useCreateAssignment();

  useEffect(() => {
    if (open) {
      loadTechnicians();
    }
  }, [open]);

  const loadTechnicians = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, specialization, is_active, is_drservis, company, note, role, auth_user_id, avatar_url, has_warehouse_access, rank, driver_license, created_at, updated_at')
      .eq('is_active', true)
      .order('full_name');

    if (data) {
      setTechnicians(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechnicianId) return;

    createAssignment.mutate(
      {
        position_id: positionId,
        technician_id: selectedTechnicianId,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedTechnicianId('');
          setNotes('');
        },
        onError: () => {
          toast.error('Chyba při přiřazování technika');
        },
      }
    );
  };

  const loading = createAssignment.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Přiřadit technika na pozici</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="technician">Vyberte technika</Label>
            <div className="flex items-center gap-2">
            <Select
              value={selectedTechnicianId}
              onValueChange={setSelectedTechnicianId}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Vyberte technika..." />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    <div className="flex items-center gap-2 w-full">
                      {tech.rank && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${RANK_COLORS[tech.rank]}`}>
                          {tech.rank}
                        </span>
                      )}
                      <span>{tech.full_name}</span>
                      <span className="text-slate-400 text-xs ml-auto">{tech.company || (tech.is_drservis ? 'DR Servis' : '')}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTechnicianId && (() => {
              const tech = technicians.find(t => t.id === selectedTechnicianId);
              if (!tech) return null;
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="shrink-0 text-slate-400 hover:text-slate-600">
                      <Info className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 text-sm" side="right">
                    <div className="space-y-1">
                      <p className="font-medium">{tech.full_name}</p>
                      {tech.rank && (
                        <p className="text-slate-500">Rank: <span className={`font-bold px-1 rounded text-xs ${RANK_COLORS[tech.rank]}`}>{tech.rank}</span></p>
                      )}
                      {tech.phone && <p className="text-slate-500">Tel: {tech.phone}</p>}
                      {tech.driver_license && <p className="text-slate-500">ŘP: {tech.driver_license}</p>}
                      {tech.note && <p className="text-slate-500 italic text-xs">{tech.note}</p>}
                      {tech.company && <p className="text-slate-500">{tech.company}</p>}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })()}
            </div>
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
