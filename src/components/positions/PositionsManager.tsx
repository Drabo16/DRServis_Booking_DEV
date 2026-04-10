'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, X, Mail, UserPlus, Loader2, Check, CalendarDays, Info, ChevronDown } from 'lucide-react';
import { getRoleTypeLabel, getAttendanceStatusLabel, getAttendanceStatusColor, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import type { Position, Assignment, Profile, RoleType, AttendanceStatus, EventSection } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { eventKeys } from '@/hooks/useEvents';
import { useRoleTypes, type RoleTypeDB } from '@/hooks/useRoleTypes';

// Standalone component - each instance has its own open/selectedRoles state
function AddPositionsPopover({
  sectionId,
  roleTypes,
  onAdd,
  variant = 'ghost',
  showLabel = false,
}: {
  sectionId: string | null;
  roleTypes: RoleTypeDB[];
  onAdd: (roles: string[], sectionId: string | null) => Promise<void>;
  variant?: 'ghost' | 'outline';
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (value: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onAdd(Array.from(selected), sectionId);
      setSelected(new Set());
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setSelected(new Set()); }}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={variant}
          className={showLabel ? 'text-xs md:text-sm' : 'h-7 w-7 p-0'}
          title="Přidat pozici"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className={showLabel ? 'w-4 h-4 md:mr-1' : 'w-4 h-4'} />
          )}
          {showLabel && <span className="hidden md:inline">Přidat pozice</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="text-xs font-medium text-slate-500 px-3 py-2 border-b">
          Vyberte pozice
        </div>
        <div className="py-1 px-1 max-h-60 overflow-y-auto">
          {roleTypes.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 cursor-pointer rounded"
            >
              <Checkbox
                checked={selected.has(role.value)}
                onCheckedChange={() => toggle(role.value)}
              />
              <span className="text-sm">{role.label}</span>
            </label>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="border-t px-2 py-2">
            <Button
              size="sm"
              className="w-full gap-1"
              onClick={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Přidat {selected.size} {selected.size === 1 ? 'pozici' : selected.size < 5 ? 'pozice' : 'pozic'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-slate-200 text-slate-700',
};

function TechPickerDropdown({
  technicians,
  selectedId,
  onSelect,
  roleTypes = [],
  placeholder = 'Vyberte technika...',
  className = '',
}: {
  technicians: { matching: Profile[]; others: Profile[] };
  selectedId: string;
  onSelect: (id: string) => void;
  roleTypes?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [infoTechId, setInfoTechId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setInfoTechId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allTechs = [...technicians.matching, ...technicians.others];
  const selectedTech = selectedId ? allTechs.find(t => t.id === selectedId) : null;
  const infoTech = infoTechId ? allTechs.find(t => t.id === infoTechId) : null;

  const q = search.toLowerCase();
  const filterBySearch = (techs: Profile[]) =>
    q ? techs.filter(t => t.full_name.toLowerCase().includes(q)) : techs;

  const sortByRank = (techs: Profile[]) =>
    [...techs].sort((a, b) => {
      const ra = a.rank ?? 999;
      const rb = b.rank ?? 999;
      if (ra !== rb) return ra - rb;
      return a.full_name.localeCompare(b.full_name, 'cs');
    });

  const filteredMatching = sortByRank(filterBySearch(technicians.matching));
  const filteredOthers = sortByRank(filterBySearch(technicians.others));

  const renderRow = (tech: Profile, dimmed = false) => (
    <div
      key={tech.id}
      className={`flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer ${
        tech.id === selectedId ? 'bg-blue-50' : ''
      }`}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setInfoTechId(prev => prev === tech.id ? null : tech.id); }}
        className="shrink-0 text-slate-500 hover:text-blue-600"
        title="Info"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <div
        className={`flex-1 min-w-0 text-sm truncate ${dimmed ? 'text-slate-400' : ''}`}
        onClick={() => { onSelect(tech.id); setOpen(false); setInfoTechId(null); setSearch(''); }}
      >
        {tech.full_name}
      </div>
      {tech.rank && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${RANK_COLORS[tech.rank]}`}>{tech.rank}</span>
      )}
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setInfoTechId(null); setSearch(''); }}
        className="w-full flex items-center justify-between border rounded px-3 py-2 text-sm bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {selectedTech ? (
          <span className="flex items-center gap-1.5 truncate min-w-0">
            <span className="truncate">{selectedTech.full_name}</span>
            {selectedTech.rank && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${RANK_COLORS[selectedTech.rank]}`}>
                {selectedTech.rank}
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {open && (() => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return null;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top;
        const desiredHeight = 320; // search + ~56 list rows
        const flipUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
        const maxHeight = Math.max(180, Math.min(desiredHeight, (flipUp ? spaceAbove : spaceBelow) - 12));
        const positionStyle: React.CSSProperties = flipUp
          ? { bottom: vh - rect.top + 4, left: rect.left, width: rect.width, maxHeight }
          : { top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight };
        return (
        <div
          className="fixed z-[100] bg-white border rounded shadow-lg flex flex-col"
          style={positionStyle}
        >
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
          <div className="flex-1 min-h-0 overflow-y-auto">
            {filteredMatching.length === 0 && filteredOthers.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400">
                {allTechs.length === 0 ? 'Žádní technici' : 'Nic nenalezeno'}
              </div>
            )}
            {filteredMatching.map(tech => renderRow(tech))}
            {filteredOthers.length > 0 && filteredMatching.length > 0 && (
              <div className="border-t my-0.5">
                <div className="text-[10px] font-medium text-slate-400 px-3 py-0.5">Ostatní</div>
              </div>
            )}
            {filteredOthers.map(tech => renderRow(tech, true))}
          </div>
        </div>
        );
      })()}

      {infoTech && (() => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return null;
        const panelWidth = 240; // w-60
        const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
        // Mirror the dropdown's flip-up logic so info panel opens in the same direction
        const desiredHeight = 320;
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top;
        const flipUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
        // Place to the LEFT of the trigger; if no room, fall back to right
        const leftPos = rect.left - panelWidth - 8;
        const useLeft = leftPos >= 8;
        const left = useLeft
          ? leftPos
          : Math.min(rect.right + 8, (typeof window !== 'undefined' ? window.innerWidth : 0) - panelWidth - 8);
        // Align info panel edge with the dropdown edge:
        // - dropdown opens DOWN (top: rect.bottom) → info panel top: rect.bottom
        // - dropdown opens UP   (bottom: vh - rect.top) → info panel bottom: vh - rect.top
        const style: React.CSSProperties = flipUp
          ? { bottom: vh - rect.top, left, width: panelWidth }
          : { top: rect.bottom, left, width: panelWidth };
        return (
        <div className="fixed z-[100] bg-white border rounded-lg shadow-xl p-3 text-sm" style={style}>
          <div className="flex items-start justify-between mb-2">
            <p className="font-semibold text-slate-900">{infoTech.full_name}</p>
            <button type="button" onClick={() => setInfoTechId(null)} className="text-slate-400 hover:text-slate-600 ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <p className="text-slate-600">Rank: {infoTech.rank ? <span className={`font-bold px-1.5 py-0.5 rounded ${RANK_COLORS[infoTech.rank]}`}>{infoTech.rank}</span> : <span className="text-slate-400">–</span>}</p>
            <p className="text-slate-600">Tel: {infoTech.phone || <span className="text-slate-400">–</span>}</p>
            <p className="text-slate-600">ŘP: {infoTech.driver_license || <span className="text-slate-400">–</span>}</p>
            <p className="text-slate-600">Pozice: {infoTech.specialization?.length ? infoTech.specialization.map(s => getRoleTypeLabel(s, roleTypes)).join(', ') : <span className="text-slate-400">–</span>}</p>
            {infoTech.company && <p className="text-slate-600">Firma: {infoTech.company}</p>}
            {infoTech.note && <p className="text-slate-500 italic">{infoTech.note}</p>}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

interface PositionsManagerProps {
  positions: (Position & {
    assignments: (Assignment & { technician: Profile })[];
  })[];
  sections?: EventSection[];
  eventId: string;
  isAdmin: boolean;
  allTechnicians?: Profile[];
  eventStartDate?: string;
  eventEndDate?: string;
}

interface EditDatesDialogState {
  open: boolean;
  assignmentId: string;
  technicianName: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

export default function PositionsManager({
  positions: initialPositions,
  sections: initialSections = [],
  eventId,
  isAdmin,
  allTechnicians = [],
  eventStartDate,
  eventEndDate,
}: PositionsManagerProps) {
  const queryClient = useQueryClient();
  const [positions, setPositions] = useState(initialPositions);
  const [sections, setSections] = useState<EventSection[]>(initialSections);
  const [loading, setLoading] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<{ [key: string]: string }>({});
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [addingSectionOpen, setAddingSectionOpen] = useState(false);
  const [renamingSection, setRenamingSection] = useState<string | null>(null);
  const [renameSectionName, setRenameSectionName] = useState('');

  // Dialog for editing assignment dates
  const [editDatesDialog, setEditDatesDialog] = useState<EditDatesDialogState>({
    open: false,
    assignmentId: '',
    technicianName: '',
    startDate: undefined,
    endDate: undefined,
  });

  // Parse event dates for calendar constraints
  const eventStart = eventStartDate ? new Date(eventStartDate) : undefined;
  const eventEnd = eventEndDate ? new Date(eventEndDate) : undefined;

  // Dynamic role types from database (shared cache via React Query)
  const { data: roleTypes = [] } = useRoleTypes();

  // Sync local state with props when React Query cache updates
  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  // Add a new section
  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;
    try {
      const res = await fetch(`/api/events/${eventId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const { section } = await res.json();
      setSections(prev => [...prev, section]);
      setNewSectionName('');
      setAddingSectionOpen(false);
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch {
      toast.error('Chyba při vytváření sekce');
    }
  };

  // Delete a section
  const handleDeleteSection = async (sectionId: string) => {
    const affectedCount = positions.filter(p => p.section_id === sectionId).length;
    if (!confirm(`Opravdu smazat tuto sekci? ${affectedCount > 0 ? `${affectedCount} pozic bude přesunuto do "Obecné".` : 'Sekce je prázdná.'}`)) return;
    try {
      const res = await fetch(`/api/events/${eventId}/sections?section_id=${sectionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setSections(prev => prev.filter(s => s.id !== sectionId));
      // Update positions that had this section
      setPositions(prev => prev.map(p => p.section_id === sectionId ? { ...p, section_id: null } : p));
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch {
      toast.error('Chyba při mazání sekce');
    }
  };

  // Rename a section
  const handleRenameSection = async (sectionId: string) => {
    if (!renameSectionName.trim()) return;
    try {
      const res = await fetch(`/api/events/${eventId}/sections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, name: renameSectionName.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, name: renameSectionName.trim() } : s));
      setRenamingSection(null);
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch {
      toast.error('Chyba při přejmenování sekce');
    }
  };

  // Move position to different section
  const handleMovePosition = async (positionId: string, newSectionId: string | null) => {
    // Optimistic update
    setPositions(prev => prev.map(p => p.id === positionId ? { ...p, section_id: newSectionId } : p));
    try {
      const res = await fetch('/api/positions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_id: positionId, section_id: newSectionId }),
      });
      if (!res.ok) throw new Error('Failed');
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch {
      // Rollback
      setPositions(prev => prev.map(p => p.id === positionId ? { ...p, section_id: p.section_id } : p));
      toast.error('Chyba při přesunu pozice');
    }
  };

  // Add multiple positions at once (called from AddPositionsPopover)
  const handleAddPositionsToSection = async (roles: string[], sectionId: string | null) => {
    const newPositions: (Position & { assignments: (Assignment & { technician: Profile })[] })[] = [];

    for (const roleValue of roles) {
      const role = roleTypes.find(r => r.value === roleValue);
      if (!role) continue;

      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          title: role.label,
          role_type: roleValue,
          section_id: sectionId,
        }),
      });

      if (response.ok) {
        const { position } = await response.json();
        newPositions.push({ ...position, assignments: [] });
      }
    }

    // Update UI with all new positions
    setPositions(prev => [...prev, ...newPositions]);

    // Invalidate cache to sync all views
    await queryClient.invalidateQueries({ queryKey: eventKeys.all });
  };

  const handleDeletePosition = async (positionId: string) => {
    if (!confirm('Opravdu smazat tuto pozici?')) return;

    try {
      const response = await fetch(`/api/positions?id=${positionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete position');

      // Manuální update UI bez router.refresh
      setPositions(positions.filter(p => p.id !== positionId));

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      toast.error('Chyba při mazání pozice');
    }
  };

  // Open edit dates dialog for existing assignment
  const openEditDatesDialog = (assignment: Assignment & { technician: Profile }) => {
    setEditDatesDialog({
      open: true,
      assignmentId: assignment.id,
      technicianName: assignment.technician.full_name,
      startDate: assignment.start_date ? new Date(assignment.start_date) : undefined,
      endDate: assignment.end_date ? new Date(assignment.end_date) : undefined,
    });
  };

  // Save updated dates
  const saveAssignmentDates = async () => {
    const { assignmentId, startDate, endDate } = editDatesDialog;

    setEditDatesDialog(prev => ({ ...prev, open: false }));

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update dates');

      // Update local state
      setPositions(prev => prev.map(pos => ({
        ...pos,
        assignments: (pos.assignments || []).map(a =>
          a.id === assignmentId
            ? {
                ...a,
                start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
                end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
              }
            : a
        )
      })));

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      toast.error('Chyba při aktualizaci dat');
    }
  };

  // Direct assignment for the full event (no dialog needed)
  const handleAssignTechnician = async (positionId: string, technicianId: string) => {
    const tech = allTechnicians.find(t => t.id === technicianId);
    if (!tech) return;

    // OPTIMISTIC UPDATE - okamžitě aktualizuj UI s temporary ID
    const tempAssignment = {
      id: `temp-${Date.now()}`,
      position_id: positionId,
      technician_id: technicianId,
      attendance_status: 'pending' as const,
      start_date: null, // Full event by default
      end_date: null,
      technician: tech,
    };

    setPositions(prev => prev.map(pos => {
      if (pos.id === positionId) {
        return {
          ...pos,
          assignments: [...(pos.assignments || []), tempAssignment as Assignment & { technician: Profile }]
        };
      }
      return pos;
    }));
    setSelectedTechnician({ ...selectedTechnician, [positionId]: '' });

    // Server call na pozadí
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_id: positionId,
          technician_id: technicianId,
          // No dates = full event
        }),
      });

      if (!response.ok) throw new Error('Failed to assign technician');

      const { assignment } = await response.json();

      // Nahraď temporary assignment skutečným
      setPositions(prev => prev.map(pos => {
        if (pos.id === positionId) {
          return {
            ...pos,
            assignments: (pos.assignments || []).map(a =>
              a.id === tempAssignment.id ? { ...assignment, technician: tech } : a
            )
          };
        }
        return pos;
      }));

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      // ROLLBACK - odeber temporary assignment při chybě
      setPositions(prev => prev.map(pos => {
        if (pos.id === positionId) {
          return {
            ...pos,
            assignments: (pos.assignments || []).filter(a => a.id !== tempAssignment.id)
          };
        }
        return pos;
      }));
      toast.error('Chyba při přiřazování technika');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Opravdu odebrat přiřazení?')) return;

    // Backup pro rollback - extrahuj PŘED optimistic update
    const backupRef: { value: (Assignment & { technician: Profile }) | null } = { value: null };
    setPositions(prev => {
      backupRef.value = prev.find(pos =>
        pos.assignments?.some(a => a.id === assignmentId)
      )?.assignments?.find(a => a.id === assignmentId) ?? null;

      // OPTIMISTIC UPDATE - okamžitě odeber z UI
      return prev.map(pos => ({
        ...pos,
        assignments: (pos.assignments || []).filter(a => a.id !== assignmentId)
      }));
    });

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove assignment');

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      // ROLLBACK - vrať assignment zpět - POUŽIJ PREV!
      if (backupRef.value) {
        const savedBackup = backupRef.value;
        setPositions(prev => prev.map(pos => {
          if (pos.id === savedBackup.position_id) {
            return {
              ...pos,
              assignments: [...(pos.assignments || []), savedBackup]
            };
          }
          return pos;
        }));
      }
      toast.error('Chyba při odebírání přiřazení');
    }
  };

  const handleStatusChange = async (assignmentId: string, newStatus: AttendanceStatus) => {
    // Backup starého statusu pro rollback - extrahuj PŘED optimistic update
    let oldStatus: AttendanceStatus | undefined;
    setPositions(prev => {
      oldStatus = prev
        .flatMap(pos => pos.assignments || [])
        .find(a => a.id === assignmentId)?.attendance_status;

      // OPTIMISTIC UPDATE - okamžitě změň status v UI
      return prev.map(pos => ({
        ...pos,
        assignments: (pos.assignments || []).map(a =>
          a.id === assignmentId ? { ...a, attendance_status: newStatus } : a
        )
      }));
    });

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      // Invalidate cache to sync all views
      await queryClient.invalidateQueries({ queryKey: eventKeys.all });
    } catch (error) {
      // ROLLBACK - vrať starý status - POUŽIJ PREV!
      if (oldStatus) {
        setPositions(prev => prev.map(pos => ({
          ...pos,
          assignments: (pos.assignments || []).map(a =>
            a.id === assignmentId ? { ...a, attendance_status: oldStatus! } : a
          )
        })));
      }
      toast.error('Chyba při aktualizaci statusu');
    }
  };

  const handleInvite = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });

      if (response.ok) {
        toast.success('Pozvánka odeslána!');
      } else {
        toast.error('Chyba při odesílání pozvánky');
      }
    } catch (error) {
      toast.error('Chyba při odesílání pozvánky');
    }
  };

  // Check if a specialization value is "related" to a position's role type.
  // Exact match OR the position's label starts with the specialization's label
  // (e.g. spec "Rigger" matches position "Rigger 2", "Rigger 3", etc.)
  const isSpecRelated = (specValue: string, posRoleType: string): boolean => {
    if (specValue === posRoleType) return true;
    const specLabel = getRoleTypeLabel(specValue, roleTypes).toLowerCase().trim();
    const posLabel = getRoleTypeLabel(posRoleType, roleTypes).toLowerCase().trim();
    // Same label (handles old value → new DB value mapping, e.g. "lights" → "Osvětlovač")
    if (specLabel === posLabel) return true;
    // Position label starts with spec label + space (e.g. "Rigger 2" ← "Rigger")
    return posLabel.startsWith(specLabel + ' ');
  };

  // Render a single position row (desktop table)
  const renderPositionRow = (position: typeof positions[0]) => (
    <TableRow key={position.id}>
      <TableCell className="font-medium">
        <Badge variant="outline">{getRoleTypeLabel(position.role_type, roleTypes)}</Badge>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          {position.assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-md"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {assignment.technician.full_name}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-500 truncate">
                    {assignment.technician.email}
                  </p>
                  {(assignment.start_date || assignment.end_date) && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {assignment.start_date && format(new Date(assignment.start_date), 'd.M.', { locale: cs })}
                      {assignment.start_date && assignment.end_date && ' - '}
                      {assignment.end_date && format(new Date(assignment.end_date), 'd.M.', { locale: cs })}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin ? (
                  <>
                    <Select
                      value={assignment.attendance_status}
                      onValueChange={(value) =>
                        handleStatusChange(assignment.id, value as AttendanceStatus)
                      }
                      disabled={updatingStatus === assignment.id}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Čeká</SelectItem>
                        <SelectItem value="accepted">Přijato</SelectItem>
                        <SelectItem value="declined">Odmítnuto</SelectItem>
                        <SelectItem value="tentative">Předběžně</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => openEditDatesDialog(assignment)} title="Upravit období">
                      <CalendarDays className="w-4 h-4" />
                    </Button>
                    {assignment.attendance_status === 'pending' && (
                      <Button size="sm" variant="ghost" onClick={() => handleInvite(assignment.id)}>
                        <Mail className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveAssignment(assignment.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <Badge className={getAttendanceStatusColor(assignment.attendance_status)}>
                    {getAttendanceStatusLabel(assignment.attendance_status)}
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {isAdmin && (
            <div className="flex items-center gap-2">
              {(() => {
                const available = allTechnicians.filter(t => !position.assignments.some(a => a.technician_id === t.id));
                const matching = available.filter(t => t.specialization?.some(s => isSpecRelated(s, position.role_type)));
                const others = available.filter(t => !t.specialization?.some(s => isSpecRelated(s, position.role_type)));
                return (
                  <TechPickerDropdown
                    technicians={{ matching, others }}
                    selectedId={selectedTechnician[position.id] || ''}
                    onSelect={(id) => setSelectedTechnician({ ...selectedTechnician, [position.id]: id })}
                    roleTypes={roleTypes}
                    className="flex-1"
                  />
                );
              })()}
              <Button
                size="sm"
                onClick={() => {
                  if (selectedTechnician[position.id]) {
                    handleAssignTechnician(position.id, selectedTechnician[position.id]);
                  }
                }}
                disabled={!selectedTechnician[position.id]}
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </TableCell>
      {isAdmin && (
        <TableCell>
          <div className="flex items-center gap-1">
            {sections.length > 0 && (
              <select
                value={position.section_id || ''}
                onChange={(e) => handleMovePosition(position.id, e.target.value || null)}
                className="h-7 text-[11px] border rounded px-1 bg-white text-slate-600"
                title="Přesunout do sekce"
              >
                <option value="">Obecné</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <Button size="sm" variant="ghost" onClick={() => handleDeletePosition(position.id)}>
              <Trash2 className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );

  // Build section groups for rendering
  const sectionGroups = (() => {
    const groups: { section: EventSection | null; positions: typeof positions }[] = [];
    for (const section of sections) {
      groups.push({ section, positions: positions.filter(p => p.section_id === section.id) });
    }
    const unsectioned = positions.filter(p => !p.section_id);
    if (unsectioned.length > 0 || sections.length === 0) {
      groups.push({ section: null, positions: unsectioned });
    }
    return groups;
  })();

  // (AddPositionsPopover is now a standalone component above)

  // Render mobile card for a single position
  const renderMobilePositionCard = (position: typeof positions[0]) => (
    <div key={position.id} className="border rounded-lg p-3 bg-slate-50">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="text-xs">{getRoleTypeLabel(position.role_type, roleTypes)}</Badge>
        {isAdmin && (
          <div className="flex items-center gap-1">
            {sections.length > 0 && (
              <select
                value={position.section_id || ''}
                onChange={(e) => handleMovePosition(position.id, e.target.value || null)}
                className="h-7 text-[11px] border rounded px-1 bg-white text-slate-600"
              >
                <option value="">Obecné</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeletePosition(position.id)}
              className="h-9 w-9 p-0"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {position.assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="flex flex-col gap-2 p-2 bg-white rounded-md border"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {assignment.technician.full_name}
                </p>
                {(assignment.start_date || assignment.end_date) && (
                  <Badge variant="outline" className="text-xs gap-1 mt-1">
                    <CalendarDays className="w-3 h-3" />
                    {assignment.start_date && format(new Date(assignment.start_date), 'd.M.', { locale: cs })}
                    {assignment.start_date && assignment.end_date && ' - '}
                    {assignment.end_date && format(new Date(assignment.end_date), 'd.M.', { locale: cs })}
                  </Badge>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDatesDialog(assignment)}
                    className="h-9 w-9 p-0"
                    title="Upravit období"
                  >
                    <CalendarDays className="w-4 h-4" />
                  </Button>
                  {assignment.attendance_status === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleInvite(assignment.id)}
                      className="h-9 w-9 p-0"
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveAssignment(assignment.id)}
                    className="h-9 w-9 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            {isAdmin ? (
              <Select
                value={assignment.attendance_status}
                onValueChange={(value) =>
                  handleStatusChange(assignment.id, value as AttendanceStatus)
                }
                disabled={updatingStatus === assignment.id}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Čeká</SelectItem>
                  <SelectItem value="accepted">Přijato</SelectItem>
                  <SelectItem value="declined">Odmítnuto</SelectItem>
                  <SelectItem value="tentative">Předběžně</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className={`${getAttendanceStatusColor(assignment.attendance_status)} text-xs`}>
                {getAttendanceStatusLabel(assignment.attendance_status)}
              </Badge>
            )}
          </div>
        ))}
        {isAdmin && (
          <div className="flex items-center gap-2 pt-1">
            {(() => {
              const available = allTechnicians.filter(t => !position.assignments.some(a => a.technician_id === t.id));
              const matching = available.filter(t => t.specialization?.some(s => isSpecRelated(s, position.role_type)));
              const others = available.filter(t => !t.specialization?.some(s => isSpecRelated(s, position.role_type)));
              return (
                <TechPickerDropdown
                  technicians={{ matching, others }}
                  selectedId={selectedTechnician[position.id] || ''}
                  onSelect={(id) => setSelectedTechnician({ ...selectedTechnician, [position.id]: id })}
                  roleTypes={roleTypes}
                  placeholder="Přidat technika..."
                  className="flex-1"
                />
              );
            })()}
            <Button
              size="sm"
              onClick={() => {
                if (selectedTechnician[position.id]) {
                  handleAssignTechnician(position.id, selectedTechnician[position.id]);
                }
              }}
              disabled={!selectedTechnician[position.id]}
              className="h-8 w-8 p-0"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Render a section group (mobile)
  const renderMobileSectionGroup = (group: { section: EventSection | null; positions: typeof positions }) => (
    <div key={group.section?.id || 'general'} className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {isAdmin && group.section && renamingSection === group.section.id ? (
            <div className="flex items-center gap-1">
              <Input
                value={renameSectionName}
                onChange={e => setRenameSectionName(e.target.value)}
                className="h-6 w-28 text-xs"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameSection(group.section!.id);
                  if (e.key === 'Escape') setRenamingSection(null);
                }}
                autoFocus
              />
              <button onClick={() => handleRenameSection(group.section!.id)} className="text-green-600">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setRenamingSection(null)} className="text-slate-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <span
                className={`text-xs font-semibold text-slate-600 uppercase tracking-wide ${isAdmin && group.section ? 'cursor-pointer' : ''}`}
                onDoubleClick={() => {
                  if (isAdmin && group.section) {
                    setRenamingSection(group.section.id);
                    setRenameSectionName(group.section.name);
                  }
                }}
              >
                {group.section?.name || 'Obecné'}
              </span>
              {isAdmin && group.section && (
                <button onClick={() => handleDeleteSection(group.section!.id)} className="text-slate-400 hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
        {isAdmin && (
            <AddPositionsPopover
              sectionId={group.section?.id || null}
              roleTypes={roleTypes}
              onAdd={handleAddPositionsToSection}
            />
          )}
      </div>
      {group.positions.map(renderMobilePositionCard)}
      {group.positions.length === 0 && (
        <p className="text-xs text-slate-400 pl-1">Žádné pozice</p>
      )}
    </div>
  );

  return (
    <Card className="min-h-[420px]">
      <CardHeader className="pb-2 md:pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-xl">Pozice a přiřazení</CardTitle>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {addingSectionOpen ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newSectionName}
                    onChange={e => setNewSectionName(e.target.value)}
                    placeholder="Název sekce..."
                    className="h-7 w-32 text-xs"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') setAddingSectionOpen(false); }}
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleAddSection}>
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAddingSectionOpen(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddingSectionOpen(true)}>
                  <Plus className="w-3 h-3" />
                  Sekce
                </Button>
              )}
              {/* Top-level add positions button (adds to "general" / no section) */}
              {sections.length === 0 && (
                <AddPositionsPopover
                  sectionId={null}
                  roleTypes={roleTypes}
                  onAdd={handleAddPositionsToSection}
                  variant="outline"
                  showLabel
                />
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2 md:p-6">
        {/* Mobile: Card layout with section groups */}
        <div className="md:hidden space-y-4">
          {sections.length > 0
            ? sectionGroups.map(renderMobileSectionGroup)
            : positions.map(renderMobilePositionCard)
          }
        </div>

        {/* Desktop: Table layout with section groups */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Pozice</TableHead>
                <TableHead>Přiřazení technici</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Akce</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.length > 0
                ? sectionGroups.map(group => (
                    <React.Fragment key={group.section?.id || 'general'}>
                      <TableRow className="bg-slate-100 hover:bg-slate-100">
                        <TableCell colSpan={isAdmin ? 3 : 2} className="py-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isAdmin && group.section && renamingSection === group.section.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={renameSectionName}
                                    onChange={e => setRenameSectionName(e.target.value)}
                                    className="h-6 w-32 text-xs"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleRenameSection(group.section!.id);
                                      if (e.key === 'Escape') setRenamingSection(null);
                                    }}
                                    autoFocus
                                  />
                                  <button onClick={() => handleRenameSection(group.section!.id)} className="text-green-600 hover:text-green-700">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setRenamingSection(null)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span
                                    className={`text-xs font-semibold text-slate-600 uppercase tracking-wide ${isAdmin && group.section ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                    onDoubleClick={() => {
                                      if (isAdmin && group.section) {
                                        setRenamingSection(group.section.id);
                                        setRenameSectionName(group.section.name);
                                      }
                                    }}
                                    title={isAdmin && group.section ? 'Dvojklik pro přejmenování' : undefined}
                                  >
                                    {group.section?.name || 'Obecné'}
                                  </span>
                                  {isAdmin && group.section && (
                                    <button onClick={() => handleDeleteSection(group.section!.id)} className="text-slate-400 hover:text-red-600">
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                            {isAdmin && (
                              <AddPositionsPopover
                                sectionId={group.section?.id || null}
                                roleTypes={roleTypes}
                                onAdd={handleAddPositionsToSection}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.positions.map(renderPositionRow)}
                      {group.positions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 3 : 2} className="py-2 text-xs text-slate-400 text-center">
                            Žádné pozice
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                : positions.map(renderPositionRow)
              }
            </TableBody>
          </Table>
        </div>

        {positions.length === 0 && sections.length === 0 && (
          <div className="text-center py-6 md:py-8 text-slate-500 text-sm">
            {isAdmin ? 'Zatím nejsou vytvořené žádné pozice.' : 'Pro tuto akci zatím nejsou vytvořené žádné pozice.'}
          </div>
        )}
      </CardContent>

      {/* Dialog for editing assignment dates */}
      <Dialog open={editDatesDialog.open} onOpenChange={(open) => setEditDatesDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upravit období účasti</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Technik: <strong>{editDatesDialog.technicianName}</strong>
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Od</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !editDatesDialog.startDate && "text-slate-400"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {editDatesDialog.startDate
                          ? format(editDatesDialog.startDate, "d. M. yyyy", { locale: cs })
                          : "Celá akce"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDatesDialog.startDate}
                        onSelect={(date) => setEditDatesDialog(prev => ({ ...prev, startDate: date }))}
                        disabled={eventStart && eventEnd ? { before: eventStart, after: eventEnd } : undefined}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Do</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !editDatesDialog.endDate && "text-slate-400"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {editDatesDialog.endDate
                          ? format(editDatesDialog.endDate, "d. M. yyyy", { locale: cs })
                          : "Celá akce"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDatesDialog.endDate}
                        onSelect={(date) => setEditDatesDialog(prev => ({ ...prev, endDate: date }))}
                        disabled={eventStart && eventEnd ? { before: editDatesDialog.startDate || eventStart, after: eventEnd } : undefined}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {(editDatesDialog.startDate || editDatesDialog.endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditDatesDialog(prev => ({ ...prev, startDate: undefined, endDate: undefined }))}
                  className="text-xs text-slate-500"
                >
                  Zrušit období (celá akce)
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDatesDialog(prev => ({ ...prev, open: false }))}>
              Zrušit
            </Button>
            <Button onClick={saveAssignmentDates}>
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
