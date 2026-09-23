'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Truck, ShieldCheck, Award, AlertCircle } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import { fmtDayMonth } from '../utils/formatters';

interface ProcurementData {
  total_purchases: number;
  total_value: number;
  earliest_date: string | null;
  latest_date: string | null;
  unique_suppliers: number;
  timeline: Array<{ date: string; purchases: number; value: number }>;
  top_suppliers: Array<{ supplier: string; vouchers: number; value: number }>;
  by_category: Array<{ category: string; value: number; quantity: number }>;
  monthly_outflow?: Array<{ name: string; month: string; vouchers: number; value: number }>;
  consignment_brackets?: Array<{ name: string; bracket: string; count: number; value: number }>;
}

export default function ProcurementPage() {
  const { proc, sales, kpis, inwardsList } = useBi();
  const [procData, setProcData] = useState<ProcurementData | null>(null);

  useEffect(() => {
    fetch('/api/analytics/procurement')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data === 'object') {
          setProcData(data);
        }
      })
      .catch(() => {});
  }, []);

  // 1. Authoritative purchase spend trend from historical purchases ledger
  const spendTrendData = useMemo(() => {
    if (procData && procData.timeline && procData.timeline.length > 0) {
      return procData.timeline.map(t => ({
        name: fmtDayMonth(t.date),
        date: t.date,
        value: t.value,
        purchases: t.purchases,
      }));
    }
    if (inwardsList && inwardsList.length > 0) {
      const dateMap: Record<string, number> = {};
      inwardsList.forEach(t => {
        const d = String(t.Date || t.Timestamp || t.created_at || '').slice(0, 10);
        if (!d) return;
        const cost = Number(t["Total Cost"] || t.total_cost || (Number(t.Quantity || 0) * Number(t["Unit Cost"] || 0)));
        dateMap[d] = (dateMap[d] || 0) + cost;
      });
      return Object.keys(dateMap).sort().map(d => ({
        name: fmtDayMonth(d),
        value: Math.round(dateMap[d]),
      }));
    }
    return [];
  }, [procData, inwardsList]);

  // 2. Authoritative supplier spend ranking from purchase ledger
  const supplierSpendData = useMemo(() => {
    if (procData && procData.top_suppliers && procData.top_suppliers.length > 0) {
      return procData.top_suppliers.map(s => ({
        name: s.supplier.length > 22 ? s.supplier.slice(0, 22) + '…' : s.supplier,
        value: s.value,
      }));
    }
    if (inwardsList && inwardsList.length > 0) {
      const supMap: Record<string, number> = {};
      inwardsList.forEach(t => {
        const sup = String(t.supplier_or_recipient || t.Supplier || 'General Supplier').trim();
        const cost = Number(t["Total Cost"] || t.total_cost || (Number(t.Quantity || 0) * Number(t["Unit Cost"] || 0)));
        supMap[sup] = (supMap[sup] || 0) + cost;
      });
      return Object.entries(supMap)
        .map(([name, value]) => ({
          name: name.length > 20 ? name.slice(0, 20) + '…' : name,
          value: Math.round(value),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 20);
    }
    return (proc.top_suppliers || []).map(s => ({
      name: s.supplier.length > 20 ? s.supplier.slice(0, 20) + '…' : s.supplier,
      value: s.value,
    }));
  }, [procData, inwardsList, proc.top_suppliers]);

  // 3. Category purchase spend from historical purchase lines
  const categoryPurchData = useMemo(() => {
    if (procData && procData.by_category && procData.by_category.length > 0) {
      return procData.by_category.map(c => ({
        name: c.category.length > 20 ? c.category.slice(0, 20) + '…' : c.category,
        value: c.value,
      }));
    }
    if (inwardsList && inwardsList.length > 0) {
      const catMap: Record<string, number> = {};
      inwardsList.forEach(t => {
        const cat = String(t.Category || t.categoryName || 'General').trim();
        const cost = Number(t["Total Cost"] || t.total_cost || (Number(t.Quantity || 0) * Number(t["Unit Cost"] || 0)));
        catMap[cat] = (catMap[cat] || 0) + cost;
      });
      return Object.entries(catMap)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value);
    }
    return [];
  }, [procData, inwardsList]);

  // 4. Monthly sourcing capital outflow
  const monthlyOutflowData = useMemo(() => {
    if (procData && procData.monthly_outflow && procData.monthly_outflow.length > 0) {
      return procData.monthly_outflow.map(m => ({
        name: m.month,
        value: m.value,
        vouchers: m.vouchers,
      }));
    }
    return [];
  }, [procData]);

  // 5. Consignment ticket size tier allocation
  const consignmentBracketData = useMemo(() => {
    if (procData && procData.consignment_brackets && procData.consignment_brackets.length > 0) {
      return procData.consignment_brackets.map(b => ({
        name: b.name,
        value: b.value,
        count: b.count,
      }));
    }
    return [];
  }, [procData]);

  // 6. Top items by quantity ordered
  const topItemsByVolumeData = useMemo(() => {
    if (procData && procData.by_category && procData.by_category.length > 0) {
      return [...procData.by_category]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 20)
        .map(i => ({
          name: i.category.length > 22 ? i.category.slice(0, 22) + '…' : i.category,
          value: Math.round(i.quantity),
        }));
    }
    return [];
  }, [procData]);

  const topSupplier = procData?.top_suppliers?.[0];
  const totalPurchaseValue = procData?.total_value ?? Number(kpis.purchase_value || 0);
  const totalVendors = procData?.unique_suppliers ?? Number(kpis.active_suppliers || 0);

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
            Authoritative inward purchase spend volume and supplier consignment capital allocation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Sourcing Spend</div>
            <div className="text-base font-extrabold text-amber-400">₹{totalPurchaseValue.toLocaleString('en-IN')}</div>
          </div>
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Connected Vendors</div>
            <div className="text-base font-extrabold text-sky-400">{totalVendors} Vendors</div>
          </div>
        </div>
      </div>

      {/* ── Hero Chart: Purchase Spend Trend ─────────── */}
      <div className="w-full">
        <InteractiveChart
          title="Purchase Spend Trend Over Time"
          subtitle="Authoritative procurement spend timeline tracking historical purchase vouchers"
          data={spendTrendData}
          defaultChartType="area"
          unit="₹"
          isHero={true}
          statusBadge="LIVE"
        />
      </div>

      {/* ── Supporting Analytics Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <InteractiveChart
          title="Supplier Spend Contribution"
          subtitle="Total procurement purchase capital allocation split by primary manufacturing partner"
          data={supplierSpendData}
          defaultChartType="horizontal_bar"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Purchase Value by Category"
          subtitle="Procurement spend split across primary product lines"
          data={categoryPurchData}
          defaultChartType="donut"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Monthly Sourcing Capital Outflow"
          subtitle="Monthly procurement expenditure and inward voucher volume trajectory"
          data={monthlyOutflowData}
          defaultChartType="bar"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Consignment Value Distribution"
          subtitle="Authoritative purchase voucher ticket size tier allocation"
          data={consignmentBracketData}
          defaultChartType="donut"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Top Procured Items by Volume"
          subtitle="Authoritative purchase line items ranking by inward units ordered"
          data={topItemsByVolumeData}
          defaultChartType="horizontal_bar"
          unit="units"
          statusBadge="LIVE"
        />

        {/* Top Vendor Partnership Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
              <Award size={18} />
              <span>Primary Vendor Strategic Scorecard</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Authoritative ranking for primary manufacturing supplier partner.
            </p>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-2">
              <div className="text-sm font-bold text-slate-100">
                {topSupplier?.supplier || 'Authoritative Ledger Sync Required'}
              </div>
              <div className="text-xs text-slate-400">
                Primary Supplier Account (Authoritative Purchase Ledger)
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/40 text-xs">
                <div>
                  <span className="text-slate-500">Spend: </span>
                  <span className="font-bold text-amber-400">
                    {topSupplier?.value ? `₹${Math.round(topSupplier.value).toLocaleString('en-IN')}` : '₹0'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Invoices: </span>
                  <span className="font-bold text-indigo-400">
                    {topSupplier?.vouchers ?? 0} Vouchers
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Verified from canonical historical purchase records</span>
          </div>
        </div>
      </div>
    </div>
  );
}
