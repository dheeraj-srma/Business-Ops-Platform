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
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Award,
  ChevronDown,
  MapPin,
  UserCheck,
  ChevronRight,
  RefreshCw,
  FileText
} from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import GithubHeatmap, { HeatmapDay } from './GithubHeatmap';
import InteractiveChart from './InteractiveChart';
import { resolveDateRange, DateRangeType } from '../utils/dateRange';
import { calculateAOV } from '../utils/metricCalculations';

interface CustomerRecord {
  id: string;
  name: string;
  city: string;
  state: string;
  salesman: string;
  phone: string;
  revenue: number;
  orders: number;
  avg_order: number;
  units_sold: number;
  products_count: number;
  active_days: number;
  tier: string;
}

export default function CustomerPerformanceView() {
  const { sales, kpis, dealersList, ordersList, customersAnalyticsList } = useBi();

  // Date Range Filter State (matching SalesmanPerformanceView)
  const [dateRange, setDateRange] = useState<string>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Selected Customer Focus State ('all' or customer_id)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');

  // Heatmap State
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [heatmapRange, setHeatmapRange] = useState<string>('30d');
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);

  // Table Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Chart Granularity for selected customer timeline
  const [chartGranularity, setChartGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Authoritative calendar date strings derived from dateRange.ts
  const { startDateStr, endDateStr, daysCount } = useMemo(() => {
    const rangeType = (dateRange === 'this_year' ? 'ytd' : dateRange) as DateRangeType;
    const res = resolveDateRange(rangeType, customStart, customEnd);
    return { startDateStr: res.startDate, endDateStr: res.endDate, daysCount: res.daysCount };
  }, [dateRange, customStart, customEnd]);

  // Authoritative Customer Catalog: Primary source is backend historical customer analytics (Rule 18)
  const customersData: CustomerRecord[] = useMemo(() => {
    if (customersAnalyticsList && customersAnalyticsList.length > 0) {
      const seenIds = new Set<string>();
      return customersAnalyticsList.map((c: any, idx: number) => {
        const name = c.customer_name || 'Counter Customer';
        const city = c.city || 'Gurugram';
        const state = c.state || 'Haryana';
        const salesman = c.salesman || 'Unassigned';
        const phone = c.gstin ? `GST: ${c.gstin}` : '-';
        let code = c.customer_id || `CUST-${1001 + idx}`;
        if (seenIds.has(code)) {
          code = `${code}-${idx + 1}`;
        }
        seenIds.add(code);
        const rev = Math.round(Number(c.revenue || 0));
        const ords = Number(c.voucher_count || 0);
        const avgOrd = Number(c.aov || (ords > 0 ? Math.round(rev / ords) : 0));
        const units = Number(c.units_sold || 0);
        const activeDays = Number(c.active_days || 1);
        const prodDiversity = Number(c.product_diversity || 1);
        const tier = rev > 250000 ? 'Platinum' : rev > 120000 ? 'Gold' : rev > 50000 ? 'Silver' : 'Bronze';

        return {
          id: code,
          name,
          city,
          state,
          salesman,
          phone,
          revenue: rev,
          orders: ords,
          avg_order: avgOrd,
          units_sold: units,
          products_count: prodDiversity,
          active_days: activeDays,
          tier,
        };
      });
    }

    // Fallback if historical endpoint has not returned yet: operational dealers
    const cleanDealerNameAndCity = (rawName: string, rawCity?: string, rawState?: string) => {
      let name = (rawName || '').trim();
      let city = (rawCity || '').trim();
      let state = (rawState || '').trim() || 'Haryana';
      const match = name.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (match) {
        name = match[1].trim();
        if (!city || city === 'Gurugram' || city === 'Faridabad') city = match[2].trim();
      }
      if (!city) city = 'Gurugram';
      return { name, city, state };
    };

    if (dealersList && dealersList.length > 0) {
      const seenDealerIds = new Set<string>();
      return dealersList.map((d: any, idx: number) => {
        const rawName = d["Shop Name"] || d.name || d.shop_name || `Customer ${idx + 1}`;
        const { name, city, state } = cleanDealerNameAndCity(rawName, d.City || d.city, d.State || d.state);
        const salesman = d["Salesman Name"] || d.salesman || 'Unassigned';
        const phone = d.Phone || d.phone || '-';
        let code = d["Customer Code"] || d.customer_code || `CUST-${1001 + idx}`;
        if (seenDealerIds.has(code)) {
          code = `${code}-${idx + 1}`;
        }
        seenDealerIds.add(code);
        return {
          id: code,
          name,
          city,
          state,
          salesman,
          phone,
          revenue: 0,
          orders: 0,
          avg_order: 0,
          units_sold: 0,
          products_count: 0,
          active_days: 0,
          tier: 'Standard',
        };
      });
    }

    return [];
  }, [customersAnalyticsList, dealersList]);

  // Current Selected Customer object (or null if "All Customers")
  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId === 'all') return null;
    return customersData.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customersData]);

  // Filtered Customers for comparison table based on search query & tier filter
  const filteredCustomerOptions = useMemo(() => {
    let list = customersData;
    if (tierFilter !== 'all') {
      list = list.filter(c => c.tier.toLowerCase() === tierFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.salesman.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
      );
    }
    return list;
  }, [customersData, searchQuery, tierFilter]);

  // Heatmap Fetcher from authoritative backend historical database
  const fetchHeatmap = async (customerId: string, range: string) => {
    setLoadingHeatmap(true);
    try {
      let daysParam = 30;
      switch (range) {
        case '7d':
        case 'this_week':
          daysParam = 7;
          break;
        case '30d':
        case 'this_month':
        case 'last_month':
          daysParam = 30;
          break;
        case '3m':
        case '90d':
        case 'this_quarter':
          daysParam = 90;
          break;
        case '6m':
        case '180d':
          daysParam = 180;
          break;
        case '12m':
        case '1y':
        case '365d':
        case 'this_year':
        case 'ytd':
        case 'all':
          daysParam = 365;
          break;
        default:
          daysParam = 30;
      }

      const qCust = customerId && customerId !== 'all' ? encodeURIComponent(customerId) : 'all';
      const url = `/api/analytics/customers/heatmap?customer_id=${qCust}&days=${daysParam}`;
      const res = await fetch(url);
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

  // Fetch heatmap on customer focus or range change
  useEffect(() => {
    fetchHeatmap(selectedCustomerId, heatmapRange);
  }, [selectedCustomerId, heatmapRange]);

  // Calculated KPI Values: Pure sum from actual data
  const metrics = useMemo(() => {
    if (selectedCustomer) {
      return {
        totalSales: selectedCustomer.revenue,
        orders: selectedCustomer.orders,
        avgOrder: selectedCustomer.avg_order,
        unitsSold: selectedCustomer.units_sold,
        products: selectedCustomer.products_count,
        activeDays: selectedCustomer.active_days,
      };
    }

    const totalSales = customersData.reduce((acc, c) => acc + c.revenue, 0);
    const totalOrders = customersData.reduce((acc, c) => acc + c.orders, 0);
    const totalUnits = customersData.reduce((acc, c) => acc + c.units_sold, 0);
    const avgOrder = calculateAOV(totalSales, totalOrders);
    const activeDays = customersData.length > 0 ? Math.max(...customersData.map(c => c.active_days), 0) : 0;
    const maxDiversity = customersData.length > 0 ? Math.max(...customersData.map(c => c.products_count), 0) : 0;

    return {
      totalSales,
      orders: totalOrders,
      avgOrder,
      unitsSold: totalUnits,
      products: maxDiversity > 0 ? maxDiversity : (sales.top_products?.length || 0),
      activeDays,
    };
  }, [selectedCustomer, customersData, sales.top_products]);

  // Top Customer Revenue Ranking (Horizontal Bar)
  const topCustomersRankingData = useMemo(() => {
    return [...customersData]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(c => ({
        name: c.name.length > 20 ? c.name.slice(0, 20) + '…' : c.name,
        value: c.revenue,
      }));
  }, [customersData]);

  // Customer Purchase Frequency Distribution (Bar)
  const frequencyDistributionData = useMemo(() => {
    const buckets: Record<string, number> = {
      '1 Voucher': 0,
      '2-5 Vouchers': 0,
      '6-10 Vouchers': 0,
      '11-20 Vouchers': 0,
      '20+ Vouchers': 0,
    };
    customersData.forEach(c => {
      if (c.orders <= 1) buckets['1 Voucher'] += 1;
      else if (c.orders <= 5) buckets['2-5 Vouchers'] += 1;
      else if (c.orders <= 10) buckets['6-10 Vouchers'] += 1;
      else if (c.orders <= 20) buckets['11-20 Vouchers'] += 1;
      else buckets['20+ Vouchers'] += 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [customersData]);

  // Time-Series Trend Chart Data for Selected Customer
  const chartData = useMemo(() => {
    const raw = heatmapDays.filter(d => d.orders > 0 || d.sales > 0);
    if (chartGranularity === 'daily') {
      return raw.map(d => ({
        name: d.date.slice(5),
        Sales: d.sales,
        Orders: d.orders
      }));
    }

    if (chartGranularity === 'monthly') {
      const monthMap = new Map<string, { sales: number; orders: number }>();
      raw.forEach(d => {
        const mKey = d.date.slice(0, 7);
        const curr = monthMap.get(mKey) || { sales: 0, orders: 0 };
        monthMap.set(mKey, {
          sales: curr.sales + d.sales,
          orders: curr.orders + d.orders
        });
      });
      return Array.from(monthMap.entries()).map(([mKey, val]) => ({
        name: mKey,
        Sales: Math.round(val.sales),
        Orders: val.orders
      }));
    }

    // Weekly aggregation
    const weekMap = new Map<string, { sales: number; orders: number }>();
    raw.forEach(d => {
      const dt = new Date(`${d.date}T00:00:00Z`);
      const dayOfWeek = (dt.getUTCDay() + 6) % 7;
      const mon = new Date(dt.getTime() - dayOfWeek * 86400000);
      const wKey = mon.toISOString().slice(5, 10);
      const curr = weekMap.get(wKey) || { sales: 0, orders: 0 };
      weekMap.set(wKey, {
        sales: curr.sales + d.sales,
        orders: curr.orders + d.orders
      });
    });
    return Array.from(weekMap.entries()).map(([wKey, val]) => ({
      name: `Wk ${wKey}`,
      Sales: Math.round(val.sales),
      Orders: val.orders
    }));
  }, [heatmapDays, chartGranularity]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Top Unified Date Range & Selector Control Bar (Matching Salesman Layout) ── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Calendar size={20} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Scope</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Customer Performance</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Customer Focus Dropdown */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <Users size={14} className="text-sky-400" />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer max-w-[240px] truncate"
            >
              <option value="all" className="bg-slate-900 text-white">All Customers ({customersData.length} Accounts)</option>
              {customersData.map((c, idx) => (
                <option key={`${c.id}-${idx}`} value={c.id} className="bg-slate-900 text-white">
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Period:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
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
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white"
              />
            </div>
          )}

          <button
            onClick={() => fetchHeatmap(selectedCustomerId, heatmapRange)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700/50"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loadingHeatmap ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── 1. Aggregate KPI Cards (Matching Salesman Performance Layout) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Sales</span>
            <DollarSign size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            ₹{metrics.totalSales.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Live data</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Orders</span>
            <ShoppingCart size={16} className="text-sky-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            {metrics.orders.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Completed orders</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Average Order</span>
            <TrendingUp size={16} className="text-amber-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            ₹{metrics.avgOrder.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Average order value</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Units Sold</span>
            <Package size={16} className="text-indigo-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            {metrics.unitsSold.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Total units</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">{selectedCustomer ? 'Products' : 'Customers'}</span>
            <Building2 size={16} className="text-purple-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            {selectedCustomer ? `${metrics.products} SKUs` : `${customersData.length} Accounts`}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{selectedCustomer ? 'Distinct items' : 'Unique accounts'}</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Days</span>
            <Calendar size={16} className="text-teal-400" />
          </div>
          <div className="text-lg font-extrabold text-white">
            {metrics.activeDays} Days
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Purchase activity</div>
        </div>
      </div>

      {/* ── 2. GitHub-Style Order Activity Heatmap (Identical Interactive Component) ── */}
      <GithubHeatmap
        days={heatmapDays}
        title={selectedCustomerId === 'all' ? "Order Activity" : `Order Activity: ${selectedCustomer?.name || 'Customer'}`}
        subtitle={selectedCustomerId === 'all' ? "Daily order activity for all customers" : `Daily order activity for ${selectedCustomer?.name || 'selected customer'}`}
        selectedRange={heatmapRange}
        onRangeChange={setHeatmapRange}
        isLoading={loadingHeatmap}
      />

      {/* ── 3. Selected Customer Focus Analytics Detail View (Matching Salesman Detail) ── */}
      {selectedCustomerId !== 'all' && selectedCustomer && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border uppercase ${
                  selectedCustomer.tier === 'Platinum' ? 'bg-indigo-900/60 text-indigo-300 border-indigo-700/60' :
                  selectedCustomer.tier === 'Gold' ? 'bg-amber-900/60 text-amber-300 border-amber-700/60' :
                  selectedCustomer.tier === 'Silver' ? 'bg-slate-800 text-slate-300 border-slate-700' :
                  'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {selectedCustomer.tier} Tier Account
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  ACTIVE
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                {selectedCustomer.name}
                <span className="text-xs font-medium text-slate-400 font-mono">({selectedCustomer.id})</span>
              </h2>
              <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-sky-400" />
                  {selectedCustomer.city}, {selectedCustomer.state}
                </span>
                <span className="flex items-center gap-1">
                  <UserCheck size={12} className="text-indigo-400" />
                  Rep: {selectedCustomer.salesman}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {selectedCustomer.phone}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedCustomerId('all')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all border border-slate-700/60 flex items-center gap-2 self-start sm:self-auto"
            >
              <span>View All Customers</span>
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
                <div className="text-sm font-extrabold text-white">₹{selectedCustomer.revenue.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 mb-1">Total Vouchers</div>
                <div className="text-sm font-extrabold text-sky-400">{selectedCustomer.orders}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Average ₹{selectedCustomer.avg_order.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 mb-1">Units Dispatched</div>
                <div className="text-sm font-extrabold text-amber-400">{selectedCustomer.units_sold.toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Across {selectedCustomer.products_count} distinct SKUs</div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 mb-1">Active Days</div>
                <div className="text-sm font-extrabold text-teal-400">{selectedCustomer.active_days} Days</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Purchase activity</div>
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
              subtitle={`Order activity timeline for ${selectedCustomer.name}`}
              data={chartData}
              defaultChartType="area"
              unit="₹"
            />
          </div>
        </div>
      )}

      {/* ── 4. Customer Analytical Charts (When All Customers Selected) ── */}
      {selectedCustomerId === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InteractiveChart
            title="Top Customer Revenue Ranking"
            subtitle="Top 10 highest-value dealer accounts ranked by cumulative gross revenue"
            data={topCustomersRankingData}
            defaultChartType="horizontal_bar"
            unit="₹"
          />

          <InteractiveChart
            title="Customer Purchase Frequency Distribution"
            subtitle="Count of dealer accounts categorized by number of distinct purchase vouchers"
            data={frequencyDistributionData}
            defaultChartType="bar"
            unit="Accounts"
          />
        </div>
      )}

      {/* ── 5. Customer Directory & Comparison Table (Matching Salesman Table Layout) ── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        {/* Table Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Users size={18} className="text-sky-400" />
              Customer Accounts Directory
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Authoritative performance ledger across all {customersData.length} customer accounts</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input with Dynamic Placeholder */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${customersData.length} customers...`}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44 sm:w-60"
              />
            </div>

            {/* Tier Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-400">
              <Filter size={12} />
              <select
                value={tierFilter}
                onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-slate-900">All Tiers</option>
                <option value="Platinum" className="bg-slate-900">Platinum Tier</option>
                <option value="Gold" className="bg-slate-900">Gold Tier</option>
                <option value="Silver" className="bg-slate-900">Silver Tier</option>
                <option value="Bronze" className="bg-slate-900">Bronze Tier</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
          <span>Showing {filteredCustomerOptions.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredCustomerOptions.length)} of {filteredCustomerOptions.length} customers</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
            >
              Prev
            </button>
            <span>Page {page} of {Math.max(1, Math.ceil(filteredCustomerOptions.length / pageSize))}</span>
            <button
              disabled={page >= Math.ceil(filteredCustomerOptions.length / pageSize)}
              onClick={() => setPage(p => p + 1)}
              className="px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Sales Rep</th>
                <th className="py-3 px-4 text-center">Tier</th>
                <th className="py-3 px-4 text-center">Vouchers</th>
                <th className="py-3 px-4 text-right">Units Sold</th>
                <th className="py-3 px-4 text-right">AOV</th>
                <th className="py-3 px-4 text-center">Diversity</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-medium">
              {filteredCustomerOptions.slice((page - 1) * pageSize, page * pageSize).map((c, idx) => (
                <tr key={`${c.id}-${(page - 1) * pageSize + idx}`} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-100">{c.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{c.id}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <div>{c.city}</div>
                    <div className="text-[10px] text-slate-500">{c.state}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-300">{c.salesman}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.tier === 'Platinum' ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/60' :
                      c.tier === 'Gold' ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60' :
                      c.tier === 'Silver' ? 'bg-slate-800 text-slate-300 border border-slate-700' :
                      'bg-slate-800/60 text-slate-400'
                    }`}>
                      {c.tier}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-200">{c.orders}</td>
                  <td className="py-3 px-4 text-right font-medium text-amber-400">{c.units_sold.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-right font-medium text-purple-400">₹{c.avg_order.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-center text-slate-300">{c.products_count} SKUs</td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-400">₹{c.revenue.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => { setSelectedCustomerId(c.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900 text-indigo-400 border border-indigo-800/50 text-[10px] font-semibold transition-all"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCustomerOptions.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No customers found matching "{searchQuery}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
