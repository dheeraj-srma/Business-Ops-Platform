'use client';
import React, { useMemo } from 'react';
import { Compass, MapPin } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import IndiaMapChart from '../components/IndiaMapChart';
import DataFreshnessBadge from '../components/DataFreshnessBadge';

export default function GeographyPage() {
  const { sales, kpis, dealersList } = useBi();

  // 1. Authoritative State Revenue Ranking from Historical Sales Ledger
  const stateRevenueData = useMemo(() => {
    return (sales.by_state || []).map((s: any) => ({
      name: s.state,
      value: s.revenue,
    }));
  }, [sales.by_state]);

  // 2. Authoritative City Revenue Ranking from Historical Sales Ledger
  const cityRevenueData = useMemo(() => {
    return (sales.by_city || []).map((c: any) => ({
      name: `${c.city} (${c.state || ''})`,
      value: c.revenue,
    }));
  }, [sales.by_city]);

  // 3. Real Dealer Outlet Density from Canonical Dealers Ledger
  const dealerDensityData = useMemo(() => {
    const counts: Record<string, number> = {};
    dealersList.forEach(d => {
      const st = (d.State || d.state || 'Unmapped').trim();
      counts[st] = (counts[st] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [dealersList]);

  const topState = sales.by_state?.[0];
  const primaryTerritoryLabel = topState
    ? `${topState.state} (${topState.share_percent}%)`
    : 'Haryana';

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
            Interactive India GIS heatmap, state territory revenue share, and verified retail dealer concentration.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <DataFreshnessBadge />
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Primary Territory</div>
            <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{primaryTerritoryLabel}</div>
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
          subtitle="Authoritative sales realization per state territory"
          data={stateRevenueData}
          defaultChartType="horizontal_bar"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Revenue by City Hub"
          subtitle="Top contributing metro and city commercial centers"
          data={cityRevenueData}
          defaultChartType="horizontal_bar"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Dealer Outlet Density"
          subtitle="Verified partner outlet distribution across territories"
          data={dealerDensityData}
          defaultChartType="donut"
          unit="dealers"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Manufacturing Supplier Sourcing Hubs"
          subtitle="Location density of active manufacturing vendor factories"
          data={[]}
          defaultChartType="donut"
          unit="vendors"
          unavailable={true}
          unavailableReason="Supplier geolocation telemetry is unavailable. Vendor addresses are not tracked in the current database schema."
          statusBadge="UNAVAILABLE"
        />

        <InteractiveChart
          title="Regional Return Rate (%)"
          subtitle="Customer return percentages categorized by destination territory"
          data={[]}
          defaultChartType="bar"
          unit="%"
          unavailable={true}
          unavailableReason="Regional return telemetry is unavailable. All customer returns are processed at the central receiving dock."
          statusBadge="UNAVAILABLE"
        />

        <InteractiveChart
          title="Regional Inventory Valuation"
          subtitle="Physical asset capital allocation stored per regional warehouse depot"
          data={[]}
          defaultChartType="bar"
          unit="₹"
          unavailable={true}
          unavailableReason="Regional inventory breakdown is unavailable. The business operates a single centralized warehouse facility."
          statusBadge="UNAVAILABLE"
        />
      </div>
    </div>
  );
}
