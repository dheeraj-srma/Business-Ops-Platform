'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import './app/globals.css';
import { ThemeProvider } from './app/context/ThemeContext';
import { DialogProvider } from './app/context/DialogContext';
import { GlobalTooltipProvider } from './app/components/common/Tooltip';
import { AppProvider } from './app/context/AppContext';
import { BiDataProvider } from './app/context/BiDataContext';
import { AppShell } from './app/components/layout/AppShell';

// Management workspace page components
import DashboardPage from './app/page';
import SalesPage from './app/sales/page';
import CustomersPage from './app/dealers/page';
import InventoryVelocityPage from './app/inventory-velocity/page';
import ProcurementPage from './app/procurement/page';
import QualityReturnsPage from './app/quality-returns/page';
import GeographyPage from './app/geography/page';
import DemandForecastPage from './app/demand-forecast/page';
import FinancialValuationPage from './app/financial-valuation/page';
import BusinessExplorerPage from './app/explorer/page';
import InventoryPage from './app/inventory/page';
import CentralAdminPage from './app/admin/page';

export default function ManagementWorkspaceWrapper() {
  const pathname = usePathname();

  const activePage = useMemo(() => {
    if (!pathname || pathname === '/management' || pathname === '/') {
      return <DashboardPage />;
    }

    const cleanPath = pathname.replace(/^\/management\/?/, '').toLowerCase();
    const tabSegment = cleanPath.split('/')[0];

    switch (tabSegment) {
      case 'sales':
        return <SalesPage />;
      case 'dealers':
        return <CustomersPage />;
      case 'inventory-velocity':
        return <InventoryVelocityPage />;
      case 'procurement':
        return <ProcurementPage />;
      case 'quality-returns':
        return <QualityReturnsPage />;
      case 'geography':
        return <GeographyPage />;
      case 'demand-forecast':
        return <DemandForecastPage />;
      case 'financial':
      case 'financial-valuation':
      case 'finance':
        return <FinancialValuationPage />;
      case 'explorer':
        return <BusinessExplorerPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'admin':
        return <CentralAdminPage />;
      default:
        return <DashboardPage />;
    }
  }, [pathname]);

  return (
    <ThemeProvider>
      <DialogProvider>
        <GlobalTooltipProvider>
          <AppProvider>
            <BiDataProvider>
              <AppShell>
                {activePage}
              </AppShell>
            </BiDataProvider>
          </AppProvider>
        </GlobalTooltipProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}
