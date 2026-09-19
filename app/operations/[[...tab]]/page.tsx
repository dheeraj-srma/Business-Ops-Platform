'use client';

import dynamic from 'next/dynamic';

const OperationsApp = dynamic(() => import('@/workspaces/operations/src/App'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-400 font-medium">Loading Operations Workspace...</p>
      </div>
    </div>
  ),
});

export default function OperationsWorkspacePage() {
  return <OperationsApp />;
}
