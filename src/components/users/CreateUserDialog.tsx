'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Crown, UserCog, User, Check } from 'lucide-react';
import { ROLE_TYPES } from '@/lib/constants';
import { UserRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/types';
import { useCreateUser } from '@/hooks/useUsers';

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <Crown className="w-4 h-4" />,
  manager: <UserCog className="w-4 h-4" />,
  technician: <User className="w-4 h-4" />,
};

export default function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'technician' as UserRole,
    specialization: [] as string[],
  });

  const createUser = useCreateUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    createUser.mutate(
      {
        ...formData,
        specialization: formData.specialization.length > 0 ? formData.specialization : null,
      },
      {
        onSuccess: () => {
          // Reset form and close dialog
          setFormData({
            email: '',
            full_name: '',
            phone: '',
            role: 'technician',
            specialization: [],
          });
          setOpen(false);
        },
        onError: (error) => {
          alert(error instanceof Error ? error.message : 'Chyba při vytváření uživatele');
        },
      }
    );
  };

  const loading = createUser.isPending;

  const toggleSpecialization = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      specialization: prev.specialization.includes(value)
        ? prev.specialization.filter((s) => s !== value)
        : [...prev.specialization, value],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Přidat uživatele
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nový uživatel</DialogTitle>
          <DialogDescription>
            Vytvořte nový uživatelský účet. Uživatel se bude moci přihlásit přes Google OAuth.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="uzivatel@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Celé jméno *</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Jan Novák"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+420 123 456 789"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Role *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['technician', 'manager', 'admin'] as UserRole[]).map((role) => {
                const isSelected = formData.role === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setFormData({ ...formData, role })}
                    disabled={loading}
                    className={`p-2 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={isSelected ? 'text-blue-600' : 'text-slate-500'}>
                        {ROLE_ICONS[role]}
                      </span>
                      <span className={`font-medium text-xs ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                        {ROLE_LABELS[role]}
                      </span>
                      {isSelected && <Check className="w-3 h-3 text-blue-600 ml-auto" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[formData.role]}</p>
          </div>

          <div className="space-y-2">
            <Label>Specializace</Label>
            <div className="flex flex-wrap gap-2">
              {ROLE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => toggleSpecialization(type.value)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    formData.specialization.includes(type.value)
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  disabled={loading}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Vytváření...' : 'Vytvořit uživatele'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Zrušit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
