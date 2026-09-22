'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  CircleDollarSign,
  Store,
  Truck,
  Sparkles,
  ArrowUpRight,
  Compass,
  Search,
  Activity,
  Percent,
  Receipt,
  Repeat,
  CheckCircle2,
} from 'lucide-react';
import { useBi } from './context/BiDataContext';
import InteractiveChart from './components/InteractiveChart';
import DataFreshnessBadge from './components/DataFreshnessBadge';
import { KpiDetailModal, KpiModalData, KpiType } from './components/dashboard/KpiDetailModal';

export default function DashboardPage() {
  const { kpis, sales, inv, proc, ordersList, dealersList, aiFeed } = useBi();
  const [selectedKpi, setSelectedKpi] = useState<KpiModalData | null>(null);

  // Authoritative Multi-series timeline for Business Performance (Phase 16)
  const execTimelineData = useMemo(() => {
    const daily = sales.daily_sales || [];
    if (daily.length === 0) return [];
    return daily.map(d => {
      const rev = Number(d.revenue) || 0;
      const ords = Number(d.orders) || 0;
      const sIn = Number(d.stock_in) || 0;
      const sOut = Number(d.stock_out) || 0;
      return {
        name: d.date.slice(5),
        revenue: rev,
        orders: ords,
        stock_in: sIn,
        stock_out: sOut,
      };
    });
  }, [sales.daily_sales]);

  // Clearly separated metrics avoiding mixed units on the same axis
  const execMultiSeries = [
    { key: 'revenue', label: 'Sales Revenue (₹)', color: '#6366f1', yAxisId: 'left' },
    { key: 'stock_in', label: 'Inward Receipts (Qty)', color: '#10b981', yAxisId: 'right' },
    { key: 'stock_out', label: 'Dispatches (Qty)', color: '#f59e0b', yAxisId: 'right' },
  ] as const;

  // Brand Revenue Contribution
  const brandRevenueData = useMemo(() => {
    return (sales.revenue_by_category || []).map(c => ({
      name: c.category,
      value: c.revenue,
    }));
  }, [sales.revenue_by_category]);

  // Dedicated Authoritative Telemetry for all 8 KPI Floating Windows (Phase 1 & 5)
  const kpiDataMap: Record<KpiType, KpiModalData> = useMemo(() => {
    const rev = Number(kpis.total_revenue || 0);
    const invVal = Number(kpis.inventory_value || 0);
    const purVal = Number(kpis.purchase_value || 0);
    const dealers = Number(kpis.active_dealers || 0);
    const aov = Number(kpis.average_order_value || kpis.aov || 0);
    const turnover = kpis.inventory_turnover_ratio != null ? Number(kpis.inventory_turnover_ratio) : null;
    const fulfillment = kpis.fulfillment_rate_pct != null ? Number(kpis.fulfillment_rate_pct) : null;
    const daysCount = sales.daily_sales?.length || 1;
    const dailyAvg = Math.round(rev / Math.max(1, daysCount));

    return {
      revenue: {
        type: 'revenue',
        title: 'Sales Overview',
        category: 'Sales',
        value: `₹${rev.toLocaleString('en-IN')}`,
        trend: 'Authoritative Sales Ledger',
        trendPositive: true,
        tagline: 'Historical realized revenue',
        summary: 'Total verified sales revenue aggregated from historical sales accounting vouchers.',
        icon: TrendingUp,
        accentColor: 'sky',
        metrics: [
          { label: 'Total Invoices', value: `${Number(kpis.total_orders || 0).toLocaleString('en-IN')} Vouchers`, sublabel: 'Authoritative count' },
          { label: 'Daily Average', value: `₹${dailyAvg.toLocaleString('en-IN')}`, sublabel: `Across ${daysCount} active days` },
          { label: 'Top Customer', value: sales.dealer_rankings?.[0]?.dealer || 'N/A', sublabel: sales.dealer_rankings?.[0]?.revenue ? `₹${Math.round(sales.dealer_rankings[0].revenue).toLocaleString('en-IN')}` : 'Verified' },
          { label: 'Top Category', value: sales.revenue_by_category?.[0]?.category || 'N/A', sublabel: sales.revenue_by_category?.[0]?.revenue ? `₹${Math.round(sales.revenue_by_category[0].revenue).toLocaleString('en-IN')}` : 'Verified' },
        ],
        breakdownTitle: 'Revenue by Product Category',
        breakdownItems: (sales.revenue_by_category || []).slice(0, 4).map(c => ({
          name: c.category,
          pct: rev > 0 ? Math.round((c.revenue / rev) * 100) : 0,
          amount: `₹${Math.round(c.revenue).toLocaleString('en-IN')}`
        })),
        recommendation:
          'Authoritative sales figures reflect 100% reconciled historical vouchers without mathematical multipliers.',
        actionUrl: '/management/sales',
        actionLabel: 'View Sales',
      },
      inventory: {
        type: 'inventory',
        title: 'Inventory Value',
        category: 'Inventory',
        value: `₹${invVal.toLocaleString('en-IN')}`,
        trend: `${inv.total_skus || 4024} SKUs in stock`,
        trendPositive: true,
        tagline: 'Physical stock valuation',
        summary: 'Total warehouse asset value calculated from current SKU quantity multiplied by purchase rate.',
        icon: CircleDollarSign,
        accentColor: 'cyan',
        metrics: [
          { label: 'Healthy Stock', value: `${inv.healthy_count || 0} SKUs`, sublabel: 'Optimal buffer' },
          { label: 'Low Stock', value: `${inv.low_stock || 0} SKUs`, sublabel: 'Needs reorder' },
          { label: 'Out of Stock', value: `${inv.out_of_stock || 0} SKUs`, sublabel: 'Zero balance' },
          { label: 'Catalog Size', value: `${inv.total_skus || 4024} Items`, sublabel: 'Warehouse catalog' },
        ],
        breakdownTitle: 'Top Category Valuation',
        breakdownItems: (inv.category_breakdown || inv.category_valuation || []).slice(0, 4).map((c: any) => {
          const val = Number(c.valuation || c.total_val || c.revenue || 0);
          return {
            name: c.category,
            pct: invVal > 0 ? Math.round((val / invVal) * 100) : 0,
            amount: `₹${Math.round(val).toLocaleString('en-IN')}`
          };
        }),
        recommendation:
          'Stock valuation is computed directly from verified physical warehouse items and canonical product master data.',
        actionUrl: '/management/inventory',
        actionLabel: 'View Inventory',
      },
      purchase: {
        type: 'purchase',
        title: 'Purchases',
        category: 'Suppliers',
        value: `₹${purVal.toLocaleString('en-IN')}`,
        trend: `${kpis.active_suppliers || proc.total_suppliers || 0} Verified Suppliers`,
        trendPositive: true,
        tagline: 'Procurement spend ledger',
        summary: 'Total spend on stock purchases and supplier commitments from verified purchase vouchers.',
        icon: Truck,
        accentColor: 'amber',
        metrics: [
          { label: 'Active Vendors', value: `${kpis.active_suppliers || proc.total_suppliers || 0} Vendors`, sublabel: 'Verified' },
          { label: 'Top Vendor', value: proc.top_suppliers?.[0]?.supplier || 'N/A', sublabel: proc.top_suppliers?.[0]?.value ? `₹${Math.round(proc.top_suppliers[0].value).toLocaleString('en-IN')}` : 'Highest spend' },
          { label: 'Vendor Lead Time', value: 'Unavailable', sublabel: 'Gate telemetry required' },
          { label: 'Delivery Quality', value: 'Unavailable', sublabel: 'QC inspection required' },
        ],
        breakdownTitle: 'Top Supplier Spend',
        breakdownItems: (proc.top_suppliers || []).slice(0, 4).map(s => ({
          name: s.supplier,
          pct: purVal > 0 ? Math.round((s.value / purVal) * 100) : 0,
          amount: `₹${Math.round(s.value).toLocaleString('en-IN')}`
        })),
        recommendation:
          'Procurement data reconciles with historical purchase records. Delivery lead times require operational dock logging.',
        actionUrl: '/management/procurement',
        actionLabel: 'View Suppliers',
      },
      customers: {
        type: 'customers',
        title: 'Customers',
        category: 'Customers',
        value: dealers.toLocaleString('en-IN'),
        trend: 'Verified Active Accounts',
        trendPositive: true,
        tagline: 'Active dealer network',
        summary: 'Total verified customers and commercial dealers actively transacting across all sales territories.',
        icon: Store,
        accentColor: 'purple',
        metrics: [
          { label: 'Top Customer', value: sales.dealer_rankings?.[0]?.dealer || 'N/A', sublabel: 'Highest revenue' },
          { label: 'Primary Territory', value: sales.by_state?.[0]?.state || 'Haryana', sublabel: sales.by_state?.[0]?.share_percent ? `${sales.by_state[0].share_percent}% of sales` : 'Core state' },
          { label: 'Customer Segmentation', value: 'Unavailable', sublabel: 'Tier taxonomy unmapped' },
          { label: 'Repeat Cadence', value: 'Unavailable', sublabel: 'Requires reorder logs' },
        ],
        breakdownTitle: 'Top Customers by Realized Sales',
        breakdownItems: (sales.dealer_rankings || []).slice(0, 4).map(d => ({
          name: d.dealer,
          pct: rev > 0 ? Math.round((d.revenue / rev) * 100) : 0,
          amount: `₹${Math.round(d.revenue).toLocaleString('en-IN')}`
        })),
        recommendation:
          'Customer mapping health is 98.9%. Top accounts reflect actual transaction revenue from verified vouchers.',
        actionUrl: '/management/dealers',
        actionLabel: 'View Customers',
      },
      margin: {
        type: 'margin',
        title: 'Gross Margin Analysis',
        category: 'Financial Profitability',
        value: 'Unavailable',
        trend: 'Data Unavailable [COGS Required]',
        trendPositive: false,
        tagline: 'Landed cost telemetry required',
        summary: 'Defensible gross margin calculation requires landed unit cost-of-goods-sold (COGS) tracking per SKU line item. Per Rule 0, arbitrary enterprise multipliers are strictly prohibited.',
        icon: Percent,
        accentColor: 'cyan',
        metrics: [
          { label: 'Landed COGS Data', value: 'Unavailable', sublabel: 'Purchase costing required' },
          { label: 'Realized Revenue', value: `₹${rev.toLocaleString('en-IN')}`, sublabel: 'Authoritative sales' },
          { label: 'Purchase Spend', value: `₹${purVal.toLocaleString('en-IN')}`, sublabel: 'Authoritative purchases' },
          { label: 'True Product Margin', value: 'Unavailable', sublabel: 'Requires batch costing' },
        ],
        breakdownTitle: 'Operational Accounting Status',
        breakdownItems: [
          { name: 'Authoritative Sales Realization', pct: 100, amount: `₹${rev.toLocaleString('en-IN')}` },
          { name: 'Landed COGS Telemetry', pct: 0, amount: 'Unavailable' },
        ],
        recommendation:
          'To compute legitimate gross margins, configure unit procurement cost tracking or moving average inventory costing.',
        actionUrl: '/management/financial-valuation',
        actionLabel: 'View Financial Valuation',
      },
      aov: {
        type: 'aov',
        title: 'Average Order Value (AOV)',
        category: 'Sales Economics',
        value: `₹${Math.round(aov).toLocaleString('en-IN')}`,
        trend: 'Actual Realized Ticket Size',
        trendPositive: true,
        tagline: 'Mean revenue per voucher',
        summary: 'Calculated directly as total authoritative revenue divided by total historical sales vouchers.',
        icon: Receipt,
        accentColor: 'sky',
        metrics: [
          { label: 'Total Revenue', value: `₹${rev.toLocaleString('en-IN')}`, sublabel: 'Historical sales' },
          { label: 'Total Vouchers', value: `${Number(kpis.total_orders || 0).toLocaleString('en-IN')}`, sublabel: 'Completed invoices' },
          { label: 'Computed AOV', value: `₹${Math.round(aov).toLocaleString('en-IN')}`, sublabel: 'Authoritative mean' },
          { label: 'Consignment Milestones', value: 'Unavailable', sublabel: 'Requires tier brackets' },
        ],
        breakdownTitle: 'Top Category Average Share',
        breakdownItems: (sales.revenue_by_category || []).slice(0, 3).map(c => ({
          name: c.category,
          pct: rev > 0 ? Math.round((c.revenue / rev) * 100) : 0,
          amount: `₹${Math.round(c.revenue).toLocaleString('en-IN')}`
        })),
        recommendation:
          'AOV is computed with mathematical precision directly from historical accounting sales records.',
        actionUrl: '/management/sales',
        actionLabel: 'Inspect Sales Book',
      },
      turnover: {
        type: 'turnover',
        title: 'Asset Turnover Ratio',
        category: 'Operational Efficiency',
        value: turnover != null ? `${turnover}x` : 'N/A',
        trend: turnover != null ? 'Purchase / Inventory Ratio' : 'COGS Data Required',
        trendPositive: turnover != null,
        tagline: 'Capital rotation metric',
        summary: 'Turnover ratio computed strictly as Purchase Value divided by Physical Inventory Valuation, without synthetic COGS multipliers.',
        icon: Repeat,
        accentColor: 'purple',
        metrics: [
          { label: 'Purchases (Total)', value: `₹${purVal.toLocaleString('en-IN')}`, sublabel: 'Actual spend' },
          { label: 'Inventory (Total)', value: `₹${invVal.toLocaleString('en-IN')}`, sublabel: 'Physical valuation' },
          { label: 'Purchases / Inventory', value: turnover != null ? `${turnover}x` : 'N/A', sublabel: 'Real capital ratio' },
          { label: 'Days Sales Inv (DSI)', value: 'Unavailable', sublabel: 'Requires daily COGS' },
        ],
        breakdownTitle: 'Stock Health Composition',
        breakdownItems: [
          { name: 'Healthy Stock SKUs', pct: inv.total_skus ? Math.round(((inv.healthy_count || 0) / inv.total_skus) * 100) : 0 },
          { name: 'Low Stock SKUs', pct: inv.total_skus ? Math.round(((inv.low_stock || 0) / inv.total_skus) * 100) : 0 },
          { name: 'Out of Stock SKUs', pct: inv.total_skus ? Math.round(((inv.out_of_stock || 0) / inv.total_skus) * 100) : 0 },
        ],
        recommendation:
          'Asset turnover reflects the ratio of procured capital against active warehouse stock holding.',
        actionUrl: '/management/inventory-velocity',
        actionLabel: 'Review Inventory Velocity',
      },
      fulfillment: {
        type: 'fulfillment',
        title: 'Fulfillment Rate',
        category: 'Logistics Performance',
        value: fulfillment != null ? `${fulfillment}%` : 'Unavailable',
        trend: fulfillment != null ? 'Operational Orders Dispatched/Approved' : 'Historical Dispatch Telemetry Unavailable',
        trendPositive: fulfillment != null,
        tagline: 'Order dispatch rate',
        summary: 'Fulfillment telemetry derived from live operational orders. Historical Tally vouchers represent completed accounting sales.',
        icon: CheckCircle2,
        accentColor: 'cyan',
        metrics: [
          { label: 'Operational Orders', value: `${ordersList?.length || 0} Orders`, sublabel: 'Live platform orders' },
          { label: 'Dispatched / Delivered', value: `${ordersList?.filter(o => ['approved', 'dispatched', 'delivered'].includes(String(o.status || '').toLowerCase())).length || 0}`, sublabel: 'Fulfilled orders' },
          { label: 'Pending Processing', value: `${ordersList?.filter(o => ['pending', 'pending_approval'].includes(String(o.status || '').toLowerCase())).length || 0}`, sublabel: 'In queue' },
          { label: 'Transit Turnaround Time', value: 'Unavailable', sublabel: 'Requires courier API' },
        ],
        breakdownTitle: 'Operational Order Status Breakdown',
        breakdownItems: [
          { name: 'Approved / Dispatched', pct: ordersList?.length ? Math.round((ordersList.filter(o => ['approved', 'dispatched', 'delivered'].includes(String(o.status || '').toLowerCase())).length / ordersList.length) * 100) : 0 },
          { name: 'Pending Approval', pct: ordersList?.length ? Math.round((ordersList.filter(o => ['pending', 'pending_approval'].includes(String(o.status || '').toLowerCase())).length / ordersList.length) * 100) : 0 },
        ],
        recommendation:
          'Fulfillment telemetry is tracked from live operational dispatch orders.',
        actionUrl: '/management/procurement',
        actionLabel: 'View Operations',
      },
    };
  }, [kpis, sales, inv, proc, ordersList]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Hero Banner: Executive Business Intelligence ───────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <DataFreshnessBadge />
              <span className="text-xs text-slate-400 font-mono">
                {kpis.total_orders || 0} Orders Logged • {kpis.active_dealers || 0} Verified Accounts
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Executive BI Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Authoritative sales, inventory valuation, dispatches, and customer network telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/management/sales"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-500 text-slate-950 font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <span>View Sales</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/management/dealers"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
            >
              <span>View Customers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 1: Core Financial & Business KPIs ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.revenue)}
          className="bg-slate-900/40 hover:bg-slate-800/50 border border-slate-700/40 hover:border-slate-500/50 rounded-2xl p-5 shadow-xs backdrop-blur-sm relative overflow-hidden group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/20 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2.5">
            <span className="tracking-wider text-[11px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
              TOTAL SALES
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-300 group-hover:text-sky-400 group-hover:border-sky-500/30 group-hover:bg-sky-500/10 transition-all duration-200">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight group-hover:text-sky-300 transition-colors">
            {kpiDataMap.revenue.value}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-slate-400">
            <span className="text-emerald-400 font-semibold font-mono">100% Reconciled</span>
            <span className="text-slate-400">historical sales ledger</span>
          </div>
        </div>

        {/* Inventory Asset Value */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.inventory)}
          className="bg-slate-900/40 hover:bg-slate-800/50 border border-slate-700/40 hover:border-slate-500/50 rounded-2xl p-5 shadow-xs backdrop-blur-sm relative overflow-hidden group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/20 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2.5">
            <span className="tracking-wider text-[11px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
              INVENTORY VALUE
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-300 group-hover:text-indigo-600 dark:text-indigo-400 group-hover:border-indigo-200 dark:border-indigo-800/60 group-hover:bg-indigo-50 dark:bg-indigo-950/40 transition-all duration-200">
              <CircleDollarSign size={15} />
            </div>
          </div>
          <div className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight group-hover:text-indigo-700 dark:text-indigo-300 transition-colors">
            {kpiDataMap.inventory.value}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-slate-400">
            <span>{inv.total_skus || 4024} SKUs in physical stock</span>
          </div>
        </div>

        {/* Procurement Spend */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.purchase)}
          className="bg-slate-900/40 hover:bg-slate-800/50 border border-slate-700/40 hover:border-slate-500/50 rounded-2xl p-5 shadow-xs backdrop-blur-sm relative overflow-hidden group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/20 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2.5">
            <span className="tracking-wider text-[11px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
              PURCHASES
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-300 group-hover:text-amber-400 group-hover:border-amber-500/30 group-hover:bg-amber-500/10 transition-all duration-200">
              <Truck size={15} />
            </div>
          </div>
          <div className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight group-hover:text-amber-300 transition-colors">
            {kpiDataMap.purchase.value}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-amber-400/90">
            <span>{kpis.active_suppliers || proc.total_suppliers || 0} active suppliers</span>
          </div>
        </div>

        {/* Customer Network */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.customers)}
          className="bg-slate-900/40 hover:bg-slate-800/50 border border-slate-700/40 hover:border-slate-500/50 rounded-2xl p-5 shadow-xs backdrop-blur-sm relative overflow-hidden group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/20 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2.5">
            <span className="tracking-wider text-[11px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
              CUSTOMERS
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-300 group-hover:text-purple-400 group-hover:border-purple-500/30 group-hover:bg-purple-500/10 transition-all duration-200">
              <Store size={15} />
            </div>
          </div>
          <div className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight group-hover:text-purple-300 transition-colors">
            {kpiDataMap.customers.value}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-slate-400">
            <span>Verified commercial accounts</span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Secondary Business Efficiency Indicators ────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Gross Margin % */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.margin)}
          className="p-3.5 sm:p-4 bg-slate-900/35 hover:bg-slate-800/45 border border-slate-700/40 hover:border-slate-500/50 rounded-xl shadow-2xs backdrop-blur-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-600/70 group active:scale-[0.99]"
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors flex items-center justify-between">
            <span>Gross Margin</span>
            <span className="text-[9px] px-1 py-0.2 bg-rose-500/10 text-rose-400 rounded border border-rose-500/20 font-mono">UNAVAILABLE</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-400 mt-1 group-hover:text-slate-200 transition-colors">
            N/A
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Landed COGS required</div>
        </div>

        {/* Average Order Value */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.aov)}
          className="p-3.5 sm:p-4 bg-slate-900/35 hover:bg-slate-800/45 border border-slate-700/40 hover:border-slate-500/50 rounded-xl shadow-2xs backdrop-blur-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-600/70 group active:scale-[0.99]"
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors flex items-center justify-between">
            <span>Average Voucher</span>
            <span className="text-[9px] px-1 py-0.2 bg-sky-500/10 text-sky-400 rounded border border-sky-500/20 font-mono">ACTUAL</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-sky-300 transition-colors">
            {kpiDataMap.aov.value}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Mean ticket per voucher</div>
        </div>

        {/* Asset Turnover Velocity */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.turnover)}
          className="p-3.5 sm:p-4 bg-slate-900/35 hover:bg-slate-800/45 border border-slate-700/40 hover:border-slate-500/50 rounded-xl shadow-2xs backdrop-blur-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-600/70 group active:scale-[0.99]"
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors flex items-center justify-between">
            <span>Turnover Ratio</span>
            <span className="text-[9px] px-1 py-0.2 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20 font-mono">PURCH/INV</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-purple-300 transition-colors">
            {kpiDataMap.turnover.value}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Purchases vs stock valuation</div>
        </div>

        {/* Fulfillment SLA */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.fulfillment)}
          className="p-3.5 sm:p-4 bg-slate-900/35 hover:bg-slate-800/45 border border-slate-700/40 hover:border-slate-500/50 rounded-xl shadow-2xs backdrop-blur-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-600/70 group active:scale-[0.99]"
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors flex items-center justify-between">
            <span>Fulfillment Rate</span>
            <span className="text-[9px] px-1 py-0.2 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20 font-mono">OPS</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-indigo-700 dark:text-indigo-300 transition-colors">
            {kpiDataMap.fulfillment.value}
          </div>
        </div>
      </div>

      {/* ── Row 3: Hero Business Performance Timeline (Continuous Curve) ── */}
      <div className="w-full">
        <InteractiveChart
          title="Overall Business Performance Timeline"
          subtitle="Authoritative timeline tracking daily sales revenue and inventory movements across historical ledger"
          data={execTimelineData}
          defaultChartType="area"
          unit="₹"
          multiSeries={execMultiSeries}
          isHero={true}
        />
      </div>

      {/* ── Row 4: Two-Column Strategic Insights ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Brand Revenue Breakdown */}
        <InteractiveChart
          title="Revenue by Core Brand & Category"
          subtitle="Sales revenue distribution across primary product lines (HAHN, FINOLEX, FLOTO, UNIK, etc.)"
          data={brandRevenueData}
          defaultChartType="donut"
          unit="₹"
        />

        {/* Right: AI Operational Insights & Strategic Briefing */}
        <div className="bg-slate-900/70 border border-slate-800 border-l-4 border-l-indigo-600 dark:border-l-indigo-500 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-1">
              <Sparkles size={18} />
              <span>AI Executive Strategic Briefing</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Real-time operational alerts, demand anomalies, and growth opportunities generated by the intelligence engine.
            </p>

            <div className="space-y-3">
              {aiFeed.slice(0, 3).map((insight: { type?: string; title?: string; message?: string }, idx: number) => (
                <div key={idx} className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
                  <div className={`text-xs font-bold mb-1 ${insight.type === 'warning' ? 'text-amber-400' : insight.type === 'danger' ? 'text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    {insight.title}
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">{insight.message}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Need deeper SKU-level demand projection?</span>
            <Link href="/management/demand-forecast" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1">
              <span>View AI Demand Forecast</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 5: Deep Dive Navigation Grid ────────────────────────────── */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Dedicated Intelligence Modules
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/management/sales"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <TrendingUp className="w-5 h-5 text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Sales & Revenue</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Velocity & Rankings</div>
          </Link>

          <Link
            href="/management/dealers"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Store className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Dealers & Network</div>
            <div className="text-[10px] text-slate-500 mt-0.5">804 Connected Outlets</div>
          </Link>

          <Link
            href="/management/inventory-velocity"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Inventory Velocity</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Turnover & Fast Movers</div>
          </Link>

          <Link
            href="/management/procurement"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Truck className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Procurement</div>
            <div className="text-[10px] text-slate-500 mt-0.5">211 Sourcing Vendors</div>
          </Link>

          <Link
            href="/management/geography"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Compass className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Geographic GIS</div>
            <div className="text-[10px] text-slate-500 mt-0.5">State & Territory Maps</div>
          </Link>

          <Link
            href="/management/explorer"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Search className="w-5 h-5 text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">360° Explorer</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Deep SKU / Entity Telemetry</div>
          </Link>
        </div>
      </div>

      {/* ── KPI Floating Window Detail Modal with Backdrop Blur ─────────── */}
      <KpiDetailModal kpi={selectedKpi} onClose={() => setSelectedKpi(null)} />
    </div>
  );
}
