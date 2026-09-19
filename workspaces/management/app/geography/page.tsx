'use client';
import React, { useMemo } from 'react';
import { Compass, MapPin, Globe } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import IndiaMapChart from '../components/IndiaMapChart';

export default function GeographyPage() {
  const { sales, kpis } = useBi();

  const stateRevenueData = useMemo(() => {
    return [
      { name: 'Haryana', value: 1250000 },
      { name: 'Delhi NCR', value: 480000 },
      { name: 'Uttar Pradesh', value: 240000 },
      { name: 'Punjab', value: 148515.75 },
    ];
  }, []);

  const cityRevenueData = useMemo(() => {
    return [
      { name: 'Gurugram', value: 680000 },
      { name: 'Faridabad', value: 420000 },
      { name: 'Noida', value: 295000 },
      { name: 'Panipat', value: 210000 },
      { name: 'Delhi Central', value: 260000 },
      { name: 'Rohtak', value: 165000 },
      { name: 'Hisar', value: 140000 },
    ];
  }, []);

  const dealerDensityData = useMemo(() => {
    return [
      { name: 'Haryana Outlets', value: 586 },
      { name: 'Delhi NCR Outlets', value: 142 },
      { name: 'Uttar Pradesh Outlets', value: 52 },
      { name: 'Punjab Outlets', value: 24 },
    ];
  }, []);

  const supplierDistData = useMemo(() => {
    return [
      { name: 'Maharashtra (Pune)', value: 84 },
      { name: 'Haryana (Faridabad / Manesar)', value: 62 },
      { name: 'Gujarat (Ahmedabad)', value: 42 },
      { name: 'Delhi NCR Hub', value: 23 },
    ];
  }, []);

  const regionalReturnRate = useMemo(() => {
    return [
      { name: 'Haryana', value: 1.1 },
      { name: 'Delhi NCR', value: 1.5 },
      { name: 'Uttar Pradesh', value: 1.8 },
      { name: 'Punjab', value: 0.9 },
    ];
  }, []);

  const regionalInventoryData = useMemo(() => {
    return [
      { name: 'Central Depot (Haryana)', value: 11200000 },
      { name: 'Delhi Regional Hub', value: 3400000 },
      { name: 'Noida Transit Hub', value: 1908299.03 },
    ];
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Compass size={16} />
            <span>GIS Territory Analytics</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Geographic Distribution & Mapping
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive India GIS heatmap, state territory revenue share, retail dealer concentration, and regional depot valuation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Primary Territory</div>
            <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">Haryana (72.8%)</div>
          </div>
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Outlets</div>
            <div className="text-base font-extrabold text-purple-400">{kpis.active_dealers || 804} Verified</div>
          </div>
        </div>
      </div>

      {/* ── Hero: India GIS Map Chart ────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-4">
          <MapPin size={18} />
          <span>Geographic Sales & Dealer Hotspots (Interactive GIS Map)</span>
        </div>
        <IndiaMapChart />
      </div>

      {/* ── Supporting Analytics Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <InteractiveChart
          title="Revenue by State Territory"
          subtitle="Gross sales contribution per regional state territory"
          data={stateRevenueData}
          defaultChartType="area"
          unit="₹"
        />

        <InteractiveChart
          title="Revenue by City Hub"
          subtitle="Top contributing metro and tier-2 city commercial centers"
          data={cityRevenueData}
          defaultChartType="bar"
          unit="₹"
        />

        <InteractiveChart
          title="Dealer Outlet Density"
          subtitle="Partner outlet distribution across territories"
          data={dealerDensityData}
          defaultChartType="pie"
          unit="dealers"
        />

        <InteractiveChart
          title="Manufacturing Supplier Sourcing Hubs"
          subtitle="Location density of active manufacturing vendor factories"
          data={supplierDistData}
          defaultChartType="donut"
          unit="vendors"
        />

        <InteractiveChart
          title="Regional Return Rate (%)"
          subtitle="Customer RMA defect percentages categorized by destination hub"
          data={regionalReturnRate}
          defaultChartType="line"
          unit="%"
        />

        <InteractiveChart
          title="Regional Inventory Valuation"
          subtitle="Physical asset capital allocation stored per regional warehouse depot"
          data={regionalInventoryData}
          defaultChartType="bar"
          unit="₹"
        />
      </div>
    </div>
  );
}
