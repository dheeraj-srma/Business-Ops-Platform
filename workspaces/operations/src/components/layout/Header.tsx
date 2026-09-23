import React, { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Menu,
  Sun,
  Moon,
  HelpCircle,
  Database,
  LogOut,
} from 'lucide-react';
import { UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { clearAuthSession, getAuthSession } from '@/shared/auth';

interface HeaderProps {
  currentTabTitle?: string;
  subtitle?: string;
  role: UserRole;
  allowNegativeOrders?: boolean;
  onToggleStockOverride?: (enabled: boolean) => void | Promise<void>;
  onSwitchRole?: (role: UserRole) => void;
  onOpenStockIn?: () => void;
  onOpenStockOut?: () => void;
  onOpenStockAdjustment?: () => void;
  onOpenNewProduct?: () => void;
  onOpenTallyExport?: () => void;
  onOpenHelp?: () => void;
  onOpenBackup?: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTabTitle = 'Inventory Management',
  subtitle = 'Stock ledger and Tally synchronization',
  role,
  allowNegativeOrders = false,
  onToggleStockOverride,
  onSwitchRole,
  onOpenHelp,
  onOpenBackup,
  onRefresh,
  isRefreshing = false,
  onOpenMobileMenu,
}) => {
  const isManager = (() => {
    if (role === 'manager' || (role as string) === 'stock_manager' || (role as string) === 'admin') return true;
    try {
      const session = getAuthSession();
      const sRole = session?.user?.role;
      if (sRole === 'manager' || sRole === 'stock_manager' || sRole === 'admin') return true;
    } catch {}
    return false;
  })();
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

  // Stock Override Warning Confirmation Modal State
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isTogglingOverride, setIsTogglingOverride] = useState(false);

  const handleToggleClick = async () => {
    if (!isManager) {
      alert('Only managers can toggle the Stock Override setting.');
      return;
    }

    if (allowNegativeOrders) {
      // Turning OFF -> execute immediately
      setIsTogglingOverride(true);
      try {
        await onToggleStockOverride?.(false);
      } finally {
        setIsTogglingOverride(false);
      }
    } else {
      // Turning ON -> prompt warning modal first (do not silently activate)
      setIsOverrideModalOpen(true);
    }
  };

  const handleConfirmEnable = async () => {
    setIsTogglingOverride(true);
    try {
      await onToggleStockOverride?.(true);
      setIsOverrideModalOpen(false);
    } catch (err) {
      console.error('Failed to enable override:', err);
    } finally {
      setIsTogglingOverride(false);
    }
  };

  return (
    <>
      <header
        id="app-header"
        className="min-h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 z-10 transition-colors"
      >
        {/* Left: Mobile Hamburger & Page Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onOpenMobileMenu && (
            <button
              id="btn-mobile-menu"
              onClick={onOpenMobileMenu}
              title="Open navigation menu"
              className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
              {currentTabTitle}
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate hidden sm:block">{subtitle}</p>
          </div>
        </div>

        {/* Right: Action Controls, Stock Override & Role Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Database Backup & Provider Migration Button */}
          {onOpenBackup && (
            <button
              id="btn-header-backup"
              onClick={onOpenBackup}
              data-tooltip="Database Backup & Provider Migration System"
              className="p-1.5 sm:p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 rounded-lg transition-all cursor-pointer font-semibold text-xs flex items-center gap-1.5"
            >
              <Database className="w-4 h-4" />
              <span className="hidden md:inline font-bold">Backup DB</span>
            </button>
          )}

          {/* Help Manual Button */}
          {onOpenHelp && (
            <button
              id="btn-header-help"
              onClick={onOpenHelp}
              data-tooltip="Help Manual & Documentation"
              data-tooltip-shortcut="F1"
              className="p-1.5 sm:p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          {/* Theme Toggle (Dark / Light) */}
          <button
            id="btn-theme-toggle"
            onClick={toggleTheme}
            data-tooltip={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-1.5 sm:p-2 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Refresh button */}
          <button
            id="btn-header-refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
            data-tooltip="Refresh inventory & sync status"
            data-tooltip-shortcut="Ctrl+R"
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-indigo-600 dark:text-indigo-400')} />
          </button>

          {/* STOCK OVERRIDE TOGGLE & STATUS CAPSULE */}
          <div className="flex items-center border-r border-slate-200 dark:border-slate-700 pr-1.5 sm:pr-2.5">
            {allowNegativeOrders ? (
              // ACTIVE INDICATOR & TOGGLE
              <div
                id="btn-stock-override-capsule"
                onClick={handleToggleClick}
                data-tooltip="Stock Override is ACTIVE. Salesmen can place orders for zero/negative stock items. (Click to Disable)"
                className="flex items-center gap-2 px-2.5 py-1 sm:py-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 dark:border-amber-500/40 shadow-xs transition-all cursor-pointer select-none hover:bg-amber-500/20 active:scale-95"
              >
                <div className="flex items-center gap-1.5 pointer-events-none">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 whitespace-nowrap">
                    Stock Override Active
                  </span>
                </div>

                <button
                  id="btn-stock-override-toggle"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleClick();
                  }}
                  disabled={isTogglingOverride}
                  className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-amber-500 transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                >
                  <span className="translate-x-4 pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out" />
                </button>
              </div>
            ) : (
              // INACTIVE TOGGLE
              <div
                id="btn-stock-override-capsule"
                onClick={handleToggleClick}
                data-tooltip="Enable Stock Override (Allow salesmen to place orders for zero/negative stock)"
                className="flex items-center gap-2 px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer select-none hover:bg-slate-200/80 dark:hover:bg-slate-700/80 active:scale-95"
              >
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 pointer-events-none">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                  <span className="text-[11px] sm:text-xs font-medium whitespace-nowrap">
                    Stock Override
                  </span>
                </div>

                <button
                  id="btn-stock-override-toggle"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleClick();
                  }}
                  disabled={isTogglingOverride}
                  className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-300 dark:bg-slate-600 transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-500 hover:bg-slate-400 dark:hover:bg-slate-500"
                >
                  <span className="translate-x-0 pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out" />
                </button>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            id="btn-header-logout"
            onClick={() => setShowLogoutConfirm(true)}
            title="Sign out of Operations Workspace"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800/60 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer flex items-center gap-1.5 ml-1"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline text-xs">Logout</span>
          </button>
        </div>
      </header>

      {/* WARNING CONFIRMATION MODAL (Never silently activate) */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Warning Header */}
            <div className="bg-amber-50 dark:bg-amber-950/40 p-5 border-b border-amber-100 dark:border-amber-900/50 flex items-start gap-3.5">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  Enable Stock Override?
                </h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-400/80 mt-0.5">
                  System inventory restriction warning
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                This will allow salesmen to place orders for items with zero or negative system stock.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                id="btn-cancel-override"
                onClick={() => setIsOverrideModalOpen(false)}
                disabled={isTogglingOverride}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-override"
                onClick={handleConfirmEnable}
                disabled={isTogglingOverride}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isTogglingOverride ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enabling...</span>
                  </>
                ) : (
                  <span>Enable Override</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sign Out?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Your session will be ended.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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



