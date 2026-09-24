import type { Metadata } from 'next';
import './globals.css';
import WorkspaceSwitcher from '@/shared/components/WorkspaceSwitcher';

export const metadata: Metadata = {
  title: 'Business Ops Platform',
  description: 'Unified Business Operations Platform integrating Sales, Operations, and Management Workspaces.',
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
      <body suppressHydrationWarning className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white flex flex-col relative">
        <main className="flex-1 w-full relative">
          {children}
        </main>
        <WorkspaceSwitcher />
      </body>
    </html>
  );
}
