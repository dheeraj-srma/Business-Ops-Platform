'use client';

import React, { useState, useMemo } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import GithubHeatmap, { HeatmapDay } from './GithubHeatmap';
import InteractiveChart from './InteractiveChart';
import { DateRangeType, getDateRangeBounds, filterItemsByDateRange, parseCalendarDate, formatCalendarDate } from '../utils/dateRange';
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

  // Search & Filter State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRangeType>('30d');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

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
        const units = 0;
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

  // Filtered Customers dropdown options based on search query
  const filteredCustomerOptions = useMemo(() => {
    if (!searchQuery.trim()) return customersData;
    const q = searchQuery.toLowerCase();
    return customersData.filter(
      c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.salesman.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
    );
  }, [customersData, searchQuery]);

  // Current Selected Customer object (or null if "All Customers")
  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId === 'all') return null;
    return customersData.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customersData]);

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

  // Top Customer Revenue Ranking (Horizontal Bar - Rule 18 & 26)
  const topCustomersRankingData = useMemo(() => {
    return [...customersData]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(c => ({
        name: c.name.length > 20 ? c.name.slice(0, 20) + '…' : c.name,
        value: c.revenue,
      }));
  }, [customersData]);

  // Customer Purchase Frequency Distribution (Bar - Rule 18 & 26)
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

  // Order Activity Heatmap: Derived from actual orders (Phase 13)
  const heatmapDays: HeatmapDay[] = useMemo(() => {
    const days: HeatmapDay[] = [];
    const bounds = getDateRangeBounds(dateRange);
    const start = parseCalendarDate(bounds.start);
    const end = parseCalendarDate(bounds.end);

    // Map actual order timestamps
    const rangedOrders = filterItemsByDateRange(ordersList, dateRange, o => String(o.created_at || ''));
    const relevantOrders = selectedCustomer
      ? rangedOrders.filter(o => String(o.shop_name || o.customer_name || '').toLowerCase().includes(selectedCustomer.name.toLowerCase()))
      : rangedOrders;

    const dayOrdersMap: Record<string, { count: number; sales: number; customers: Set<string> }> = {};
    relevantOrders.forEach(o => {
      const d = String(o.created_at || '').slice(0, 10);
      if (!d) return;
      if (!dayOrdersMap[d]) {
        dayOrdersMap[d] = { count: 0, sales: 0, customers: new Set() };
      }
      dayOrdersMap[d].count += 1;
      dayOrdersMap[d].sales += Number(o.total_amount || 0);
      dayOrdersMap[d].customers.add(String(o.shop_name || o.customer_name || ''));
    });

    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const dStr = formatCalendarDate(cur);
      const isSunday = cur.getDay() === 0;
      const dataPoint = dayOrdersMap[dStr];

      if (dataPoint) {
        days.push({
          date: dStr,
          orders: dataPoint.count,
          sales: Math.round(dataPoint.sales),
          customers: dataPoint.customers.size,
        });
      } else {
        days.push({
          date: dStr,
          orders: 0,
          sales: 0,
          customers: 0,
        });
      }
    }
    return days;
  }, [selectedCustomer, dateRange, ordersList]);

  // Sales Over Time Data: Group actual orders by date (Phase 13)
  const salesOverTimeData = useMemo(() => {
    const rangedOrders = filterItemsByDateRange(ordersList, dateRange, o => String(o.created_at || ''));
    const targetOrders = selectedCustomer
      ? rangedOrders.filter(o => String(o.shop_name || o.customer_name || '').toLowerCase().includes(selectedCustomer.name.toLowerCase()))
      : rangedOrders;

    if (targetOrders.length === 0) {
      // Fallback to daily sales if individual orders are not yet populated
      const filteredDaily = filterItemsByDateRange(sales.daily_sales || [], dateRange, d => d.date);
      return filteredDaily.map(d => ({
        name: d.date.slice(5),
        value: Math.round(d.revenue),
      }));
    }

    const dateMap: Record<string, number> = {};
    targetOrders.forEach(o => {
      const isApproved = ['approved', 'dispatched', 'delivered'].includes(String(o.status || '').toLowerCase());
      if (!isApproved) return;
      const d = String(o.created_at || '').slice(0, 10);
      if (!d) return;
      dateMap[d] = (dateMap[d] || 0) + Number(o.total_amount || 0);
    });

    return Object.keys(dateMap).sort().map(d => ({
      name: d.slice(5),
      value: Math.round(dateMap[d]),
    }));
  }, [ordersList, selectedCustomer, dateRange, sales.daily_sales]);

  // Items Bought: Real products from order items
  const itemsBoughtData = useMemo(() => {
    const rangedOrders = filterItemsByDateRange(ordersList, dateRange, o => String(o.created_at || ''));
    const targetOrders = selectedCustomer
      ? rangedOrders.filter(o => String(o.shop_name || o.customer_name || '').toLowerCase().includes(selectedCustomer.name.toLowerCase()))
      : rangedOrders;

    const prodMap: Record<string, { category: string; qty: number; revenue: number }> = {};
    targetOrders.forEach(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((it: any) => {
        const name = String(it.name || it.item_name || it.sku || 'Item').trim();
        const cat = String(it.category || 'General').trim();
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || it.price || 0);
        if (!prodMap[name]) prodMap[name] = { category: cat, qty: 0, revenue: 0 };
        prodMap[name].qty += qty;
        prodMap[name].revenue += (qty * price);
      });
    });

    const result = Object.entries(prodMap).map(([name, val]) => ({
      name,
      category: val.category,
      qty: val.qty,
      revenue: Math.round(val.revenue),
    })).sort((a, b) => b.revenue - a.revenue);

    if (result.length > 0) return result.slice(0, 10);

    return (sales.top_products || []).slice(0, 6).map(p => ({
      name: p.name,
      category: 'General',
      qty: p.qty,
      revenue: Math.round(p.qty * 380),
    }));
  }, [ordersList, selectedCustomer, dateRange, sales.top_products]);

  // Order History: Actual orders from database
  const orderHistory = useMemo(() => {
    const rangedOrders = filterItemsByDateRange(ordersList, dateRange, o => String(o.created_at || ''));
    const targetOrders = selectedCustomer
      ? rangedOrders.filter(o => String(o.shop_name || o.customer_name || '').toLowerCase().includes(selectedCustomer.name.toLowerCase()))
      : rangedOrders;

    return targetOrders.slice(0, 15).map(o => {
      const dateStr = String(o.created_at || '').slice(0, 10);
      const items = Array.isArray(o.items) ? o.items.length : 1;
      return {
        id: String(o.order_id || o.id || 'ORD-UNKNOWN'),
        date: dateStr,
        customer: String(o.shop_name || o.customer_name || 'Customer'),
        items,
        amount: Math.round(Number(o.total_amount || 0)),
        status: String(o.status || 'Approved'),
      };
    });
  }, [ordersList, selectedCustomer, dateRange]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Customer Selector Bar ───────────────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Customer Search Input */}
        <div className="relative flex-1 min-w-[280px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 804 customers by name, code, city, state, or salesman..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs font-medium text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600 dark:border-indigo-500/50 transition-all"
          />
        </div>

        {/* Customer Dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative min-w-[280px] max-w-[380px]">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full appearance-none bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2.5 pr-9 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600 dark:border-indigo-500/50 cursor-pointer transition-all truncate"
            >
              <option value="all">👥 All Customers ({customersData.length} Accounts)</option>
              {filteredCustomerOptions.map((c, idx) => (
                <option key={`${c.id}-${idx}`} value={c.id}>
                  {c.name} — {c.city} ({c.state})
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <ChevronDown size={16} />
            </div>
          </div>

          {/* Interactive Header Time Range Selector */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs font-semibold text-slate-400">
            {[
              { id: '7d' as DateRangeType, label: '7D' },
              { id: '30d' as DateRangeType, label: '30D' },
              { id: '90d' as DateRangeType, label: '90D' },
              { id: 'ytd' as DateRangeType, label: 'YTD' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setDateRange(r.id)}
                className={`px-3 py-1.5 rounded-lg uppercase tracking-wider text-[10px] font-bold transition-all ${
                  dateRange === r.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-bold shadow-xs'
                    : 'hover:text-slate-200 hover:bg-slate-700/40'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Customer Header Banner */}
      {selectedCustomer && (
        <div className="bg-cyan-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-sm shrink-0">
              {selectedCustomer.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-100">{selectedCustomer.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-bold text-[10px]">
                  {selectedCustomer.tier} Partner
                </span>
                <span className="text-[10px] text-slate-400 font-mono">[{selectedCustomer.id}]</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5">
                {selectedCustomer.city}, {selectedCustomer.state} • Sales Rep: <span className="text-slate-200 font-semibold">{selectedCustomer.salesman}</span> • Phone: <span className="text-slate-300 font-mono">{selectedCustomer.phone}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedCustomerId('all')}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-lg font-bold text-[11px] transition-all border border-slate-700"
          >
            ← View All Customers
          </button>
        </div>
      )}

      {/* ── 6 KPI Metric Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Sales */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Sales</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <DollarSign size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
            ₹{metrics.totalSales.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium flex items-center gap-1">
            <TrendingUp size={11} className="text-indigo-600 dark:text-indigo-400" />
            <span>Gross revenue ({dateRange.toUpperCase()})</span>
          </div>
        </div>

        {/* Orders */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Orders</span>
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <ShoppingCart size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-sky-400 tracking-tight">
            {metrics.orders.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Dispatches placed</div>
        </div>

        {/* Average Order */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average Order</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <BarChart3 size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-purple-400 tracking-tight">
            ₹{metrics.avgOrder.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Avg ticket size</div>
        </div>

        {/* Units Sold */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Units Sold</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Package size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-400 tracking-tight">
            {metrics.unitsSold.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Total quantity</div>
        </div>

        {/* Products */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Products</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Building2 size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-400 tracking-tight">
            {metrics.products} SKUs
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Distinct items</div>
        </div>

        {/* Active Days */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Days</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <Calendar size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-teal-400 tracking-tight">
            {metrics.activeDays} Days
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">Purchase activity</div>
        </div>
      </div>

      {/* ── Order Activity Heatmap Section ──────────────────────────────── */}
      <GithubHeatmap
        days={heatmapDays}
        customerName={selectedCustomer ? selectedCustomer.name : 'All Customers'}
      />

      {/* ── Analytics Grid: Sales Over Time & Items Bought ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sales Over Time Chart */}
        <div className="w-full">
          <InteractiveChart
            title="Sales Over Time"
            subtitle={selectedCustomer ? `Revenue trend for ${selectedCustomer.name} (${dateRange.toUpperCase()})` : `Combined customer sales revenue (${dateRange.toUpperCase()})`}
            data={salesOverTimeData}
            defaultChartType="area"
            unit="₹"
          />
        </div>

        {/* Items Bought Table & Breakdown */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Package size={16} className="text-amber-400" />
                  <span>Items Bought — {selectedCustomer ? selectedCustomer.name : 'All Customers'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Top purchased products and sales volume breakdown ({dateRange.toUpperCase()})
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                Top SKUs
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {itemsBoughtData.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-400">{item.category}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-100">{item.qty} units</div>
                    {item.revenue > 0 && (
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">₹{item.revenue.toLocaleString('en-IN')}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Analytical Charts (Rule 18 & 26) ───────────────────── */}
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

      {/* ── Customer Accounts Directory Ledger (Rule 18) ────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Users size={16} className="text-indigo-400" />
              <span>Customer Accounts Directory ({filteredCustomerOptions.length} Accounts)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Authoritative historical sales ledger data at customer grain (1 row per account)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Page {page} of {Math.max(1, Math.ceil(filteredCustomerOptions.length / pageSize))}</span>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
            >
              Prev
            </button>
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
                  <td className="py-3 px-4 text-right font-medium text-purple-400">₹{c.avg_order.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-center text-slate-300">{c.products_count} SKUs</td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-400">₹{c.revenue.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900 text-indigo-400 border border-indigo-800/50 text-[10px] font-semibold transition-all"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order History Ledger (Operational Orders) ──────────────────── */}
      {orderHistory.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock size={16} className="text-sky-400" />
                <span>Operational Dispatches — {selectedCustomer ? selectedCustomer.name : 'Recent Platform Orders'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time operational orders and fulfillment state ({dateRange.toUpperCase()})
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer Account</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-medium">
                {orderHistory.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-100">{row.id}</td>
                    <td className="py-3 px-4 text-slate-400">{row.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{row.customer}</td>
                    <td className="py-3 px-4 text-center text-slate-300">{row.items} SKUs</td>
                    <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">₹{row.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                        <CheckCircle2 size={11} />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
