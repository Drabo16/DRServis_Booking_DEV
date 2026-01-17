'use client';

import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface HeaderProps {
  user: User;
  profile: Profile | null;
}

export default function Header({ user, profile }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [syncing, setSyncing] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleSync = async () => {
    if (profile?.role !== 'admin') return;

    setSyncing(true);
    try {
      const response = await fetch('/api/sync/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysAhead: 90 }),
      });

      if (response.ok) {
        router.refresh();
        alert('Synchronizace dokončena!');
      } else {
        alert('Chyba při synchronizaci');
      }
    } catch (error) {
      alert('Chyba při synchronizaci');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Vítejte, {profile?.full_name || 'User'}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {profile?.role === 'admin' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Synchronizovat
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Odhlásit se
        </Button>
      </div>
    </header>
  );
}
