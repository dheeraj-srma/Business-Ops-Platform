'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  BarChart3,
  RotateCw,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SeriesOption {
  key: string;
  label: string;
  color: string;
  yAxisId?: 'left' | 'right';
}

export type ChartTypeOption = 'area' | 'bar' | 'pie' | 'donut' | 'line' | 'table' | 'kpi';

interface InteractiveChartProps {
  title: string;
  subtitle?: string;
  data: any[];
  defaultChartType?: ChartTypeOption;
  unit?: string;
  multiSeries?: readonly SeriesOption[];
  isHero?: boolean;
  pageSize?: number;
  enablePagination?: boolean;
  hideXAxisLabels?: boolean;
}

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#c084fc',
  '#f43f5e', '#06b6d4', '#ec4899', '#8b5cf6',
  '#14b8a6', '#f97316', '#a855f7', '#4f46e5',
  '#84cc16', '#e11d48', '#6366f1', '#eab308'
];

interface WalkingPieLegendItemProps {
  item: any;
  idx: number;
  startIndex: number;
  pct: string;
  formattedVal: string;
  isWide: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function WalkingPieLegendItem({
  item,
  idx,
  startIndex,
  pct,
  formattedVal,
  isWide,
  isHovered,
  onHover,
  onLeave,
}: WalkingPieLegendItemProps) {
  const itemColor = item.color || COLORS[(startIndex + idx) % COLORS.length];

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`relative flex items-center justify-between px-2.5 py-1.5 min-h-[32px] rounded-lg transition-all duration-200 text-xs select-none cursor-default overflow-hidden ${
        isHovered
          ? 'bg-slate-800/95 border border-slate-600 shadow-md ring-1 ring-slate-600/50'
          : 'bg-slate-900/80 border border-slate-800/90 hover:border-slate-700'
      }`}
      style={{ cursor: 'default', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {isHovered ? (
        /* Walking ticker state when hovered: runs smoothly from right to left */
        <div className="flex items-center gap-2 w-full min-w-0 overflow-hidden select-none cursor-default">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform scale-110"
            style={{
              background: itemColor,
              boxShadow: `0 0 8px ${itemColor}`,
            }}
          />
          <div
            className="overflow-hidden whitespace-nowrap flex-1 min-w-0 relative select-none cursor-default"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 8px, black calc(100% - 8px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8px, black calc(100% - 8px), transparent 100%)',
            }}
          >
            <div className="animate-legend-walk select-none cursor-default">
              <span className="inline-flex items-center gap-2 pr-6 select-none cursor-default">
                <span className="font-bold text-slate-100">{item.name}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-mono">{formattedVal}</span>
                <span className="text-sky-400 font-bold text-[10px] bg-sky-500/15 px-1.5 py-0.5 rounded border border-sky-500/20">
                  {pct}%
                </span>
                <span className="text-slate-600 text-xs">✦</span>
              </span>
              <span className="inline-flex items-center gap-2 pr-6 select-none cursor-default" aria-hidden="true">
                <span className="font-bold text-slate-100">{item.name}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-mono">{formattedVal}</span>
                <span className="text-sky-400 font-bold text-[10px] bg-sky-500/15 px-1.5 py-0.5 rounded border border-sky-500/20">
                  {pct}%
                </span>
                <span className="text-slate-600 text-xs">✦</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Static compact state when not hovered */
        <div className="flex items-center justify-between w-full min-w-0 select-none cursor-default">
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-1.5 select-none cursor-default">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: itemColor }}
            />
            <span
              className={`font-semibold text-slate-200 truncate select-none cursor-default ${
                isWide ? 'text-xs' : 'text-[11px]'
              }`}
            >
              {item.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-right select-none cursor-default">
            <span className={`text-slate-300 font-mono select-none cursor-default ${isWide ? 'text-xs' : 'text-[11px]'}`}>
              {formattedVal}
            </span>
            <span className="text-sky-400 font-bold text-[10px] bg-sky-500/15 px-1.5 py-0.5 rounded border border-sky-500/20 select-none cursor-default">
              {pct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InteractiveChart({
  title,
  subtitle,
  data,
  defaultChartType = 'area',
  unit = '',
  multiSeries,
  isHero,
  pageSize = 5,
  enablePagination,
  hideXAxisLabels
}: InteractiveChartProps) {
  const [chartType, setChartType] = useState<ChartTypeOption>(defaultChartType);
  const [timeRange, setTimeRange] = useState<'30d' | '7d' | '90d' | 'ytd' | 'all' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-09-14');
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return () => observer.disconnect();
  }, []);

  const isWide = useMemo(() => {
    if (isHero !== undefined) return isHero;
    if (multiSeries && multiSeries.length > 1) return true;
    return containerWidth >= 700;
  }, [isHero, multiSeries, containerWidth]);

  const hasSecondaryYAxis = useMemo(() => {
    return Array.isArray(multiSeries) && multiSeries.some(s => s.yAxisId === 'right');
  }, [multiSeries]);

  // Determine whether data represents a chronological time-series
  const isTimeSeries = useMemo(() => {
    if (!data || data.length === 0) return false;
    return data.some(d => /^\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}$/.test(String(d.name || '')));
  }, [data]);

  // Automatically suppress horizontal axis data labels when color legends and hover tooltips identify items
  const shouldHideXAxisLabels = hideXAxisLabels !== undefined ? hideXAxisLabels : !isTimeSeries;

  // Filter data based on timeRange while preserving complete categorical datasets
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    if (isTimeSeries) {
      if (timeRange === '7d') return data.slice(-7);
      if (timeRange === '30d') return data.slice(-30);
      if (timeRange === '90d') return data.slice(-90);
      if (timeRange === 'ytd' || timeRange === 'all') return data;

      if (timeRange === 'custom') {
        return data.filter(item => {
          const name = String(item.name || '');
          const datePart = name.length === 5 ? `2026-${name}` : name;
          if (startDate && datePart < startDate) return false;
          if (endDate && datePart > endDate) return false;
          return true;
        });
      }
    } else {
      // Categorical data: retain entire dataset for full visual pagination
      return data;
    }
    return data;
  }, [data, isTimeSeries, timeRange, startDate, endDate]);

  // Compute readable active time range label badge dynamically
  const timeRangeLabel = useMemo(() => {
    if (timeRange === 'custom') {
      return `${startDate} to ${endDate}`;
    }
    if (filteredData.length > 0) {
      const first = String(filteredData[0]?.name || '');
      const last = String(filteredData[filteredData.length - 1]?.name || '');
      if (/^\d{2}-\d{2}$/.test(first) && /^\d{2}-\d{2}$/.test(last)) {
        return `2026-${first} – 2026-${last}`;
      }
    }
    if (timeRange === '7d') return 'Last 7 Operating Days (Sep 08 – Sep 14, 2026)';
    if (timeRange === '30d') return 'Current Operating Month (Sep 01 – Sep 14, 2026)';
    if (timeRange === '90d') return 'Current Quarter (Q3 2026)';
    if (timeRange === 'ytd') return 'Year-To-Date (FY 2026-27)';
    if (timeRange === 'all') return 'Full Financial History';
    return 'All Records';
  }, [timeRange, filteredData, startDate, endDate]);

  // ── Pagination Calculation & State Management ──────────────────────────────
  // Applied to all graphs irrespective of chart type.
  // Smart Orphan-Prevention: if the last page would be left with only 1 or 2 items
  // (or up to 3 items for wide/hero graphs), those entries are absorbed into prior pages.
  const shouldPaginate = enablePagination !== false;
  const totalItems = filteredData.length;
  const isEffectiveHero = isHero !== undefined ? isHero : (containerWidth >= 800 || (Boolean(multiSeries) && (multiSeries?.length ?? 0) > 1));
  const maxAbsorb = isEffectiveHero ? 3 : 2;
  const effectiveBase = isEffectiveHero ? Math.max(pageSize, 7) : Math.max(1, pageSize);

  const { totalPages, getPageRange } = useMemo(() => {
    if (!shouldPaginate || totalItems <= 0) {
      return { totalPages: 1, getPageRange: () => ({ start: 0, end: totalItems }) };
    }

    // If totalItems can be absorbed into a single page without creating an orphan trailing page:
    if (totalItems <= effectiveBase + maxAbsorb) {
      return {
        totalPages: 1,
        getPageRange: () => ({ start: 0, end: totalItems })
      };
    }

    // Calculate naive page count
    const naivePages = Math.ceil(totalItems / effectiveBase);
    const naiveRemainder = totalItems % effectiveBase;

    // Check if the trailing page has only 1 or 2 orphan items (or <= maxAbsorb):
    let targetPages = naivePages;
    if (naiveRemainder > 0 && naiveRemainder <= maxAbsorb && naivePages > 1) {
      const reducedPages = naivePages - 1;
      const maxPerReducedPage = Math.ceil(totalItems / reducedPages);
      // Ensure the prior pages don't become excessively overloaded
      if (maxPerReducedPage <= effectiveBase + (isEffectiveHero ? 2 : 1)) {
        targetPages = reducedPages;
      }
    }

    const itemsPerPage = Math.floor(totalItems / targetPages);
    const extraItems = totalItems % targetPages; // First `extraItems` pages get +1 item

    const getRange = (page: number) => {
      const safePage = Math.min(Math.max(1, page), targetPages);
      let start = 0;
      let end = 0;
      if (safePage <= extraItems) {
        start = (safePage - 1) * (itemsPerPage + 1);
        end = start + (itemsPerPage + 1);
      } else {
        start = extraItems * (itemsPerPage + 1) + (safePage - 1 - extraItems) * itemsPerPage;
        end = Math.min(start + itemsPerPage, totalItems);
      }
      return { start, end };
    };

    return { totalPages: targetPages, getPageRange: getRange };
  }, [shouldPaginate, totalItems, effectiveBase, maxAbsorb, isEffectiveHero]);

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const { start: startIndex, end: endIndex } = getPageRange(safeCurrentPage);

  // Stable dataset signature to automatically reset pagination ONLY on real data/filter changes
  const datasetSignature = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return 'empty';
    const first = filteredData[0];
    const last = filteredData[filteredData.length - 1];
    const firstName = String(first?.name || first?.supplier || first?.dealer || '');
    const lastName = String(last?.name || last?.supplier || last?.dealer || '');
    const firstVal = String(first?.value ?? first?.revenue ?? first?.qty ?? '');
    const lastVal = String(last?.value ?? last?.revenue ?? last?.qty ?? '');
    return `${filteredData.length}_${timeRange}_${startDate}_${endDate}_${firstName}_${lastName}_${firstVal}_${lastVal}`;
  }, [filteredData, timeRange, startDate, endDate]);

  useEffect(() => {
    Promise.resolve().then(() => setCurrentPage(1));
  }, [datasetSignature]);

  // Sliced data for current page rendering (preserves complete dataset in memory)
  const visibleData = useMemo(() => {
    if (!shouldPaginate || totalPages <= 1) return filteredData;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, shouldPaginate, totalPages, startIndex, endIndex]);

  // Normalized sliced dataset guaranteeing a `value` prop on every entry for single-series charts
  const normalizedVisibleData = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return [];
    return visibleData.map((d, idx) => {
      let val = d.value;
      if (val === undefined || val === null || isNaN(Number(val))) {
        if (multiSeries && multiSeries.length > 0 && d[multiSeries[0].key] !== undefined) {
          val = d[multiSeries[0].key];
        } else if (d.revenue !== undefined) {
          val = d.revenue;
        } else if (d.amount !== undefined) {
          val = d.amount;
        } else if (d.orders !== undefined) {
          val = d.orders;
        } else if (d.qty !== undefined || d.quantity !== undefined) {
          val = d.qty || d.quantity;
        } else {
          const numKey = Object.keys(d).find(k => k !== 'name' && k !== 'id' && typeof d[k] === 'number');
          val = numKey ? d[numKey] : 0;
        }
      }
      return {
        ...d,
        name: d.name || `Item ${idx + 1}`,
        value: Number(val) || 0
      };
    });
  }, [visibleData, multiSeries]);

  // Full dataset mapped to standard { name, value, ... } objects
  const allPieData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    // Case 1: multiSeries chart
    if (multiSeries && multiSeries.length > 1) {
      const seriesTotals = multiSeries
        .filter(s => s.yAxisId !== 'right')
        .map(s => {
          const sum = filteredData.reduce((acc, d) => acc + (Number(d[s.key]) || 0), 0);
          return {
            name: s.label.replace(/\s*\([₹%a-zA-Z\s]+\)/g, ''),
            value: sum,
            color: s.color
          };
        });

      if (seriesTotals.some(st => st.value > 0)) {
        return seriesTotals;
      }
    }

    // Case 2: Standard or single series dataset
    return filteredData.map((d, idx) => {
      let val = d.value;
      if (val === undefined || val === null || isNaN(Number(val))) {
        if (multiSeries && multiSeries.length > 0 && d[multiSeries[0].key] !== undefined) {
          val = d[multiSeries[0].key];
        } else if (d.revenue !== undefined) {
          val = d.revenue;
        } else if (d.amount !== undefined) {
          val = d.amount;
        } else if (d.orders !== undefined) {
          val = d.orders;
        } else if (d.qty !== undefined || d.quantity !== undefined) {
          val = d.qty || d.quantity;
        } else {
          const numKey = Object.keys(d).find(k => k !== 'name' && k !== 'id' && typeof d[k] === 'number');
          val = numKey ? d[numKey] : 0;
        }
      }
      return {
        ...d,
        name: d.name || `Item ${idx + 1}`,
        value: Number(val) || 0
      };
    });
  }, [filteredData, multiSeries]);

  // Sliced Pie / Donut data for active visual batch
  const visiblePieData = useMemo(() => {
    if (!shouldPaginate || totalPages <= 1) return allPieData;
    return allPieData.slice(startIndex, endIndex);
  }, [allPieData, shouldPaginate, totalPages, startIndex, endIndex]);

  // Aggregate total across the ENTIRE dataset so donut center and share % reflect true 100%
  const pieTotalValue = useMemo(() => {
    return allPieData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  }, [allPieData]);

  const totalValue = useMemo(() => {
    return pieTotalValue;
  }, [pieTotalValue]);

  const topContributor = useMemo(() => {
    if (!allPieData || allPieData.length === 0) return { name: 'N/A', value: 0 };
    return [...allPieData].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))[0];
  }, [allPieData]);

  const minContributor = useMemo(() => {
    if (!allPieData || allPieData.length === 0) return { name: 'N/A', value: 0 };
    return [...allPieData].sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0))[0];
  }, [allPieData]);

  // Dynamic X-Axis Configuration:
  // When color legends & hover tooltips identify items (or explicitly requested via hideXAxisLabels),
  // suppress horizontal axis text to save space drastically and elevate visual quality
  const xAxisConfig = useMemo(() => {
    if (shouldHideXAxisLabels) {
      return {
        showTicks: false,
        height: 6,
        bottomMargin: 2,
        angle: 0,
        textAnchor: 'middle' as const,
        interval: 0
      };
    }

    const count = visibleData.length;
    if (count === 0) return { showTicks: true, angle: 0, textAnchor: 'middle' as const, height: 24, interval: 0, bottomMargin: 6 };

    const isShortDate = visibleData.every(d => /^\d{2}-\d{2}$/.test(String(d.name || '')));

    if (isShortDate && count <= 14) {
      return { showTicks: true, angle: 0, textAnchor: 'middle' as const, height: 24, interval: 0, bottomMargin: 10 };
    }

    if (count <= 5) {
      return {
        showTicks: true,
        angle: -20,
        textAnchor: 'end' as const,
        height: 38,
        interval: 0,
        bottomMargin: 15
      };
    }

    return {
      showTicks: true,
      angle: -35,
      textAnchor: 'end' as const,
      height: 48,
      interval: count > 24 ? Math.ceil(count / 14) - 1 : 0,
      bottomMargin: 30
    };
  }, [shouldHideXAxisLabels, visibleData]);

  const formatXAxisTick = (val: any) => {
    const s = String(val ?? '');
    if (s.length > 15) {
      return s.slice(0, 14) + '…';
    }
    return s;
  };

  const formatYAxis = (val: number) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return `${val}`;
  };

  const renderCustomTooltip = (props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      return (
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 backdrop-blur-md"
          style={{
            fontSize: '0.82rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div className="text-slate-500 dark:text-slate-400 font-semibold mb-0.5">{label}</div>
          {payload.map((p: any, idx: number) => {
            const val = p.value;
            const formattedVal = typeof val === 'number'
              ? (unit === '₹' ? `₹${val.toLocaleString('en-IN')}` : `${val.toLocaleString('en-IN')} ${unit}`)
              : val;
            return (
              <div key={idx} style={{ color: p.color || COLORS[(startIndex + idx) % COLORS.length], fontWeight: 700, fontSize: '0.88rem' }}>
                {p.name ? `${p.name}: ` : ''}{formattedVal}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm flex flex-col min-h-[420px] h-auto w-full min-w-0 box-border gap-2 overflow-hidden"
    >
      {/* ── Header Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-indigo-600 dark:text-indigo-400 shrink-0" size={17} />
            <h3 className="font-bold text-sm text-slate-100 truncate" title={title}>
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 truncate mt-0.5" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          {/* View Mode Selector */}
          <select
            className="bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-indigo-600 dark:border-indigo-500 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none transition-colors cursor-pointer"
            value={chartType}
            onChange={e => setChartType(e.target.value as any)}
          >
            <option value="area">Area Chart</option>
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="donut">Donut Chart</option>
            <option value="table">Table View</option>
            <option value="kpi">KPI Summary</option>
          </select>

          {/* Time Range Dropdown */}
          <select
            className="bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-indigo-600 dark:border-indigo-500 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none transition-colors cursor-pointer"
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as any)}
          >
            <option value="30d">This Month</option>
            <option value="7d">This Week</option>
            <option value="90d">This Quarter</option>
            <option value="ytd">YTD</option>
            <option value="all">Full History</option>
            <option value="custom">Custom...</option>
          </select>

          {/* Reset Button */}
          <button
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            onClick={() => {
              setChartType(defaultChartType);
              setTimeRange('30d');
              setCurrentPage(1);
            }}
            title="Reset Chart View"
          >
            <RotateCw size={13} />
          </button>
        </div>
      </div>

      {/* Inline Time Range Sub-Bar & Custom Date Inputs */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-indigo-400 dark:text-indigo-400 mb-1 flex-wrap min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <Calendar size={11} className="shrink-0" />
          <span className="truncate">Range: {timeRangeLabel}</span>
        </div>

        {timeRange === 'custom' && (
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800 text-xs text-slate-300 shadow-sm shrink-0">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">From</span>
            <input
              type="date"
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-mono text-slate-200 outline-none focus:border-indigo-500 [color-scheme:dark] cursor-pointer"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span className="text-[10px] text-slate-400 font-semibold uppercase">To</span>
            <input
              type="date"
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-mono text-slate-200 outline-none focus:border-indigo-500 [color-scheme:dark] cursor-pointer"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ── View Canvas Area ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {filteredData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No data records available for this selected time range
          </div>
        ) : chartType === 'table' ? (
          /* ── 1. Table View Mode (Paginated) ──────────────────────────── */
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflowY: 'auto', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.95)', color: 'var(--text-muted)', textAlign: 'left', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '6px 10px' }}>#</th>
                  <th style={{ padding: '6px 10px' }}>Label / Metric</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Value</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Share (%)</th>
                </tr>
              </thead>
              <tbody>
                {visiblePieData.map((item, idx) => {
                  const val = Number(item.value) || 0;
                  const formattedVal = unit === '₹' ? `₹${val.toLocaleString('en-IN')}` : `${val.toLocaleString('en-IN')} ${unit}`;
                  const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : '0.0';
                  const rowNumber = startIndex + idx + 1;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: idx % 2 === 0 ? 'rgba(19, 27, 46, 0.4)' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{rowNumber}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{formattedVal}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : chartType === 'kpi' ? (
          /* ── 2. KPI Summary Mode ─────────────────────────────────────── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', padding: '8px 0', alignContent: 'center', height: '100%' }}>
            <div style={{ padding: '0.8rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Aggregate Total</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6366f1', marginTop: '2px' }}>
                {unit === '₹' ? `₹${totalValue.toLocaleString('en-IN')}` : `${totalValue.toLocaleString('en-IN')} ${unit}`}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Across {allPieData.length} records in active range
              </div>
            </div>

            <div style={{ padding: '0.8rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Average per Entry</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                {unit === '₹'
                  ? `₹${allPieData.length > 0 ? Math.round(totalValue / allPieData.length).toLocaleString('en-IN') : 0}`
                  : `${allPieData.length > 0 ? (totalValue / allPieData.length).toFixed(1) : 0} ${unit}`}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Mean contribution
              </div>
            </div>

            <div style={{ padding: '0.8rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '6px', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Top Contributor</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#c084fc', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {topContributor.name || 'N/A'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {unit === '₹' ? `₹${Number(topContributor.value || 0).toLocaleString('en-IN')}` : `${topContributor.value || 0} ${unit}`} ({totalValue > 0 ? ((Number(topContributor.value || 0) / totalValue) * 100).toFixed(1) : 0}%)
              </div>
            </div>

            <div style={{ padding: '0.8rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Minimum Record</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {minContributor.name || 'N/A'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {unit === '₹' ? `₹${Number(minContributor.value || 0).toLocaleString('en-IN')}` : `${minContributor.value || 0} ${unit}`}
              </div>
            </div>
          </div>
        ) : (chartType === 'pie' || chartType === 'donut') ? (
          /* ── 3. Pie & Donut Layout (Paginated slices & legend) ─────────── */
          <div className="flex flex-col sm:flex-row items-center justify-between w-full h-full gap-3 p-1 overflow-hidden">
            {/* Left / Center: The Pie or Donut Circle */}
            <div className={`w-full ${isWide ? 'sm:w-[42%] lg:w-[38%] h-[200px] sm:h-[230px]' : 'sm:w-[46%] h-[160px] sm:h-[190px]'} shrink-0 relative flex items-center justify-center`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <Pie
                    data={visiblePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={chartType === 'donut' ? (isWide ? 62 : 46) : 0}
                    outerRadius={isWide ? 96 : 74}
                    paddingAngle={visiblePieData.length > 10 ? 1 : 2}
                    dataKey="value"
                    onMouseEnter={(_, index) => setActiveHoverIndex(index)}
                    onMouseLeave={() => setActiveHoverIndex(null)}
                  >
                    {visiblePieData.map((entry, index) => {
                      const isHighlighted = activeHoverIndex === null || activeHoverIndex === index;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color || COLORS[(startIndex + index) % COLORS.length]}
                          opacity={isHighlighted ? 1 : 0.4}
                          style={{
                            transition: 'opacity 0.2s ease',
                            cursor: 'default',
                          }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip content={renderCustomTooltip} />
                </PieChart>
              </ResponsiveContainer>
              {chartType === 'donut' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={`${isWide ? 'text-xs' : 'text-[9px]'} uppercase tracking-wider text-slate-400 font-semibold`}>Total</span>
                  <span className={`${isWide ? 'text-base sm:text-lg font-extrabold' : 'text-xs font-bold'} text-slate-100 font-mono mt-0.5`}>
                    {unit === '₹' ? formatYAxis(pieTotalValue) : `${formatYAxis(pieTotalValue)}`}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Adaptive Legend for Visible Page Items */}
            <div
              className={`w-full ${isWide ? 'sm:w-[58%] lg:w-[62%] max-h-[230px]' : 'sm:w-[54%] max-h-[190px]'} flex-1 overflow-y-auto pr-1.5 custom-scrollbar ${
                visiblePieData.length <= 4 ? 'flex flex-col justify-center' : ''
              }`}
            >
              <div
                className={
                  isWide && visiblePieData.length > 5
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-1.5'
                    : 'flex flex-col gap-1.5'
                }
              >
                {visiblePieData.map((item, idx) => {
                  const val = Number(item.value) || 0;
                  const pct = pieTotalValue > 0 ? ((val / pieTotalValue) * 100).toFixed(1) : '0';
                  const formattedVal = unit === '₹' ? `₹${formatYAxis(val)}` : `${formatYAxis(val)} ${unit}`;
                  return (
                    <WalkingPieLegendItem
                      key={idx}
                      item={item}
                      idx={idx}
                      startIndex={startIndex}
                      pct={pct}
                      formattedVal={formattedVal}
                      isWide={isWide}
                      isHovered={activeHoverIndex === idx}
                      onHover={() => setActiveHoverIndex(idx)}
                      onLeave={() => setActiveHoverIndex(null)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ) : chartType === 'area' ? (
          /* ── 4. Area Chart ───────────────────────────────────────────── */
          <div className="flex flex-col h-full w-full min-h-0">
            <div className={`w-full flex-1 ${isEffectiveHero ? 'min-h-[340px] h-[340px] sm:h-[380px]' : 'min-h-[250px] h-[250px] sm:h-[280px]'} relative`}>
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={isEffectiveHero ? 340 : 250}>
                  <AreaChart data={normalizedVisibleData} margin={{ top: 10, right: hasSecondaryYAxis ? 35 : 15, left: -5, bottom: xAxisConfig.bottomMargin }}>
                    <defs>
                      {multiSeries ? (
                        multiSeries.map((s, idx) => (
                          <linearGradient key={idx} id={`colorGrad_${title.replace(/[^a-z0-9]/gi, '')}_${s.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                          </linearGradient>
                        ))
                      ) : (
                        <linearGradient id={`colorGrad_${title.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                      )}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                    <XAxis
                      dataKey="name"
                      stroke={xAxisConfig.showTicks ? "#94a3b8" : "#334155"}
                      fontSize={10}
                      tickLine={false}
                      tick={xAxisConfig.showTicks ? { fill: '#94a3b8', fontSize: 10 } : false}
                      tickFormatter={xAxisConfig.showTicks ? formatXAxisTick : undefined}
                      interval={xAxisConfig.interval}
                      angle={xAxisConfig.angle}
                      textAnchor={xAxisConfig.textAnchor}
                      height={xAxisConfig.height}
                      axisLine={{ stroke: '#334155' }}
                    />
                    {hasSecondaryYAxis ? (
                      <>
                        <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} style={{ textAnchor: 'start' }} />
                      </>
                    ) : (
                      <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                    )}
                    <Tooltip content={renderCustomTooltip} />
                    {multiSeries ? (
                      multiSeries.map((s, idx) => (
                        <Area key={idx} yAxisId={hasSecondaryYAxis ? (s.yAxisId || 'left') : undefined} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fillOpacity={1} fill={`url(#colorGrad_${title.replace(/[^a-z0-9]/gi, '')}_${s.key})`} />
                      ))
                    ) : (
                      <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill={`url(#colorGrad_${title.replace(/[^a-z0-9]/gi, '')})`} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full min-h-[250px] bg-slate-800/30 animate-pulse rounded-xl" />
              )}
            </div>
            {/* Bottom Legend */}
            <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-1 justify-center items-center pt-2 pb-0.5 border-t border-slate-800/60 mt-auto select-none">
              {multiSeries ? (
                multiSeries.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="font-semibold text-slate-200">{s.label}</span>
                  </div>
                ))
              ) : (
                visiblePieData.map((item, idx) => {
                  const val = Number(item.value) || 0;
                  const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color || COLORS[(startIndex + idx) % COLORS.length] }} />
                      <span className="font-semibold text-slate-200 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                      {totalValue > 0 && <span className="text-sky-400 font-bold text-[10px]">({pct}%)</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : chartType === 'bar' ? (
          /* ── 5. Bar Chart ────────────────────────────────────────────── */
          <div className="flex flex-col h-full w-full min-h-0">
            <div className={`w-full flex-1 ${isEffectiveHero ? 'min-h-[340px] h-[340px] sm:h-[380px]' : 'min-h-[250px] h-[250px] sm:h-[280px]'} relative`}>
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={isEffectiveHero ? 340 : 250}>
                  <BarChart data={normalizedVisibleData} margin={{ top: 10, right: hasSecondaryYAxis ? 35 : 15, left: -5, bottom: xAxisConfig.bottomMargin }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                    <XAxis
                      dataKey="name"
                      stroke={xAxisConfig.showTicks ? "#94a3b8" : "#334155"}
                      fontSize={10}
                      tickLine={false}
                      tick={xAxisConfig.showTicks ? { fill: '#94a3b8', fontSize: 10 } : false}
                      tickFormatter={xAxisConfig.showTicks ? formatXAxisTick : undefined}
                      interval={xAxisConfig.interval}
                      angle={xAxisConfig.angle}
                      textAnchor={xAxisConfig.textAnchor}
                      height={xAxisConfig.height}
                      axisLine={{ stroke: '#334155' }}
                    />
                    {hasSecondaryYAxis ? (
                      <>
                        <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} style={{ textAnchor: 'start' }} />
                      </>
                    ) : (
                      <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                    )}
                    <Tooltip content={renderCustomTooltip} />
                    {multiSeries ? (
                      multiSeries.map((s, idx) => (
                        <Bar key={idx} yAxisId={hasSecondaryYAxis ? (s.yAxisId || 'left') : undefined} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
                      ))
                    ) : (
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {normalizedVisibleData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[(startIndex + index) % COLORS.length]} />
                        ))}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full min-h-[250px] bg-slate-800/30 animate-pulse rounded-xl" />
              )}
            </div>
            {/* Bottom Legend */}
            <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-1 justify-center items-center pt-2 pb-0.5 border-t border-slate-800/60 mt-auto select-none">
              {multiSeries ? (
                multiSeries.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="font-semibold text-slate-200">{s.label}</span>
                  </div>
                ))
              ) : (
                visiblePieData.map((item, idx) => {
                  const val = Number(item.value) || 0;
                  const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color || COLORS[(startIndex + idx) % COLORS.length] }} />
                      <span className="font-semibold text-slate-200 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                      {totalValue > 0 && <span className="text-sky-400 font-bold text-[10px]">({pct}%)</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* ── 6. Line Chart ───────────────────────────────────────────── */
          <div className="flex flex-col h-full w-full min-h-0">
            <div className={`w-full flex-1 ${isEffectiveHero ? 'min-h-[340px] h-[340px] sm:h-[380px]' : 'min-h-[250px] h-[250px] sm:h-[280px]'} relative`}>
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={isEffectiveHero ? 340 : 250}>
                  <LineChart data={normalizedVisibleData} margin={{ top: 10, right: hasSecondaryYAxis ? 35 : 15, left: -5, bottom: xAxisConfig.bottomMargin }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                    <XAxis
                      dataKey="name"
                      stroke={xAxisConfig.showTicks ? "#94a3b8" : "#334155"}
                      fontSize={10}
                      tickLine={false}
                      tick={xAxisConfig.showTicks ? { fill: '#94a3b8', fontSize: 10 } : false}
                      tickFormatter={xAxisConfig.showTicks ? formatXAxisTick : undefined}
                      interval={xAxisConfig.interval}
                      angle={xAxisConfig.angle}
                      textAnchor={xAxisConfig.textAnchor}
                      height={xAxisConfig.height}
                      axisLine={{ stroke: '#334155' }}
                    />
                    {hasSecondaryYAxis ? (
                      <>
                        <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} style={{ textAnchor: 'start' }} />
                      </>
                    ) : (
                      <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                    )}
                    <Tooltip content={renderCustomTooltip} />
                    {multiSeries ? (
                      multiSeries.map((s, idx) => (
                        <Line key={idx} yAxisId={hasSecondaryYAxis ? (s.yAxisId || 'left') : undefined} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                      ))
                    ) : (
                      <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full min-h-[250px] bg-slate-800/30 animate-pulse rounded-xl" />
              )}
            </div>
            {/* Bottom Legend */}
            <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-1 justify-center items-center pt-2 pb-0.5 border-t border-slate-800/60 mt-auto select-none">
              {multiSeries ? (
                multiSeries.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="font-semibold text-slate-200">{s.label}</span>
                  </div>
                ))
              ) : (
                visiblePieData.map((item, idx) => {
                  const val = Number(item.value) || 0;
                  const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color || COLORS[(startIndex + idx) % COLORS.length] }} />
                      <span className="font-semibold text-slate-200 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                      {totalValue > 0 && <span className="text-sky-400 font-bold text-[10px]">({pct}%)</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Prominent & Clearly Visible Chart Pagination Footer ─────────────────── */}
      {shouldPaginate && totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-3 pt-2 pb-0.5 border-t border-slate-800/80 mt-auto select-none">
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={safeCurrentPage <= 1}
            aria-label="Previous batch"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/80 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-300 hover:bg-slate-700 hover:border-indigo-600 dark:border-indigo-500/60 active:scale-95 disabled:opacity-20 disabled:border-slate-800/40 disabled:bg-slate-900/40 disabled:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
            title="Previous batch"
          >
            <ChevronLeft size={16} strokeWidth={2.4} />
          </button>
          <span className="text-xs font-mono font-semibold text-slate-200 bg-slate-800/80 border border-slate-700/60 px-3 py-0.5 rounded-md tracking-wider shadow-inner">
            {startIndex + 1}–{endIndex} <span className="text-slate-400 font-normal">of</span> {totalItems}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={safeCurrentPage >= totalPages}
            aria-label="Next batch"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/80 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-300 hover:bg-slate-700 hover:border-indigo-600 dark:border-indigo-500/60 active:scale-95 disabled:opacity-20 disabled:border-slate-800/40 disabled:bg-slate-900/40 disabled:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
            title="Next batch"
          >
            <ChevronRight size={16} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}

