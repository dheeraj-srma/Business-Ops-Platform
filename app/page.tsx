'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Boxes, BarChart3, ArrowRight, ShieldCheck, UserCheck, Layers } from 'lucide-react';

export default function PlatformDashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>('admin');

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('nalka_terminal_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        const role = parsed.profile?.role || 'admin';
        setUserRole(role);
      }
    } catch (e) {}
  }, []);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-6 sm:p-10 max-w-7xl mx-auto flex flex-col justify-center space-y-8">
      {/* Header Banner */}
      <div className="space-y-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Unified Enterprise Platform</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Business Operations Platform
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
          Consolidated operations suite providing unified role-based workspaces for Sales, Stock & Operations Management, and Executive BI & Analytics.
        </p>
      </div>

      {/* Workspace Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sales Workspace */}
        <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">Sales Workspace</h2>
              <p className="text-xs text-slate-400 mt-1">Order Application for sales representatives, dealer selection, catalog search, PDF order generation, and offline submission.</p>
            </div>
          </div>
          <div className="pt-6">
            <Link
              href="/sales"
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <span>Enter Sales Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Operations Workspace */}
        <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">Operations Workspace</h2>
              <p className="text-xs text-slate-400 mt-1">Stock & Inventory Management, pending order approvals, restock planner, stock movements, and Tally ERP sync.</p>
            </div>
          </div>
          <div className="pt-6">
            <Link
              href="/operations"
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <span>Enter Operations Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Management Workspace */}
        <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">Management Workspace</h2>
              <p className="text-xs text-slate-400 mt-1">Executive Business Intelligence, financial stock valuation, geographic heatmaps, demand forecasting, and reports.</p>
            </div>
          </div>
          <div className="pt-6">
            <Link
              href="/management"
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <span>Enter Management Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
