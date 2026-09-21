'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Boxes, BarChart3, User, Shield } from 'lucide-react';
import { getAuthSession, hasWorkspaceAccess, UserProfile } from './auth';

export default function PlatformHeader() {
  const pathname = usePathname();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const syncProfile = () => {
      const session = getAuthSession();
      if (session && session.user) {
        setUserProfile(session.user);
      } else {
        setUserProfile(null);
      }
    };

    const refreshProfileFromBackend = async () => {
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
            if (typeof window !== 'undefined') {
              document.cookie = `nalka_user=${encodeURIComponent(JSON.stringify(freshUser))}; path=/; max-age=86400; SameSite=Lax`;
            }
          }
        }
      } catch (err) {
        // preserve local session gracefully
      }
    };

    syncProfile();
    refreshProfileFromBackend();

    const handleAuthEvent = () => {
      syncProfile();
      refreshProfileFromBackend();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nalka_auth_change', handleAuthEvent);
      window.addEventListener('storage', handleAuthEvent);
      window.addEventListener('focus', handleAuthEvent);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleAuthEvent();
        }
      });
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('nalka_auth_change', handleAuthEvent);
        window.removeEventListener('storage', handleAuthEvent);
        window.removeEventListener('focus', handleAuthEvent);
      }
    };
  }, [pathname]);

  const isSalesActive = pathname?.startsWith('/sales');
  const isOperationsActive = pathname?.startsWith('/operations');
  const isManagementActive = pathname?.startsWith('/management');

  // If on login page, don't render header
  if (pathname === '/login') return null;

  const userRole = userProfile?.role || 'viewer';
  const canAccessSales = hasWorkspaceAccess('sales', userRole);
  const canAccessOperations = hasWorkspaceAccess('operations', userRole);
  const canAccessManagement = hasWorkspaceAccess('management', userRole);

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand & Workspace Title */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-base tracking-wide text-white hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <span>BUSINESS OPS PLATFORM</span>
          </Link>

          {/* Permission-Aware Workspace Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            {canAccessSales && (
              <Link
                href="/sales"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSalesActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Sales Workspace</span>
              </Link>
            )}

            {canAccessOperations && (
              <Link
                href="/operations"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isOperationsActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Operations Workspace</span>
              </Link>
            )}

            {canAccessManagement && (
              <Link
                href="/management"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isManagementActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Management Workspace</span>
              </Link>
            )}
          </nav>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3">
          {userProfile ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 rounded-lg border border-slate-700/50 text-xs">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-medium text-slate-200">{userProfile.full_name || userProfile.email}</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] uppercase">
                {userProfile.role}
              </span>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Permission-Aware Nav Bar */}
      <div className="flex md:hidden border-t border-slate-800 px-4 sm:px-6 py-1.5 bg-slate-950 overflow-x-auto gap-1">
        {canAccessSales && (
          <Link
            href="/sales"
            className={`flex-1 text-center py-1.5 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap ${
              isSalesActive ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Sales
          </Link>
        )}
        {canAccessOperations && (
          <Link
            href="/operations"
            className={`flex-1 text-center py-1.5 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap ${
              isOperationsActive ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Operations
          </Link>
        )}
        {canAccessManagement && (
          <Link
            href="/management"
            className={`flex-1 text-center py-1.5 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap ${
              isManagementActive ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Management
          </Link>
        )}
      </div>
    </header>
  );
}
