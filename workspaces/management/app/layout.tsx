import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import { DialogProvider } from "./context/DialogContext";
import { GlobalTooltipProvider } from "./components/common/Tooltip";
import { AppProvider } from "./context/AppContext";
import { BiDataProvider } from "./context/BiDataContext";
import { AppShell } from "./components/layout/AppShell";

export const metadata: Metadata = {
  title: "Nalka Metals | PowerBI Analytics & Business Intelligence",
  description: "Enterprise Business Intelligence, Financial Valuation & Demand Forecasting Platform for Nalka Metals.",
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <ThemeProvider>
          <DialogProvider>
            <GlobalTooltipProvider>
              <AppProvider>
                <BiDataProvider>
                  <AppShell>
                    {children}
                  </AppShell>
                </BiDataProvider>
              </AppProvider>
            </GlobalTooltipProvider>
          </DialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
