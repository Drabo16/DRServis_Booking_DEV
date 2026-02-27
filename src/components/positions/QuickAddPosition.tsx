'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePosition } from '@/hooks/usePositions';

interface RoleTypeDB {
  id: string;
  value: string;
  label: string;
}

interface QuickAddPositionProps {
  eventId: string;
  variant?: 'default' | 'compact' | 'icon';
  onSuccess?: () => void;
}

export default function QuickAddPosition({ eventId, variant = 'default', onSuccess }: QuickAddPositionProps) {
  const [open, setOpen] = useState(false);
  const [roleTypes, setRoleTypes] = useState<RoleTypeDB[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const createPosition = useCreatePosition();

  // Load role types from database
  useEffect(() => {
    const fetchRoleTypes = async () => {
      try {
        const res = await fetch('/api/role-types');
        if (res.ok) {
          const data = await res.json();
          setRoleTypes(data.roleTypes || []);
        }
      } catch (error) {
        console.error('Error fetching role types:', error);
      }
    };
    fetchRoleTypes();
  }, []);

  // Reset selection when popover closes
  useEffect(() => {
    if (!open) {
      setSelectedRoles(new Set());
    }
  }, [open]);

  const toggleRole = (roleValue: string) => {
    setSelectedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleValue)) {
        newSet.delete(roleValue);
      } else {
        newSet.add(roleValue);
      }
      return newSet;
    });
  };

  const handleAddPositions = async () => {
    if (selectedRoles.size === 0) return;

    setIsAdding(true);

    try {
      // Add all selected positions
      for (const roleValue of selectedRoles) {
        const role = roleTypes.find(r => r.value === roleValue);
        if (role) {
          await createPosition.mutateAsync({
            event_id: eventId,
            title: role.label,
            role_type: roleValue,
          });
        }
      }

      setOpen(false);
      setSelectedRoles(new Set());
      onSuccess?.();
    } catch (error) {
      toast.error('Chyba při vytváření pozic');
    } finally {
      setIsAdding(false);
    }
  };

  const content = (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="text-xs font-medium text-slate-500 px-2 py-1.5 border-b">
        Vyberte role
      </div>
      <div className="py-1">
        {roleTypes.map((type) => (
          <label
            key={type.value}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 cursor-pointer rounded"
          >
            <Checkbox
              checked={selectedRoles.has(type.value)}
              onCheckedChange={() => toggleRole(type.value)}
            />
            <span className="text-sm">{type.label}</span>
          </label>
        ))}
      </div>
      {selectedRoles.size > 0 && (
        <div className="border-t px-2 py-2">
          <Button
            size="sm"
            className="w-full gap-1"
            onClick={handleAddPositions}
            disabled={isAdding}
          >
            {isAdding ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Přidat {selectedRoles.size} {selectedRoles.size === 1 ? 'pozici' : selectedRoles.size < 5 ? 'pozice' : 'pozic'}
          </Button>
        </div>
      )}
    </div>
  );

  if (variant === 'icon') {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={isAdding}
            onClick={(e) => e.stopPropagation()}
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-0">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  if (variant === 'compact') {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={isAdding}
            onClick={(e) => e.stopPropagation()}
          >
            {isAdding ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Pozice
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-0">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isAdding}
          onClick={(e) => e.stopPropagation()}
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Přidat pozice
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-0">
        {content}
      </PopoverContent>
    </Popover>
  );
}
