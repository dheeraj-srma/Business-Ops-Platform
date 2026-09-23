'use client';
import React from 'react';
import { Database, Clock, AlertTriangle, CheckCircle2, Calendar, RefreshCw } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import { DateRangeType } from '../utils/dateRange';

interface DataFreshnessBadgeProps {
  className?: string;
  showSelector?: boolean;
}

export default function DataFreshnessBadge({ className = '', showSelector = true }: DataFreshnessBadgeProps) {
  const {
    dataStatus,
    dataAsOf,
    referenceDate,
    snapshotUpdatedAt,
    lastSyncedAt,
    loading,
    selectedRange,
    customStart,
    customEnd,
    activeBounds,
    setSelectedRange,
    refreshBiData,
  } = useBi();

  const formatDate = (iso: string) => {
    if (!iso || iso.length < 10) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = iso.slice(0, 10).split('-');
    const m = parseInt(parts[1], 10) - 1;
    return `${parts[2]} ${months[m] || parts[1]} ${parts[0]}`;
  };

  const isDataHistorical = dataAsOf && dataAsOf !== referenceDate;

  return (
    <div className={`flex items-center gap-2.5 flex-wrap ${className}`}>
      {/* ── Status Pill ────────────────────────────────────────────── */}
      {loading ? (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 animate-pulse">
          <Clock size={12} className="animate-spin text-indigo-400" />
          <span>Synchronizing...</span>
        </div>
      ) : dataStatus === 'SNAPSHOT' ? (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Database size={12} className="text-amber-400" />
          <span>READ-ONLY SNAPSHOT</span>
          {dataAsOf && (
            <span className="text-[11px] text-amber-300">· Data through {formatDate(dataAsOf)}</span>
          )}
          {snapshotUpdatedAt && (
            <span className="text-[10px] text-amber-400/80">· Captured {snapshotUpdatedAt.slice(11, 19)}</span>
          )}
        </div>
      ) : dataStatus === 'UNAVAILABLE' ? (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <AlertTriangle size={12} className="text-rose-400" />
          <span>DATA UNAVAILABLE</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 size={12} className="text-emerald-400" />
          <span>LIVE DATA</span>
          {isDataHistorical ? (
            <span className="text-[11px] text-emerald-400/90">· Data through {formatDate(dataAsOf!)}</span>
          ) : (
            <span className="text-[11px] text-emerald-400/90">· Today ({formatDate(referenceDate)})</span>
          )}
          {lastSyncedAt && (
            <span className="text-[10px] text-slate-400 hidden sm:inline">· Synced {lastSyncedAt}</span>
          )}
        </div>
      )}

      {/* ── Global Date Range Selector ────────────────────────────── */}
      {showSelector && (
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-200">
          <Calendar size={12} className="text-indigo-400 shrink-0" />
          <select
            className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer pr-1 font-medium"
            value={selectedRange}
            onChange={e => setSelectedRange(e.target.value as DateRangeType)}
          >
            <option value="today" className="bg-slate-900 text-slate-200">Today</option>
            <option value="yesterday" className="bg-slate-900 text-slate-200">Yesterday</option>
            <option value="7d" className="bg-slate-900 text-slate-200">Last 7 Days</option>
            <option value="this_week" className="bg-slate-900 text-slate-200">This Week</option>
            <option value="this_month" className="bg-slate-900 text-slate-200">This Month</option>
            <option value="last_month" className="bg-slate-900 text-slate-200">Last Month</option>
            <option value="30d" className="bg-slate-900 text-slate-200">Last 30 Days</option>
            <option value="60d" className="bg-slate-900 text-slate-200">Last 60 Days</option>
            <option value="90d" className="bg-slate-900 text-slate-200">Last 90 Days</option>
            <option value="this_quarter" className="bg-slate-900 text-slate-200">This Quarter</option>
            <option value="ytd" className="bg-slate-900 text-slate-200">Year-to-Date (YTD)</option>
            <option value="12m" className="bg-slate-900 text-slate-200">Last 12 Months</option>
            <option value="all" className="bg-slate-900 text-slate-200">All History</option>
            <option value="custom" className="bg-slate-900 text-slate-200">Custom Range...</option>
          </select>

          {selectedRange === 'custom' && (
            <div className="flex items-center gap-1 ml-1 text-[11px]">
              <input
                type="date"
                value={customStart || activeBounds.start}
                onChange={e => setSelectedRange('custom', e.target.value, customEnd || activeBounds.end)}
                className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-slate-200 text-[10px]"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEnd || activeBounds.end}
                onChange={e => setSelectedRange('custom', customStart || activeBounds.start, e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-slate-200 text-[10px]"
              />
            </div>
          )}

          <button
            onClick={() => refreshBiData()}
            disabled={loading}
            title="Refresh analytics data"
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors ml-0.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      )}
    </div>
  );
}
