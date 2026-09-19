'use client';

import dynamic from 'next/dynamic';
import RouteGuard from '@/shared/RouteGuard';

const SalesApp = dynamic(() => import('@/workspaces/sales/src/App'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-400 font-medium">Loading Sales Workspace...</p>
      </div>
    </div>
  ),
});

export default function SalesWorkspacePage() {
  return (
    <RouteGuard workspace="sales">
      <SalesApp />
    </RouteGuard>
  );
}
