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
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import {
  DateRangeType,
  DateRangeBounds,
  getDateRangeBounds,
  filterItemsByDateRange,
  aggregateTimeSeriesData,
  formatCalendarDate,
  parseCalendarDate,
  getReferenceDate,
  fillTimeSeriesGaps,
  formatDayMonth
} from '../utils/dateRange';
import { fmtDayMonth } from '../utils/formatters';

interface SeriesOption {
  key: string;
  label: string;
  color: string;
  yAxisId?: 'left' | 'right';
}

export type ChartTypeOption = 'area' | 'bar' | 'horizontal_bar' | 'pie' | 'donut' | 'line' | 'table' | 'kpi';

export interface InteractiveChartProps {
  title: string;
  subtitle?: string;
  data?: any[];
  defaultChartType?: ChartTypeOption;
  defaultTimeRange?: DateRangeType;
  unit?: string;
  multiSeries?: readonly SeriesOption[];
  isHero?: boolean;
  pageSize?: number;
  enablePagination?: boolean;
  hideXAxisLabels?: boolean;
  showLegend?: boolean;
  unavailable?: boolean;
  unavailableReason?: string;
  statusBadge?: 'LIVE' | 'SNAPSHOT' | 'MODELLED' | 'UNAVAILABLE' | 'HEURISTIC' | string;
  fetchData?: (bounds: DateRangeBounds, timeRange: DateRangeType) => Promise<any[]>;
  onTimeRangeChange?: (range: DateRangeType, bounds: DateRangeBounds) => void;
  groupBy?: string;
  valueKey?: string;
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
          ? 'bg-slate-100 dark:bg-slate-800/95 border border-indigo-400 dark:border-slate-600 shadow-sm dark:shadow-md ring-1 ring-indigo-300 dark:ring-slate-600/50'
          : 'bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
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
                <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                <span className="text-slate-400 dark:text-slate-500">•</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono font-medium">{formattedVal}</span>
                <span className="text-indigo-600 dark:text-sky-400 font-bold text-[10px] bg-indigo-50 dark:bg-sky-500/15 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-sky-500/20">
                  {pct}%
                </span>
                <span className="text-slate-400 dark:text-slate-600 text-xs">✦</span>
              </span>
              <span className="inline-flex items-center gap-2 pr-6 select-none cursor-default" aria-hidden="true">
                <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                <span className="text-slate-400 dark:text-slate-500">•</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono font-medium">{formattedVal}</span>
                <span className="text-indigo-600 dark:text-sky-400 font-bold text-[10px] bg-indigo-50 dark:bg-sky-500/15 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-sky-500/20">
                  {pct}%
                </span>
                <span className="text-slate-400 dark:text-slate-600 text-xs">✦</span>
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
              className={`font-semibold text-slate-800 dark:text-slate-200 truncate select-none cursor-default ${
                isWide ? 'text-xs' : 'text-[11px]'
              }`}
            >
              {item.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-right select-none cursor-default">
            <span className={`text-slate-700 dark:text-slate-300 font-mono font-medium select-none cursor-default ${isWide ? 'text-xs' : 'text-[11px]'}`}>
              {formattedVal}
            </span>
            <span className="text-indigo-600 dark:text-sky-400 font-bold text-[10px] bg-indigo-50 dark:bg-sky-500/15 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-sky-500/20 select-none cursor-default">
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
  defaultTimeRange = '30d',
  unit = '',
  multiSeries,
  isHero,
  pageSize = 5,
  enablePagination,
  hideXAxisLabels,
  showLegend = true,
  unavailable = false,
  unavailableReason,
  statusBadge,
  fetchData,
  onTimeRangeChange,
  groupBy,
  valueKey,
}: InteractiveChartProps) {
  const [chartType, setChartType] = useState<ChartTypeOption>(defaultChartType);
  const [timeRange, setTimeRange] = useState<DateRangeType>(defaultTimeRange || '30d');
  const initialBounds = useMemo(() => getDateRangeBounds(defaultTimeRange || '30d'), [defaultTimeRange]);
  const [startDate, setStartDate] = useState<string>(initialBounds.start);
  const [endDate, setEndDate] = useState<string>(initialBounds.end);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);

  // Independent per-graph dynamic fetched data state
  const [fetchedData, setFetchedData] = useState<any[] | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(false);

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

  const isInitialMount = useRef(true);

  // Synchronize with external defaultTimeRange changes (e.g. when global page time range changes)
  useEffect(() => {
    if (defaultTimeRange) {
      setTimeRange(defaultTimeRange);
      const refDate = getReferenceDate();
      const b = getDateRangeBounds(defaultTimeRange, refDate);
      if (defaultTimeRange !== 'custom') {
        setStartDate(b.start);
        setEndDate(b.end);
      }
      setFetchedData(null);
    }
  }, [defaultTimeRange]);

  // When data prop changes from parent, reset fetchedData override so parent data updates render smoothly
  useEffect(() => {
    setFetchedData(null);
  }, [data]);

  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // When timeRange or custom date changes and fetchData is provided, fetch dynamically for this graph
  useEffect(() => {
    if (!fetchDataRef.current) return;
    
    // If data prop is already provided and this is the initial mount, skip redundant fetch to avoid race condition
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (data && data.length > 0) {
        return;
      }
    }

    const refDate = getReferenceDate();
    const bounds = getDateRangeBounds(timeRange, refDate, startDate, endDate);
    if (!bounds.isValid) return;

    let active = true;
    setIsFetching(true);
    fetchDataRef.current(bounds, timeRange)
      .then(res => {
        if (active) {
          const list = Array.isArray(res) ? res : [];
          if (list.length > 0 || !data || data.length === 0) {
            setFetchedData(list);
          }
          setIsFetching(false);
          setCurrentPage(1);
        }
      })
      .catch(err => {
        console.error(`Error fetching data for "${title}":`, err);
        if (active) setIsFetching(false);
      });

    return () => {
      active = false;
    };
  }, [timeRange, startDate, endDate, data]);

  const isWide = useMemo(() => {
    if (isHero !== undefined) return isHero;
    if (multiSeries && multiSeries.length > 1) return true;
    return containerWidth >= 700;
  }, [isHero, multiSeries, containerWidth]);

  const hasSecondaryYAxis = useMemo(() => {
    return Array.isArray(multiSeries) && multiSeries.some(s => s.yAxisId === 'right');
  }, [multiSeries]);

  // Helper to extract canonical YYYY-MM-DD date from a data point
  const getItemDate = (item: any): string => {
    if (item?.date && typeof item.date === 'string') return item.date.slice(0, 10);
    const name = String(item?.name || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(name)) return name;
    const currentYear = parseCalendarDate(getReferenceDate()).getFullYear();
    if (/^\d{2}\/\d{2}$/.test(name)) {
      const parts = name.split('/');
      return `${currentYear}-${parts[1]}-${parts[0]}`;
    }
    if (/^\d{2}-\d{2}$/.test(name)) {
      return `${currentYear}-${name}`;
    }
    return '';
  };

  const activeRawData = useMemo(() => {
    if (fetchedData !== null && fetchedData.length > 0) return fetchedData;
    if (data && data.length > 0) return data;
    if (fetchedData !== null) return fetchedData;
    return [];
  }, [fetchedData, data]);

  // Determine whether data represents a chronological time-series
  const isTimeSeries = useMemo(() => {
    if (!activeRawData || activeRawData.length === 0) return false;
    return activeRawData.some(d => Boolean(getItemDate(d))) && (chartType === 'area' || chartType === 'line' || isHero === true || (!groupBy && !activeRawData.some(d => d.category || d.product || d.dealer || d.salesman)));
  }, [activeRawData, chartType, isHero, groupBy]);

  // Automatically suppress horizontal axis data labels when color legends and hover tooltips identify items
  const shouldHideXAxisLabels = hideXAxisLabels !== undefined ? hideXAxisLabels : !isTimeSeries;

  // Filter data based on timeRange using shared dateRange engine
  const filteredData = useMemo(() => {
    if (!activeRawData || activeRawData.length === 0) return [];

    const refDate = getReferenceDate();
    const bounds = getDateRangeBounds(timeRange, refDate, startDate, endDate);
    if (!bounds.isValid) return activeRawData;

    // Case 1: Time Series
    if (isTimeSeries) {
      const keysToAggregate = multiSeries && multiSeries.length > 0
        ? multiSeries.map(s => s.key)
        : ['value', 'revenue', 'orders', 'qty', 'units', 'stock_in', 'stock_out', 'outward_qty', 'dispatches', 'defective', 'reusable', 'inward', 'outward', 'cost', 'profit', 'Sales', 'sales', 'Orders', 'amount'];

      // Filter items within bounds
      const inRange = filterItemsByDateRange(activeRawData, timeRange, getItemDate, refDate, startDate, endDate);

      // Fill continuous daily calendar sequence [bounds.start, bounds.end]
      const continuous = fillTimeSeriesGaps(inRange, bounds.start, bounds.end, keysToAggregate, 0, formatDayMonth);

      // If time series duration > 31 days, aggregate automatically to avoid dense clutter
      if (continuous.length > 31) {
        return aggregateTimeSeriesData(continuous, keysToAggregate);
      }
      return continuous;
    }

    // Case 2: Categorical dataset with dates (e.g. raw vouchers or dated entity points)
    const hasDates = activeRawData.some(d => Boolean(getItemDate(d)));
    if (hasDates && fetchedData === null) {
      const inRange = filterItemsByDateRange(activeRawData, timeRange, getItemDate, refDate, startDate, endDate);
      const groupKey = groupBy || 'name';
      const valKey = valueKey || 'value';
      const map: Record<string, any> = {};
      inRange.forEach(item => {
        const k = String(item[groupKey] || item.name || item.category || item.product || item.dealer || item.salesman || 'Item');
        let numVal = Number(item[valKey] ?? item.value ?? item.revenue ?? item.qty ?? item.amount ?? 0);
        if (isNaN(numVal)) numVal = 0;
        if (!map[k]) {
          map[k] = { ...item, name: k, value: 0 };
        }
        map[k].value += numVal;
      });
      return Object.values(map).sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0));
    }

    // Case 3: Already filtered / aggregated (e.g. by backend fetchData or static)
    return activeRawData;
  }, [activeRawData, isTimeSeries, timeRange, startDate, endDate, multiSeries, groupBy, valueKey, fetchedData]);

  // Dynamic Chart Summaries (Phase 8): Calculate latest, average, and peak from real data
  const timeSeriesSummary = useMemo(() => {
    if (!isTimeSeries || filteredData.length === 0) return null;

    const extractMetricValue = (d: any): number => {
      if (multiSeries && multiSeries.length > 0 && d[multiSeries[0].key] !== undefined) {
        return Number(d[multiSeries[0].key]) || 0;
      }
      if (d.value !== undefined && d.value !== null && !isNaN(Number(d.value))) {
        return Number(d.value) || 0;
      }
      if (d.Sales !== undefined && d.Sales !== null && !isNaN(Number(d.Sales))) {
        return Number(d.Sales) || 0;
      }
      if (d.sales !== undefined && d.sales !== null && !isNaN(Number(d.sales))) {
        return Number(d.sales) || 0;
      }
      if (d.revenue !== undefined && d.revenue !== null && !isNaN(Number(d.revenue))) {
        return Number(d.revenue) || 0;
      }
      if (d.amount !== undefined && d.amount !== null && !isNaN(Number(d.amount))) {
        return Number(d.amount) || 0;
      }
      if (d.orders !== undefined && d.orders !== null && !isNaN(Number(d.orders))) {
        return Number(d.orders) || 0;
      }
      if (d.Orders !== undefined && d.Orders !== null && !isNaN(Number(d.Orders))) {
        return Number(d.Orders) || 0;
      }
      if (d.qty !== undefined || d.quantity !== undefined) {
        return Number(d.qty ?? d.quantity) || 0;
      }
      const numKey = Object.keys(d).find(
        k => k !== 'name' && k !== 'id' && k !== 'date' && typeof d[k] === 'number'
      );
      return numKey ? (Number(d[numKey]) || 0) : 0;
    };

    const values = filteredData.map(extractMetricValue);
    if (values.length === 0) return null;

    const latest = values[values.length - 1];
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / values.length);
    let peak = values[0];
    let peakIdx = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > peak) {
        peak = values[i];
        peakIdx = i;
      }
    }
    const peakItem = filteredData[peakIdx];
    const peakDate = peakItem?.name || (peakItem?.date ? fmtDayMonth(peakItem.date) : '');
    return { latest, avg, peak, peakDate };
  }, [isTimeSeries, filteredData, multiSeries]);

  // Compute readable active time range label badge dynamically from canonical bounds
  const timeRangeLabel = useMemo(() => {
    if (timeRange === 'custom') {
      return `${startDate} to ${endDate}`;
    }
    const refDate = getReferenceDate();
    const bounds = getDateRangeBounds(timeRange, refDate, startDate, endDate);
    if (!bounds.isValid) return 'Invalid Range';

    const formatDate = (iso: string) => {
      if (!iso || iso.length < 10) return iso;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const parts = iso.slice(0, 10).split('-');
      const m = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const year = parts[0];
      return `${months[m] || parts[1]} ${day}, ${year}`;
    };

    if (bounds.start === bounds.end) {
      return formatDate(bounds.start);
    }
    return `${formatDate(bounds.start)} – ${formatDate(bounds.end)}`;
  }, [timeRange, startDate, endDate]);

  // ── Pagination Calculation & State Management ──────────────────────────────
  // For time series, aggregation is preferred over pagination.
  // Categorical / ranking charts use smart pagination to preserve legibility.
  const shouldPaginate = !isTimeSeries && enablePagination !== false;
  const totalItems = filteredData.length;
  const isEffectiveHero = isHero !== undefined ? isHero : (containerWidth >= 800 || (Boolean(multiSeries) && (multiSeries?.length ?? 0) > 1));
  const maxAbsorb = isEffectiveHero ? 3 : 2;
  const effectiveBase = isEffectiveHero ? Math.max(pageSize, 7) : Math.max(1, pageSize);

  const { totalPages, getPageRange } = useMemo(() => {
    if (!shouldPaginate || totalItems <= 0) {
      return { totalPages: 1, getPageRange: () => ({ start: 0, end: totalItems }) };
    }

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
      className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-lg flex flex-col min-h-[420px] h-full w-full min-w-0 box-border gap-2 overflow-hidden"
    >
      {/* ── Header Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5 min-w-0">
        <div className="min-w-0 flex-1 pr-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <BarChart3 className="text-indigo-600 dark:text-indigo-400 shrink-0" size={15} />
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate" title={title}>
              {title}
            </h3>
            {statusBadge && (
              <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold tracking-wider uppercase font-mono shrink-0 ${
                statusBadge === 'LIVE' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' :
                statusBadge === 'MODELLED' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' :
                statusBadge === 'UNAVAILABLE' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20' :
                statusBadge === 'HEURISTIC' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20' :
                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {statusBadge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* View Mode Selector */}
          <select
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-600 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 outline-none transition-colors cursor-pointer max-w-[82px] sm:max-w-[90px]"
            value={chartType}
            onChange={e => setChartType(e.target.value as any)}
            title="Select Chart Type"
          >
            <option value="area">Area</option>
            <option value="bar">Bar</option>
            <option value="horizontal_bar">H-Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
            <option value="donut">Donut</option>
            <option value="table">Table</option>
            <option value="kpi">KPI</option>
          </select>

          {/* Time Range Dropdown */}
          <div className="flex items-center gap-1">
            {isFetching && (
              <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            <select
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-600 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 outline-none transition-colors cursor-pointer max-w-[88px] sm:max-w-[96px]"
              value={timeRange}
              onChange={e => {
                const newRange = e.target.value as DateRangeType;
                setTimeRange(newRange);
                setCurrentPage(1);
                const refDate = getReferenceDate();
                const b = getDateRangeBounds(newRange, refDate, startDate, endDate);
                if (newRange !== 'custom') {
                  setStartDate(b.start);
                  setEndDate(b.end);
                }
                if (onTimeRangeChange) {
                  onTimeRangeChange(newRange, b);
                }
              }}
              title="Select Time Range"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">7 Days</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="30d">30 Days</option>
              <option value="60d">60 Days</option>
              <option value="90d">90 Days</option>
              <option value="this_quarter">This Quarter</option>
              <option value="ytd">YTD</option>
              <option value="12m">12 Months</option>
              <option value="all">All Time</option>
              <option value="custom">Custom...</option>
            </select>
          </div>

          {/* Reset Button */}
          <button
            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
            onClick={() => {
              setChartType(defaultChartType);
              const defaultRange = defaultTimeRange || '30d';
              setTimeRange(defaultRange);
              const b = getDateRangeBounds(defaultRange);
              setStartDate(b.start);
              setEndDate(b.end);
              setCurrentPage(1);
              if (onTimeRangeChange) {
                onTimeRangeChange(defaultRange, b);
              }
            }}
            title="Reset Chart View"
          >
            <RotateCw size={12} />
          </button>
        </div>
      </div>

      {/* Inline Time Range Sub-Bar & Custom Date Inputs */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-indigo-600 dark:text-indigo-400 mb-1 flex-wrap min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <Calendar size={11} className="shrink-0" />
          <span className="truncate font-medium">Range: {timeRangeLabel}</span>
          {shouldPaginate && totalPages > 1 && (
            <span className="text-slate-500 font-mono text-[10px] ml-1.5 shrink-0">
              (Visible: {startIndex + 1}–{endIndex} of {totalItems})
            </span>
          )}
        </div>

        {timeRange === 'custom' && (
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 shadow-xs shrink-0">
            <span className="text-[10px] text-slate-500 font-semibold uppercase">From</span>
            <input
              type="date"
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span className="text-[10px] text-slate-500 font-semibold uppercase">To</span>
            <input
              type="date"
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Phase 8: Dynamic Contextual Metrics Summary Banner for Time-Series */}
      {timeSeriesSummary && (
        <div className="flex items-center gap-2 sm:gap-4 py-1.5 px-2.5 mb-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] flex-wrap transition-opacity duration-300">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400">Latest:</span>
            <span className="font-bold text-slate-900 dark:text-slate-200 font-mono">
              {unit === '₹' ? `₹${formatYAxis(timeSeriesSummary.latest)}` : `${formatYAxis(timeSeriesSummary.latest)} ${unit}`.trim()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400">Average:</span>
            <span className="font-bold text-slate-800 dark:text-slate-300 font-mono">
              {unit === '₹' ? `₹${formatYAxis(timeSeriesSummary.avg)}` : `${formatYAxis(timeSeriesSummary.avg)} ${unit}`.trim()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400">Peak:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
              {unit === '₹' ? `₹${formatYAxis(timeSeriesSummary.peak)}` : `${formatYAxis(timeSeriesSummary.peak)} ${unit}`.trim()}
            </span>
            {timeSeriesSummary.peakDate && (
              <span className="text-[10px] text-slate-500 font-mono">({timeSeriesSummary.peakDate})</span>
            )}
          </div>
        </div>
      )}

      {/* ── View Canvas Area ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {unavailable ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-slate-950/40 rounded-xl border border-slate-800/60 my-auto min-h-[220px]">
            <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-2.5 text-slate-400">
              <Activity size={18} />
            </div>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Telemetry Unavailable</span>
            <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">
              {unavailableReason || "Authoritative database telemetry not currently available for this dimension."}
            </p>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No data records available for this selected time range
          </div>
        ) : chartType === 'horizontal_bar' ? (
          /* ── Horizontal Bar Chart for Rankings ── */
          <div className="flex flex-col h-full w-full min-h-0">
            <div className={`w-full flex-1 ${isEffectiveHero ? 'min-h-[340px] h-[340px] sm:h-[380px]' : 'min-h-[250px] h-[250px] sm:h-[280px]'} relative`}>
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={isEffectiveHero ? 340 : 250}>
                  <BarChart
                    layout="vertical"
                    data={normalizedVisibleData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.6} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      fontSize={10}
                      tickFormatter={formatYAxis}
                      tickLine={false}
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 500 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      width={120}
                      tick={{ fill: '#1e293b', fontSize: 10, fontWeight: 600 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <Tooltip content={renderCustomTooltip} />
                    {multiSeries ? (
                      multiSeries.map((s, idx) => (
                        <Bar key={idx} dataKey={s.key} name={s.label} fill={s.color} radius={[0, 4, 4, 0]} />
                      ))
                    ) : (
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {normalizedVisibleData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[(startIndex + index) % COLORS.length]} />
                        ))}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full min-h-[250px] bg-slate-100 dark:bg-slate-800/30 animate-pulse rounded-xl" />
              )}
            </div>
            {/* Bottom Legend */}
            {showLegend && (
              <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-1 justify-center items-center pt-2 pb-0.5 border-t border-slate-100 dark:border-slate-800/60 mt-auto select-none">
                {multiSeries ? (
                  multiSeries.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{s.label}</span>
                    </div>
                  ))
                ) : (
                  visiblePieData.map((item, idx) => {
                    const val = Number(item.value) || 0;
                    const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(0) : '0';
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color || COLORS[(startIndex + idx) % COLORS.length] }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                        {totalValue > 0 && <span className="text-indigo-600 dark:text-sky-400 font-bold text-[10px]">({pct}%)</span>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : chartType === 'table' ? (
          /* ── 1. Table View Mode (Paginated) ──────────────────────────── */
          <div className="absolute inset-0 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Label / Metric</th>
                  <th className="py-2.5 px-3 text-right">Value</th>
                  <th className="py-2.5 px-3 text-right">Share (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {visiblePieData.map((item, idx) => {
                  const val = Number(item.value) || 0;
                  const formattedVal = unit === '₹' ? `₹${val.toLocaleString('en-IN')}` : `${val.toLocaleString('en-IN')} ${unit}`;
                  const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : '0.0';
                  const rowNumber = startIndex + idx + 1;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 text-slate-400 dark:text-slate-500">{rowNumber}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td>
                      <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{formattedVal}</td>
                      <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : chartType === 'kpi' ? (
          /* ── 2. KPI Summary Mode ─────────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-2 h-full content-center">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-indigo-200 dark:border-indigo-900/40 shadow-xs">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Aggregate Total</div>
              <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                {unit === '₹' ? `₹${totalValue.toLocaleString('en-IN')}` : `${totalValue.toLocaleString('en-IN')} ${unit}`}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Across {allPieData.length} records in active range
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-emerald-200 dark:border-emerald-900/40 shadow-xs">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Average per Entry</div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {unit === '₹'
                  ? `₹${allPieData.length > 0 ? Math.round(totalValue / allPieData.length).toLocaleString('en-IN') : 0}`
                  : `${allPieData.length > 0 ? (totalValue / allPieData.length).toFixed(1) : 0} ${unit}`}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Mean contribution
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-purple-200 dark:border-purple-900/40 shadow-xs">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Top Contributor</div>
              <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-1 truncate">
                {topContributor.name || 'N/A'}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {unit === '₹' ? `₹${Number(topContributor.value || 0).toLocaleString('en-IN')}` : `${topContributor.value || 0} ${unit}`} ({totalValue > 0 ? ((Number(topContributor.value || 0) / totalValue) * 100).toFixed(1) : 0}%)
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-amber-200 dark:border-amber-900/40 shadow-xs">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Minimum Record</div>
              <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1 truncate">
                {minContributor.name || 'N/A'}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
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
                  <span className={`${isWide ? 'text-xs' : 'text-[9px]'} uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold`}>Total</span>
                  <span className={`${isWide ? 'text-base sm:text-lg font-extrabold' : 'text-xs font-bold'} text-slate-900 dark:text-slate-100 font-mono mt-0.5`}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.6} />
                    <XAxis
                      dataKey="name"
                      stroke={xAxisConfig.showTicks ? "#64748b" : "#cbd5e1"}
                      fontSize={10}
                      tickLine={false}
                      tick={xAxisConfig.showTicks ? { fill: '#64748b', fontSize: 10 } : false}
                      tickFormatter={xAxisConfig.showTicks ? formatXAxisTick : undefined}
                      interval={xAxisConfig.interval}
                      angle={xAxisConfig.angle}
                      textAnchor={xAxisConfig.textAnchor}
                      height={xAxisConfig.height}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    {hasSecondaryYAxis ? (
                      <>
                        <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} style={{ textAnchor: 'start' }} />
                      </>
                    ) : (
                      <YAxis stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
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
                <div className="w-full h-full min-h-[250px] bg-slate-100 dark:bg-slate-800/30 animate-pulse rounded-xl" />
              )}
            </div>
            {/* Bottom Legend */}
            {showLegend && (
              <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-1 justify-center items-center pt-2 pb-0.5 border-t border-slate-100 dark:border-slate-800/60 mt-auto select-none">
                {multiSeries ? (
                  multiSeries.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{s.label}</span>
                    </div>
                  ))
                ) : (
                  visiblePieData.map((item, idx) => {
                    const val = Number(item.value) || 0;
                    const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(0) : '0';
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color || COLORS[(startIndex + idx) % COLORS.length] }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                        {totalValue > 0 && <span className="text-indigo-600 dark:text-sky-400 font-bold text-[10px]">({pct}%)</span>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : chartType === 'bar' ? (
          /* ── 5. Bar Chart ────────────────────────────────────────────── */
          <div className="flex flex-col h-full w-full min-h-0">
            <div className={`w-full flex-1 ${isEffectiveHero ? 'min-h-[340px] h-[340px] sm:h-[380px]' : 'min-h-[250px] h-[250px] sm:h-[280px]'} relative`}>
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={isEffectiveHero ? 340 : 250}>
                  <BarChart data={normalizedVisibleData} margin={{ top: 10, right: hasSecondaryYAxis ? 35 : 15, left: -5, bottom: xAxisConfig.bottomMargin }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                    <XAxis
                      dataKey="name"
                      stroke={xAxisConfig.showTicks ? "#64748b" : "#94a3b8"}
                      fontSize={10}
                      tickLine={false}
                      tick={xAxisConfig.showTicks ? { fill: '#64748b', fontSize: 10 } : false}
                      tickFormatter={xAxisConfig.showTicks ? formatXAxisTick : undefined}
                      interval={xAxisConfig.interval}
                      angle={xAxisConfig.angle}
                      textAnchor={xAxisConfig.textAnchor}
                      height={xAxisConfig.height}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    {hasSecondaryYAxis ? (
                      <>
                        <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} style={{ textAnchor: 'start' }} />
                      </>
                    ) : (
                      <YAxis stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
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
                <div className="w-full h-full min-h-[250px] bg-slate-100 dark:bg-slate-800/30 animate-pulse rounded-xl" />
              )}
            </div>
            {/* Bottom Legend */}
            {showLegend && (
              <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-1 justify-center items-center pt-2 pb-0.5 border-t border-slate-100 dark:border-slate-800/60 mt-auto select-none">
                {multiSeries ? (
                  multiSeries.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{s.label}</span>
                    </div>
                  ))
                ) : (
                  visiblePieData.map((item, idx) => {
                    const val = Number(item.value) || 0;
                    const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(0) : '0';
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color || COLORS[(startIndex + idx) % COLORS.length] }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                        {totalValue > 0 && <span className="text-indigo-600 dark:text-sky-400 font-bold text-[10px]">({pct}%)</span>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── 6. Line Chart ───────────────────────────────────────────── */
          <div className="flex flex-col h-full w-full min-h-0">
            <div className={`w-full flex-1 ${isEffectiveHero ? 'min-h-[340px] h-[340px] sm:h-[380px]' : 'min-h-[250px] h-[250px] sm:h-[280px]'} relative`}>
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={isEffectiveHero ? 340 : 250}>
                  <LineChart data={normalizedVisibleData} margin={{ top: 10, right: hasSecondaryYAxis ? 35 : 15, left: -5, bottom: xAxisConfig.bottomMargin }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                    <XAxis
                      dataKey="name"
                      stroke={xAxisConfig.showTicks ? "#64748b" : "#94a3b8"}
                      fontSize={10}
                      tickLine={false}
                      tick={xAxisConfig.showTicks ? { fill: '#64748b', fontSize: 10 } : false}
                      tickFormatter={xAxisConfig.showTicks ? formatXAxisTick : undefined}
                      interval={xAxisConfig.interval}
                      angle={xAxisConfig.angle}
                      textAnchor={xAxisConfig.textAnchor}
                      height={xAxisConfig.height}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    {hasSecondaryYAxis ? (
                      <>
                        <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} style={{ textAnchor: 'start' }} />
                      </>
                    ) : (
                      <YAxis stroke="#64748b" fontSize={10} tickFormatter={formatYAxis} tickLine={false} />
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
                <div className="w-full h-full min-h-[250px] bg-slate-100 dark:bg-slate-800/30 animate-pulse rounded-xl" />
              )}
            </div>
            {/* Bottom Legend */}
            {showLegend && (
              <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-1 justify-center items-center pt-2 pb-0.5 border-t border-slate-100 dark:border-slate-800/60 mt-auto select-none">
                {multiSeries ? (
                  multiSeries.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{s.label}</span>
                    </div>
                  ))
                ) : (
                  visiblePieData.map((item, idx) => {
                    const val = Number(item.value) || 0;
                    const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(0) : '0';
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color || COLORS[(startIndex + idx) % COLORS.length] }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                        {totalValue > 0 && <span className="text-indigo-600 dark:text-sky-400 font-bold text-[10px]">({pct}%)</span>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Prominent & Clearly Visible Chart Pagination Footer ─────────────────── */}
      {shouldPaginate && totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-3 pt-2 pb-0.5 border-t border-slate-100 dark:border-slate-800/80 mt-auto select-none">
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={safeCurrentPage <= 1}
            aria-label="Previous batch"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-indigo-400 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
            title="Previous batch"
          >
            <ChevronLeft size={16} strokeWidth={2.4} />
          </button>
          <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-3 py-0.5 rounded-md tracking-wider">
            {startIndex + 1}–{endIndex} <span className="text-slate-500 dark:text-slate-400 font-normal">of</span> {totalItems}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={safeCurrentPage >= totalPages}
            aria-label="Next batch"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-indigo-400 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
            title="Next batch"
          >
            <ChevronRight size={16} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}

