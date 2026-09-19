'use client';
import React, { useMemo, useState } from 'react';
import { Store, Users, Award, ShieldCheck, BarChart3 } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import CustomerPerformanceView from '../components/CustomerPerformanceView';

export default function CustomersPage() {
  const { sales, kpis, dealersList } = useBi();
  const [activeTab, setActiveTab] = useState<'performance' | 'overview'>('overview');

  const customerRankData = useMemo(() => {
    return (sales.dealer_rankings || []).map(d => ({
      name: d.dealer,
      value: d.revenue,
    }));
  }, [sales.dealer_rankings]);

  const customerOrderFreqData = useMemo(() => {
    return [
      { name: 'Mehta Distributors', value: 48 },
      { name: 'Dubey & Sons', value: 39 },
      { name: 'A 2 Z Paint & Hardware', value: 35 },
      { name: 'Nagar Distributors', value: 28 },
      { name: 'Aggarwal Sanitary', value: 24 },
      { name: 'Sharma Metal Mart', value: 21 },
      { name: 'Gupta Hardware', value: 18 },
    ];
  }, []);

  const customerGrowthData = useMemo(() => {
    return [
      { name: 'Mehta Distributors', value: 24.5 },
      { name: 'Dubey & Sons', value: 18.2 },
      { name: 'A 2 Z Paint & Hardware', value: 14.8 },
      { name: 'Nagar Distributors', value: 12.0 },
      { name: 'Aggarwal Sanitary', value: 9.5 },
      { name: 'Sharma Metal Mart', value: 8.2 },
    ];
  }, []);

  const customerGeoData = useMemo(() => {
    return [
      { name: 'Haryana Hubs (Gurugram, Faridabad)', value: 586 },
      { name: 'Delhi NCR Territory', value: 142 },
      { name: 'Uttar Pradesh (Noida, Ghaziabad)', value: 52 },
      { name: 'Punjab & Chandigarh', value: 24 },
    ];
  }, []);

  const customerRetentionData = useMemo(() => {
    return [
      { name: '90%+ Re-order Rate', value: 412 },
      { name: '70%-90% Re-order Rate', value: 268 },
      { name: '50%-70% Re-order Rate', value: 89 },
      { name: 'Inactive / Dormant (<50%)', value: 35 },
    ];
  }, []);

  const customerSegmentationData = useMemo(() => {
    return [
      { name: 'Platinum Tier (>₹5L/mo)', value: 18 },
      { name: 'Gold Tier (₹2L-₹5L/mo)', value: 64 },
      { name: 'Silver Tier (₹50k-₹2L/mo)', value: 240 },
      { name: 'Bronze Retail (<₹50k/mo)', value: 482 },
    ];
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Users size={16} />
            <span>Customers</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Customers
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Customer rankings, order frequency, growth, and performance analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Customers</div>
            <div className="text-base font-extrabold text-purple-400">{kpis.active_dealers || 804} Active</div>
          </div>
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Top Customer</div>
            <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{sales.top_dealer || 'Mehta Distributors'}</div>
          </div>
        </div>
      </div>

      {/* ── Section Navigation Tabs ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-fit backdrop-blur-md">
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'performance'
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users size={16} />
          <span>Customer Performance</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BarChart3 size={16} />
          <span>Overview</span>
        </button>
      </div>

      {/* ── View Content ────────────────────────────────────────────────── */}
      {activeTab === 'performance' ? (
        <CustomerPerformanceView />
      ) : (
        <>
          {/* ── Hero Chart: Customer Revenue Ranking ──────────────────────────── */}
          <div className="w-full">
            <InteractiveChart
              title="Customer Sales"
              subtitle="Sales by customer account"
              data={customerRankData}
              defaultChartType="bar"
              unit="₹"
              isHero={true}
            />
          </div>

          {/* ── Supporting Analytics Grid ───────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <InteractiveChart
              title="Order Frequency"
              subtitle="Orders placed by customer"
              data={customerOrderFreqData}
              defaultChartType="donut"
              unit="orders"
            />

            <InteractiveChart
              title="Customer Growth"
              subtitle="Sales growth rate by customer"
              data={customerGrowthData}
              defaultChartType="bar"
              unit="%"
            />

            <InteractiveChart
              title="Customers by Region"
              subtitle="Customer count by region"
              data={customerGeoData}
              defaultChartType="pie"
              unit="customers"
            />

            <InteractiveChart
              title="Customer Retention"
              subtitle="Re-order rates"
              data={customerRetentionData}
              defaultChartType="donut"
              unit="accounts"
            />

            <InteractiveChart
              title="Customer Tiers"
              subtitle="Accounts grouped by monthly sales volume"
              data={customerSegmentationData}
              defaultChartType="bar"
              unit="accounts"
            />

            {/* Strategic Partner Spotlight Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-1">
                  <Award size={18} />
                  <span>Key Account Spotlight</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Performance metrics for the highest volume regional distribution customer account.
                </p>

                <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-2">
                  <div className="text-sm font-bold text-slate-100">Mehta Distributors (Gurugram)</div>
                  <div className="text-xs text-slate-400">Primary territory: Haryana Central Hub</div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/40 text-xs">
                    <div>
                      <span className="text-slate-500">Gross Sales: </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">₹3,45,000</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Orders: </span>
                      <span className="font-bold text-sky-400">48 dispatches</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <ShieldCheck size={14} />
                <span>Tier 1 Platinum Partner • Zero payment defaults</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

