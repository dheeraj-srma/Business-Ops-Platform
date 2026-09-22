import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  ShoppingBag,
  FolderPlus,
  Boxes,
  Calculator,
  History,
  FolderTree,
  Zap,
  FileSpreadsheet,
  BookOpen,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  AlertTriangle,
  UploadCloud,
  X,
  Ticket,
  RotateCcw,
  ArrowUpDown,
} from 'lucide-react';
import { UserRole } from '../../types';
import { cn } from '../../lib/utils';

export type NavigationTab =
  | 'dashboard'
  | 'pending_orders'
  | 'inventory'
  | 'restock_planner'
  | 'stock-in'
  | 'stock-out'
  | 'adjustment'
  | 'transactions'
  | 'data-exchange'
  | 'tally-sync'
  | 'tally-import'
  | 'tally-export'
  | 'tally'
  | 'categories'
  | 'coupons'
  | 'help'
  | 'manual'
  | 'settings';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  role: UserRole;
  lowStockCount: number;
  criticalStockCount?: number;
  pendingOrdersCount?: number;
  tallyConnected?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenStockIn?: () => void;
  onOpenStockOut?: () => void;
  onOpenStockAdjustment?: () => void;
  onOpenNewProduct?: () => void;
  onOpenCustomerReturn?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  role,
  lowStockCount,
  criticalStockCount = 0,
  pendingOrdersCount = 0,
  tallyConnected = false,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  onOpenStockIn,
  onOpenStockOut,
  onOpenStockAdjustment,
  onOpenNewProduct,
  onOpenCustomerReturn,
}) => {
  const isManager = role === 'manager';
  const totalAlerts = lowStockCount + criticalStockCount;
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(true);
  const [isCollapsedCreateOpen, setIsCollapsedCreateOpen] = useState<boolean>(false);
  const [flyoutCoords, setFlyoutCoords] = useState<{ top: number; left: number }>({ top: 0, left: 72 });
  const collapsedCreateBtnRef = useRef<HTMLButtonElement>(null);
  const flyoutMenuRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (tab: string) => {
    onSelectTab(tab);
    setIsCollapsedCreateOpen(false);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  // Close flyout when sidebar is expanded
  useEffect(() => {
    if (!isCollapsed) {
      setIsCollapsedCreateOpen(false);
    }
  }, [isCollapsed]);

  // Click outside and escape listener for collapsed flyout menu
  useEffect(() => {
    if (!isCollapsedCreateOpen) return;

    const updatePosition = () => {
      if (collapsedCreateBtnRef.current) {
        const rect = collapsedCreateBtnRef.current.getBoundingClientRect();
        setFlyoutCoords({
          top: Math.max(12, Math.min(window.innerHeight - 220, rect.top)),
          left: rect.right + 8,
        });
      }
    };

    updatePosition();

    const handleClickOutside = (event: MouseEvent) => {
      if (
        flyoutMenuRef.current &&
        !flyoutMenuRef.current.contains(event.target as Node) &&
        collapsedCreateBtnRef.current &&
        !collapsedCreateBtnRef.current.contains(event.target as Node)
      ) {
        setIsCollapsedCreateOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCollapsedCreateOpen(false);
      }
    };

    const handleScroll = () => {
      updatePosition();
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCollapsedCreateOpen]);

  const navContent = (collapsed: boolean, isMobileView: boolean = false) => {
    // When the collapsed flyout is open or currentTab is 'create', the active highlight square transfers to the Create button
    const isCreateActive = currentTab === 'create' || (collapsed && isCollapsedCreateOpen);
    const isDashboardActive = currentTab === 'dashboard' && !isCreateActive;
    const isPendingOrdersActive = (currentTab === 'pending_orders' || currentTab === 'pending-orders') && !isCreateActive;
    const isInventoryActive = currentTab === 'inventory' && !isCreateActive;
    const isRestockActive = currentTab === 'restock_planner' && !isCreateActive;
    const isTxActive = currentTab === 'transactions' && !isCreateActive;
    const isCategoriesActive = currentTab === 'categories' && !isCreateActive;
    const isCouponsActive = currentTab === 'coupons' && !isCreateActive;
    const isTallySyncActive = currentTab === 'tally-sync' && !isCreateActive;
    const isDataExchangeActive =
      (currentTab === 'data-exchange' ||
        currentTab === 'data_exchange' ||
        currentTab === 'tally-import' ||
        currentTab === 'tally_import' ||
        currentTab === 'tally' ||
        currentTab === 'tally-export') &&
      !isCreateActive;
    const isHelpActive = (currentTab === 'help' || currentTab === 'manual') && !isCreateActive;
    const isSettingsActive = currentTab === 'settings' && !isCreateActive;

    return (
      <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 select-none border-r border-slate-200 dark:border-slate-800 transition-colors">
        {/* Top Header: Collapse / Expand Toggle & Brand (Aligned with top Header height) */}
        <div
          className={cn(
            'h-16 flex items-center shrink-0 border-b border-slate-200 dark:border-slate-800 transition-all',
            collapsed ? 'px-3 justify-center' : 'px-4 justify-between'
          )}
        >
          {!collapsed ? (
            <>
              <div
                id="nav-brand-expanded"
                onClick={() => handleTabClick('dashboard')}
                data-tooltip="Go to Home"
                data-tooltip-position="bottom"
                className="flex items-center gap-2.5 cursor-pointer group min-w-0"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0 group-hover:scale-105 active:scale-95 transition-transform">
                  N
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    nalka
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                    PRO
                  </span>
                </div>
              </div>

              {/* Collapse Button << */}
              {isMobileView ? (
                <button
                  onClick={onCloseMobile}
                  title="Close menu"
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                onToggleCollapse && (
                  <button
                    id="btn-toggle-sidebar-collapse"
                    onClick={onToggleCollapse}
                    data-tooltip="Collapse sidebar (Ctrl+B)"
                    data-tooltip-position="bottom"
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 rounded-lg transition-all cursor-pointer"
                  >
                    <ChevronsLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                )
              )}
            </>
          ) : (
            /* In Collapsed Mode: Centered N icon button that reveals an expand icon and tooltip on hover */
            <div className="w-full flex items-center justify-center">
              <button
                id="nav-brand-collapsed"
                onClick={onToggleCollapse || (() => handleTabClick('dashboard'))}
                data-tooltip="Expand sidebar"
                data-tooltip-shortcut="Ctrl+B"
                data-tooltip-position="right"
                className="relative group/brand w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-bold text-sm shadow-xs flex items-center justify-center cursor-pointer transition-all active:scale-95 overflow-hidden"
              >
                {/* Default "N" logo */}
                <span className="font-bold text-sm text-white group-hover/brand:opacity-0 group-hover/brand:scale-75 transition-all duration-200 select-none">
                  N
                </span>

                {/* Expand icon appearing on hover */}
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/brand:opacity-100 group-hover/brand:scale-100 scale-75 transition-all duration-200">
                  <ChevronsRight className="w-4 h-4 text-white" />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items List */}
        {/* Navigation Items List */}
        <nav
          className={cn(
            'flex-1 overflow-y-auto space-y-1 py-2',
            collapsed ? 'px-2' : 'px-3'
          )}
        >
          {/* SECTION 1: CORE OPERATIONS (TOP) */}
          {!collapsed && (
            <div className="px-3 pt-1 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Operations & Inventory
            </div>
          )}

          {/* 1. Dashboard Button */}
          <button
            id="nav-tab-dashboard"
            onClick={() => handleTabClick('dashboard')}
            data-tooltip={
              collapsed
                ? `Dashboard ${totalAlerts > 0 ? `(${totalAlerts} alerts)` : '(Overview & Stock Health)'}`
                : undefined
            }
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
              isDashboardActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
              <LayoutGrid
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                  isDashboardActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                )}
              />
              {!collapsed && <span>Dashboard</span>}
            </div>

            {!collapsed && totalAlerts > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                {totalAlerts}
              </span>
            )}

            {collapsed && totalAlerts > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* 2. Pending Orders Button */}
          <button
            id="nav-tab-pending-orders"
            onClick={() => handleTabClick('pending_orders')}
            data-tooltip={
              collapsed
                ? `Pending Orders ${
                    pendingOrdersCount && pendingOrdersCount > 0
                      ? `(${pendingOrdersCount} orders waiting review)`
                      : '(Salesman Queue & JSON)'
                  }`
                : undefined
            }
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
              isPendingOrdersActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
              <ShoppingBag
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6',
                  isPendingOrdersActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                )}
              />
              {!collapsed && <span>Pending Orders</span>}
            </div>

            {!collapsed && pendingOrdersCount !== undefined && pendingOrdersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                {pendingOrdersCount}
              </span>
            )}

            {collapsed && pendingOrdersCount !== undefined && pendingOrdersCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {/* 3. Create (Accordion Dropdown Menu in Expanded Mode, Flyout in Collapsed Mode) */}
          {!collapsed ? (
            <div className="space-y-1 pt-0.5">
              <button
                id="nav-tab-create"
                onClick={() => {
                  handleTabClick('create');
                  setIsCreateOpen((prev) => (currentTab === 'create' ? !prev : true));
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group border border-transparent',
                  isCreateActive
                    ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <FolderPlus
                    className={cn(
                      'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6',
                      isCreateActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                    )}
                  />
                  <span>Create</span>
                </div>
                {isCreateOpen ? (
                  <ChevronUp className={cn("w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-y-0.5", isCreateActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200")} />
                ) : (
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-y-0.5", isCreateActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200")} />
                )}
              </button>

              {/* Accordion Submenu Items */}
              {isCreateOpen && (
                <div className="pl-4 pr-1 py-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {isManager && onOpenNewProduct && (
                    <button
                      onClick={() => {
                        handleTabClick('create');
                        onOpenNewProduct();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer group"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 group-hover:rotate-90 transition-transform duration-200" />
                      <span>New Product SKU</span>
                    </button>
                  )}

                  {onOpenStockIn && (
                    <button
                      onClick={() => {
                        handleTabClick('create');
                        onOpenStockIn();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer group"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:-rotate-45 transition-transform duration-200" />
                      <span>Receive Stock In</span>
                    </button>
                  )}

                  {onOpenStockOut && (
                    <button
                      onClick={() => {
                        handleTabClick('create');
                        onOpenStockOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer group"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 group-hover:-rotate-45 transition-transform duration-200" />
                      <span>Issue Stock Out</span>
                    </button>
                  )}

                  {isManager && onOpenStockAdjustment && (
                    <button
                      onClick={() => {
                        handleTabClick('create');
                        onOpenStockAdjustment();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer group"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:rotate-45 transition-transform duration-200" />
                      <span>Stock Adjustment</span>
                    </button>
                  )}

                  {isManager && onOpenCustomerReturn && (
                    <button
                      id="btn-create-customer-return"
                      onClick={() => {
                        handleTabClick('create');
                        onOpenCustomerReturn();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer group"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:-rotate-45 transition-transform duration-200" />
                      <span>Customer Returns</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Collapsed Mode Icon for Create (Shows active square highlight when open) */
            <button
              id="nav-tab-create-collapsed"
              ref={collapsedCreateBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                handleTabClick('create');
                if (collapsedCreateBtnRef.current) {
                  const rect = collapsedCreateBtnRef.current.getBoundingClientRect();
                  setFlyoutCoords({
                    top: Math.max(12, Math.min(window.innerHeight - 220, rect.top)),
                    left: rect.right + 8,
                  });
                }
                setIsCollapsedCreateOpen((prev) => !prev);
              }}
              data-tooltip={!isCollapsedCreateOpen ? 'Quick Actions (Stock In, Out, Adjust, New SKU)' : undefined}
              data-tooltip-position="right"
              className={cn(
                'w-full flex items-center justify-center p-2.5 rounded-lg transition-colors duration-150 cursor-pointer group relative border border-transparent',
                isCreateActive
                  ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              )}
            >
              <FolderPlus
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6',
                  isCreateActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                )}
              />
              {collapsed && isCollapsedCreateOpen && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>
          )}

          {/* 4. Master Inventory */}
          <button
            id="nav-tab-inventory"
            onClick={() => handleTabClick('inventory')}
            data-tooltip={collapsed ? 'Master Inventory (Catalog & Physical Stock)' : undefined}
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
              isInventoryActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
              <Boxes
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6',
                  isInventoryActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                )}
              />
              {!collapsed && <span>Inventory Master</span>}
            </div>


          </button>

          {/* 5. Restock Planner */}
          <button
            id="nav-tab-restock-planner"
            onClick={() => handleTabClick('restock_planner')}
            data-tooltip={collapsed ? 'Restock Planner (Buffer & Deficit Replenishment)' : undefined}
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
              isRestockActive
                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold shadow-2xs border-amber-200 dark:border-amber-900/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
              <Calculator
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6',
                  isRestockActive
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                )}
              />
              {!collapsed && <span>Restock Planner</span>}
            </div>
            {!collapsed && totalAlerts > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                REORDER
              </span>
            )}

            {collapsed && totalAlerts > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {/* 6. Audit Movements Ledger */}
          <button
            id="nav-tab-transactions"
            onClick={() => handleTabClick('transactions')}
            data-tooltip={collapsed ? 'Audit Ledger (Stock Movements & Audit Logs)' : undefined}
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
              isTxActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <History
              className={cn(
                'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-45',
                isTxActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
              )}
            />
            {!collapsed && <span>Audit Ledger</span>}
          </button>

          {/* 7. Stock Categories */}
          <button
            id="nav-tab-categories"
            onClick={() => handleTabClick('categories')}
            data-tooltip={collapsed ? 'Stock Categories & Groups' : undefined}
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
              isCategoriesActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <FolderTree
              className={cn(
                'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3',
                isCategoriesActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
              )}
            />
            {!collapsed && <span>Stock Categories</span>}
          </button>

          {/* 7.5 Brand Coupons */}
          <button
            id="nav-tab-coupons"
            onClick={() => handleTabClick('coupons')}
            data-tooltip={collapsed ? 'Brand Coupons (Upload & Redemption Records)' : undefined}
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
              isCouponsActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
              <Ticket
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-12',
                  isCouponsActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                )}
              />
              {!collapsed && <span>Brand Coupons</span>}
            </div>
            {!collapsed && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                COUPONS
              </span>
            )}
          </button>

          {/* SECTION 2: TALLY & ENTERPRISE INTEGRATION (BOTTOM) */}
          <div className={cn(collapsed ? 'my-2.5 mx-1 border-t border-slate-200 dark:border-slate-800' : 'pt-3 pb-1 px-3 border-t border-slate-200/80 dark:border-slate-800/80')}>
            {!collapsed && (
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <span>Tally & Accounting</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-mono font-semibold">
                  TALLYPRIME
                </span>
              </div>
            )}
          </div>

          {/* 8. Tally Live Sync */}
          <button
            id="nav-tab-tally-sync"
            onClick={() => handleTabClick('tally-sync')}
            data-tooltip={
              collapsed
                ? `Tally Live Sync (${tallyConnected ? 'Online & Connected' : 'Gateway Offline / Standby'})`
                : undefined
            }
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
              isTallySyncActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
              <Zap
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12',
                  isTallySyncActive
                    ? 'text-indigo-600 dark:text-indigo-400 fill-indigo-600/20'
                    : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                )}
              />
              {!collapsed && <span>Tally Live Sync</span>}
            </div>
            {!collapsed && (
              <span
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full font-bold border',
                  tallyConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                )}
              >
                {tallyConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            )}

            {collapsed && (
              <span
                className={cn(
                  'absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900',
                  tallyConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                )}
              />
            )}
          </button>

          {/* 9. Dedicated Data Exchange Section (Capsulates JSON, XML, Excel, CSV Import & Export) */}
          <button
            id="nav-tab-data-exchange"
            onClick={() => handleTabClick('data-exchange')}
            data-tooltip={
              collapsed
                ? 'Data Exchange (Import & Export JSON, XML, Excel, CSV)'
                : undefined
            }
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
              isDataExchangeActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
              <ArrowUpDown
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-180',
                  isDataExchangeActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                )}
              />
              {!collapsed && <span>Data Exchange</span>}
            </div>
            {!collapsed && (
              <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-bold border border-indigo-200 dark:border-indigo-800/60">
                EXCHANGE
              </span>
            )}
          </button>

          {/* SECTION 3: SYSTEM & PREFERENCES (FOOTER) */}
          <div className={cn(collapsed ? 'my-2.5 mx-1 border-t border-slate-200 dark:border-slate-800' : 'pt-3 pb-1 px-3 border-t border-slate-200/80 dark:border-slate-800/80')}>
            {!collapsed && (
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                System & Help
              </div>
            )}
          </div>

          {/* 11. Help Manual */}
          <button
            id="nav-tab-help"
            onClick={() => handleTabClick('help')}
            data-tooltip={collapsed ? 'Help Manual & System Docs (Press F1)' : undefined}
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
              isHelpActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <BookOpen
              className={cn(
                'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6',
                isHelpActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
              )}
            />
            {!collapsed && <span>Help & Manual</span>}
          </button>

          {/* 12. Settings */}
          <button
            id="nav-tab-settings"
            onClick={() => handleTabClick('settings')}
            data-tooltip={collapsed ? 'System Settings & Safety Buffers' : undefined}
            data-tooltip-position="right"
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors duration-150 text-left cursor-pointer group relative border border-transparent',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
              isSettingsActive
                ? 'bg-indigo-50/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs border border-indigo-100/80 dark:border-indigo-800/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <Settings
              className={cn(
                'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-45',
                isSettingsActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
              )}
            />
            {!collapsed && <span>Settings</span>}
          </button>
        </nav>

        {/* Stock Health Quick Alert */}
        {totalAlerts > 0 && !collapsed && (
          <div className="p-3 mx-3 mb-2">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-2.5 text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Attention Needed</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/90 mt-1 leading-snug">
                {totalAlerts} items require reorder or restock attention.
              </p>
            </div>
          </div>
        )}

        {/* Bottom space reserved for Workspace Switcher */}
        <div className="mt-auto h-14 shrink-0 border-t border-slate-200/80 dark:border-slate-800/80" />
      </div>
    );
  };

  return (
    <>
      {/* Desktop Docked Sidebar (hidden on mobile < md) */}
      <aside
        id="app-sidebar"
        className={cn(
          'hidden md:flex shrink-0 h-screen transition-all duration-300 ease-in-out z-20',
          isCollapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {navContent(isCollapsed, false)}
      </aside>

      {/* Mobile Drawer (visible on mobile when opened) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Off-canvas sidebar */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 flex flex-col bg-white dark:bg-slate-900">
            {navContent(false, true)}
          </div>
        </div>
      )}

      {/* Collapsed Create Right-side Flyout Menu (Displays ONLY the sub-options) */}
      {isCollapsed && isCollapsedCreateOpen && (
        <div
          ref={flyoutMenuRef}
          style={{ top: `${flyoutCoords.top}px`, left: `${flyoutCoords.left}px` }}
          className="fixed z-50 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {isManager && onOpenNewProduct && (
            <button
              onClick={() => {
                setIsCollapsedCreateOpen(false);
                handleTabClick('create');
                onOpenNewProduct();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 active:bg-slate-200 dark:active:bg-slate-700/80 transition-colors duration-150 cursor-pointer group text-left"
            >
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 group-hover:rotate-90 transition-transform duration-200 shrink-0" />
              <span>New Product SKU</span>
            </button>
          )}

          {onOpenStockIn && (
            <button
              onClick={() => {
                setIsCollapsedCreateOpen(false);
                handleTabClick('create');
                onOpenStockIn();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 active:bg-slate-200 dark:active:bg-slate-700/80 transition-colors duration-150 cursor-pointer group text-left"
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:-rotate-45 transition-transform duration-200 shrink-0" />
              <span>Receive Stock In</span>
            </button>
          )}

          {onOpenStockOut && (
            <button
              onClick={() => {
                setIsCollapsedCreateOpen(false);
                handleTabClick('create');
                onOpenStockOut();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 active:bg-slate-200 dark:active:bg-slate-700/80 transition-colors duration-150 cursor-pointer group text-left"
            >
              <ArrowUpRight className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 group-hover:-rotate-45 transition-transform duration-200 shrink-0" />
              <span>Issue Stock Out</span>
            </button>
          )}

          {isManager && onOpenStockAdjustment && (
            <button
              onClick={() => {
                setIsCollapsedCreateOpen(false);
                handleTabClick('create');
                onOpenStockAdjustment();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 active:bg-slate-200 dark:active:bg-slate-700/80 transition-colors duration-150 cursor-pointer group text-left"
            >
              <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:rotate-45 transition-transform duration-200 shrink-0" />
              <span>Stock Adjustment</span>
            </button>
          )}

          {isManager && onOpenCustomerReturn && (
            <button
              id="btn-create-customer-return-collapsed"
              onClick={() => {
                setIsCollapsedCreateOpen(false);
                handleTabClick('create');
                onOpenCustomerReturn();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 active:bg-slate-200 dark:active:bg-slate-700/80 transition-colors duration-150 cursor-pointer group text-left"
            >
              <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:-rotate-45 transition-transform duration-200 shrink-0" />
              <span>Customer Returns</span>
            </button>
          )}
        </div>
      )}
    </>
  );
};
