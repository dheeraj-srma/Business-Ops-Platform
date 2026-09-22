'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  UserCheck,
  MapPin,
  ChevronRight,
  RefreshCw,
  BarChart3,
  Award,
  AlertCircle,
  FileText
} from 'lucide-react';
import GithubHeatmap, { HeatmapDay } from './GithubHeatmap';
import InteractiveChart from './InteractiveChart';
import { resolveDateRange, getDateRangeBounds, DateRangeType } from '../utils/dateRange';

interface TeamSummary {
  total_team_sales: number;
  total_orders: number;
  total_units_sold: number;
  total_active_salesmen: number;
  total_customers_served: number;
  average_order_value: number;
}

interface SalesmanListItem {
  salesman_id: string;
  name: string;
  salesman_code: string;
  location: string;
  is_active: boolean;
  sales: number;
  orders: number;
  average_order_value: number;
  customers: number;
  units_sold: number;
  active_days: number;
}

interface SalesmanDetail {
  header: {
    salesman_id: string;
    name: string;
    salesman_code: string;
    role: string;
    location: string;
    is_active: boolean;
  };
  metrics: {
    total_sales: number;
    total_orders: number;
    average_order_value: number;
    total_units_sold: number;
    unique_customers: number;
    cancelled_returned_orders: number;
    cancelled_returned_value: number;
    net_sales: number;
    line_items_count: number;
    active_days: number;
  };
  daily_trends: { date: string; sales: number; orders: number }[];
}

export default function SalesmanPerformanceView() {
  // Date Range Filter State
  const [dateRange, setDateRange] = useState<string>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Selected Salesman (null or 'all' for Team View, or salesman_id)
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('all');

  // Data States
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [salesmenList, setSalesmenList] = useState<SalesmanListItem[]>([]);
  const [salesmanDetail, setSalesmanDetail] = useState<SalesmanDetail | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [heatmapRange, setHeatmapRange] = useState<string>('30d');

  // UI States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('sales');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [chartGranularity, setChartGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authoritative calendar date strings derived from dateRange.ts with safe custom range handling
  const { startDateStr, endDateStr, daysCount } = useMemo(() => {
    try {
      const rangeType = (dateRange === 'this_year' ? 'ytd' : dateRange) as DateRangeType;
      if (rangeType === 'custom') {
        if (!customStart || !customEnd || customStart > customEnd) {
          const fallback = resolveDateRange('30d');
          return { startDateStr: fallback.startDate, endDateStr: fallback.endDate, daysCount: fallback.daysCount };
        }
      }
      const res = resolveDateRange(rangeType, customStart, customEnd);
      return { startDateStr: res.startDate, endDateStr: res.endDate, daysCount: res.daysCount };
    } catch {
      const fallback = resolveDateRange('30d');
      return { startDateStr: fallback.startDate, endDateStr: fallback.endDate, daysCount: fallback.daysCount };
    }
  }, [dateRange, customStart, customEnd]);

  // Safe handler for date range change with auto-populated defaults for custom
  const handleDateRangeChange = (newRange: string) => {
    setDateRange(newRange);
    if (newRange === 'custom' && (!customStart || !customEnd)) {
      const bounds = getDateRangeBounds('30d');
      setCustomStart(bounds.start);
      setCustomEnd(bounds.end);
    }
  };

  // Get Auth Token from localStorage if needed
  const getAuthHeaders = (): HeadersInit => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('nalka_access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch Team Summary
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      let url = `/api/sales/salesmen/summary?start_date=${startDateStr}&end_date=${endDateStr}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTeamSummary(data);
      } else {
        setTeamSummary(null);
      }
    } catch (err) {
      console.error(err);
      setTeamSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Fetch Salesmen Performance List
  const fetchSalesmenList = async () => {
    setLoadingList(true);
    try {
      let url = `/api/sales/salesmen/performance?start_date=${startDateStr}&end_date=${endDateStr}&sort_by=${sortBy}&sort_order=${sortOrder}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSalesmenList(data?.salesmen || []);
      } else {
        setSalesmenList([]);
      }
    } catch (err) {
      console.error(err);
      setSalesmenList([]);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch Detail for selected salesman
  const fetchSalesmanDetail = async (salesmanId: string) => {
    setLoadingDetail(true);
    try {
      const url = `/api/sales/salesmen/${salesmanId}/performance?start_date=${startDateStr}&end_date=${endDateStr}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSalesmanDetail(data);
      } else {
        setSalesmanDetail(null);
      }
    } catch (err) {
      console.error(err);
      setSalesmanDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Fetch Heatmap for selected salesman
  const fetchHeatmap = async (salesmanId: string, range: string) => {
    setLoadingHeatmap(true);
    try {
      let daysCount = 30;
      switch (range) {
        case '7d':
        case 'this_week':
          daysCount = 7;
          break;
        case '30d':
        case 'this_month':
        case 'last_month':
          daysCount = 30;
          break;
        case '3m':
        case '90d':
        case 'this_quarter':
          daysCount = 90;
          break;
        case '6m':
        case '180d':
          daysCount = 180;
          break;
        case '12m':
        case '1y':
        case '365d':
        case 'this_year':
        case 'ytd':
        case 'all':
          daysCount = 365;
          break;
        default: {
          try {
            const rangeType = (range === 'this_year' ? 'ytd' : range) as DateRangeType;
            const resDates = resolveDateRange(rangeType, customStart, customEnd);
            daysCount = Math.max(7, Math.min(730, resDates.daysCount || 30));
          } catch {
            daysCount = 30;
          }
        }
      }

      const url = `/api/sales/salesmen/${salesmanId}/heatmap?days=${daysCount}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHeatmapDays(data.days || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  // Sync heatmapRange when main dateRange changes
  useEffect(() => {
    setHeatmapRange(dateRange);
  }, [dateRange]);

  // Trigger fetches on filter updates
  useEffect(() => {
    fetchSummary();
    fetchSalesmenList();
  }, [startDateStr, endDateStr, sortBy, sortOrder, statusFilter, searchQuery]);

  useEffect(() => {
    if (selectedSalesmanId) {
      fetchSalesmanDetail(selectedSalesmanId);
      fetchHeatmap(selectedSalesmanId, heatmapRange);
    }
  }, [selectedSalesmanId, heatmapRange, customStart, customEnd]);

  // Sort handler
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Granular trend chart data aggregation
  const chartData = useMemo(() => {
    if (!salesmanDetail || !salesmanDetail.daily_trends) return [];
    const raw = salesmanDetail.daily_trends;

    if (chartGranularity === 'daily') {
      return raw.map(d => ({
        name: d.date.slice(5),
        date: d.date,
        Sales: Math.round(d.sales),
        Orders: d.orders,
        value: Math.round(d.sales)
      }));
    }

    if (chartGranularity === 'monthly') {
      const monthMap = new Map<string, { sales: number; orders: number }>();
      raw.forEach(d => {
        const mKey = d.date.slice(0, 7); // YYYY-MM
        const curr = monthMap.get(mKey) || { sales: 0, orders: 0 };
        monthMap.set(mKey, {
          sales: curr.sales + d.sales,
          orders: curr.orders + d.orders
        });
      });
      return Array.from(monthMap.entries()).map(([mKey, val]) => ({
        name: mKey,
        date: `${mKey}-01`,
        Sales: Math.round(val.sales),
        Orders: val.orders,
        value: Math.round(val.sales)
      }));
    }

    // Weekly aggregation (Group by actual ISO calendar week / start-of-week Monday)
    const weekMap = new Map<string, { sales: number; orders: number }>();
    raw.forEach(d => {
      const dt = new Date(`${d.date}T00:00:00Z`);
      const dayOfWeek = (dt.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
      const mon = new Date(dt.getTime() - dayOfWeek * 86400000);
      const wKey = mon.toISOString().slice(5, 10); // MM-DD of Monday
      const curr = weekMap.get(wKey) || { sales: 0, orders: 0 };
      weekMap.set(wKey, {
        sales: curr.sales + d.sales,
        orders: curr.orders + d.orders
      });
    });
    return Array.from(weekMap.entries()).map(([wKey, val]) => ({
      name: `Wk ${wKey}`,
      date: `2026-${wKey}`,
      Sales: Math.round(val.sales),
      Orders: val.orders,
      value: Math.round(val.sales)
    }));
  }, [salesmanDetail, chartGranularity]);

  return (
    <div className="space-y-6">
      {/* ── Top Unified Date Range & Selector Control Bar ────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Calendar size={20} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Scope</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Salesmen Performance</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Salesman Focus Dropdown */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <Users size={14} className="text-sky-400" />
            <select
              value={selectedSalesmanId}
              onChange={(e) => setSelectedSalesmanId(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Salesmen</option>
              {salesmenList.map(s => (
                <option key={s.salesman_id} value={s.salesman_id} className="bg-slate-900 text-white">
                  {s.name} ({s.salesman_code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Period:</span>
            <select
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              className="bg-transparent text-indigo-600 dark:text-indigo-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value="today" className="bg-slate-900 text-white">Today</option>
              <option value="7d" className="bg-slate-900 text-white">Last 7 Days</option>
              <option value="30d" className="bg-slate-900 text-white">Last 30 Days</option>
              <option value="this_month" className="bg-slate-900 text-white">This Month</option>
              <option value="last_month" className="bg-slate-900 text-white">Last Month</option>
              <option value="12m" className="bg-slate-900 text-white">Last 12 Months</option>
              <option value="this_year" className="bg-slate-900 text-white">This Year</option>
              <option value="custom" className="bg-slate-900 text-white">Custom Range</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              />
              {customStart && customEnd && customStart > customEnd && (
                <span className="text-[10px] text-rose-400 font-semibold">Start date must be before end date</span>
              )}
            </div>
          )}

          <button
            onClick={() => { fetchSummary(); fetchSalesmenList(); if (selectedSalesmanId) fetchSalesmanDetail(selectedSalesmanId); }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700/50"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loadingSummary || loadingList || loadingDetail ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── 1. Team Summary Aggregate KPI Cards ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Sales</span>
            <DollarSign size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            ₹{loadingSummary ? '...' : (teamSummary?.total_team_sales || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Live data</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Orders</span>
            <ShoppingCart size={16} className="text-sky-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            {loadingSummary ? '...' : (teamSummary?.total_orders || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Completed orders</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Average Order</span>
            <TrendingUp size={16} className="text-amber-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            ₹{loadingSummary ? '...' : (teamSummary?.average_order_value || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Average order value</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Units Sold</span>
            <Package size={16} className="text-indigo-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            {loadingSummary ? '...' : (teamSummary?.total_units_sold || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Total units</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Customers</span>
            <Users size={16} className="text-purple-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            {loadingSummary ? '...' : (teamSummary?.total_customers_served || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Unique customers</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Salesmen</span>
            <UserCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
            {loadingSummary ? '...' : (teamSummary?.total_active_salesmen || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Active team</div>
        </div>
      </div>

      {/* ── 2. GitHub-Style Order Activity Heatmap ──────────────────────── */}
      <GithubHeatmap
        days={heatmapDays}
        title={selectedSalesmanId === 'all' ? "Order Activity" : `Order Activity: ${salesmanDetail?.header.name || 'Salesman'}`}
        subtitle={selectedSalesmanId === 'all' ? "Daily order activity for all salesmen" : `Daily order activity for ${salesmanDetail?.header.name || 'selected rep'}`}
        selectedRange={heatmapRange}
        onRangeChange={setHeatmapRange}
        isLoading={loadingHeatmap}
      />

      {/* ── 3. Selected Salesman Focus Analytics Detail View ──────────────── */}
      {selectedSalesmanId !== 'all' && salesmanDetail && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800/40 uppercase">
                  {salesmanDetail.header.role || 'Sales Executive'}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${salesmanDetail.header.is_active ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {salesmanDetail.header.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                {salesmanDetail.header.name}
                <span className="text-xs font-medium text-slate-400">({salesmanDetail.header.salesman_code})</span>
              </h2>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-sky-400" />
                  {salesmanDetail.header.location || 'Northern Region'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedSalesmanId('all')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all border border-slate-700/60 flex items-center gap-2 self-start sm:self-auto"
            >
              <span>View All Salesmen</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Exact Sales Breakdown Panel */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText size={14} className="text-sky-400" />
              Sales Breakdown
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 mb-1">Gross Sales</div>
                <div className="text-sm font-extrabold text-white">₹{salesmanDetail.metrics.total_sales.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 mb-1">Cancelled / Returns</div>
                <div className="text-sm font-extrabold text-rose-400">₹{salesmanDetail.metrics.cancelled_returned_value.toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{salesmanDetail.metrics.cancelled_returned_orders} orders affected</div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 mb-1">Net Sales</div>
                <div className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">₹{salesmanDetail.metrics.net_sales.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 mb-1">Line Items</div>
                <div className="text-sm font-extrabold text-indigo-400">{salesmanDetail.metrics.line_items_count}</div>
              </div>
            </div>
          </div>

          {/* Interactive Chart for Time-Series Trend */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={14} className="text-indigo-600 dark:text-indigo-400" />
                Sales Timeline
              </h4>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                {(['daily', 'weekly', 'monthly'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setChartGranularity(g)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all ${chartGranularity === g ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <InteractiveChart
              title={`Sales & Orders (${chartGranularity})`}
              subtitle={`Sales over time for ${salesmanDetail.header.name}`}
              data={chartData}
              defaultChartType="area"
              unit="₹"
            />
          </div>
        </div>
      )}

      {/* ── 4. Salesman Comparison Table ───────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        {/* Table Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Users size={18} className="text-sky-400" />
              Sales Comparison
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Sales performance by salesman</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search salesman..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44 sm:w-56"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-400">
              <Filter size={12} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Status</option>
                <option value="active" className="bg-slate-900">Active Only</option>
                <option value="inactive" className="bg-slate-900">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {loadingList ? (
          <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
            Loading...
          </div>
        ) : salesmenList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <AlertCircle size={24} className="text-amber-400" />
            <span>No salesmen found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold tracking-wider text-[11px]">
                  <th className="py-3 px-3">Salesman</th>
                  <th className="py-3 px-3">Ref Code</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Status</th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-sky-400 transition-all"
                    onClick={() => handleSort('sales')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Sales (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-sky-400 transition-all"
                    onClick={() => handleSort('orders')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Orders</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-sky-400 transition-all"
                    onClick={() => handleSort('average_order_value')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>AOV (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-sky-400 transition-all"
                    onClick={() => handleSort('units_sold')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Units</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-sky-400 transition-all"
                    onClick={() => handleSort('customers')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Dealers</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-sky-400 transition-all"
                    onClick={() => handleSort('active_days')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Active Days</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {salesmenList.map((row) => (
                  <tr
                    key={row.salesman_id}
                    onClick={() => setSelectedSalesmanId(row.salesman_id)}
                    className={`hover:bg-slate-800/50 cursor-pointer transition-all ${selectedSalesmanId === row.salesman_id ? 'bg-sky-500/10 border-l-2 border-sky-400' : ''}`}
                  >
                    <td className="py-3.5 px-3 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 text-xs font-bold">
                        {row.name.charAt(0)}
                      </div>
                      <span>{row.name}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-400">{row.salesman_code}</td>
                    <td className="py-3.5 px-3 text-slate-400">{row.location || 'Northern Region'}</td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.is_active ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-sky-400">
                      ₹{row.sales.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-3 text-right font-extrabold text-white">{row.orders}</td>
                    <td className="py-3.5 px-3 text-right text-slate-300">
                      ₹{row.average_order_value.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-3 text-right text-indigo-300 font-semibold">{row.units_sold}</td>
                    <td className="py-3.5 px-3 text-right text-slate-300 font-semibold">{row.customers}</td>
                    <td className="py-3.5 px-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">{row.active_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
