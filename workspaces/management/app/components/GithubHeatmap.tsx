'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Calendar, Activity, Zap, TrendingUp, Clock, Award } from 'lucide-react';
import { parseCalendarDate, addCalendarDays } from '../utils/dateRange';

export interface HeatmapDay {
  date: string;
  orders: number;
  sales: number;
  customers?: number;
}

export interface HeatmapSummary {
  total_orders: number;
  active_days: number;
  avg_orders_per_active_day: number;
  total_sales?: number;
}

interface GithubHeatmapProps {
  days: HeatmapDay[];
  summary?: HeatmapSummary;
  title?: string;
  subtitle?: string;
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  isLoading?: boolean;
  customerName?: string;
}

export default function GithubHeatmap({
  days = [],
  summary,
  title = "Order Activity",
  subtitle = "Daily order volume and purchasing velocity heatmap",
  selectedRange = "30d",
  onRangeChange,
  isLoading = false,
  customerName
}: GithubHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; isNearTop: boolean } | null>(null);

  // Process days into weeks grid and compute rich analytics breakdown
  const { weeks, monthLabels, computedSummary, distribution, peakStats } = useMemo(() => {
    if (!days || days.length === 0) {
      return {
        weeks: [],
        monthLabels: [],
        computedSummary: { total_orders: 0, active_days: 0, avg_orders_per_active_day: 0, total_sales: 0 },
        distribution: { high: 0, medium: 0, low: 0, inactive: 0 },
        peakStats: { busiestDay: 'N/A', longestStreak: 0, reorderInterval: 0 }
      };
    }

    const dayMap = new Map<string, HeatmapDay>();
    let calcTotalOrders = 0;
    let calcActiveDays = 0;
    let calcTotalSales = 0;

    let highDays = 0;
    let medDays = 0;
    let lowDays = 0;
    let inactiveDays = 0;

    const dayOfWeekCounts: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const dayOfWeekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let maxStreak = 0;
    let currentStreak = 0;

    days.forEach(d => {
      dayMap.set(d.date, d);
      const ords = d.orders || 0;
      calcTotalOrders += ords;
      calcTotalSales += d.sales || 0;

      if (ords > 0) {
        calcActiveDays += 1;
        currentStreak += 1;
        if (currentStreak > maxStreak) maxStreak = currentStreak;

        if (ords >= 4) highDays += 1;
        else if (ords >= 2) medDays += 1;
        else lowDays += 1;

        const dateObj = new Date(d.date);
        const dayName = dayOfWeekNames[dateObj.getDay()];
        dayOfWeekCounts[dayName] = (dayOfWeekCounts[dayName] || 0) + ords;
      } else {
        currentStreak = 0;
        inactiveDays += 1;
      }
    });

    let busiestDay = 'Wednesday';
    let maxDayOrds = -1;
    Object.entries(dayOfWeekCounts).forEach(([day, count]) => {
      if (count > maxDayOrds) {
        maxDayOrds = count;
        busiestDay = day === 'Mon' ? 'Monday' : day === 'Tue' ? 'Tuesday' : day === 'Wed' ? 'Wednesday' : day === 'Thu' ? 'Thursday' : day === 'Fri' ? 'Friday' : day === 'Sat' ? 'Saturday' : 'Sunday';
      }
    });

    const calcAvg = calcActiveDays > 0 ? Number((calcTotalOrders / calcActiveDays).toFixed(1)) : 0;
    const reorderInterval = calcActiveDays > 1 ? Number((days.length / calcActiveDays).toFixed(1)) : 0;

    const summaryData: HeatmapSummary = summary || {
      total_orders: calcTotalOrders,
      active_days: calcActiveDays,
      avg_orders_per_active_day: calcAvg,
      total_sales: calcTotalSales
    };

    const sortedDates = days.map(d => d.date).sort();
    const minDateStr = sortedDates[0];
    const maxDateStr = sortedDates[sortedDates.length - 1];

    let effectiveStartStr = minDateStr;
    const daySpan = days.length;
    if (daySpan < 28) {
      // Pad to at least 28 days back from maxDateStr for visual grid completeness
      effectiveStartStr = addCalendarDays(maxDateStr, -27);
    }

    const startDayOfWeek = parseCalendarDate(effectiveStartStr).getDay();
    const daysToMon = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const calendarStartStr = addCalendarDays(effectiveStartStr, -daysToMon);

    const weekCols: { dateStr: string; day: HeatmapDay | null }[][] = [];
    const monthLbls: { monthName: string; weekIndex: number }[] = [];
    let currentWeek: { dateStr: string; day: HeatmapDay | null }[] = [];
    let weekIdx = 0;
    let lastMonth = -1;

    let currStr = calendarStartStr;
    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    while (currStr <= maxDateStr || currentWeek.length > 0) {
      const currDateObj = parseCalendarDate(currStr);
      const month = currDateObj.getMonth();

      if (month !== lastMonth && currentWeek.length === 0) {
        const monthName = mNames[month];
        monthLbls.push({ monthName, weekIndex: weekIdx });
        lastMonth = month;
      }

      const dayData = dayMap.has(currStr) ? dayMap.get(currStr)! : { date: currStr, orders: 0, sales: 0, customers: 0 };
      currentWeek.push({ dateStr: currStr, day: dayData });

      if (currentWeek.length === 7) {
        weekCols.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }

      currStr = addCalendarDays(currStr, 1);
      if (currStr > maxDateStr && currentWeek.length === 0) break;
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ dateStr: currStr, day: null });
        currStr = addCalendarDays(currStr, 1);
      }
      weekCols.push(currentWeek);
    }

    return {
      weeks: weekCols,
      monthLabels: monthLbls,
      computedSummary: summaryData,
      distribution: { high: highDays, medium: medDays, low: lowDays, inactive: inactiveDays },
      peakStats: { busiestDay, longestStreak: Math.max(1, maxStreak), reorderInterval }
    };
  }, [days, summary]);

  const maxOrdersInDataset = useMemo(() => {
    if (!days || days.length === 0) return 1;
    return Math.max(...days.map(d => d.orders || 0), 1);
  }, [days]);

  const getIntensityClass = (orders: number) => {
    if (orders === 0) return 'bg-slate-950/70 border-slate-800/80 hover:border-slate-600';
    
    // Adaptive relative ratio scaling to prevent flat single-color blocks
    const ratio = orders / maxOrdersInDataset;
    if (ratio <= 0.25) return 'bg-cyan-950/90 border-cyan-850/80 text-indigo-700 dark:text-indigo-300 hover:border-cyan-400';
    if (ratio <= 0.55) return 'bg-cyan-700/80 border-cyan-600/90 text-cyan-100 hover:border-cyan-300';
    if (ratio <= 0.80) return 'bg-indigo-600 dark:bg-indigo-500 border-cyan-400 text-slate-950 font-bold hover:border-cyan-200';
    return 'bg-indigo-500 border-cyan-300 text-slate-950 font-extrabold shadow-sm shadow-cyan-400/50 hover:bg-cyan-300';
  };

  const dayNames = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

  const handleMouseEnter = (e: React.MouseEvent, day: HeatmapDay | null) => {
    if (!day || !containerRef.current) return;
    const cellRect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const relX = cellRect.left - containerRect.left + cellRect.width / 2;
    const relY = cellRect.top - containerRect.top;

    // Clamp horizontal center so 192px wide tooltip doesn't get clipped on left or right padding
    const clampedX = Math.max(105, Math.min(containerRect.width - 105, relX));

    // Direction flip: if cell is near the top of container card (< 130px), pop below cell
    const isNearTop = relY < 130;

    setHoveredDay(day);
    setTooltipPos({
      x: clampedX,
      y: isNearTop ? relY + cellRect.height + 8 : relY - 8,
      isNearTop
    });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
    setTooltipPos(null);
  };

  const formatTooltipDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const cardTitle = customerName ? `${title} — ${customerName}` : title;

  const isRangeActive = (id: string) => {
    if (selectedRange === id) return true;
    if (id === '7d' && selectedRange === 'this_week') return true;
    if (id === '30d' && (selectedRange === 'this_month' || selectedRange === 'last_month')) return true;
    if (id === '3m' && (selectedRange === '90d' || selectedRange === 'this_quarter')) return true;
    if (id === '6m' && selectedRange === '180d') return true;
    if (id === '12m' && (selectedRange === '1y' || selectedRange === '365d' || selectedRange === 'this_year' || selectedRange === 'ytd' || selectedRange === 'all')) return true;
    return false;
  };

  return (
    <div ref={containerRef} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative backdrop-blur-md z-10">
      {/* Persistent Section Header Title & Range Controls (Never disappears) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" />
            <span>{cardTitle}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        {onRangeChange && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-[11px] self-start sm:self-auto">
            {[
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '3m', label: '3M' },
              { id: '6m', label: '6M' },
              { id: '12m', label: '1Y' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onRangeChange(r.id)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  isRangeActive(r.id)
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="h-56 flex items-center justify-center text-slate-400 text-sm animate-pulse">
          Loading activity heatmap...
        </div>
      ) : weeks.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
          No order activity recorded for selected range.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Heatmap Grid (Spans 7 columns on lg+ screens) */}
          <div className="lg:col-span-7 flex flex-col justify-between overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">

            <div className="min-w-[480px]">
              {/* Month Labels Row */}
              <div className="flex text-[11px] text-slate-400 mb-2.5 ml-9 relative h-4">
                {monthLabels.map((m, idx) => (
                  <div
                    key={idx}
                    className="absolute font-bold text-slate-400"
                    style={{ left: `${m.weekIndex * 20}px` }}
                  >
                    {m.monthName}
                  </div>
                ))}
              </div>

              {/* 7-Row Grid Body */}
              <div className="flex">
                {/* Day Labels Column */}
                <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold w-9 pr-2 py-0.5">
                  {dayNames.map((name, i) => (
                    <div key={i} className="h-4 flex items-center justify-end">
                      {name}
                    </div>
                  ))}
                </div>

                {/* Weeks Columns with smooth gap */}
                <div className="flex gap-2">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-2">
                      {week.map((cell, dIdx) => (
                        <div
                          key={dIdx}
                          onMouseEnter={(e) => handleMouseEnter(e, cell.day)}
                          onMouseLeave={handleMouseLeave}
                          className={`w-4 h-4 rounded-[4px] border transition-all cursor-pointer ${
                            cell.day ? getIntensityClass(cell.day.orders) : 'opacity-0'
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Legend */}
            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">Activity Level:</span>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                  <span className="text-slate-500">None</span>
                  <div className="w-3.5 h-3.5 rounded-[3.5px] bg-slate-950/70 border border-slate-800/80" />
                  <div className="w-3.5 h-3.5 rounded-[3.5px] bg-cyan-950/90 border border-cyan-850/80" />
                  <div className="w-3.5 h-3.5 rounded-[3.5px] bg-cyan-700/80 border border-cyan-600/90" />
                  <div className="w-3.5 h-3.5 rounded-[3.5px] bg-indigo-600 dark:bg-indigo-500 border border-cyan-400" />
                  <div className="w-3.5 h-3.5 rounded-[3.5px] bg-indigo-500 border border-cyan-300" />
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">High</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                Active Days: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{computedSummary.active_days}</span> / {days.length}
              </div>
            </div>
          </div>

          {/* Right Column: Activity Insights Box (Placed at Top alongside title) */}
          <div className="lg:col-span-5 self-start mt-0 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
            {/* Box Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Zap size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span>Activity Insights</span>
              </span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/40">
                Purchasing Velocity
              </span>
            </div>

            {/* Velocity Metrics Grid (2x2 Cards) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Busiest Day</div>
                <div className="text-sm font-black text-slate-100 mt-1">{peakStats.busiestDay}</div>
              </div>

              <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Streak</div>
                <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1">{peakStats.longestStreak} Days</div>
              </div>

              <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Re-order Gap</div>
                <div className="text-sm font-black text-sky-400 mt-1">
                  {peakStats.reorderInterval ? `Every ${peakStats.reorderInterval}d` : 'Frequent'}
                </div>
              </div>

              <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg / Active Day</div>
                <div className="text-sm font-black text-amber-400 mt-1">{computedSummary.avg_orders_per_active_day} Ords</div>
              </div>
            </div>

            {/* Activity Purchasing Ratio Progress Bar */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Active Purchasing Ratio</span>
                <span className="font-bold text-slate-200">
                  {Math.round((computedSummary.active_days / Math.max(1, days.length)) * 100)}% active
                </span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${(distribution.high / Math.max(1, days.length)) * 100}%` }}
                  className="bg-indigo-500 h-full"
                  title={`High volume: ${distribution.high} days`}
                />
                <div
                  style={{ width: `${(distribution.medium / Math.max(1, days.length)) * 100}%` }}
                  className="bg-cyan-600 h-full"
                  title={`Medium volume: ${distribution.medium} days`}
                />
                <div
                  style={{ width: `${(distribution.low / Math.max(1, days.length)) * 100}%` }}
                  className="bg-cyan-850 h-full"
                  title={`Low volume: ${distribution.low} days`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> High ({distribution.high}d)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-600 inline-block" /> Med ({distribution.medium}d)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-800 inline-block" /> Quiet ({distribution.inactive}d)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Hover Tooltip ────────────────────────────────────── */}
      {hoveredDay && tooltipPos && (
        <div
          className={`absolute z-50 pointer-events-none transform -translate-x-1/2 bg-slate-950/95 border border-slate-700 text-white rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs w-48 space-y-1 transition-all duration-75 ${
            tooltipPos.isNearTop ? 'translate-y-0' : '-translate-y-full'
          }`}
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="font-bold text-slate-300 pb-1 border-b border-slate-800 flex items-center justify-between">
            <span>{formatTooltipDate(hoveredDay.date)}</span>
            <Calendar size={12} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="pt-1 flex items-center justify-between">
            <span className="text-slate-400">Orders:</span>
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{hoveredDay.orders}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Sales:</span>
            <span className="font-bold text-sky-400">₹{(hoveredDay.sales || 0).toLocaleString('en-IN')}</span>
          </div>
          {hoveredDay.customers !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Customers:</span>
              <span className="font-medium text-slate-200">{hoveredDay.customers}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
