'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChevronDown, Info, X } from 'lucide-react';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [infoTechId, setInfoTechId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const createAssignment = useCreateAssignment();

  useEffect(() => {
    if (open) {
      loadTechnicians();
    } else {
      setDropdownOpen(false);
      setInfoTechId(null);
      setSearch('');
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setInfoTechId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const selectedTech = technicians.find(t => t.id === selectedTechnicianId);
  const loading = createAssignment.isPending;

  const filtered = technicians.filter(t =>
    !search || t.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const infoTech = infoTechId ? technicians.find(t => t.id === infoTechId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Přiřadit technika na pozici</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Vyberte technika</Label>
            <div className="relative mt-1" ref={dropdownRef}>
              {/* Trigger */}
              <button
                type="button"
                onClick={() => { setDropdownOpen(v => !v); setInfoTechId(null); }}
                className="w-full flex items-center justify-between border rounded px-3 py-2 text-sm bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {selectedTech ? (
                  <div className="flex items-center gap-2">
                    {selectedTech.rank && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${RANK_COLORS[selectedTech.rank]}`}>
                        {selectedTech.rank}
                      </span>
                    )}
                    <span>{selectedTech.full_name}</span>
                  </div>
                ) : (
                  <span className="text-slate-400">Vyberte technika...</span>
                )}
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-64 overflow-y-auto">
                  {/* Search */}
                  <div className="p-2 border-b">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Hledat..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>

                  {filtered.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-400">Žádní technici</div>
                  )}

                  {filtered.map((tech) => (
                    <div
                      key={tech.id}
                      className={`flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer group ${
                        tech.id === selectedTechnicianId ? 'bg-blue-50' : ''
                      }`}
                    >
                      {/* Selectable area */}
                      <div
                        className="flex items-center gap-2 flex-1 min-w-0"
                        onClick={() => {
                          setSelectedTechnicianId(tech.id);
                          setDropdownOpen(false);
                          setInfoTechId(null);
                          setSearch('');
                        }}
                      >
                        {tech.rank && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${RANK_COLORS[tech.rank]}`}>
                            {tech.rank}
                          </span>
                        )}
                        <span className="text-sm truncate">{tech.full_name}</span>
                        {tech.company && (
                          <span className="text-xs text-slate-400 truncate ml-auto shrink-0">{tech.company}</span>
                        )}
                      </div>

                      {/* Info button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfoTechId(prev => prev === tech.id ? null : tech.id);
                        }}
                        className="shrink-0 text-slate-400 hover:text-blue-500"
                        title="Info"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Info panel */}
              {infoTech && (
                <div className="absolute z-50 right-0 mt-1 w-52 bg-white border rounded shadow-lg p-3 text-sm">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium">{infoTech.full_name}</p>
                    <button type="button" onClick={() => setInfoTechId(null)} className="text-slate-400 hover:text-slate-600 ml-2">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    {infoTech.rank && (
                      <p>Rank: <span className={`font-bold px-1 rounded ${RANK_COLORS[infoTech.rank]}`}>{infoTech.rank}</span></p>
                    )}
                    {infoTech.phone && <p>Tel: {infoTech.phone}</p>}
                    {infoTech.driver_license && <p>ŘP: {infoTech.driver_license}</p>}
                    {infoTech.note && <p className="italic">{infoTech.note}</p>}
                    {infoTech.company && <p>{infoTech.company}</p>}
                  </div>
                </div>
              )}
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
