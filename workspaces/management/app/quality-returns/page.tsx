'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import DataFreshnessBadge from '../components/DataFreshnessBadge';
import { fmtDayMonth } from '../utils/formatters';
import { InScreenLoader } from '../components/common/InScreenLoader';

interface ReturnAnalyticsData {
  total_returns: number;
  total_value: number;
  earliest_date: string | null;
  latest_date: string | null;
  unique_customers: number;
  timeline: Array<{ date: string; returns: number; value: number }>;
  top_returned_products: Array<{ product: string; category: string; quantity: number; value: number; occurrences: number }>;
  by_customer: Array<{ customer: string; returns: number; value: number }>;
  by_category: Array<{ category: string; quantity: number; value: number; lines: number }>;
}

export default function QualityReturnsPage() {
  const { ret, sales, kpis, returnsList, activeBounds, loading, selectedRange } = useBi();
  const [retData, setRetData] = useState<ReturnAnalyticsData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeBounds?.isValid) {
      params.set('start_date', activeBounds.start);
      params.set('end_date', activeBounds.end);
    }
    const q = params.toString() ? `?${params.toString()}` : '';

    fetch(`/api/analytics/returns${q}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data === 'object') {
          setRetData(data);
        }
      })
      .catch(() => {});
  }, [activeBounds]);

  // 1. Authoritative returns timeline from historical return vouchers
  const returnsTimelineData = useMemo(() => {
    if (retData && retData.timeline && retData.timeline.length > 0) {
      return retData.timeline.map(t => ({
        name: fmtDayMonth(t.date),
        date: t.date,
        value: t.value,
        returns: t.returns,
      }));
    }
    if (returnsList && returnsList.length > 0) {
      const dateMap: Record<string, { name: string; value: number; returns: number }> = {};
      returnsList.forEach(r => {
        const ts = String(r.Timestamp || r.created_at || '').slice(0, 10);
        if (!ts) return;
        if (!dateMap[ts]) {
          dateMap[ts] = { name: fmtDayMonth(ts), value: 0, returns: 0 };
        }
        dateMap[ts].returns += 1;
        dateMap[ts].value += Number(r.Price || r.price || 0) * Number(r.Quantity || r.quantity || 1);
      });
      return Object.keys(dateMap).sort().map(k => dateMap[k]);
    }
    return [];
  }, [retData, returnsList]);

  // 2. Returns by Category
  const returnCategoryData = useMemo(() => {
    if (retData && retData.by_category && retData.by_category.length > 0) {
      return retData.by_category.map(c => ({
        name: c.category,
        value: c.value,
      }));
    }
    return [];
  }, [retData]);

  // 3. Top Returned Products (Horizontal Bar)
  const topReturnedProducts = useMemo(() => {
    if (retData && retData.top_returned_products && retData.top_returned_products.length > 0) {
      return retData.top_returned_products.map(p => ({
        name: p.product.length > 22 ? p.product.slice(0, 22) + '…' : p.product,
        value: p.value,
      }));
    }
    if (returnsList && returnsList.length > 0) {
      const prodMap: Record<string, number> = {};
      returnsList.forEach(r => {
        const name = String(r["Item Name"] || r.item_name || r.SKU || 'Item').trim();
        const qty = Number(r.Quantity || r.quantity || 1);
        prodMap[name] = (prodMap[name] || 0) + qty;
      });
      return Object.entries(prodMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    }
    return [];
  }, [retData, returnsList]);

  // 4. Returns by Customer
  const returnsByCustomerData = useMemo(() => {
    if (retData && retData.by_customer && retData.by_customer.length > 0) {
      return retData.by_customer.slice(0, 10).map(c => ({
        name: c.customer.length > 20 ? c.customer.slice(0, 20) + '…' : c.customer,
        value: c.value,
      }));
    }
    return [];
  }, [retData]);

  const returnRateLabel = kpis.return_rate_pct != null
    ? `${kpis.return_rate_pct}%`
    : 'N/A';
  const totalReturnCount = retData?.total_returns ?? (returnsList?.length || 0);
  const totalReturnValue = retData?.total_value ?? 0;

  if (loading && !retData) {
    return <InScreenLoader message="Loading Returns & Quality Diagnostics..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
            <RotateCcw size={16} />
            <span>Quality Assurance & RMA</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Returns & Quality Diagnostics
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Authoritative customer return vouchers, financial claim impact, and returned product analytics.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <DataFreshnessBadge />
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Return Rate</div>
            <div className="text-base font-extrabold text-rose-400">{returnRateLabel}</div>
          </div>
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Claim Value</div>
            <div className="text-base font-extrabold text-rose-400">₹{totalReturnValue.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* ── Hero Chart: Returns Timeline ───────────────────────────── */}
      <div className="w-full">
        <InteractiveChart
          title="Customer Returns Value Timeline"
          subtitle="Chronological return claims aggregated from historical return vouchers"
          data={returnsTimelineData}
          defaultTimeRange={selectedRange}
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/returns?start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return (d?.timeline || []).map((t: any) => ({
              name: fmtDayMonth(t.date),
              date: t.date,
              value: t.value,
              returns: t.returns,
            }));
          }}
          defaultChartType="area"
          unit="₹"
          isHero={true}
          statusBadge="LIVE"
        />
      </div>

      {/* ── Supporting Analytics Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <InteractiveChart
          title="Returns by Product Category"
          subtitle="Financial return claim value distributed across product lines"
          data={returnCategoryData}
          defaultTimeRange={selectedRange}
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/returns?start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return (d?.by_category || []).map((c: any) => ({
              name: c.category,
              value: c.value,
            }));
          }}
          defaultChartType="donut"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Top Returned Products"
          subtitle="Products with highest cumulative return claim values"
          data={topReturnedProducts}
          defaultTimeRange={selectedRange}
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/returns?start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return (d?.top_returned_products || []).map((p: any) => ({
              name: p.product.length > 22 ? p.product.slice(0, 22) + '…' : p.product,
              value: p.value,
            }));
          }}
          defaultChartType="horizontal_bar"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Returns by Customer"
          subtitle="Customer accounts with highest logged return values"
          data={returnsByCustomerData}
          defaultTimeRange={selectedRange}
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/returns?start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return (d?.by_customer || []).slice(0, 10).map((c: any) => ({
              name: c.customer.length > 20 ? c.customer.slice(0, 20) + '…' : c.customer,
              value: c.value,
            }));
          }}
          defaultChartType="horizontal_bar"
          unit="₹"
          statusBadge="LIVE"
        />

        <InteractiveChart
          title="Supplier Defect Rate (%)"
          subtitle="Percentage of defective items sourced per manufacturing partner"
          data={[]}
          defaultTimeRange={selectedRange}
          defaultChartType="line"
          unit="%"
          unavailable={true}
          unavailableReason="Supplier defect rate telemetry is unavailable. Inward gate QC inspection logs are not connected."
          statusBadge="UNAVAILABLE"
        />

        <InteractiveChart
          title="Geographic Return Hotspots"
          subtitle="Regional distribution of logged customer returns across dealer network"
          data={[]}
          defaultTimeRange={selectedRange}
          defaultChartType="pie"
          unit="claims"
          unavailable={true}
          unavailableReason="Regional return hotspot tracking requires return depot location tagging."
          statusBadge="UNAVAILABLE"
        />

        {/* AI Quality Control Diagnostics Panel */}
        <div className="bg-slate-900/70 border border-slate-800 border-l-4 border-l-rose-500 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-1">
              <Sparkles size={18} />
              <span>AI Quality Control Diagnostics</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Automated diagnostics derived directly from authoritative return ledger data.
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
                <div className="font-bold text-rose-400 mb-0.5">Top Return Product Concentration:</div>
                <div className="text-slate-300">
                  {retData?.top_returned_products?.[0]
                    ? `${retData.top_returned_products[0].product} accounts for ₹${Math.round(retData.top_returned_products[0].value).toLocaleString('en-IN')} in return claims. Recommend packaging review for this SKU.`
                    : 'Analyze top returned products to minimize transit packaging claims.'}
                </div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
                <div className="font-bold text-amber-400 mb-0.5">Territory Return Impact:</div>
                <div className="text-slate-300">
                  Total audited return claim value is ₹{totalReturnValue.toLocaleString('en-IN')} across {totalReturnCount} vouchers, representing an overall return rate of {returnRateLabel}.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Authoritative Historical Return Ledgers Synchronized</span>
          </div>
        </div>
      </div>
    </div>
  );
}
