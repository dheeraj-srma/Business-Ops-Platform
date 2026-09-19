'use client';

import React from 'react';
import { Boxes, LogOut, Radio } from 'lucide-react';

interface SalesmanAuthHeaderProps {
  userRole: 'Salesman' | 'Customer' | 'Admin';
  loginSalesman: string;
  realtimeStatus?: 'connected' | 'reconnecting' | 'idle';
  onLogout: () => void;
}

export default function SalesmanAuthHeader({
  userRole,
  loginSalesman,
  realtimeStatus = 'connected',
  onLogout,
}: SalesmanAuthHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-md shadow-xl">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Boxes className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Nalka Metals Order Terminal</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
              Outward Order Logging
            </span>
            {realtimeStatus === 'connected' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                <Radio className="w-3 h-3 animate-pulse text-indigo-600 dark:text-indigo-400" />
                Realtime Active
              </span>
            )}
            {realtimeStatus === 'reconnecting' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Radio className="w-3 h-3 animate-spin text-amber-400" />
                Resyncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Active Role: <strong className="text-slate-200">{userRole}</strong> &bull; Profile: <strong className="text-indigo-700 dark:text-indigo-300">{loginSalesman}</strong>
          </p>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
      >
        <LogOut className="w-4 h-4 text-rose-400" />
        Log Out
      </button>
    </div>
  );
}
