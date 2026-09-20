import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { PendingOrdersView } from './components/orders/PendingOrdersView';
import { InventoryView } from './components/inventory/InventoryView';
import { TransactionHistoryView } from './components/transactions/TransactionHistoryView';
import { CategoriesView } from './components/categories/CategoriesView';
import { RestockPlannerView } from './components/inventory/RestockPlannerView';
import { TallyExportView } from './components/tally/TallyExportView';
import { TallySyncDashboard } from './components/tally/TallySyncDashboard';
import { TallyImportPanel } from './components/tally/sync/TallyImportPanel';
import { HelpManualView } from './components/help/HelpManualView';
import { SettingsView } from './components/settings/SettingsView';
import { CouponsView } from './components/coupons/CouponsView';

import { StockInModal } from './components/stock-movements/StockInModal';
import { StockOutModal } from './components/stock-movements/StockOutModal';
import { StockAdjustmentModal } from './components/stock-movements/StockAdjustmentModal';
import { CustomerReturnModal } from './components/stock-movements/CustomerReturnModal';
import { ProductFormModal } from './components/inventory/ProductFormModal';
import { ProductDetailModal } from './components/inventory/ProductDetailModal';
import { CategoryModal } from './components/categories/CategoryModal';
import { DatabaseBackupModal } from './components/admin/DatabaseBackupModal';

import { Product, Category, DashboardStats, AppSettings, UserRole } from './types';
import { api } from './lib/api';
import { GlobalTooltipProvider } from './components/common/Tooltip';
import { ScrollToTopButton } from './components/common/ScrollToTopButton';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './context/DialogContext';
import { getAuthSession } from '@/shared/auth';

export default function App() {
  // Navigation & Role State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [lastContentTab, setLastContentTab] = useState<string>('dashboard');
  const [role, setRole] = useState<UserRole>(() => {
    try {
      const session = getAuthSession();
      if (session?.user?.role === 'staff') return 'staff';
      return 'manager';
    } catch {
      return 'manager';
    }
  });
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<string>('all');
  const [navigationHistory, setNavigationHistory] = useState<Array<{ tab: string; inventoryStatusFilter: string }>>([]);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('stockmaster_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const mainScrollRef = useRef<HTMLElement | null>(null);

  // Scroll to top on tab change
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [currentTab]);

  // Navigate to a tab and store previous location in history
  const navigateTo = useCallback(
    (tab: string, filter: string = 'all') => {
      setNavigationHistory((prev) => {
        // If already on the same tab and filter, do nothing
        if (currentTab === tab && inventoryStatusFilter === filter) {
          return prev;
        }
        return [...prev.slice(-30), { tab: currentTab, inventoryStatusFilter }];
      });
      if (tab !== 'create') {
        setLastContentTab(tab);
      }
      setCurrentTab(tab);
      setInventoryStatusFilter(filter);
    },
    [currentTab, inventoryStatusFilter]
  );

  // Return to previous state in history
  const handleGoBack = useCallback(() => {
    setNavigationHistory((prev) => {
      if (prev.length === 0) {
        if (currentTab !== 'dashboard') {
          setCurrentTab('dashboard');
          setLastContentTab('dashboard');
          setInventoryStatusFilter('all');
        }
        return [];
      }
      const nextStack = [...prev];
      const prevState = nextStack.pop();
      if (prevState) {
        setCurrentTab(prevState.tab);
        if (prevState.tab !== 'create') {
          setLastContentTab(prevState.tab);
        }
        setInventoryStatusFilter(prevState.inventoryStatusFilter || 'all');
      }
      return nextStack;
    });
  }, [currentTab]);

  const canGoBack = navigationHistory.length > 0 || currentTab !== 'dashboard';

  // Alt + ArrowLeft shortcut to navigate back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleGoBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGoBack]);

  // Core Data State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'Nalka Metals Pvt Ltd',
    company_name: 'Nalka Metals Pvt Ltd',
    tallyCompanyName: 'Nalka Metals (2026-27)',
    tally_company_name: 'Nalka Metals (2026-27)',
    defaultCriticalThreshold: 5,
    default_critical_threshold: 5,
    defaultMinimumThreshold: 20,
    default_minimum_threshold: 20,
    defaultCriticalStock: 5,
    defaultMinimumStock: 20,
    tallyXmlGuidPrefix: 'NALKA-STOCK-',
    tally_xml_guid_prefix: 'NALKA-STOCK-',
    allow_negative_orders: false,
    allowNegativeOrders: false,
    lastExportCheckpoint: new Date().toISOString(),
    last_export_checkpoint: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);

  // Toggle sidebar collapse state and persist
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('stockmaster_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleSidebar]);

  // Keyboard shortcut F1 to open application Help Manual & prevent Chrome from opening browser documentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        navigateTo('help');
      }
    };

    const handleHelp = (e: Event) => {
      e.preventDefault();
      navigateTo('help');
      return false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('help', handleHelp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('help', handleHelp, true);
    };
  }, [navigateTo]);

  // Modals Visibility State
  const [isStockInOpen, setIsStockInOpen] = useState<boolean>(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState<boolean>(false);
  const [isStockAdjustOpen, setIsStockAdjustOpen] = useState<boolean>(false);
  const [isCustomerReturnOpen, setIsCustomerReturnOpen] = useState<boolean>(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState<boolean>(false);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState<boolean>(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState<boolean>(false);

  // Selected Entities for Modals
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [tallyConnected, setTallyConnected] = useState<boolean>(false);

  // Helper to safely execute API calls with exponential backoff retries
  const fetchWithRetry = useCallback(async <T,>(fn: () => Promise<T>, retries = 3, delayMs = 400): Promise<T | null> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === retries - 1) {
          console.warn(`[Fetch Retry] Final attempt failed:`, err);
          return null;
        }
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
    return null;
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [productsRes, categoriesRes, statsRes, settingsRes, ordersRes, tallyStatusRes] = await Promise.all([
        fetchWithRetry(() => api.getProducts(), 3, 500),
        fetchWithRetry(() => api.getCategories(), 3, 500),
        fetchWithRetry(() => api.getDashboardStats(), 2, 300),
        fetchWithRetry(() => api.getSettings(), 2, 300),
        api.getPendingOrders().catch(() => ({ orders: [] })),
        api.getTallySyncStatus().catch(() => null),
      ]);

      if (productsRes && Array.isArray(productsRes.products) && productsRes.products.length > 0) {
        setProducts(productsRes.products);
      }
      if (categoriesRes && Array.isArray(categoriesRes.categories) && categoriesRes.categories.length > 0) {
        setCategories(categoriesRes.categories);
      }
      if (statsRes) {
        setStats((statsRes as any).stats || statsRes);
      }
      if (settingsRes?.settings) {
        setSettings((prev) => ({
          ...prev,
          ...settingsRes.settings,
        }));
      }

      setPendingOrdersCount((ordersRes as any)?.orders?.length || 0);
      setTallyConnected(tallyStatusRes?.connection?.connection_status === 'CONNECTED');
    } catch (err: any) {
      console.error('Failed to load application data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithRetry]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Modal Triggers
  const handleOpenStockIn = (productId?: string) => {
    setSelectedProductId(productId);
    setIsStockInOpen(true);
    setCurrentTab('create');
  };

  const handleOpenStockOut = (productId?: string) => {
    setSelectedProductId(productId);
    setIsStockOutOpen(true);
    setCurrentTab('create');
  };

  const handleOpenStockAdjustment = (productId?: string) => {
    setSelectedProductId(productId);
    setIsStockAdjustOpen(true);
    setCurrentTab('create');
  };

  const handleOpenCustomerReturn = (productId?: string) => {
    setSelectedProductId(productId);
    setIsCustomerReturnOpen(true);
    setCurrentTab('create');
  };

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setIsProductFormOpen(true);
    setCurrentTab('create');
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductFormOpen(true);
  };

  const handleOpenProductDetail = (productId: string) => {
    setSelectedProductId(productId);
    setIsProductDetailOpen(true);
  };

  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setIsCategoryFormOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setIsCategoryFormOpen(true);
  };

  const handleNavigateToInventory = (statusFilter?: string) => {
    navigateTo('inventory', statusFilter || 'all');
  };

  const handleFilterByCategory = (categoryId: string) => {
    navigateTo('inventory', 'all');
  };

  const handleToggleStockOverride = async (enabled: boolean) => {
    // Optimistically update the UI state immediately
    setSettings((prev) => ({
      ...prev,
      allow_negative_orders: enabled,
      allowNegativeOrders: enabled,
    }));

    try {
      const res = await api.setStockOverride(enabled);
      const isAllowed = res?.allow_negative_orders ?? res?.allowNegativeOrders ?? enabled;
      setSettings((prev) => ({
        ...prev,
        ...(res?.settings || {}),
        allow_negative_orders: isAllowed,
        allowNegativeOrders: isAllowed,
      }));
    } catch (err: any) {
      console.error('Failed to update stock override setting:', err);
      // Revert optimistic update on failure
      setSettings((prev) => ({
        ...prev,
        allow_negative_orders: !enabled,
        allowNegativeOrders: !enabled,
      }));
      alert(err.message || 'Failed to update stock override setting.');
    }
  };

  const criticalStockCount = (stats?.criticalStockCount || 0) + (stats?.outOfStockCount || 0);
  const lowStockCount = stats?.lowStockCount || 0;

  const tabMetadata: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Executive Inventory Dashboard',
      subtitle: 'Real-time stock valuation, health indicators & transactions',
    },
    pending_orders: {
      title: 'Pending Orders Queue',
      subtitle: 'Review & approve salesman orders from Supabase Live Cloud or offline JSON files',
    },
    'pending-orders': {
      title: 'Pending Orders Queue',
      subtitle: 'Review & approve salesman orders from Supabase Live Cloud or offline JSON files',
    },
    inventory: {
      title: 'Master Inventory Catalog',
      subtitle: 'Manage SKUs, physical stock balances & unit valuations',
    },
    transactions: {
      title: 'Stock Movement Audit Ledger',
      subtitle: 'Immutable chronological ledger of receipts, issues & reconciliations',
    },
    categories: {
      title: 'Categories & Tally Groups',
      subtitle: 'Hierarchical product classifications synced with Tally masters',
    },
    restock_planner: {
      title: 'Restock & Reorder Replenishment Planner',
      subtitle: 'Deficit mitigation, negative stock recovery, and safety buffer calculations',
    },
    'tally-sync': {
      title: 'Tally Live Synchronization Engine',
      subtitle: 'Bi-directional live integration, stock reservations & idempotent event ledger',
    },
    tally: {
      title: 'Tally & TallyPrime Export',
      subtitle: 'Generate compliant XML envelopes and JSON payload exports',
    },
    help: {
      title: 'Help Center & Integration Manual',
      subtitle: 'TallyPrime connection guide, XML/JSON export specs, stock reservation formulas & troubleshooting',
    },
    manual: {
      title: 'Help Center & Integration Manual',
      subtitle: 'TallyPrime connection guide, XML/JSON export specs, stock reservation formulas & troubleshooting',
    },
    settings: {
      title: 'Company & Integration Settings',
      subtitle: 'Configure inventory parameters, thresholds & export prefixes',
    },
    coupons: {
      title: 'Brand Promotional Coupons',
      subtitle: 'Upload, audit and manage brand discount coupons and series redemptions',
    },
  };

  const activeContentTab = currentTab === 'create' ? lastContentTab : currentTab;

  const currentTabMeta = tabMetadata[activeContentTab] || {
    title: 'Inventory & Tally System',
    subtitle: 'Stock ledger and master synchronization',
  };

  useEffect(() => {
    document.title = `${currentTabMeta.title} | Nalka Metal Industries`;
  }, [currentTabMeta.title]);

  return (
    <ThemeProvider>
      <DialogProvider>
        <GlobalTooltipProvider>
          <div className="h-screen w-screen overflow-hidden flex bg-slate-100 dark:bg-slate-950 antialiased text-slate-800 dark:text-slate-100 selection:bg-indigo-500 selection:text-white transition-colors">
            {/* Navigation Sidebar */}
            <Sidebar
              currentTab={currentTab}
              onSelectTab={(tab) => navigateTo(tab, 'all')}
              lowStockCount={lowStockCount}
              criticalStockCount={criticalStockCount}
              pendingOrdersCount={pendingOrdersCount}
              tallyConnected={tallyConnected}
              role={role}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={handleToggleSidebar}
              isMobileOpen={isMobileDrawerOpen}
              onCloseMobile={() => setIsMobileDrawerOpen(false)}
              onOpenStockIn={() => handleOpenStockIn()}
              onOpenStockOut={() => handleOpenStockOut()}
              onOpenStockAdjustment={() => handleOpenStockAdjustment()}
              onOpenNewProduct={handleOpenNewProduct}
              onOpenCustomerReturn={() => handleOpenCustomerReturn()}
            />

            {/* Right Content Area (Header + Scrollable Main Content) */}
            <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
              {/* Top Header */}
              <Header
                currentTabTitle={currentTabMeta.title}
                subtitle={currentTabMeta.subtitle}
                role={role}
                allowNegativeOrders={
                  settings?.allow_negative_orders ?? (settings as any)?.allowNegativeOrders ?? false
                }
                onToggleStockOverride={handleToggleStockOverride}
                onOpenStockIn={() => handleOpenStockIn()}
                onOpenStockOut={() => handleOpenStockOut()}
                onOpenStockAdjustment={() => handleOpenStockAdjustment()}
                onOpenNewProduct={handleOpenNewProduct}
                onOpenTallyExport={() => navigateTo('tally')}
                onOpenHelp={() => navigateTo('help')}
                onOpenBackup={() => setIsBackupModalOpen(true)}
                onRefresh={fetchData}
                isRefreshing={isLoading}
                onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
              />

              {/* Dynamic Main Workspace Area (Only this content area scrolls) */}
              <main
                ref={mainScrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 dark:bg-slate-900/50 pb-16 transition-colors relative"
              >
                {activeContentTab === 'dashboard' && (
                  <DashboardView
                    stats={stats}
                    isLoading={isLoading}
                    onOpenProductDetail={handleOpenProductDetail}
                    onOpenStockIn={handleOpenStockIn}
                    onOpenStockOut={handleOpenStockOut}
                    onNavigateToInventory={handleNavigateToInventory}
                    onNavigateToTransactions={() => navigateTo('transactions')}
                    onNavigateToTally={() => navigateTo('tally')}
                    onNavigateToRestockPlanner={() => navigateTo('restock_planner')}
                  />
                )}

                {(activeContentTab === 'pending_orders' || activeContentTab === 'pending-orders') && (
                  <PendingOrdersView
                    products={products}
                    onRefreshProducts={fetchData}
                    onGoBack={handleGoBack}
                  />
                )}

                {activeContentTab === 'inventory' && (
                  <InventoryView
                    products={products}
                    categories={categories}
                    role={role}
                    isLoading={isLoading}
                    onRefresh={fetchData}
                    onOpenNewProduct={handleOpenNewProduct}
                    onOpenEditProduct={handleOpenEditProduct}
                    onOpenProductDetail={handleOpenProductDetail}
                    onOpenStockIn={handleOpenStockIn}
                    onOpenStockOut={handleOpenStockOut}
                    onOpenStockAdjustment={handleOpenStockAdjustment}
                    initialStatusFilter={inventoryStatusFilter}
                    onGoBack={handleGoBack}
                  />
                )}

                {activeContentTab === 'restock_planner' && (
                  <RestockPlannerView
                    categories={categories}
                    role={role}
                    onOpenStockIn={handleOpenStockIn}
                    onOpenProductDetail={handleOpenProductDetail}
                    onRefreshAll={fetchData}
                  />
                )}

                {activeContentTab === 'transactions' && (
                  <TransactionHistoryView
                    categories={categories}
                    onOpenProductDetail={handleOpenProductDetail}
                    onGoBack={handleGoBack}
                  />
                )}

                {activeContentTab === 'categories' && (
                  <CategoriesView
                    categories={categories}
                    products={products}
                    role={role}
                    onOpenNewCategory={handleOpenNewCategory}
                    onOpenEditCategory={handleOpenEditCategory}
                    onOpenProductDetail={handleOpenProductDetail}
                    onOpenStockIn={handleOpenStockIn}
                    onOpenStockOut={handleOpenStockOut}
                    onOpenEditProduct={handleOpenEditProduct}
                    onOpenNewProduct={handleOpenNewProduct}
                    onFilterByCategory={handleFilterByCategory}
                    onGoBack={handleGoBack}
                  />
                )}

                {activeContentTab === 'coupons' && (
                  <CouponsView
                    role={role}
                    products={products}
                    categories={categories}
                    onGoBack={handleGoBack}
                  />
                )}

                {activeContentTab === 'tally-sync' && (
                  <TallySyncDashboard
                    products={products}
                    onGoBack={handleGoBack}
                  />
                )}

                {(activeContentTab === 'tally-import' || activeContentTab === 'tally_import') && (
                  <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <TallyImportPanel
                      products={products}
                      onRefreshAll={fetchData}
                    />
                  </div>
                )}

                {activeContentTab === 'tally' && <TallyExportView onGoBack={handleGoBack} />}

                {(activeContentTab === 'help' || activeContentTab === 'manual') && <HelpManualView />}

                {activeContentTab === 'settings' && (
                  <SettingsView
                    settings={settings}
                    role={role}
                    products={products}
                    categories={categories}
                    onRefresh={fetchData}
                    onGoBack={handleGoBack}
                    onOpenProductDetail={handleOpenProductDetail}
                  />
                )}

                {/* Floating Scroll to Top button */}
                <ScrollToTopButton containerRef={mainScrollRef} />
              </main>
            </div>

            {/* Modal Dialogs */}
            <StockInModal
              isOpen={isStockInOpen}
              onClose={() => {
                setIsStockInOpen(false);
                setSelectedProductId(undefined);
              }}
              onSuccess={fetchData}
              products={products}
              initialProductId={selectedProductId}
              onViewInLedger={() => navigateTo('transactions')}
            />

            <StockOutModal
              isOpen={isStockOutOpen}
              onClose={() => {
                setIsStockOutOpen(false);
                setSelectedProductId(undefined);
              }}
              onSuccess={fetchData}
              products={products}
              initialProductId={selectedProductId}
              onViewInLedger={() => navigateTo('transactions')}
            />

            <StockAdjustmentModal
              isOpen={isStockAdjustOpen}
              onClose={() => setIsStockAdjustOpen(false)}
              onSuccess={fetchData}
              products={products}
              initialProductId={selectedProductId}
            />

            <CustomerReturnModal
              isOpen={isCustomerReturnOpen}
              onClose={() => {
                setIsCustomerReturnOpen(false);
                setSelectedProductId(undefined);
              }}
              onSuccess={fetchData}
              products={products}
              initialProductId={selectedProductId}
              onViewInLedger={() => navigateTo('transactions')}
            />

            <ProductFormModal
              isOpen={isProductFormOpen}
              onClose={() => setIsProductFormOpen(false)}
              onSuccess={fetchData}
              categories={categories}
              editingProduct={editingProduct}
            />

            <ProductDetailModal
              isOpen={isProductDetailOpen}
              onClose={() => setIsProductDetailOpen(false)}
              productId={selectedProductId || null}
              onOpenStockIn={handleOpenStockIn}
              onOpenStockOut={handleOpenStockOut}
              onOpenStockAdjustment={handleOpenStockAdjustment}
              onOpenEditProduct={handleOpenEditProduct}
              onRefresh={fetchData}
              isManager={role === 'manager' || role === 'admin'}
            />

            <CategoryModal
              isOpen={isCategoryFormOpen}
              onClose={() => setIsCategoryFormOpen(false)}
              onSuccess={fetchData}
              editingCategory={editingCategory}
            />

            <DatabaseBackupModal
              isOpen={isBackupModalOpen}
              onClose={() => setIsBackupModalOpen(false)}
            />
          </div>
        </GlobalTooltipProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}
