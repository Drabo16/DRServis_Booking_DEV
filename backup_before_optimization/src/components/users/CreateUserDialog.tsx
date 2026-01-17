'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import { ROLE_TYPES } from '@/lib/constants';

export default function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'technician' as 'admin' | 'technician',
    specialization: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          specialization: formData.specialization.length > 0 ? formData.specialization : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      // Reset form
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        role: 'technician',
        specialization: [],
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Chyba při vytváření uživatele');
    } finally {
      setLoading(false);
    }
  };

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
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value: 'admin' | 'technician') =>
                setFormData({ ...formData, role: value })
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Technik</SelectItem>
                <SelectItem value="admin">Administrátor</SelectItem>
              </SelectContent>
            </Select>
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
