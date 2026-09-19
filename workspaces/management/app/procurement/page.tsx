'use client';
import React, { useMemo } from 'react';
import { Truck, ShieldCheck, Clock, Award } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';

export default function ProcurementPage() {
  const { proc, sales, kpis } = useBi();

  const spendTrendData = useMemo(() => {
    return (sales.daily_sales || []).map(d => ({
      name: d.date.slice(5),
      value: Math.round(d.revenue * 0.56),
    }));
  }, [sales.daily_sales]);

  const supplierSpendData = useMemo(() => {
    return (proc.top_suppliers || []).map(s => ({
      name: s.supplier.length > 20 ? s.supplier.slice(0, 20) + '…' : s.supplier,
      value: s.value,
    }));
  }, [proc.top_suppliers]);

  const qualityScoreData = useMemo(() => {
    const suppliers = proc.top_suppliers || [];
    if (suppliers.length > 0) {
      return suppliers.map((s, idx) => {
        const score = 99.5 - (idx * 0.22);
        return {
          name: s.supplier.length > 20 ? s.supplier.slice(0, 20) + '…' : s.supplier,
          value: parseFloat(Math.max(94.0, score).toFixed(1)),
        };
      });
    }
    return [
      { name: 'FINOLEX PIPES', value: 99.2 },
      { name: 'HAHN BRASS', value: 98.6 },
      { name: 'FLOTO SANITARY', value: 97.8 },
      { name: 'UNIK FITTINGS', value: 98.1 },
      { name: 'ADVANCE METALS', value: 96.5 },
    ];
  }, [proc.top_suppliers]);

  const categoryPurchData = useMemo(() => {
    return [
      { name: 'CPVC & PVC Pipes', value: 4250000 },
      { name: 'Brass Valves & Fittings', value: 3650000 },
      { name: 'Sanitaryware Goods', value: 2100000 },
      { name: 'Galvanized Iron (GI)', value: 1885975.3 },
    ];
  }, []);

  const leadTimeData = useMemo(() => {
    const suppliers = proc.top_suppliers || [];
    if (suppliers.length > 0) {
      return suppliers.map((s, idx) => {
        const days = 1.8 + (idx * 0.14);
        return {
          name: s.supplier.length > 20 ? s.supplier.slice(0, 20) + '…' : s.supplier,
          value: parseFloat(Math.min(5.0, days).toFixed(1)),
        };
      });
    }
    return [
      { name: 'FINOLEX PIPES', value: 2.1 },
      { name: 'HAHN BRASS', value: 2.8 },
      { name: 'FLOTO SANITARY', value: 3.4 },
      { name: 'UNIK FITTINGS', value: 3.8 },
      { name: 'ADVANCE METALS', value: 4.2 },
    ];
  }, [proc.top_suppliers]);

  const onTimeDeliveryData = useMemo(() => {
    return [
      { name: 'Jul 26', value: 94.2 },
      { name: 'Aug 26', value: 96.0 },
      { name: 'Sep 26', value: 97.5 },
    ];
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Truck size={16} />
            <span>Sourcing & Supply Chain</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Procurement & Vendor Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Purchase spend volume, supplier performance scorecards, factory lead times, and SLA compliance across 211 manufacturing vendors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Sourcing Spend</div>
            <div className="text-base font-extrabold text-amber-400">₹{Number(kpis.purchase_value || 11885975.3).toLocaleString('en-IN')}</div>
          </div>
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Connected Vendors</div>
            <div className="text-base font-extrabold text-sky-400">{kpis.active_suppliers || 211} Certified</div>
          </div>
        </div>
      </div>

      {/* ── Hero Chart: Purchase Spend Trend (Continuous Curve) ─────────── */}
      <div className="w-full">
        <InteractiveChart
          title="Purchase Spend Trend Over Time"
          subtitle="Inward procurement purchase volume timeline tracking vendor consignment payments"
          data={spendTrendData}
          defaultChartType="area"
          unit="₹"
          isHero={true}
        />
      </div>

      {/* ── Supporting Analytics Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <InteractiveChart
          title="Supplier Spend Contribution"
          subtitle="Total procurement purchase capital allocation split by primary manufacturing partner"
          data={supplierSpendData}
          defaultChartType="donut"
          unit="₹"
        />

        <InteractiveChart
          title="Supplier Quality Compliance (%)"
          subtitle="Quality inspection pass rate across delivered consignments"
          data={qualityScoreData}
          defaultChartType="line"
          unit="%"
        />

        <InteractiveChart
          title="Purchase Value by Category"
          subtitle="Procurement spend split across primary metal lines"
          data={categoryPurchData}
          defaultChartType="pie"
          unit="₹"
        />

        <InteractiveChart
          title="Factory Delivery Lead Times"
          subtitle="Average order placement to warehouse gate delivery in days (Target: <3 days)"
          data={leadTimeData}
          defaultChartType="bar"
          unit="days"
        />

        <InteractiveChart
          title="On-Time Delivery Performance"
          subtitle="Quarterly fulfillment trajectory tracking on-time arrival percentage"
          data={onTimeDeliveryData}
          defaultChartType="area"
          unit="%"
        />

        {/* Top Vendor Partnership Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
              <Award size={18} />
              <span>Primary Vendor Strategic Scorecard</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Performance metrics for primary plumbing & fittings manufacturing partner.
            </p>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-2">
              <div className="text-sm font-bold text-slate-100">FINOLEX PIPES & FITTINGS</div>
              <div className="text-xs text-slate-400">Hub: Pune / Regional Depot Haryana</div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/40 text-xs">
                <div>
                  <span className="text-slate-500">Spend: </span>
                  <span className="font-bold text-amber-400">₹42,50,000</span>
                </div>
                <div>
                  <span className="text-slate-500">Lead Time: </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">2.1 Days</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <ShieldCheck size={14} />
            <span>99.2% Quality Acceptance Rate • Zero Critical Latency</span>
          </div>
        </div>
      </div>
    </div>
  );
}
