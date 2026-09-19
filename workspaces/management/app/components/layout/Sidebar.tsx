'use client';
import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  TrendingUp,
  Store,
  Activity,
  Truck,
  RotateCcw,
  Compass,
  Sparkles,
  CircleDollarSign,
  Search,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  X,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type NavigationTab =
  | 'dashboard'
  | 'sales'
  | 'dealers'
  | 'inventory-velocity'
  | 'procurement'
  | 'quality-returns'
  | 'geography'
  | 'demand-forecast'
  | 'financial'
  | 'explorer'
  | 'inventory'
  | 'admin';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  role?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  lowStockCount?: number;
  criticalStockCount?: number;
  pendingOrdersCount?: number;
  tallyConnected?: boolean;
  onOpenStockIn?: () => void;
  onOpenStockOut?: () => void;
  onOpenStockAdjustment?: () => void;
  onOpenNewProduct?: () => void;
  onOpenCustomerReturn?: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const TAB_ROUTES: Record<NavigationTab, string> = {
  'dashboard': '/',
  'sales': '/sales',
  'dealers': '/dealers',
  'inventory-velocity': '/inventory-velocity',
  'procurement': '/procurement',
  'quality-returns': '/quality-returns',
  'geography': '/geography',
  'demand-forecast': '/demand-forecast',
  'financial': '/financial-valuation',
  'explorer': '/explorer',
  'inventory': '/inventory',
  'admin': '/admin',
};

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: 'Executive Intelligence',
    items: [
      { id: 'dashboard', label: 'Executive Insights', icon: LayoutDashboard, badge: 'CORE', badgeColor: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60' },
      { id: 'sales', label: 'Sales & Revenue', icon: TrendingUp },
      { id: 'dealers', label: 'Customers & Collections', icon: Store },
    ],
  },
  {
    groupTitle: 'Operational Velocity',
    items: [
      { id: 'inventory-velocity', label: 'Inventory Velocity', icon: Activity },
      { id: 'procurement', label: 'Procurement & Vendors', icon: Truck },
      { id: 'quality-returns', label: 'Quality & Returns', icon: RotateCcw },
    ],
  },
  {
    groupTitle: 'Strategic Forecasting',
    items: [
      { id: 'geography', label: 'Geographic Intelligence', icon: Compass },
      { id: 'demand-forecast', label: 'AI Demand Forecast', icon: Sparkles, badge: 'AI', badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
      { id: 'financial', label: 'Financial Valuation', icon: CircleDollarSign },
      { id: 'explorer', label: '360° Business Explorer', icon: Search },
    ],
  },
  {
    groupTitle: 'Reference Catalog',
    items: [
      { id: 'inventory', label: 'Master Catalog (4,315 SKUs)', icon: Boxes },
    ],
  },
  {
    groupTitle: 'Platform Administration',
    items: [
      { id: 'admin', label: 'Admin Control Center', icon: ShieldCheck, badge: 'ADMIN', badgeColor: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60' },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const handleItemClick = (tab: string) => {
    onSelectTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (collapsed: boolean, isMobileView: boolean = false) => {
    return (
      <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200 select-none border-r border-slate-800 transition-colors">
        {/* Top Header: Brand & Collapse / Expand Toggle */}
        <div
          className={cn(
            'h-16 flex items-center shrink-0 border-b border-slate-800 transition-all overflow-hidden',
            collapsed ? 'px-3 justify-center' : 'px-4 justify-between'
          )}
        >
          {!collapsed ? (
            <>
              <Link
                href="/"
                prefetch={true}
                onClick={() => handleItemClick('dashboard')}
                className="flex items-center gap-2.5 cursor-pointer group min-w-0 overflow-hidden whitespace-nowrap"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white font-extrabold text-sm shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  N
                </div>
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden whitespace-nowrap">
                  <span className="font-bold text-base tracking-tight text-white group-hover:text-indigo-600 dark:text-indigo-400 transition-colors truncate">
                    nalka
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                    BI INTEL
                  </span>
                </div>
              </Link>

              {isMobileView ? (
                <button
                  onClick={onCloseMobile}
                  title="Close menu"
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                onToggleCollapse && (
                  <button
                    id="btn-toggle-sidebar-collapse"
                    onClick={onToggleCollapse}
                    title="Collapse sidebar (Ctrl+B)"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-95 rounded-lg transition-all cursor-pointer shrink-0"
                  >
                    <ChevronsLeft className="w-4 h-4 text-slate-400" />
                  </button>
                )
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                id="nav-brand-collapsed"
                onClick={onToggleCollapse || (() => handleItemClick('dashboard'))}
                title="Expand sidebar"
                className="relative group/brand w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-md flex items-center justify-center cursor-pointer transition-all active:scale-95 overflow-hidden"
              >
                <span className="font-bold text-sm text-white group-hover/brand:opacity-0 transition-all duration-200">
                  N
                </span>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/brand:opacity-100 transition-all duration-200">
                  <ChevronsRight className="w-4 h-4 text-white" />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Groups List */}
        <nav
          className={cn(
            'flex-1 overflow-y-auto space-y-4 py-3 custom-scrollbar overflow-x-hidden',
            collapsed ? 'px-2' : 'px-3'
          )}
        >
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider overflow-hidden whitespace-nowrap">
                  {group.groupTitle}
                </div>
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                const route = TAB_ROUTES[item.id];

                return (
                  <Link
                    key={item.id}
                    href={route}
                    prefetch={true}
                    onClick={() => handleItemClick(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'w-full flex items-center rounded-lg text-xs font-medium transition-all duration-150 text-left cursor-pointer group relative border overflow-hidden whitespace-nowrap',
                      collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold border-indigo-200 dark:border-indigo-800/60 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200 border-transparent'
                    )}
                  >
                    <div className={cn('flex items-center min-w-0 overflow-hidden whitespace-nowrap', collapsed ? 'justify-center' : 'gap-3')}>
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110',
                          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                        )}
                      />
                      {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
                    </div>

                    {!collapsed && item.badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider shrink-0 ml-1.5 whitespace-nowrap',
                          item.badgeColor || 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}

                    {collapsed && isActive && (
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-sm" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Info Pill */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-800">
            <div className="flex items-center gap-2 p-2 bg-slate-800/40 rounded-lg border border-slate-800 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="truncate">
                <span className="text-slate-300 font-semibold">PostgreSQL</span>
                <span className="mx-1 text-slate-600">•</span>
                <span className="text-indigo-600 dark:text-indigo-400">Live BI Engine</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        id="desktop-sidebar"
        className={cn(
          'hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-30 transition-[width] duration-200 ease-out will-change-[width]',
          isCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {navContent(isCollapsed, false)}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          id="sidebar-backdrop"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
        />
      )}

      {/* Mobile Sliding Drawer */}
      <aside
        id="mobile-drawer"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col md:hidden shadow-2xl transition-transform duration-200 ease-out will-change-transform',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {navContent(false, true)}
      </aside>
    </>
  );
};
