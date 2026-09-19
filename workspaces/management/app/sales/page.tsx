'use client';
import React, { useMemo, useState } from 'react';
import { TrendingUp, Users, DollarSign, Award, BarChart3, UserCheck } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import SalesmanPerformanceView from '../components/SalesmanPerformanceView';

export default function SalesPage() {
  const { sales, kpis } = useBi();
  const [activeTab, setActiveTab] = useState<'overview' | 'salesman'>('overview');

  const dailySalesData = useMemo(() => {
    return (sales.daily_sales || []).map(d => ({
      name: d.date.slice(5),
      value: d.revenue,
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

  const regionRevenueData = useMemo(() => {
    return [
      { name: 'Haryana', value: 1250000 },
      { name: 'Delhi NCR', value: 480000 },
      { name: 'Uttar Pradesh', value: 240000 },
      { name: 'Punjab', value: 148515.75 },
    ];
  }, []);

  const orderValueDistribution = useMemo(() => {
    return [
      { name: 'Large (>₹2L)', value: 8 },
      { name: 'Medium (₹50k-₹2L)', value: 18 },
      { name: 'Small (<₹50k)', value: 42 },
    ];
  }, []);

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
            Sales
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Sales trends, top products, customer rankings, and salesmen performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Sales</div>
            <div className="text-base font-extrabold text-sky-400">₹{Number(kpis.total_revenue || 2118515.75).toLocaleString('en-IN')}</div>
          </div>
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Top Salesman</div>
            <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{sales.top_salesman || 'RAVINDER KUMAR'}</div>
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
