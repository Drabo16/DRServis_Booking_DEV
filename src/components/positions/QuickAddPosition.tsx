'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Loader2 } from 'lucide-react';
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
  const createPosition = useCreatePosition();
  const loading = createPosition.isPending;

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

  const handleAddPosition = (roleType: string, label: string) => {
    createPosition.mutate(
      {
        event_id: eventId,
        title: label,
        role_type: roleType,
      },
      {
        onSuccess: () => {
          setOpen(false);
          onSuccess?.();
        },
        onError: () => {
          alert('Chyba při vytváření pozice');
        },
      }
    );
  };

  if (variant === 'icon') {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={loading}
            onClick={(e) => e.stopPropagation()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {roleTypes.map((type) => (
            <DropdownMenuItem
              key={type.value}
              onClick={() => handleAddPosition(type.value, type.label)}
            >
              + {type.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'compact') {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={loading}
            onClick={(e) => e.stopPropagation()}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Pozice
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {roleTypes.map((type) => (
            <DropdownMenuItem
              key={type.value}
              onClick={() => handleAddPosition(type.value, type.label)}
            >
              + {type.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Přidat pozici
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {roleTypes.map((type) => (
          <DropdownMenuItem
            key={type.value}
            onClick={() => handleAddPosition(type.value, type.label)}
          >
            + {type.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
