'use client';
import React, { useMemo, useState } from 'react';
import { TrendingUp, Users, DollarSign, Award, BarChart3, UserCheck } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import SalesmanPerformanceView from '../components/SalesmanPerformanceView';

export default function SalesPage() {
  const { sales, kpis, ordersList, dealersList } = useBi();
  const [activeTab, setActiveTab] = useState<'overview' | 'salesman'>('overview');

  const dailySalesData = useMemo(() => {
    return (sales.daily_sales || []).map(d => ({
      name: d.date.slice(5),
      value: d.revenue,
      date: d.date,
    }));
  }, [sales.daily_sales]);

  const catRevenueData = useMemo(() => {
    return (sales.revenue_by_category || []).map(c => ({
      name: c.category,
      value: c.revenue,
    }));
  }, [sales.revenue_by_category]);

  const topProductsData = useMemo(() => {
    return (sales.top_products || []).map(p => ({
      name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
      value: p.qty,
    }));
  }, [sales.top_products]);

  const dealerRankData = useMemo(() => {
    return (sales.dealer_rankings || []).map(d => ({
      name: d.dealer,
      value: d.revenue,
    }));
  }, [sales.dealer_rankings]);

  const salesmanRankData = useMemo(() => {
    return (sales.salesman_performance || []).map(s => ({
      name: s.salesman,
      value: s.revenue,
    }));
  }, [sales.salesman_performance]);

  // Derive region revenue from actual orders & dealer state mapping
  const regionRevenueData = useMemo(() => {
    const dealerStateMap: Record<string, string> = {};
    dealersList.forEach(d => {
      const name = (d["Shop Name"] || d.name || d.shop_name || '').trim().toLowerCase();
      const state = (d.State || d.state || 'Haryana').trim();
      if (name) dealerStateMap[name] = state;
    });

    const stateRevMap: Record<string, number> = {};
    ordersList.forEach(o => {
      const isApproved = ['approved', 'dispatched', 'delivered'].includes(String(o.status || '').toLowerCase());
      if (!isApproved) return;
      const cust = String(o.shop_name || o.customer_name || '').trim().toLowerCase();
      const st = dealerStateMap[cust] || 'Haryana';
      stateRevMap[st] = (stateRevMap[st] || 0) + Number(o.total_amount || 0);
    });

    const list = Object.entries(stateRevMap).map(([name, value]) => ({
      name,
      value: Math.round(value),
    })).sort((a, b) => b.value - a.value);

    if (list.length > 0) return list;

    // If no direct order geography map, aggregate by top dealer regions or default to available state breakdown
    if (sales.dealer_states && Object.keys(sales.dealer_states).length > 0) {
      return Object.entries(sales.dealer_states).map(([name, count]) => ({
        name,
        value: count,
      }));
    }

    return [];
  }, [ordersList, dealersList, sales.dealer_states]);

  // Derive order size distribution from actual orders
  const orderValueDistribution = useMemo(() => {
    let large = 0;
    let medium = 0;
    let small = 0;

    ordersList.forEach(o => {
      const amt = Number(o.total_amount || 0);
      if (amt >= 200000) large++;
      else if (amt >= 50000) medium++;
      else if (amt > 0) small++;
    });

    if (large === 0 && medium === 0 && small === 0 && kpis.total_orders) {
      return [];
    }

    return [
      { name: 'Large (>₹2L)', value: large },
      { name: 'Medium (₹50k-₹2L)', value: medium },
      { name: 'Small (<₹50k)', value: small },
    ];
  }, [ordersList, kpis.total_orders]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider mb-1">
            <TrendingUp size={16} />
            <span>Sales</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Sales Performance
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Authoritative sales trends, product dispatches, verified customer rankings, and salesman telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Sales</div>
            <div className="text-base font-extrabold text-sky-400">₹{Number(kpis.total_revenue || 0).toLocaleString('en-IN')}</div>
          </div>
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Top Salesman</div>
            <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{sales.top_salesman || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* ── Section Navigation Tabs ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-fit backdrop-blur-md">
        <button
          onClick={() => setActiveTab('salesman')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'salesman'
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <UserCheck size={16} />
          <span>Salesmen Performance</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BarChart3 size={16} />
          <span>Overview</span>
        </button>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      {activeTab === 'salesman' ? (
        <SalesmanPerformanceView />
      ) : (
        <>
          {/* ── Hero Chart: Daily Sales ──── */}
          <div className="w-full">
            <InteractiveChart
              title="Sales Over Time"
              subtitle="Daily sales revenue"
              data={dailySalesData}
              defaultChartType="area"
              unit="₹"
              isHero={true}
            />
          </div>

          {/* ── Supporting Analytics Grid ──── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <InteractiveChart
              title="Sales by Category"
              subtitle="Sales split by brand and category"
              data={catRevenueData}
              defaultChartType="donut"
              unit="₹"
            />

            <InteractiveChart
              title="Top Products"
              subtitle="Products with highest quantity sold"
              data={topProductsData}
              defaultChartType="bar"
              unit="units"
            />

            <InteractiveChart
              title="Top Customers"
              subtitle="Highest buying customers"
              data={dealerRankData}
              defaultChartType="area"
              unit="₹"
              showLegend={false}
            />

            <InteractiveChart
              title="Salesmen Ranking"
              subtitle="Total sales per salesman"
              data={salesmanRankData}
              defaultChartType="bar"
              unit="₹"
            />

            <InteractiveChart
              title="Sales by Region"
              subtitle="Sales split across regional territories"
              data={regionRevenueData}
              defaultChartType="pie"
              unit="₹"
            />

            <InteractiveChart
              title="Order Size"
              subtitle="Orders grouped by value size"
              data={orderValueDistribution}
              defaultChartType="donut"
              unit="orders"
            />
          </div>
        </>
      )}
    </div>
  );
}
