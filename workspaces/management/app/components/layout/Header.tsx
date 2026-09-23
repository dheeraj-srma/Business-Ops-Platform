'use client';
import React, { useState } from 'react';
import {
  RefreshCw,
  Menu,
  Sun,
  Moon,
  Database,
  LogOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { clearAuthSession } from '@/shared/auth';

interface HeaderProps {
  currentTabTitle?: string;
  subtitle?: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onOpenMobileMenu?: () => void;
  // Kept optional for backwards compatibility
  role?: string;
  allowNegativeOrders?: boolean;
  onToggleStockOverride?: (enabled: boolean) => void | Promise<void>;
  onSwitchRole?: (role: any) => void;
  onOpenStockIn?: () => void;
  onOpenStockOut?: () => void;
  onOpenStockAdjustment?: () => void;
  onOpenNewProduct?: () => void;
  onOpenTallyExport?: () => void;
  onOpenHelp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTabTitle = 'Executive Business Insights',
  subtitle = 'Enterprise business intelligence, financial valuation, and sales velocity',
  onRefresh,
  isRefreshing = false,
  onOpenMobileMenu,
}) => {
  const { isDark, toggleTheme } = useTheme();

  // Logout Confirmation
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      await clearAuthSession();
    } catch (err) {
      console.warn('Logout error:', err);
    }
    window.location.href = '/login';
  };

  return (
    <>
    <header
      id="app-header"
      className="min-h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 z-10 transition-colors shadow-xs dark:shadow-none"
    >
      {/* Left: Mobile Hamburger & Page Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            id="btn-mobile-menu"
            onClick={onOpenMobileMenu}
            title="Open navigation menu"
            className="md:hidden p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
            {currentTabTitle}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">{subtitle}</p>
        </div>
      </div>

      {/* Right: Live Database Status, Theme Toggle & Refresh */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Database Status Capsule */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs shadow-xs dark:shadow-none">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600 dark:bg-indigo-500"></span>
          </span>
          <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">
            4,315 Master SKUs <span className="text-slate-400 dark:text-slate-600">•</span> 804 Dealers <span className="text-slate-400 dark:text-slate-600">•</span> 211 Suppliers
          </span>
        </div>

        <button
          id="btn-theme-toggle"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="p-2 text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all duration-150 ease-out hover:scale-110 active:scale-90 cursor-pointer"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-sky-600 transition-transform duration-200 -rotate-12 hover:rotate-0" />
          )}
        </button>

        {/* Refresh button */}
        <button
          id="btn-header-refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Business Intelligence & Analytics"
          className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-indigo-600 dark:text-indigo-400')} />
        </button>

        {/* Logout button */}
        <button
          id="btn-header-logout"
          onClick={() => setShowLogoutConfirm(true)}
          title="Sign out of Admin Management Workspace"
          className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-slate-200 dark:border-slate-700/60 hover:border-rose-300 dark:hover:border-rose-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-all flex items-center gap-1.5 cursor-pointer ml-1 shadow-xs dark:shadow-none"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden sm:inline text-xs">Logout</span>
        </button>
      </div>
    </header>

    {/* Logout Confirmation Modal */}
    {showLogoutConfirm && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sign Out?</h3>
              <p className="text-xs text-slate-400">Your admin session will be ended.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
