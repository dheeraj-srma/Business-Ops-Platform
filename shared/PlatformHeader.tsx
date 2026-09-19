'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingCart, Boxes, BarChart3, LogOut, User, Shield, ChevronDown } from 'lucide-react';

export default function PlatformHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<{ email?: string; role?: string; name?: string } | null>(null);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('nalka_terminal_session') || localStorage.getItem('app_user');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        setUserProfile(parsed.profile || parsed.user || { name: 'Authorized User', role: 'manager' });
      } else {
        setUserProfile({ name: 'Operations User', role: 'admin' });
      }
    } catch (e) {
      setUserProfile({ name: 'Operations User', role: 'admin' });
    }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('nalka_terminal_session');
      localStorage.removeItem('app_auth');
      localStorage.removeItem('app_role');
    } catch (e) {}
    router.push('/login');
  };

  const isSalesActive = pathname?.startsWith('/sales');
  const isOperationsActive = pathname?.startsWith('/operations');
  const isManagementActive = pathname?.startsWith('/management');

  // If on login page, don't render header
  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand & Workspace Title */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-base tracking-wide text-white hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <span>BUSINESS OPS PLATFORM</span>
          </Link>

          {/* Workspace Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
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
          </nav>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800/60 rounded-lg border border-slate-700/50 text-xs">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-slate-200">{userProfile?.name || 'User'}</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] uppercase">
              {userProfile?.role || 'User'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile Workspace Tabs Bar */}
      <div className="flex md:hidden border-t border-slate-800 px-2 py-1.5 bg-slate-950 overflow-x-auto gap-1">
        <Link
          href="/sales"
          className={`flex-1 text-center py-1.5 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap ${
            isSalesActive ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Sales
        </Link>
        <Link
          href="/operations"
          className={`flex-1 text-center py-1.5 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap ${
            isOperationsActive ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Operations
        </Link>
        <Link
          href="/management"
          className={`flex-1 text-center py-1.5 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap ${
            isManagementActive ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Management
        </Link>
      </div>
    </header>
  );
}
