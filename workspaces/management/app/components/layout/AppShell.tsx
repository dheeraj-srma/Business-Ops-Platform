'use client';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useApp } from '../../context/AppContext';
import { ScrollToTopButton } from '../common/ScrollToTopButton';
import { ProductDetailModal } from '../inventory/ProductDetailModal';
import { GlassmorphicModuleLoader } from '../common/GlassmorphicModuleLoader';

const TAB_MODULE_TITLES: Record<string, string> = {
  dashboard: 'Executive Business Insights Dashboard',
  sales: 'Sales & Revenue Intelligence',
  dealers: 'Customer Partner Network & Collections',
  'inventory-velocity': 'Inventory Movement & Velocity Analytics',
  procurement: 'Procurement & Vendor Intelligence',
  'quality-returns': 'Returns & Quality Diagnostics',
  geography: 'Geographic Intelligence & GIS Mapping',
  'demand-forecast': 'AI Demand Forecast & Predictive Modeling',
  financial: 'Financial Valuation & Capital Allocation',
  explorer: '360° Business Entity Explorer',
  inventory: 'Master Catalog Reference (4,315 SKUs)',
  admin: 'Central Admin & System Control Center',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const [isModuleLoading, setIsModuleLoading] = useState(false);
  const [loadingModuleName, setLoadingModuleName] = useState<string>('');

  const {
    fetchData,
    isProductDetailOpen,
    detailProductId,
    handleCloseProductDetail,
    handleOpenStockIn,
    handleOpenStockOut,
    handleOpenStockAdjustment,
  } = useApp();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Restore sidebar collapse state strictly after mount to avoid SSR hydration mismatch
  useEffect(() => {
    try {
      if (localStorage.getItem('stockmaster_sidebar_collapsed') === 'true') {
        setIsSidebarCollapsed(true);
      }
    } catch {}
  }, []);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Map pathname to activeTab
  const currentTab = useMemo(() => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/sales')) return 'sales';
    if (pathname.startsWith('/dealers')) return 'dealers';
    if (pathname.startsWith('/inventory-velocity')) return 'inventory-velocity';
    if (pathname.startsWith('/procurement')) return 'procurement';
    if (pathname.startsWith('/quality-returns')) return 'quality-returns';
    if (pathname.startsWith('/geography')) return 'geography';
    if (pathname.startsWith('/demand-forecast')) return 'demand-forecast';
    if (pathname.startsWith('/financial-valuation') || pathname.startsWith('/finance')) return 'financial';
    if (pathname.startsWith('/explorer')) return 'explorer';
    if (pathname.startsWith('/inventory')) return 'inventory';
    if (pathname.startsWith('/admin')) return 'admin';
    return 'dashboard';
  }, [pathname]);

  // Smooth dismiss when route changes and DOM mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsModuleLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Intercept all route link clicks to trigger glassmorphic loading animation immediately
  useEffect(() => {
    const handleGlobalLinkClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('/#') && href !== pathname) {
        let title = 'Business Module';
        if (href === '/') title = TAB_MODULE_TITLES.dashboard;
        else if (href.startsWith('/sales')) title = TAB_MODULE_TITLES.sales;
        else if (href.startsWith('/dealers')) title = TAB_MODULE_TITLES.dealers;
        else if (href.startsWith('/inventory-velocity')) title = TAB_MODULE_TITLES['inventory-velocity'];
        else if (href.startsWith('/procurement')) title = TAB_MODULE_TITLES.procurement;
        else if (href.startsWith('/quality-returns')) title = TAB_MODULE_TITLES['quality-returns'];
        else if (href.startsWith('/geography')) title = TAB_MODULE_TITLES.geography;
        else if (href.startsWith('/demand-forecast')) title = TAB_MODULE_TITLES['demand-forecast'];
        else if (href.startsWith('/financial-valuation')) title = TAB_MODULE_TITLES.financial;
        else if (href.startsWith('/explorer')) title = TAB_MODULE_TITLES.explorer;
        else if (href.startsWith('/inventory')) title = TAB_MODULE_TITLES.inventory;
        else if (href.startsWith('/admin')) title = TAB_MODULE_TITLES.admin;

        setLoadingModuleName(title);
        setIsModuleLoading(true);
      }
    };

    document.addEventListener('click', handleGlobalLinkClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalLinkClick, { capture: true });
  }, [pathname]);

  const handleSelectTab = (tab: string) => {
    if (tab !== currentTab) {
      setLoadingModuleName(TAB_MODULE_TITLES[tab] || 'Business Module');
      setIsModuleLoading(true);
    }
    if (tab === 'dashboard') router.push('/');
    else if (tab === 'sales') router.push('/sales');
    else if (tab === 'dealers') router.push('/dealers');
    else if (tab === 'inventory-velocity') router.push('/inventory-velocity');
    else if (tab === 'procurement') router.push('/procurement');
    else if (tab === 'quality-returns') router.push('/quality-returns');
    else if (tab === 'geography') router.push('/geography');
    else if (tab === 'demand-forecast') router.push('/demand-forecast');
    else if (tab === 'financial') router.push('/financial-valuation');
    else if (tab === 'explorer') router.push('/explorer');
    else if (tab === 'inventory') router.push('/inventory');
    else if (tab === 'admin') router.push('/admin');
  };

  const headerMeta = useMemo(() => {
    if (pathname === '/') {
      return {
        title: 'Executive Business Insights Dashboard',
        subtitle: 'Enterprise business intelligence, revenue velocity, dealer health, and asset allocation',
      };
    }
    if (pathname.startsWith('/sales')) {
      return {
        title: 'Sales & Revenue Intelligence',
        subtitle: 'Top brand contributions, sales velocity curves, and SKU transaction volume',
      };
    }
    if (pathname.startsWith('/dealers')) {
      return {
        title: 'Customer Partner Network & Collections',
        subtitle: 'Performance rankings across 804 connected customers, purchase velocity, and retention',
      };
    }
    if (pathname.startsWith('/inventory-velocity')) {
      return {
        title: 'Inventory Movement & Velocity Analytics',
        subtitle: 'Turnover ratios, fast vs slow movers, and carrying efficiency across 4,315 SKUs',
      };
    }
    if (pathname.startsWith('/procurement')) {
      return {
        title: 'Procurement & Vendor Intelligence',
        subtitle: 'Purchase spend trends, vendor scorecards, and lead time performance across 211 suppliers',
      };
    }
    if (pathname.startsWith('/quality-returns')) {
      return {
        title: 'Returns & Quality Diagnostics',
        subtitle: 'RMA return reasons, defect root-cause distribution, and recovery value allocation',
      };
    }
    if (pathname.startsWith('/geography')) {
      return {
        title: 'Geographic Intelligence & GIS Mapping',
        subtitle: 'State and territory revenue heatmaps, dealer density, and regional depot stock',
      };
    }
    if (pathname.startsWith('/demand-forecast')) {
      return {
        title: 'AI Demand Forecast & Predictive Modeling',
        subtitle: 'Machine learning demand projections, run-rate depletion risk, and optimal replenishment',
      };
    }
    if (pathname.startsWith('/financial-valuation') || pathname.startsWith('/finance')) {
      return {
        title: 'Financial Valuation & Capital Allocation',
        subtitle: 'Gross margins, working capital liquidity, asset holding costs, and profit contribution',
      };
    }
    if (pathname.startsWith('/explorer')) {
      return {
        title: '360° Business Entity Explorer',
        subtitle: 'Deep-dive profile and transaction telemetry for any SKU, Category, Dealer, or Supplier',
      };
    }
    if (pathname.startsWith('/inventory')) {
      return {
        title: 'Master Catalog Reference',
        subtitle: 'Live searchable operational SKU directory across all brand categories',
      };
    }
    if (pathname.startsWith('/admin')) {
      return {
        title: 'Central Admin & System Control Center',
        subtitle: 'Platform-wide security, user access control, system settings, feature flags, and audit logs',
      };
    }
    return {
      title: 'PowerBI Business Intelligence Platform',
      subtitle: 'Nalka Metals enterprise analytical control plane',
    };
  }, [pathname]);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('stockmaster_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Refactored Business Intelligence Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isMobileOpen={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-950">
        {/* Streamlined Header */}
        <Header
          currentTabTitle={headerMeta.title}
          subtitle={headerMeta.subtitle}
          onRefresh={fetchData}
          onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
        />

        {/* Dynamic Route Page Body */}
        <main
          ref={mainScrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100 custom-scrollbar relative"
        >
          <div className="w-full max-w-[1760px] 2xl:max-w-[1880px] mx-auto">
            {children}
          </div>

          <ScrollToTopButton containerRef={mainScrollRef} />
        </main>
      </div>

      {/* Product Detail Modal for Drill-down View */}
      <ProductDetailModal
        isOpen={isProductDetailOpen}
        productId={detailProductId ?? null}
        onClose={handleCloseProductDetail}
        onOpenStockIn={(id) => {
          handleCloseProductDetail();
          handleOpenStockIn(id);
        }}
        onOpenStockOut={(id) => {
          handleCloseProductDetail();
          handleOpenStockOut(id);
        }}
        onOpenStockAdjustment={(id) => {
          handleCloseProductDetail();
          handleOpenStockAdjustment(id);
        }}
      />

      {/* Glassmorphic Interactive Module Loader */}
      <GlassmorphicModuleLoader isLoading={isModuleLoading} moduleName={loadingModuleName} />
    </div>
  );
}
