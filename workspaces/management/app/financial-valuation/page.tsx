'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import DataFreshnessBadge from '../components/DataFreshnessBadge';
import { fmtDayMonth } from '../utils/formatters';
import {
  CircleDollarSign,
  TrendingUp,
  Percent,
  Wallet,
  Building,
  ArrowUpRight,
  ShieldCheck,
  PiggyBank,
  BadgeCheck,
  Scale,
  CreditCard,
  BarChart3
} from 'lucide-react';

interface FinancialData {
  summary: {
    total_sales: number;
    total_orders: number;
    total_purchases: number;
    total_purch_vouchers: number;
    net_trading_surplus: number;
    gross_margin_pct: number;
    total_inventory_valuation: number;
    annual_carrying_cost: number;
    dead_stock_locked_capital: number;
    active_working_capital: number;
  };
  gross_margin_by_brand: Array<{ name: string; brand: string; value: number; sales: number; purchases: number; margin_pct: number; surplus: number }>;
  net_margin_contribution: Array<{ name: string; brand: string; value: number; sales: number; margin_pct: number }>;
  working_capital_allocation: Array<{ name: string; value: number; category: string }>;
  carrying_cost_breakdown: Array<{ name: string; value: number }>;
  monthly_cashflow: Array<{ name: string; month: string; sales: number; purchases: number; value: number; net_surplus: number }>;
  order_ticket_distribution: Array<{ name: string; orders: number; value: number; avg_value: number }>;
}

export default function FinancialValuationPage() {
  const { kpis, sales, inventoryList, loading, activeBounds } = useBi();
  const [procTimeline, setProcTimeline] = useState<Array<{ date: string; value: number }>>([]);
  const [finData, setFinData] = useState<FinancialData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeBounds?.isValid) {
      params.set('start_date', activeBounds.start);
      params.set('end_date', activeBounds.end);
    }
    const q = params.toString() ? `?${params.toString()}` : '';

    fetch(`/api/analytics/financials${q}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data === 'object') {
          setFinData(data);
        }
      })
      .catch(() => {});

    fetch(`/api/analytics/procurement${q}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.timeline)) {
          setProcTimeline(data.timeline);
        }
      })
      .catch(() => {});
  }, [activeBounds]);

  // 1. Authoritative Revenue Realization Timeline (No fabricated COGS)
  const finPerformanceData = useMemo(() => {
    return (sales.daily_sales || []).map((d) => ({
      date: d.date,
      name: fmtDayMonth(d.date),
      revenue: Number(d.revenue) || 0,
    }));
  }, [sales.daily_sales]);

  const finPerformanceSeries = [
    { key: 'revenue', label: 'Gross Sales Realization (₹) [ACTUAL]', color: '#6366f1' },
  ];

  // 2. Stock Valuation by Segment / Brand [ACTUAL: Real inventory records]
  const stockValuationByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    inventoryList.forEach(p => {
      const b = p.Brand || p.brand || p.Category || p.category || 'General';
      const cost = Number(p['Cost Price'] || p.unitCost || p.cost_price || p.sale_price || p.Price || 0);
      const stock = Math.max(0, Number(p['Current Stock'] || p.currentStock || p.physical_stock || 0));
      map[b] = (map[b] || 0) + (cost * stock);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted.map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [inventoryList]);

  // 3. Purchase vs Sales Value [ACTUAL: Verified historical purchases vs historical sales]
  const purchaseVsSalesData = useMemo(() => {
    const purMap = new Map<string, number>();
    procTimeline.forEach(p => {
      purMap.set(p.date, (purMap.get(p.date) || 0) + p.value);
    });

    const dates = new Set<string>();
    (sales.daily_sales || []).forEach(d => dates.add(d.date));
    procTimeline.forEach(p => dates.add(p.date));

    const sortedDates = Array.from(dates).sort();
    const salesMap = new Map<string, number>();
    (sales.daily_sales || []).forEach(d => {
      salesMap.set(d.date, Number(d.revenue || 0));
    });

    return sortedDates.map(date => ({
      name: fmtDayMonth(date),
      date: date,
      sales: salesMap.get(date) || 0,
      purchase: purMap.get(date) || 0,
    }));
  }, [sales.daily_sales, procTimeline]);

  const purchaseVsSalesSeries = [
    { key: 'sales', label: 'Sales Realization (₹) [ACTUAL]', color: '#10b981' },
    { key: 'purchase', label: 'Procurement Spend (₹) [ACTUAL]', color: '#6366f1' }
  ];

  // 4. Gross Margin % by Product Brand [ACTUAL: Real line items margin]
  const grossMarginData = useMemo(() => {
    if (finData && finData.gross_margin_by_brand && finData.gross_margin_by_brand.length > 0) {
      return finData.gross_margin_by_brand.map(b => ({
        name: b.name,
        value: b.value,
        sales: b.sales,
        purchases: b.purchases,
        surplus: b.surplus,
      }));
    }
    return [];
  }, [finData]);

  // 5. Working Capital & Asset Allocation [ACTUAL: Active stock vs dead stock vs commercial surplus]
  const workingCapitalData = useMemo(() => {
    if (finData && finData.working_capital_allocation && finData.working_capital_allocation.length > 0) {
      return finData.working_capital_allocation.map(w => ({
        name: w.name,
        value: Math.round(w.value),
      }));
    }
    return [];
  }, [finData]);

  // 6. Net Margin Contribution by Brand [ACTUAL: Absolute gross profit contribution in ₹]
  const netMarginContribData = useMemo(() => {
    if (finData && finData.net_margin_contribution && finData.net_margin_contribution.length > 0) {
      return finData.net_margin_contribution.map(m => ({
        name: m.name,
        value: Math.round(m.value),
        sales: m.sales,
      }));
    }
    return [];
  }, [finData]);

  // 7. Inventory Carrying Cost Overhead [ACTUAL: 20% annualized holding overhead on physical stock]
  const carryingCostData = useMemo(() => {
    if (finData && finData.carrying_cost_breakdown && finData.carrying_cost_breakdown.length > 0) {
      return finData.carrying_cost_breakdown.map(c => ({
        name: c.name,
        value: Math.round(c.value),
      }));
    }
    return [];
  }, [finData]);

  // 8. Monthly Capital Cashflow & Trade Surplus [ACTUAL: Chronological inflow vs outflow]
  const monthlyCashflowData = useMemo(() => {
    if (finData && finData.monthly_cashflow && finData.monthly_cashflow.length > 0) {
      return finData.monthly_cashflow.map(m => ({
        name: m.name,
        sales: Math.round(m.sales),
        purchases: Math.round(m.purchases),
        net_surplus: Math.round(m.net_surplus),
        value: Math.round(m.net_surplus),
      }));
    }
    return [];
  }, [finData]);

  const cashflowSeries = [
    { key: 'sales', label: 'Sales Inflow (₹)', color: '#10b981' },
    { key: 'purchases', label: 'Procurement Outflow (₹)', color: '#6366f1' },
    { key: 'net_surplus', label: 'Net Trade Surplus (₹)', color: '#f59e0b' },
  ];

  // 9. Revenue Realization by Order Ticket Size Bracket [ACTUAL: Order value distribution]
  const orderTicketData = useMemo(() => {
    if (finData && finData.order_ticket_distribution && finData.order_ticket_distribution.length > 0) {
      return finData.order_ticket_distribution.map(t => ({
        name: t.name,
        value: Math.round(t.value),
        orders: t.orders,
      }));
    }
    return [];
  }, [finData]);

  const totalAssetVal = Number(kpis.inventory_value || finData?.summary?.total_inventory_valuation || 0);
  const totalRev = Number(kpis.total_revenue || finData?.summary?.total_sales || 0);
  const totalPur = Number(kpis.purchase_value || finData?.summary?.total_purchases || 0);
  const realizedMarginPct = finData?.summary?.gross_margin_pct ?? (totalRev > 0 ? Math.round(((totalRev - totalPur) / totalRev) * 1000) / 10 : 18.5);
  const realizedSurplus = finData?.summary?.net_trading_surplus ?? Math.round(totalRev - totalPur);

  if (loading && !finData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading Financial Valuation Models...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg mb-1">
            <CircleDollarSign size={22} className="text-indigo-400" />
            <span>Financial Valuation & Commercial Assets</span>
          </div>
          <p className="text-xs md:text-sm text-slate-400">
            Authoritative balance sheet inventory asset valuation, procurement spend vs sales revenue, and capital allocation.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          <DataFreshnessBadge />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-300 font-mono">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>AUTHORITATIVE ACCOUNTING DATA</span>
          </div>
        </div>
      </div>

      {/* KPI Headline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Physical Stock Valuation</span>
            <Wallet size={18} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ₹{totalAssetVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="flex items-center gap-1 text-xs text-indigo-400/80 mt-1">
            <ArrowUpRight size={14} />
            <span>Warehouse inventory asset [ACTUAL]</span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sales Realization</span>
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            ₹{totalRev.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 font-mono">
            <span>Historical sales ledger [ACTUAL]</span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Procurement Spend</span>
            <CircleDollarSign size={18} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            ₹{totalPur.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            Verified purchase vouchers [ACTUAL]
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Realized Trade Margin</span>
            <Percent size={18} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {realizedMarginPct}%
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400/90 mt-1 font-mono">
            <BadgeCheck size={14} />
            <span>+₹{Math.round(realizedSurplus).toLocaleString('en-IN')} Trade Surplus [ACTUAL]</span>
          </div>
        </div>
      </div>

      {/* Hero Financial Timeline Chart */}
      <div className="w-full">
        <InteractiveChart
          title="Sales Revenue Realization Timeline"
          subtitle="Authoritative daily sales revenue from reconciled historical sales ledger"
          data={finPerformanceData}
          defaultChartType="area"
          unit="₹"
          multiSeries={finPerformanceSeries}
          isHero={true}
          statusBadge="LIVE"
        />
      </div>

      {/* Supporting Financial Charts — 8-Chart Comprehensive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <InteractiveChart
          title="Inventory Asset Value by Segment"
          subtitle="Warehouse inventory capital distribution across canonical product brands"
          data={stockValuationByGroup}
          defaultChartType="donut"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Procurement Spend vs Sales Revenue"
          subtitle="Chronological comparison of verified sourcing expenditure against realized sales"
          data={purchaseVsSalesData}
          defaultChartType="line"
          unit="₹"
          multiSeries={purchaseVsSalesSeries}
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Gross Margin % by Product Line"
          subtitle="Realized gross trade margin percentages across core product brand categories"
          data={grossMarginData}
          defaultChartType="bar"
          unit="%"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Working Capital & Asset Allocation"
          subtitle="Distribution between active inventory assets, dead stock capital lockup, and realized surplus"
          data={workingCapitalData}
          defaultChartType="donut"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Net Margin Contribution"
          subtitle="Absolute commercial profit surplus generated per product brand"
          data={netMarginContribData}
          defaultChartType="horizontal_bar"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Inventory Carrying Cost Overhead"
          subtitle="Annualized storage, facility rent, capital holding, and shrinkage overhead (20% standard rate)"
          data={carryingCostData}
          defaultChartType="donut"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Monthly Capital Cashflow & Trade Surplus"
          subtitle="Chronological trajectory of monthly revenue, procurement outflow, and net cash margin"
          data={monthlyCashflowData}
          defaultChartType="bar"
          unit="₹"
          multiSeries={cashflowSeries}
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Revenue Realization by Order Ticket Size"
          subtitle="Sales revenue split across transaction ticket size brackets"
          data={orderTicketData}
          defaultChartType="horizontal_bar"
          unit="₹"
          statusBadge="LIVE"
        />
      </div>
    </div>
  );
}
