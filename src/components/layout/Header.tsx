'use client';

import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw, Menu, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSidebar } from '@/contexts/SidebarContext';
import { useSaveStatus } from '@/contexts/SaveStatusContext';
import { useMyPermissions, canPerformAction } from '@/hooks/usePermissions';
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
  const { toggleMobile } = useSidebar();
  const { isSaving, savingMessage } = useSaveStatus();
  const { data: permissions } = useMyPermissions();

  // Can sync = admin/supervisor OR has booking_manage_events permission
  const canSync = canPerformAction(permissions, 'booking_manage_events');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleSync = async () => {
    if (!canSync) return;

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
    <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMobile}
          className="md:hidden p-2"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <h2 className="text-base md:text-lg font-semibold text-slate-900 truncate">
          <span className="hidden sm:inline">Vítejte, </span>
          {profile?.full_name || 'User'}
        </h2>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Save status indicator */}
        {isSaving && (
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <Save className="w-4 h-4 animate-pulse" />
            <span className="hidden md:inline">{savingMessage}</span>
          </div>
        )}

        {canSync && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="hidden sm:flex"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Synchronizovat
          </Button>
        )}

        {/* Mobile sync button (icon only) */}
        {canSync && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="sm:hidden p-2"
            title="Synchronizovat"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="hidden sm:flex"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Odhlásit se
        </Button>

        {/* Mobile logout button (icon only) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="sm:hidden p-2"
          title="Odhlásit se"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
