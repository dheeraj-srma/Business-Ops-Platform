'use client';
import React, { useMemo, useState, useEffect } from 'react';
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

  const topCustomersData = useMemo(() => {
    return (sales.dealer_rankings || []).map(r => ({
      name: r.dealer.length > 20 ? r.dealer.slice(0, 20) + '…' : r.dealer,
      value: r.revenue,
    }));
  }, [sales.dealer_rankings]);

  const salesmanRankData = useMemo(() => {
    return (sales.salesman_performance || []).map((s: any) => ({
      name: s.salesman,
      value: s.revenue,
    }));
  }, [sales.salesman_performance]);

  // Authoritative Regional Revenue from backend canonical customer mapping (Phase 9)
  const regionData = useMemo(() => {
    if (sales.by_state && sales.by_state.length > 0) {
      return sales.by_state.map((s: any) => ({
        name: s.state,
        value: s.revenue,
      }));
    }
    return (sales.by_region || []).map((s: any) => ({
      name: s.region,
      value: s.revenue,
    }));
  }, [sales.by_state, sales.by_region]);

  // Order value distribution buckets from historical sales vouchers
  const [orderDist, setOrderDist] = useState<Array<{ bucket: string; orders: number; value: number }>>([]);

  useEffect(() => {
    fetch('/api/analytics/order-distribution')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) setOrderDist(data);
      })
      .catch(() => {});
  }, []);

  const orderValueDistribution = useMemo(() => {
    return orderDist.map(item => ({
      name: item.bucket,
      value: item.orders,
    }));
  }, [orderDist]);

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
              subtitle="Highest buying customer accounts by realized sales"
              data={topCustomersData}
              defaultChartType="horizontal_bar"
              unit="₹"
              showLegend={false}
              statusBadge="LIVE"
            />

            <InteractiveChart
              title="Salesmen Ranking"
              subtitle="Total sales contribution per attributed salesman"
              data={salesmanRankData}
              defaultChartType="horizontal_bar"
              unit="₹"
              statusBadge="LIVE"
            />

            <InteractiveChart
              title="Sales by Region"
              subtitle="Authoritative sales realization per territory"
              data={regionData}
              defaultChartType="horizontal_bar"
              unit="₹"
              statusBadge="LIVE"
            />

            <InteractiveChart
              title="Order Size Distribution"
              subtitle="Historical sales vouchers grouped by invoice value"
              data={orderValueDistribution}
              defaultChartType="donut"
              unit="vouchers"
              statusBadge="LIVE"
            />
          </div>
        </>
      )}
    </div>
  );
}
