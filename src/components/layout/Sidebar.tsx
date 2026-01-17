'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Calendar, Users, Settings, UserCog, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface SidebarProps {
  user: User;
  profile: Profile | null;
}

export default function Sidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, toggleCollapse, closeMobile } = useSidebar();

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

  const sidebarContent = (
    <>
      {/* Logo section */}
      <div className={cn(
        "border-b border-slate-200 flex items-center",
        isCollapsed ? "p-3 justify-center" : "p-6"
      )}>
        {isCollapsed ? (
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">DR</span>
          </div>
        ) : (
          <Image
            src="/logo.png"
            alt="DR Servis"
            width={200}
            height={60}
            className="w-full h-auto"
            priority
          />
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 p-4 space-y-1", isCollapsed && "p-2")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={closeMobile}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-lg transition-colors',
                isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User profile section */}
      <div className={cn(
        "border-t border-slate-200",
        isCollapsed ? "p-2" : "p-4"
      )}>
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center p-2" : "gap-3 px-4 py-3"
        )}>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-slate-700">
              {profile?.full_name?.charAt(0) || user.email?.charAt(0)}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {profile?.role === 'admin' ? 'Administrátor' : 'Technik'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle button - desktop only */}
      <button
        onClick={toggleCollapse}
        className="hidden md:flex absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center shadow-sm hover:bg-slate-50 transition-colors"
        title={isCollapsed ? 'Rozbalit menu' : 'Sbalit menu'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-slate-600" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        )}
      </button>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={cn(
          "hidden md:flex flex-col bg-white border-r border-slate-200 relative transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile close button */}
        <button
          onClick={closeMobile}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-700"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </div>
    </>
  );
}
