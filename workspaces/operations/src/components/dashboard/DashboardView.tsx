import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  PackageCheck,
  ChevronRight,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Calendar,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DashboardStats, Product, StockTransaction } from '../../types';
import { formatNumber, formatDate, cn } from '../../lib/utils';
import { api } from '../../lib/api';

interface DashboardViewProps {
  stats: DashboardStats | null;
  isLoading: boolean;
  onOpenProductDetail: (productId: string) => void;
  onOpenStockIn: (productId?: string) => void;
  onOpenStockOut: (productId?: string) => void;
  onNavigateToInventory: (statusFilter?: string) => void;
  onNavigateToTransactions: () => void;
  onNavigateToTally: () => void;
  onNavigateToRestockPlanner?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  isLoading,
  onOpenProductDetail,
  onOpenStockIn,
  onOpenStockOut,
  onNavigateToInventory,
  onNavigateToTransactions,
  onNavigateToTally,
  onNavigateToRestockPlanner,
}) => {
  /** Return local YYYY-MM-DD for a Date object (avoids UTC shift from toISOString) */
  const toLocalDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d' | 'custom'>('7d');
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return {
      start: toLocalDateStr(d),
      end: toLocalDateStr(new Date()),
    };
  });
  const [isCustomOpen, setIsCustomOpen] = useState<boolean>(false);
  const [trendData, setTrendData] = useState<Array<{ date: string; stockIn: number; stockOut: number; adjustments?: number }>>([]);
  const [isFetchingTrend, setIsFetchingTrend] = useState<boolean>(false);

  useEffect(() => {
    if (stats?.trend && timeRange === '7d') {
      setTrendData(stats.trend);
    }
  }, [stats?.trend, timeRange]);

  const fetchTrend = async (
    range: '7d' | '14d' | '30d' | 'custom',
    custom?: { start: string; end: string }
  ) => {
    setIsFetchingTrend(true);
    try {
      let startDateStr: string;
      let endDateStr: string;

      if (range === 'custom') {
        const c = custom || customRange;
        startDateStr = c.start;
        endDateStr = c.end;
      } else {
        const daysMap = { '7d': 7, '14d': 14, '30d': 30 };
        const numDays = daysMap[range];
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (numDays - 1));
        startDateStr = toLocalDateStr(start);
        endDateStr = toLocalDateStr(end);
      }

      // Query transactions within date range
      const txRes = await api.getTransactions({
        dateFrom: startDateStr,
        dateTo: endDateStr,
      });
      const transactions = Array.isArray(txRes) ? txRes : (txRes?.transactions || []);

      // Build daily buckets
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const buckets: Array<{ date: string; stockIn: number; stockOut: number }> = [];
      const cur = new Date(start);
      let count = 0;
      const maxDays = 90;

      while (cur <= end && count < maxDays) {
        const dayIso = toLocalDateStr(cur);
        const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(cur);

        let stockIn = 0;
        let stockOut = 0;

        for (const tx of (transactions || [])) {
          const rawDate = tx.createdAt || (tx as any).created_at || (tx as any).transaction_date || (tx as any).transactionDate || '';
          const txDate = rawDate ? toLocalDateStr(new Date(rawDate)) : '';
          if (txDate === dayIso) {
            const rawType = (tx.transactionType || (tx as any).transaction_type || '').toUpperCase();
            const notes = ((tx as any).notes || (tx as any).reason || '').toLowerCase();
            const qty = Math.abs(Number(tx.quantity) || 0);

            // Exclude opening inventory import from daily movement trend
            if (notes.includes('opening quantity') || notes.includes('initial stock')) {
              continue;
            }

            if (['INWARD', 'STOCK_IN', 'CUSTOMER_RETURN', 'RETURN_IN', 'ADJUSTMENT_INCREASE'].includes(rawType)) {
              stockIn += qty;
            } else if (['SALE', 'SALES', 'STOCK_OUT', 'DISPATCH', 'ADJUSTMENT_DECREASE'].includes(rawType)) {
              stockOut += qty;
            } else if (rawType === 'ADJUSTMENT') {
              if (Number(tx.quantity) >= 0) {
                stockIn += qty;
              } else {
                stockOut += qty;
              }
            }
          }
        }

        buckets.push({ date: label, stockIn, stockOut });
        cur.setDate(cur.getDate() + 1);
        count++;
      }

      if (buckets.length > 0) {
        setTrendData(buckets);
      }
    } catch (e) {
      console.error('Failed to fetch trend data:', e);
    } finally {
      setIsFetchingTrend(false);
    }
  };

  const handleSelectPreset = (range: '7d' | '14d' | '30d') => {
    setTimeRange(range);
    setIsCustomOpen(false);
    fetchTrend(range);
  };

  const handleApplyCustom = () => {
    setTimeRange('custom');
    setIsCustomOpen(false);
    fetchTrend('custom', customRange);
  };

  const timeRangeLabel = useMemo(() => {
    if (timeRange === '7d') return '7 days';
    if (timeRange === '14d') return '14 days';
    if (timeRange === '30d') return '30 days';
    return `${customRange.start} to ${customRange.end}`;
  }, [timeRange, customRange]);

  const activeTrend = trendData.length > 0 ? trendData : (stats?.trend || []);

  // Handle ESC key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Lock body scrolling when full screen is active
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  if (isLoading || !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 text-sm flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Calculating real-time inventory statistics...</span>
        </div>
      </div>
    );
  }

  const totalSKUs = stats?.totalActiveSkus || stats?.totalProducts || 0;
  const negativeCount = stats?.negativeStockCount || 0;
  const healthyCount = stats?.healthyCount || 0;
  const lowStockCount = stats?.lowStockCount || 0;
  const criticalStockCount = stats?.criticalStockCount || 0;
  const outOfStockCount = stats?.outOfStockCount || 0;
  const lowStockItems = Array.isArray(stats?.lowStockItems) ? stats.lowStockItems : [];
  const recentMovements = Array.isArray(stats?.recentMovements) ? stats.recentMovements : [];
  const healthyPercent = totalSKUs > 0 ? Math.round((healthyCount / totalSKUs) * 100) : 0;
  const lowPercent = totalSKUs > 0 ? Math.round((lowStockCount / totalSKUs) * 100) : 0;
  const critPercent = totalSKUs > 0 ? Math.round((criticalStockCount / totalSKUs) * 100) : 0;
  const outPercent = totalSKUs > 0 ? Math.round((outOfStockCount / totalSKUs) * 100) : 0;
  const negPercent = totalSKUs > 0 ? Math.round((negativeCount / totalSKUs) * 100) : 0;

  return (
    <div id="dashboard-view" className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Summary Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <div
          onClick={() => onNavigateToInventory()}
          className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-2xs transition-all"
        >
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Total Inventory
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">
            {formatNumber(stats?.totalProducts || 0)} Items
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Across active categories
          </div>
        </div>

        {/* Total Stock Volume */}
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Stock Volume
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100 font-mono">
            {formatNumber(stats?.totalUnitsInStock || 0)}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active physical units</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          onClick={() => onNavigateToInventory('LOW')}
          className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-2xs transition-all"
        >
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Low Stock Alerts
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {lowStockCount} Items
          </div>
          <div className="text-xs text-amber-700/90 dark:text-amber-300/90 font-medium mt-2">
            {criticalStockCount > 0 ? `${criticalStockCount} critical items` : 'Requires restocking'}
          </div>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => onNavigateToInventory('OUT_OF_STOCK')}
          className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-red-300 dark:hover:border-red-500/50 hover:shadow-2xs transition-all"
        >
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Out of Stock
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {outOfStockCount} Items
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Zero current balance
          </div>
        </div>
      </div>

      {/* Stock Health & Inventory Status Bar */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Inventory Health Distribution</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Live categorization of {totalSKUs} active stock items</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3.5 text-xs">
            <button
              onClick={() => onNavigateToInventory('HEALTHY')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 transition-colors cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-[11px]">Healthy ({healthyCount})</span>
            </button>
            <button
              onClick={() => onNavigateToInventory('LOW')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/80 transition-colors cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-semibold text-[11px]">Low ({lowStockCount})</span>
            </button>
            <button
              onClick={() => onNavigateToInventory('CRITICAL')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-transparent dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-900/80 transition-colors cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="font-semibold text-[11px]">Critical ({criticalStockCount})</span>
            </button>
            <button
              onClick={() => onNavigateToInventory('OUT_OF_STOCK')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-transparent dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/80 transition-colors cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-red-600" />
              <span className="font-semibold text-[11px]">Out ({outOfStockCount})</span>
            </button>
            {negativeCount > 0 && (
              <button
                onClick={() => onNavigateToInventory('NEGATIVE')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/80 transition-colors cursor-pointer"
              >
                <div className="w-2 h-2 rounded-full bg-rose-600" />
                <span className="font-semibold text-[11px]">Negative ({negativeCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-700/80 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${healthyPercent}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title={`Healthy: ${healthyPercent}%`}
          />
          <div
            style={{ width: `${lowPercent}%` }}
            className="bg-amber-400 h-full transition-all duration-500"
            title={`Low Stock: ${lowPercent}%`}
          />
          <div
            style={{ width: `${critPercent}%` }}
            className="bg-orange-500 h-full transition-all duration-500"
            title={`Critical: ${critPercent}%`}
          />
          <div
            style={{ width: `${outPercent}%` }}
            className="bg-red-600 h-full transition-all duration-500"
            title={`Out of Stock: ${outPercent}%`}
          />
          {negPercent > 0 && (
            <div
              style={{ width: `${negPercent}%` }}
              className="bg-rose-600 h-full transition-all duration-500"
              title={`Negative Stock: ${negPercent}%`}
            />
          )}
        </div>

        {/* Restock & Reorder Replenishment CTA Card */}
        {(stats.lowStockCount > 0 || stats.outOfStockCount > 0 || negativeCount > 0) && onNavigateToRestockPlanner && (
          <div className="mt-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span className="p-2 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  {stats.lowStockCount + stats.outOfStockCount + negativeCount} SKUs Require Restocking & Deficit Mitigation
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Calculated based on Negative physical stock, floor outages, and safety buffer deficits.
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateToRestockPlanner}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:bg-zinc-800 dark:hover:bg-amber-300 transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
            >
              <span>Open Restock Planner</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Low Stock Alert Panel + Movement Activity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Low Stock Alert Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
              Low Stock Alerts
            </h3>
            <button
              onClick={() => onNavigateToInventory('LOW')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 sm:p-4 flex-1 overflow-y-auto space-y-2.5 max-h-[360px]">
            {lowStockItems.length === 0 ? (
              <div className="py-10 text-center">
                <PackageCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Healthy Inventory Status</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  All inventory products are currently above minimum threshold levels.
                </p>
              </div>
            ) : (
              lowStockItems.map((prod) => (
                <div
                  key={prod.id}
                  className={cn(
                    'p-3 rounded-lg border flex items-center justify-between gap-3 transition-all',
                    prod.status === 'NEGATIVE'
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50'
                      : prod.status === 'OUT_OF_STOCK' || prod.status === 'CRITICAL'
                      ? 'bg-red-50/70 dark:bg-red-950/30 border-red-100 dark:border-red-900/40'
                      : 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/40'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        'w-1.5 h-7 rounded-full shrink-0',
                        prod.status === 'NEGATIVE'
                          ? 'bg-rose-600'
                          : prod.status === 'OUT_OF_STOCK' || prod.status === 'CRITICAL'
                          ? 'bg-red-500'
                          : 'bg-orange-500'
                      )}
                    />
                    <div
                      onClick={() => onOpenProductDetail(prod.id)}
                      className="cursor-pointer min-w-0 flex-1"
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate hover:text-indigo-600 dark:hover:text-indigo-400">
                        {prod.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {prod.status === 'NEGATIVE' ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">{prod.current_stock ?? prod.currentStock} {prod.unit} (Negative)</span>
                        ) : (
                          <><span className="font-bold text-slate-900 dark:text-slate-100">{prod.current_stock ?? prod.currentStock}</span> / {prod.minimum_stock ?? prod.minimumStock} {prod.unit} left</>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenStockIn(prod.id)}
                    className="shrink-0 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  >
                    Receive
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stock Movement Activity Chart (7 cols) - Clean Modern Line Graph */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col p-5 sm:p-6 relative transition-colors">
          {/* Header Row: Title on Left, Controls & Minimal Legend on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 tracking-tight">
                  Stock Movement Activity
                </h3>
                {isFetchingTrend && (
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                Inward receipts vs outward dispatches ({timeRangeLabel})
              </p>
            </div>

            {/* Controls: Time Range Selector + Modern Minimal Legend Badges */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Time Range Selector */}
              <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 relative">
                {(['7d', '14d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSelectPreset(r)}
                    className={cn(
                      'px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-all cursor-pointer uppercase',
                      timeRange === r
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    )}
                  >
                    {r}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setIsCustomOpen(!isCustomOpen)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer',
                    timeRange === 'custom'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                  title="Select custom date range"
                >
                  <Calendar className="w-3 h-3" />
                  <span className="hidden sm:inline">Custom</span>
                </button>

                {/* Floating Popover for Custom Range */}
                {isCustomOpen && (
                  <div className="absolute right-0 top-full mt-2 z-40 w-64 p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-150">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5 flex items-center justify-between">
                      <span>Custom Date Range</span>
                      <button
                        type="button"
                        onClick={() => setIsCustomOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={customRange.start}
                          max={customRange.end || toLocalDateStr(new Date())}
                          onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">End Date</label>
                        <input
                          type="date"
                          value={customRange.end}
                          min={customRange.start}
                          max={toLocalDateStr(new Date())}
                          onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyCustom}
                        className="w-full mt-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Apply Date Range
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Minimalist Legend Pills (Matching Reference Image Style) */}
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#4338ca] dark:bg-[#6366f1] inline-block shadow-2xs" />
                  <span>Inward</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-50/80 dark:bg-cyan-950/50 border border-cyan-200/60 dark:border-cyan-800/60 text-cyan-700 dark:text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#06b6d4] dark:bg-[#22d3ee] inline-block shadow-2xs" />
                  <span>Sales</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Canvas Area */}
          <div className="h-64 sm:h-76 w-full pt-2 pb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeTrend} margin={{ top: 15, right: 15, left: -18, bottom: 8 }}>
                <defs>
                  {/* Soft Drop Shadows for 3D Elevated Curve Effect */}
                  <filter id="softGlowPurple" x="-10%" y="-10%" width="130%" height="150%">
                    <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#4338ca" floodOpacity="0.35" />
                  </filter>
                  <filter id="softGlowCyan" x="-10%" y="-10%" width="130%" height="150%">
                    <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.35" />
                  </filter>

                  {/* Vertical Subtle Translucent Gradients */}
                  <linearGradient id="gradientPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4338ca" stopOpacity={0.25} />
                    <stop offset="70%" stopColor="#6366f1" stopOpacity={0.04} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>

                  <linearGradient id="gradientCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="70%" stopColor="#22d3ee" stopOpacity={0.04} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                {/* Subtle Horizontal Grid Lines Only */}
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#94a3b8" strokeOpacity={0.12} />

                {/* X Axis - Calibrated with clean padding below the 0 baseline */}
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                  axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.15 }}
                  tickLine={false}
                  dy={8}
                />

                {/* Y Axis with 'k' formatting and guaranteed 0 floor */}
                <YAxis
                  domain={[0, 'auto']}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                  dx={-2}
                />

                {/* Custom Modern Floating Tooltip Matching Reference Design */}
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;

                    const stockIn = payload.find((p: any) => p.dataKey === 'stockIn')?.value || 0;
                    const stockOut = payload.find((p: any) => p.dataKey === 'stockOut')?.value || 0;
                    const totalMovement = stockIn + stockOut;

                    return (
                      <div className="bg-[#0b1329] text-white rounded-2xl p-3.5 px-4 shadow-2xl border border-slate-700/70 ring-1 ring-white/10 min-w-[190px] animate-in zoom-in-95 duration-100 select-none">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1.5 pb-1 border-b border-slate-800">
                          <span>{label}</span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                            Activity
                          </span>
                        </div>

                        <div className="text-base font-bold text-white font-mono tracking-tight my-1">
                          {totalMovement.toLocaleString()}{' '}
                          <span className="text-xs text-slate-400 font-normal">Units Moved</span>
                        </div>

                        <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                          <div className="flex items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-[#4338ca] dark:bg-[#6366f1] inline-block shadow-2xs" />
                              <span className="text-slate-300 text-[11px] font-medium">Inward (In)</span>
                            </div>
                            <span className="font-mono font-bold text-white text-xs">
                              {stockIn.toLocaleString()}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">pcs</span>
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-[#06b6d4] dark:bg-[#22d3ee] inline-block shadow-2xs" />
                              <span className="text-slate-300 text-[11px] font-medium">Sales (Out)</span>
                            </div>
                            <span className="font-mono font-bold text-white text-xs">
                              {stockOut.toLocaleString()}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">pcs</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Line 1: Inward (Deep Indigo / Purple Smooth Wave with Monotone interpolation to avoid 0-undershoot) */}
                <Area
                  type="monotone"
                  dataKey="stockIn"
                  name="Inward (Stock In)"
                  stroke="#4338ca"
                  strokeWidth={3.5}
                  fill="url(#gradientPurple)"
                  filter="url(#softGlowPurple)"
                  activeDot={{
                    r: 6,
                    stroke: '#4338ca',
                    strokeWidth: 3,
                    fill: '#ffffff',
                  }}
                />

                {/* Line 2: Sales / Outward (Vivid Bright Cyan / Aqua Smooth Wave) */}
                <Area
                  type="monotone"
                  dataKey="stockOut"
                  name="Outward (Sales)"
                  stroke="#06b6d4"
                  strokeWidth={3.5}
                  fill="url(#gradientCyan)"
                  filter="url(#softGlowCyan)"
                  activeDot={{
                    r: 6,
                    stroke: '#06b6d4',
                    strokeWidth: 3,
                    fill: '#ffffff',
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Full Screen Backdrop with Blur & Inactive Dimming */}
      {isFullScreen && (
        <div
          onClick={() => setIsFullScreen(false)}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-40 animate-in fade-in duration-200 cursor-pointer"
          title="Click backdrop to exit full screen"
          aria-hidden="true"
        />
      )}

      {/* Recent Stock Movements Table */}
      <div
        className={cn(
          'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs transition-all',
          isFullScreen
            ? 'fixed inset-2 sm:inset-3 md:inset-4 lg:inset-5 z-50 flex flex-col shadow-2xl border-slate-300 dark:border-slate-600 rounded-2xl animate-in zoom-in-95 duration-200'
            : ''
        )}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                Recent Inventory Transactions
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                {recentMovements.length} {recentMovements.length === 1 ? 'record' : 'records'}
              </span>
              {isFullScreen && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5" />
                  <span>Full Screen Expanded</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Live operational ledger of stock additions, dispatches, and adjustments</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onNavigateToTransactions}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-0.5 cursor-pointer shrink-0 mr-1"
            >
              <span>View Full Ledger</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Full Screen Toggle Button */}
            <button
              type="button"
              id="btn-dashboard-fullscreen"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
                isFullScreen
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              )}
              title={isFullScreen ? 'Exit Full Screen (Esc)' : 'Expand table across whole screen width'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span>Exit Full Screen</span>
                  <span className="text-[10px] text-indigo-200 font-mono hidden sm:inline">(Esc)</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Full Screen</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className={cn('overflow-x-auto', isFullScreen ? 'flex-1 overflow-y-auto' : '')}>
          <table className={cn('w-full text-left border-collapse', isFullScreen ? 'min-w-full' : 'min-w-[650px]')}>
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100 dark:border-slate-700/70 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="py-3 px-4 sm:px-5">Date & Time</th>
                <th className="py-3 px-4 sm:px-5">Product</th>
                <th className="py-3 px-4 sm:px-5">Type</th>
                <th className="py-3 px-4 sm:px-5 text-right">Quantity</th>
                <th className="py-3 px-4 sm:px-5 text-right">Balance</th>
                <th className="py-3 px-4 sm:px-5">Reference</th>
                <th className="py-3 px-4 sm:px-5">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                recentMovements.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="py-3 px-4 sm:px-5 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                      {formatDate(tx.createdAt || (tx as any).created_at)}
                    </td>
                    <td className="py-3 px-4 sm:px-5">
                      <div
                        onClick={() => onOpenProductDetail(tx.productId || (tx as any).product_id)}
                        className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-xs"
                      >
                        {tx.productName || 'Product'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{tx.productSku}</div>
                    </td>
                    <td className="py-3 px-4 sm:px-5 whitespace-nowrap">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                          (tx.transactionType || (tx as any).transaction_type) === 'STOCK_IN'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : (tx.transactionType || (tx as any).transaction_type) === 'STOCK_OUT'
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                            : (tx.transactionType || (tx as any).transaction_type) === 'CUSTOMER_RETURN'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : (tx.transactionType || (tx as any).transaction_type) === 'INITIAL_STOCK'
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        )}
                      >
                        {(tx.transactionType || (tx as any).transaction_type)?.replace('_', ' ')}
                      </span>
                    </td>
                    <td
                      className={cn(
                        'py-3 px-4 sm:px-5 text-right font-mono font-bold text-xs whitespace-nowrap',
                        (tx.transactionType || (tx as any).transaction_type) === 'CUSTOMER_RETURN'
                          ? 'text-purple-600 dark:text-purple-400'
                          : (tx.transactionType || (tx as any).transaction_type) === 'STOCK_IN' ||
                            (tx.transactionType || (tx as any).transaction_type) === 'INITIAL_STOCK' ||
                            (tx.transactionType || (tx as any).transaction_type) === 'ADJUSTMENT_INCREASE'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {(tx.transactionType || (tx as any).transaction_type) === 'CUSTOMER_RETURN' ||
                      (tx.transactionType || (tx as any).transaction_type) === 'STOCK_IN' ||
                      (tx.transactionType || (tx as any).transaction_type) === 'INITIAL_STOCK' ||
                      (tx.transactionType || (tx as any).transaction_type) === 'ADJUSTMENT_INCREASE'
                        ? '+'
                        : '-'}
                      {tx.quantity} {tx.unit}
                    </td>
                    <td className="py-3 px-4 sm:px-5 text-right font-mono text-slate-900 dark:text-slate-100 font-bold text-xs whitespace-nowrap">
                      {tx.newStock ?? (tx as any).new_stock} {tx.unit}
                    </td>
                    <td className="py-3 px-4 sm:px-5 text-slate-600 dark:text-slate-300 text-xs">
                      <div className="truncate max-w-[150px] font-medium text-slate-700 dark:text-slate-200">
                        {tx.referenceNumber || (tx as any).reference_number || tx.reason || (tx as any).reason || '-'}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
                        {tx.supplierOrRecipient || (tx as any).supplier_or_recipient || ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 sm:px-5 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                      {tx.createdByName || (tx as any).created_by_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
