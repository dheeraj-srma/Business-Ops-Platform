'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  TrendingUp,
  CircleDollarSign,
  Truck,
  Store,
  Percent,
  Receipt,
  Repeat,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Layers,
  BarChart3,
  ExternalLink,
} from 'lucide-react';

export type KpiType =
  | 'revenue'
  | 'inventory'
  | 'purchase'
  | 'customers'
  | 'margin'
  | 'aov'
  | 'turnover'
  | 'fulfillment';

export interface KpiModalData {
  type: KpiType;
  title: string;
  category: string;
  value: string;
  trend: string;
  trendPositive: boolean;
  tagline: string;
  summary: string;
  icon: any;
  accentColor: string; // 'sky' | 'cyan' | 'amber' | 'purple' | 'cyan'
  metrics: {
    label: string;
    value: string;
    sublabel: string;
  }[];
  breakdownTitle: string;
  breakdownItems: {
    name: string;
    pct: number;
    amount?: string;
  }[];
  recommendation: string;
  actionUrl: string;
  actionLabel: string;
}

interface KpiDetailModalProps {
  kpi: KpiModalData | null;
  onClose: () => void;
}

export const KpiDetailModal: React.FC<KpiDetailModalProps> = ({ kpi, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!kpi) return null;

  const Icon = kpi.icon;

  const getAccentStyles = (accent: string) => {
    switch (accent) {
      case 'cyan':
        return {
          badge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40',
          text: 'text-indigo-600 dark:text-indigo-400',
          bar: 'bg-indigo-600 dark:bg-indigo-500',
          ring: 'ring-cyan-500/20',
        };
      case 'amber':
        return {
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          text: 'text-amber-400',
          bar: 'bg-amber-500',
          ring: 'ring-amber-500/20',
        };
      case 'purple':
        return {
          badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          text: 'text-purple-400',
          bar: 'bg-purple-500',
          ring: 'ring-purple-500/20',
        };
      case 'cyan':
        return {
          badge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40',
          text: 'text-indigo-600 dark:text-indigo-400',
          bar: 'bg-indigo-600 dark:bg-indigo-500',
          ring: 'ring-cyan-500/20',
        };
      case 'sky':
      default:
        return {
          badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          text: 'text-sky-400',
          bar: 'bg-sky-500',
          ring: 'ring-sky-500/20',
        };
    }
  };

  const accentStyle = getAccentStyles(kpi.accentColor);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-5 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900/90 dark:bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden ring-1 ring-white/10 animate-in zoom-in-95 duration-200 my-auto text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Chrome Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            {/* macOS traffic lights */}
            <div className="flex items-center gap-1.5 mr-2">
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors cursor-pointer"
                title="Close"
              />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-indigo-600 dark:bg-indigo-500/80" />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {kpi.category}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline-block">
              Press Esc to close
            </span>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Hero Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border ${accentStyle.badge}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-white">{kpi.title}</h3>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-2">
                {kpi.value}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                    kpi.trendPositive
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {kpi.trend}
                </span>
                <span className="text-xs text-slate-400">{kpi.tagline}</span>
              </div>
            </div>

            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:min-w-[200px] flex flex-col justify-center">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Telemetry Verified
              </div>
              <div className="text-xs text-slate-300 font-medium">Real-time DB Sync</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Automated telemetry capture</div>
            </div>
          </div>

          {/* Key Metric Breakdown Grid */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
              <span>Key Operational Telemetry</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {kpi.metrics.map((m, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 flex flex-col justify-between"
                >
                  <span className="text-[10px] font-medium text-slate-400 leading-tight">
                    {m.label}
                  </span>
                  <span className="text-sm sm:base font-bold text-white mt-1.5">
                    {m.value}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{m.sublabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Composition Breakdown */}
          <div className="bg-slate-950/40 border border-slate-800/70 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{kpi.breakdownTitle}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Relative Distribution</span>
            </div>
            <div className="space-y-2.5">
              {kpi.breakdownItems.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">{item.name}</span>
                    <div className="flex items-center gap-2">
                      {item.amount && (
                        <span className="text-slate-400 font-mono text-[11px]">{item.amount}</span>
                      )}
                      <span className="font-semibold text-white">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${accentStyle.bar}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Insight & Recommendation */}
          <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-white mb-0.5">Executive Strategic Takeaway</div>
              <div className="text-slate-300 leading-relaxed">{kpi.recommendation}</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>

          <Link
            href={kpi.actionUrl}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-500 text-slate-950 font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <span>{kpi.actionLabel}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
