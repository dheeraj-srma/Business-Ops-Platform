import type { Metadata } from 'next';
import './globals.css';
import PlatformHeader from '@/shared/PlatformHeader';

export const metadata: Metadata = {
  title: 'Business Ops Platform',
  description: 'Unified Business Operations Platform integrating Sales, Operations, and Management Workspaces.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white flex flex-col">
        <PlatformHeader />
        <main className="flex-1 w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
