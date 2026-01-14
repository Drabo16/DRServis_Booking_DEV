'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Calendar, Users, Settings, UserCog, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface SidebarProps {
  user: User;
  profile: Profile | null;
}

export default function Sidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      label: 'Akce',
      icon: Calendar,
    },
    {
      href: '/technicians',
      label: 'Technici',
      icon: Users,
    },
    ...(profile?.role === 'admin'
      ? [
          {
            href: '/users',
            label: 'Uživatelé',
            icon: UserCog,
          },
          {
            href: '/settings',
            label: 'Nastavení',
            icon: Settings,
          },
        ]
      : []),
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 border-b border-slate-200">
        <Image
          src="/logo.png"
          alt="DR Servis"
          width={200}
          height={60}
          className="w-full h-auto"
          priority
        />
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
            <span className="text-sm font-medium text-slate-700">
              {profile?.full_name?.charAt(0) || user.email?.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {profile?.role === 'admin' ? 'Administrátor' : 'Technik'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
