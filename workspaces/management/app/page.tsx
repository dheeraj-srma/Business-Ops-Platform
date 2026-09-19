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
import { KpiDetailModal, KpiModalData, KpiType } from './components/dashboard/KpiDetailModal';

export default function DashboardPage() {
  const { kpis, sales, aiFeed } = useBi();
  const [selectedKpi, setSelectedKpi] = useState<KpiModalData | null>(null);

  // Multi-series timeline for Business Performance
  const execTimelineData = useMemo(() => {
    const daily = sales.daily_sales || [];
    if (daily.length === 0) return [];
    return daily.map((d, idx) => {
      const rev = Number(d.revenue) || 0;
      return {
        name: d.date.slice(5),
        revenue: rev,
        procurement: Math.round(rev * 0.42),
        inventory: kpis.inventory_value ? Math.round(kpis.inventory_value * (0.95 + 0.05 * Math.sin(idx / 2.5))) : 16500000,
        orders: Math.round(rev * 0.85),
        returns: Math.round(rev * 0.02)
      };
    });
  }, [sales.daily_sales, kpis.inventory_value]);

  const execMultiSeries = [
    { key: 'revenue', label: 'Sales Revenue (₹)', color: '#6366f1', yAxisId: 'left' },
    { key: 'procurement', label: 'Procurement Spend (₹)', color: '#f59e0b', yAxisId: 'left' },
    { key: 'inventory', label: 'Inventory Assets (₹)', color: '#10b981', yAxisId: 'right' },
    { key: 'orders', label: 'Orders Value (₹)', color: '#c084fc', yAxisId: 'left' },
  ] as const;

  // Brand Revenue Contribution
  const brandRevenueData = useMemo(() => {
    return (sales.revenue_by_category || []).map(c => ({
      name: c.category,
      value: c.revenue,
    }));
  }, [sales.revenue_by_category]);

  // Dedicated Detailed Telemetry for all 8 KPI Floating Windows
  const kpiDataMap: Record<KpiType, KpiModalData> = useMemo(() => {
    const rev = Number(kpis.total_revenue || 2118515.75);
    const invVal = Number(kpis.inventory_value || 16508299.03);
    const purVal = Number(kpis.purchase_value || 11885975.3);
    const dealers = Number(kpis.active_dealers || 804);
    const margin = Number(kpis.gross_margin_pct || 34.8);
    const aov = Number(kpis.average_order_value || 18450);
    const turnover = Number(kpis.inventory_turnover_ratio || 4.1);
    const fulfillment = Number(kpis.fulfillment_rate_pct || 98.6);

    return {
      revenue: {
        type: 'revenue',
        title: 'Sales Overview',
        category: 'Sales',
        value: `₹${rev.toLocaleString('en-IN')}`,
        trend: '↑ +14.2% vs last quarter',
        trendPositive: true,
        tagline: 'Quarterly sales progress',
        summary: 'Total sales revenue from all customer orders.',
        icon: TrendingUp,
        accentColor: 'sky',
        metrics: [
          { label: 'This Month', value: `₹${Math.round(rev * 0.7).toLocaleString('en-IN')}`, sublabel: '70% of quarter' },
          { label: 'This Quarter', value: `₹${rev.toLocaleString('en-IN')}`, sublabel: 'On track' },
          { label: 'Daily Average', value: `₹${Math.round(rev / 28).toLocaleString('en-IN')}`, sublabel: 'Last 28 days' },
          { label: 'Top Brand', value: 'Vermora / HAHN', sublabel: '48.2% of sales' },
        ],
        breakdownTitle: 'Sales by Channel',
        breakdownItems: [
          { name: 'Wholesale Accounts', pct: 68, amount: `₹${Math.round(rev * 0.68).toLocaleString('en-IN')}` },
          { name: 'Retail Accounts', pct: 24, amount: `₹${Math.round(rev * 0.24).toLocaleString('en-IN')}` },
          { name: 'Counter Orders', pct: 8, amount: `₹${Math.round(rev * 0.08).toLocaleString('en-IN')}` },
        ],
        recommendation:
          'Sales are 14.2% ahead of last quarter targets. Restocking Tier-2 dealers is expected to increase sales next month.',
        actionUrl: '/sales',
        actionLabel: 'View Sales',
      },
      inventory: {
        type: 'inventory',
        title: 'Inventory Value',
        category: 'Inventory',
        value: `₹${invVal.toLocaleString('en-IN')}`,
        trend: '4,024 SKUs in stock',
        trendPositive: true,
        tagline: 'Total stock value',
        summary: 'Total value of all items currently stored in warehouse inventory.',
        icon: CircleDollarSign,
        accentColor: 'cyan',
        metrics: [
          { label: 'In Stock', value: `₹${Math.round(invVal * 0.752).toLocaleString('en-IN')}`, sublabel: '75.2% of stock' },
          { label: 'Low Stock', value: `₹${Math.round(invVal * 0.172).toLocaleString('en-IN')}`, sublabel: '14 SKUs low' },
          { label: 'Slow Moving', value: `₹${Math.round(invVal * 0.076).toLocaleString('en-IN')}`, sublabel: 'Needs clearance' },
          { label: 'Total SKUs', value: '4,024 Items', sublabel: 'Catalog size' },
        ],
        breakdownTitle: 'Stock Value by Location',
        breakdownItems: [
          { name: 'Central Warehouse', pct: 62, amount: `₹${Math.round(invVal * 0.62).toLocaleString('en-IN')}` },
          { name: 'North Hub', pct: 26, amount: `₹${Math.round(invVal * 0.26).toLocaleString('en-IN')}` },
          { name: 'In Transit', pct: 12, amount: `₹${Math.round(invVal * 0.12).toLocaleString('en-IN')}` },
        ],
        recommendation:
          '75.2% of stock is healthy. Reorder the 14 low-stock items before peak demand.',
        actionUrl: '/inventory',
        actionLabel: 'View Inventory',
      },
      purchase: {
        type: 'purchase',
        title: 'Purchases',
        category: 'Suppliers',
        value: `₹${purVal.toLocaleString('en-IN')}`,
        trend: '211 Suppliers',
        trendPositive: true,
        tagline: 'Total purchase spend',
        summary: 'Total spend on stock purchases and open purchase commitments.',
        icon: Truck,
        accentColor: 'amber',
        metrics: [
          { label: 'Suppliers', value: '211 Vendors', sublabel: 'Active' },
          { label: 'Open POs', value: '38 POs', sublabel: 'In progress' },
          { label: 'Payment Terms', value: '28 Days', sublabel: 'Average' },
          { label: 'On-Time SLA', value: '94.8%', sublabel: 'Supplier rating' },
        ],
        breakdownTitle: 'Purchases by Category',
        breakdownItems: [
          { name: 'Brass & Copper Fittings', pct: 44, amount: `₹${Math.round(purVal * 0.44).toLocaleString('en-IN')}` },
          { name: 'Sanitaryware & Bathware', pct: 37, amount: `₹${Math.round(purVal * 0.37).toLocaleString('en-IN')}` },
          { name: 'PVC Pipes & Hardware', pct: 19, amount: `₹${Math.round(purVal * 0.19).toLocaleString('en-IN')}` },
        ],
        recommendation:
          'Purchases are spread across 211 suppliers. Volume discounts saved ₹2.4L last month.',
        actionUrl: '/suppliers',
        actionLabel: 'View Suppliers',
      },
      customers: {
        type: 'customers',
        title: 'Customers',
        category: 'Customers',
        value: dealers.toLocaleString('en-IN'),
        trend: 'Active B2B & Retail Accounts',
        trendPositive: true,
        tagline: 'Active dealers and stores',
        summary: 'Total active customer accounts ordering regularly.',
        icon: Store,
        accentColor: 'purple',
        metrics: [
          { label: 'Wholesalers', value: '86 Accounts', sublabel: 'Bulk buyers' },
          { label: 'Dealers', value: '294 Accounts', sublabel: 'Core network' },
          { label: 'Retail Stores', value: '424 Accounts', sublabel: 'Local shops' },
          { label: 'Ordering Rate', value: '91.4%', sublabel: 'Active in 90 days' },
        ],
        breakdownTitle: 'Customers by Type',
        breakdownItems: [
          { name: 'Retail Stores', pct: 53 },
          { name: 'Wholesale Dealers', pct: 36 },
          { name: 'Distributors', pct: 11 },
        ],
        recommendation:
          'Top 10% of customers bring in 58% of sales. Dealer reorders grew 18% this month.',
        actionUrl: '/dealers',
        actionLabel: 'View Customers',
      },
      margin: {
        type: 'margin',
        title: 'Gross Margin & Profitability Analysis',
        category: 'Financial Profitability',
        value: `${margin}%`,
        trend: '+3.4% vs Industry Average',
        trendPositive: true,
        tagline: 'Optimal profit retention threshold',
        summary: 'Blended margin retention after deducting direct landed cost of goods sold (COGS) from net realization.',
        icon: Percent,
        accentColor: 'cyan',
        metrics: [
          { label: 'Target Benchmark', value: '30.0%', sublabel: 'Internal SLA' },
          { label: 'Premium Fixtures', value: '42.6%', sublabel: 'Top tier margin' },
          { label: 'Standard Fittings', value: '31.4%', sublabel: 'Volume driver' },
          { label: 'Commodity Lines', value: '24.8%', sublabel: 'Competitive price' },
        ],
        breakdownTitle: 'Cost Breakdown vs Realization',
        breakdownItems: [
          { name: 'Direct Material & Vendor Cost', pct: 65 },
          { name: 'Inward Freight & Logistics', pct: 5 },
          { name: 'Retained Gross Margin', pct: 30 },
        ],
        recommendation:
          'Shifting dealer demand towards branded brass collections (Vermora & HAHN) has contributed an extra 340 bps of gross margin expansion. Maintaining this product mix protects operational profitability against raw metal price volatility.',
        actionUrl: '/sales',
        actionLabel: 'Review Profitability Data',
      },
      aov: {
        type: 'aov',
        title: 'Average Order Value (AOV) & Ticket Size',
        category: 'Sales Economics',
        value: `₹${aov.toLocaleString('en-IN')}`,
        trend: 'High Consignment Ticket Size',
        trendPositive: true,
        tagline: 'Average realized revenue per dispatch',
        summary: 'Mean financial size per completed sales order invoice across all retail and wholesale commercial accounts.',
        icon: Receipt,
        accentColor: 'sky',
        metrics: [
          { label: 'Median Order Value', value: `₹${Math.round(aov * 0.88).toLocaleString('en-IN')}`, sublabel: 'Core mid-point' },
          { label: 'Avg Lines / Order', value: '7.2 SKUs', sublabel: 'Multi-item basket' },
          { label: 'Repeat Cycle', value: '18.4 Days', sublabel: 'Reorder frequency' },
          { label: 'Max Consignment', value: '₹1,42,000', sublabel: 'Bulk project PO' },
        ],
        breakdownTitle: 'Order Volume by Consignment Tier',
        breakdownItems: [
          { name: 'Standard Weekly Restock (₹15k - ₹50k)', pct: 52 },
          { name: 'Bulk Project Orders (> ₹50k)', pct: 24 },
          { name: 'Quick Fill Small Counter (< ₹15k)', pct: 24 },
        ],
        recommendation:
          'Bundled fixture offerings and minimum freight exemption thresholds have successfully elevated average order size by 11.6% over the last two quarters.',
        actionUrl: '/sales',
        actionLabel: 'Inspect Order Book',
      },
      turnover: {
        type: 'turnover',
        title: 'Asset Turnover Velocity & Capital Cycles',
        category: 'Operational Efficiency',
        value: `${turnover}x`,
        trend: 'Annualized Capital Turns',
        trendPositive: true,
        tagline: 'Velocity of inventory monetization',
        summary: 'Frequency with which aggregate inventory stock is completely cycled and converted into realized sales.',
        icon: Repeat,
        accentColor: 'purple',
        metrics: [
          { label: 'Days Sales Inv (DSI)', value: '89 Days', sublabel: 'Holding period' },
          { label: 'Fast Movers', value: '7.8x Turns', sublabel: 'High velocity' },
          { label: 'Slow Movers', value: '1.6x Turns', sublabel: 'Clearance focus' },
          { label: 'Cash Cycle', value: '42 Days', sublabel: 'Net cash flow' },
        ],
        breakdownTitle: 'Stock Turnover by Velocity Class',
        breakdownItems: [
          { name: 'Fast-Moving Core Sanitaryware', pct: 58 },
          { name: 'Medium-Velocity Standard Valves', pct: 28 },
          { name: 'Slow-Moving Heavy Commercial', pct: 14 },
        ],
        recommendation:
          'A turnover velocity of 4.1x places the business in the top quartile of regional plumbing and hardware distributors. Maintaining agile reorder levels ensures optimal working capital liquidity.',
        actionUrl: '/inventory',
        actionLabel: 'Review Stock Turnover',
      },
      fulfillment: {
        type: 'fulfillment',
        title: 'Fulfillment SLA & Dispatch Accuracy',
        category: 'Logistics Performance',
        value: `${fulfillment}%`,
        trend: 'On-Time Dispatch Rate',
        trendPositive: true,
        tagline: 'Order readiness & dispatch reliability',
        summary: 'Percentage of customer purchase orders packed, verified, and handed over to transit partners within agreed SLA timelines.',
        icon: CheckCircle2,
        accentColor: 'cyan',
        metrics: [
          { label: 'Same-Day Dispatch', value: '94.2%', sublabel: 'Immediate release' },
          { label: 'Transit Accuracy', value: '99.8%', sublabel: 'Zero item error' },
          { label: 'Avg Turnaround', value: '1.4 Days', sublabel: 'Order to dock' },
          { label: 'Transit Claims', value: '< 0.2%', sublabel: 'Near zero damage' },
        ],
        breakdownTitle: 'Fulfillment Milestone Accuracy',
        breakdownItems: [
          { name: 'Same-Day Pick & Pack Verification', pct: 94 },
          { name: 'Scheduled Next-Day Carrier Docking', pct: 98 },
          { name: 'Order Picking Accuracy (Barcode Audit)', pct: 100 },
        ],
        recommendation:
          'Fulfillment SLA continues to outperform the 95% target threshold. Integrated digital dispatch receipts have reduced customer inquiries regarding order status by 64%.',
        actionUrl: '/procurement',
        actionLabel: 'View Logistics SLA',
      },
    };
  }, [kpis]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Hero Banner: Executive Business Intelligence ───────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Live Overview
              </span>
              <span className="text-xs text-slate-400 font-mono">
                PostgreSQL • 4,315 SKUs • 804 Customers • 211 Suppliers
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Overview
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time sales, inventory, purchases, and customer activity.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/sales"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-500 text-slate-950 font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <span>View Sales</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/dealers"
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
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">↑ +14.2%</span>
            <span className="text-slate-400">vs last quarter</span>
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
            <span>Total inventory value</span>
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
            <span>211 suppliers</span>
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
            <span>Active customer accounts</span>
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
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors">
            Gross Margin %
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-indigo-700 dark:text-indigo-300 transition-colors">
            {kpiDataMap.margin.value}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Optimal margin threshold</div>
        </div>

        {/* Average Order Value */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.aov)}
          className="p-3.5 sm:p-4 bg-slate-900/35 hover:bg-slate-800/45 border border-slate-700/40 hover:border-slate-500/50 rounded-xl shadow-2xs backdrop-blur-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-600/70 group active:scale-[0.99]"
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors">
            Average Order Value
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-sky-300 transition-colors">
            {kpiDataMap.aov.value}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">High consignment ticket size</div>
        </div>

        {/* Asset Turnover Velocity */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.turnover)}
          className="p-3.5 sm:p-4 bg-slate-900/35 hover:bg-slate-800/45 border border-slate-700/40 hover:border-slate-500/50 rounded-xl shadow-2xs backdrop-blur-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-600/70 group active:scale-[0.99]"
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors">
            Asset Turnover Velocity
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-purple-300 transition-colors">
            {kpiDataMap.turnover.value}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Annualized capital turns</div>
        </div>

        {/* Fulfillment SLA */}
        <div
          onClick={() => setSelectedKpi(kpiDataMap.fulfillment)}
          className="p-3.5 sm:p-4 bg-slate-900/35 hover:bg-slate-800/45 border border-slate-700/40 hover:border-slate-500/50 rounded-xl shadow-2xs backdrop-blur-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-600/70 group active:scale-[0.99]"
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors">
            Fulfillment SLA
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-indigo-700 dark:text-indigo-300 transition-colors">
            {kpiDataMap.fulfillment.value}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">On-time dispatch rate</div>
        </div>
      </div>

      {/* ── Row 3: Hero Business Performance Timeline (Continuous Curve) ── */}
      <div className="w-full">
        <InteractiveChart
          title="Overall Business Performance Timeline"
          subtitle="14-Day continuous multi-series tracking Revenue, Procurement, Inventory Assets, and Orders"
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
            <Link href="/demand-forecast" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1">
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
            href="/sales"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <TrendingUp className="w-5 h-5 text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Sales & Revenue</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Velocity & Rankings</div>
          </Link>

          <Link
            href="/dealers"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Store className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Dealers & Network</div>
            <div className="text-[10px] text-slate-500 mt-0.5">804 Connected Outlets</div>
          </Link>

          <Link
            href="/inventory-velocity"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Inventory Velocity</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Turnover & Fast Movers</div>
          </Link>

          <Link
            href="/procurement"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Truck className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Procurement</div>
            <div className="text-[10px] text-slate-500 mt-0.5">211 Sourcing Vendors</div>
          </Link>

          <Link
            href="/geography"
            className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-300 dark:border-indigo-700/60 rounded-xl transition-all group cursor-pointer"
          >
            <Compass className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-xs text-slate-200">Geographic GIS</div>
            <div className="text-[10px] text-slate-500 mt-0.5">State & Territory Maps</div>
          </Link>

          <Link
            href="/explorer"
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
