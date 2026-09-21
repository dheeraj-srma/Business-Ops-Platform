'use client';
import React from 'react';
import { Database, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useBi } from '../context/BiDataContext';

interface DataFreshnessBadgeProps {
  className?: string;
}

export default function DataFreshnessBadge({ className = '' }: DataFreshnessBadgeProps) {
  const { dataStatus, dataAsOf, snapshotUpdatedAt, loading } = useBi();

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 animate-pulse ${className}`}>
        <Clock size={13} className="animate-spin" />
        <span>Synchronizing telemetry...</span>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const isDataHistorical = dataAsOf && dataAsOf !== todayStr;

  const formatDate = (iso: string) => {
    if (!iso || iso.length < 10) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = iso.slice(0, 10).split('-');
    const m = parseInt(parts[1], 10) - 1;
    return `${months[m] || parts[1]} ${parts[2]}, ${parts[0]}`;
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  if (dataStatus === 'SNAPSHOT') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 ${className}`}>
        <Database size={13} className="text-amber-400" />
        <span>READ-ONLY SNAPSHOT</span>
        {snapshotUpdatedAt && (
          <span className="text-[11px] text-amber-400/80">· Updated: {formatTimestamp(snapshotUpdatedAt)}</span>
        )}
        {isDataHistorical && (
          <span className="text-[11px] text-amber-300">· Data through {formatDate(dataAsOf!)}</span>
        )}
      </div>
    );
  }

  if (dataStatus === 'UNAVAILABLE') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 ${className}`}>
        <AlertTriangle size={13} className="text-rose-400" />
        <span>ANALYTICS UNAVAILABLE</span>
        <span className="text-[11px] text-rose-400/80">· No live or snapshot records</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${className}`}>
      <CheckCircle2 size={13} className="text-emerald-400" />
      <span>LIVE</span>
      {isDataHistorical ? (
        <span className="text-[11px] text-emerald-400/80">· Data through {formatDate(dataAsOf!)}</span>
      ) : (
        <span className="text-[11px] text-emerald-400/80">· Real-time</span>
      )}
    </div>
  );
}
