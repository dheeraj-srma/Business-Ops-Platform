'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Megaphone,
  Factory,
  Gem,
  Shield,
  Check,
  User
} from 'lucide-react';
import { getAuthSession, hasWorkspaceAccess, UserProfile } from '../auth';

export type WorkspaceType = 'sales' | 'operations' | 'management';

export interface WorkspaceSwitcherProps {
  currentWorkspace?: WorkspaceType;
}

interface WorkspaceItem {
  id: WorkspaceType;
  label: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
}

const WORKSPACES: WorkspaceItem[] = [
  {
    id: 'sales',
    label: 'Sales',
    route: '/sales',
    icon: Megaphone,
  },
  {
    id: 'operations',
    label: 'Operations',
    route: '/operations',
    icon: Factory,
  },
  {
    id: 'management',
    label: 'Management',
    route: '/management',
    icon: Gem,
  },
];

export default function WorkspaceSwitcher({ currentWorkspace: propWorkspace }: WorkspaceSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastProfileCheckRef = useRef<number>(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Determine active workspace from prop or URL pathname
  const activeWorkspace: WorkspaceType | 'platform' = useMemo(() => {
    if (propWorkspace) return propWorkspace;
    if (pathname?.startsWith('/sales')) return 'sales';
    if (pathname?.startsWith('/operations')) return 'operations';
    if (pathname?.startsWith('/management')) return 'management';
    return 'platform';
  }, [propWorkspace, pathname]);

  // Auth session sync
  useEffect(() => {
    const syncProfile = () => {
      const session = getAuthSession();
      setUserProfile(session?.user || null);
    };

    const refreshProfile = async () => {
      try {
        const session = getAuthSession();
        const headers: Record<string, string> = {};
        if (session?.token && session.token !== 'httponly-session-token') {
          headers['Authorization'] = `Bearer ${session.token}`;
        }
        const res = await fetch('/api/auth/me', { headers, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            const freshUser: UserProfile = {
              id: data.user.id || data.user.user_id || 'usr-active',
              email: data.user.email || '',
              role: data.user.role || 'viewer',
              full_name: data.user.full_name || data.user.email || 'User',
              salesman_id: data.user.salesman_id,
            };
            setUserProfile(freshUser);
          }
        }
      } catch {
        // preserve local session gracefully
      }
    };

    syncProfile();
    refreshProfile();

    const handleAuthEvent = () => {
      syncProfile();
      refreshProfile();
    };

    const handleFocus = () => {
      if (Date.now() - lastProfileCheckRef.current > 300000) {
        refreshProfile();
      }
    };

    window.addEventListener('nalka_auth_change', handleAuthEvent);
    window.addEventListener('storage', handleAuthEvent);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('nalka_auth_change', handleAuthEvent);
      window.removeEventListener('storage', handleAuthEvent);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);



  // Close popover when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close popover on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % availableWorkspaces.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + availableWorkspaces.length) % availableWorkspaces.length);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // If on login page, do not render switcher
  if (pathname === '/login') return null;
  if (!isClient) return null;

  const userRole = userProfile?.role || 'viewer';

  // Filter workspaces based on role authorization
  const availableWorkspaces = WORKSPACES.filter((ws) =>
    hasWorkspaceAccess(ws.id, userRole)
  );

  // Active workspace icon
  const getActiveIcon = () => {
    switch (activeWorkspace) {
      case 'sales':
        return Megaphone;
      case 'operations':
        return Factory;
      case 'management':
        return Gem;
      default:
        return Shield;
    }
  };

  const ActiveIcon = getActiveIcon();

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const handleSelectWorkspace = (route: string) => {
    setIsOpen(false);
    router.push(route);
  };

  return (
    <div
      ref={containerRef}
      id="platform-workspace-switcher"
      className="fixed bottom-2.5 left-3.5 z-40 select-none"
    >
      {/* 1. Collapsed State: Compact Global Control Button */}
      <button
        ref={triggerRef}
        type="button"
        id="btn-workspace-switcher-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Switch Workspace. Currently in ${activeWorkspace} workspace.`}
        title="Switch Workspace"
        className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-md ${
          isOpen
            ? 'bg-slate-800 text-white border border-indigo-500/60 ring-2 ring-indigo-500/40 shadow-indigo-500/20'
            : 'bg-slate-900/95 hover:bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700/60 hover:border-slate-600 shadow-black/40'
        }`}
      >
        <ActiveIcon className="w-4 h-4 text-indigo-400" />
        {/* Subtle active status indicator dot */}
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
      </button>

      {/* 2. Expanded State: Compact Popover Anchored to Control */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Switch Workspace"
          className="absolute bottom-full mb-2.5 left-0 w-64 sm:w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 origin-bottom-left text-slate-100"
        >
          {/* Header */}
          <div className="px-2.5 pt-1.5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            SWITCH WORKSPACE
          </div>

          {/* Workspace Options */}
          <div className="space-y-1">
            {availableWorkspaces.map((ws, idx) => {
              const Icon = ws.icon;
              const isActive = activeWorkspace === ws.id;
              const isKeyboardFocused = focusedIndex === idx;

              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelectWorkspace(ws.route)}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors duration-150 cursor-pointer text-left ${
                    isActive
                      ? 'bg-indigo-600/20 text-white font-semibold border border-indigo-500/30'
                      : isKeyboardFocused
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-indigo-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{ws.label}</span>
                  </div>

                  {isActive && (
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-slate-800/80" />

          {/* Secondary User Profile Footer */}
          {userProfile ? (
            <div className="px-2 py-1 flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 shrink-0">
                {getInitials(userProfile.full_name, userProfile.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-200 truncate leading-tight">
                  {userProfile.full_name || userProfile.email}
                </div>
                <div className="text-[10px] text-slate-400 font-mono font-medium uppercase tracking-wider mt-0.5 truncate">
                  {userProfile.role}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-2 py-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span>Not signed in</span>
              </div>
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
