'use client';

import React from 'react';
import { ThemeProvider } from './app/context/ThemeContext';
import { DialogProvider } from './app/context/DialogContext';
import { GlobalTooltipProvider } from './app/components/common/Tooltip';
import { AppProvider } from './app/context/AppContext';
import { BiDataProvider } from './app/context/BiDataContext';
import { AppShell } from './app/components/layout/AppShell';
import DashboardPage from './app/page';

export default function ManagementWorkspaceWrapper() {
  return (
    <ThemeProvider>
      <DialogProvider>
        <GlobalTooltipProvider>
          <AppProvider>
            <BiDataProvider>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </BiDataProvider>
          </AppProvider>
        </GlobalTooltipProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}
