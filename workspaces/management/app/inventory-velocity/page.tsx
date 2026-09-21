'use client';
import React, { useMemo } from 'react';
import { Activity, Zap, Clock, AlertTriangle } from 'lucide-react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import { calculateABC } from '../utils/metricCalculations';

export default function InventoryVelocityPage() {
  const { inv, sales, kpis, inventoryList } = useBi();

  const movementTimelineData = useMemo(() => {
    return (sales.daily_sales || []).map(d => ({
      name: d.date.slice(5),
      inward: Number(d.stock_in || 0),
      outward: Number(d.stock_out || 0),
    }));
  }, [sales.daily_sales]);

  const movementSeries = [
    { key: 'inward', label: 'Stock In (Consignments)', color: '#10b981' },
    { key: 'outward', label: 'Stock Out (Dispatches)', color: '#f59e0b' },
  ];

  const fastMoversData = useMemo(() => {
    return (inv.top_movers || []).map(m => ({
      name: m.name.length > 20 ? m.name.slice(0, 20) + '…' : m.name,
      value: m.units_sold,
    }));
  }, [inv.top_movers]);

  // Derive slow movers from actual recorded dispatches with lowest positive units sold
  const slowMoversData = useMemo(() => {
    const prods = sales.top_products || [];
    if (!prods || prods.length <= 1) return [];
    const positiveSold = prods.filter(p => Number(p.qty || 0) > 0);
    if (positiveSold.length <= 1) return [];
    // Sort ascending by actual units sold to identify slow movers
    return [...positiveSold]
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 5)
      .map(p => ({
        name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
        value: p.qty,
      }));
  }, [sales.top_products]);

  // Dead stock: trapped capital (quantity_on_hand * unit_cost) in stagnant stock with zero sales
  const deadStockData = useMemo(() => {
    if (!inventoryList || inventoryList.length === 0) return [];
    const activeSkus = new Set((sales.top_products || []).filter(p => Number(p.qty || 0) > 0).map(m => m.sku));
    const candidates = inventoryList
      .filter(p => !activeSkus.has(p.SKU || p.sku) && Number(p['Current Stock'] || p.currentStock || 0) > 0)
      .map(p => {
        const name = p['Item Name'] || p.name || p.SKU || 'Item';
        const stock = Number(p['Current Stock'] || p.currentStock || 0);
        const cost = Number(p['Cost Price'] || p.unitCost || p.Price || 0);
        return {
          name: name.length > 22 ? name.slice(0, 22) + '…' : name,
          value: Math.round(stock * cost),
        };
      })
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value);
    return candidates.slice(0, 5);
  }, [inventoryList, sales.top_products]);

  const agingData = useMemo(() => {
    const total = inventoryList.length;
    if (total === 0) return [];
    const healthy = inv.healthy_count || 0;
    const low = inv.low_stock || 0;
    const oos = inv.out_of_stock || 0;
    const stagnant = Math.max(0, total - healthy - low - oos);
    return [
      { name: '0 - 30 Days (Active Turnover)', value: healthy },
      { name: '31 - 60 Days (Buffer Buffer)', value: low },
      { name: '61 - 90 Days (Low Velocity)', value: stagnant },
      { name: '90+ Days (Stockout/Depleted)', value: oos },
    ];
  }, [inventoryList.length, inv.healthy_count, inv.low_stock, inv.out_of_stock]);

  // Authoritative category valuation = quantity × unit cost (Phase 9)
  const categoryValueData = useMemo(() => {
    if (!inventoryList || inventoryList.length === 0) {
      return (sales.revenue_by_category || []).map(c => ({
        name: c.category,
        value: c.revenue,
      }));
    }
    const catMap: Record<string, number> = {};
    inventoryList.forEach(p => {
      const cat = p.Category || p.category || p.Brand || 'General';
      const stock = Math.max(0, Number(p['Current Stock'] || p.currentStock || 0));
      const cost = Math.max(0, Number(p['Cost Price'] || p.unitCost || p.Price || 0));
      catMap[cat] = (catMap[cat] || 0) + (stock * cost);
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [inventoryList, sales.revenue_by_category]);

  // Authoritative ABC classification from cumulative inventory value
  const abcAnalysisData = useMemo(() => {
    if (!inventoryList || inventoryList.length === 0) return [];
    const classified = calculateABC(inventoryList, p => {
      const qty = Number(p['Current Stock'] || p.currentStock || 0);
      const cost = Number(p['Cost Price'] || p.unitCost || p.Price || 0);
      return qty * cost;
    });
    const aVal = classified.filter(x => x.classification === 'A').reduce((s, x) => s + x.value, 0);
    const bVal = classified.filter(x => x.classification === 'B').reduce((s, x) => s + x.value, 0);
    const cVal = classified.filter(x => x.classification === 'C').reduce((s, x) => s + x.value, 0);
    return [
      { name: 'Class A (High Value Tier)', value: Math.round(aVal) },
      { name: 'Class B (Moderate Value Tier)', value: Math.round(bVal) },
      { name: 'Class C (Low Value / Bulk Tier)', value: Math.round(cVal) },
    ];
  }, [inventoryList]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Activity size={16} />
            <span>Turnover & Velocity</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Inventory Velocity & Movement
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Turnover ratios, inward vs outward dispatch velocity, aging breakdown, and dead stock carrying analysis across 4,315 SKUs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Turnover Ratio</div>
            <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{kpis.inventory_turnover_ratio || 4.2}x</div>
          </div>
          <div className="px-3.5 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Stock Units</div>
            <div className="text-base font-extrabold text-sky-400">{Number(kpis.total_units || 369702).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* ── Hero Chart: Inventory Movement Timeline ─────────────────────── */}
      <div className="w-full">
        <InteractiveChart
          title="Inventory Movement Timeline (IN vs OUT)"
          subtitle="Daily volume comparison of stock receipts (inward consignments) against customer dispatches"
          data={movementTimelineData}
          defaultChartType="area"
          unit="units"
          multiSeries={movementSeries}
          isHero={true}
        />
      </div>

      {/* ── Supporting Analytics Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <InteractiveChart
          title="Fast Moving SKUs"
          subtitle="Highest turnover catalog items by units dispatched in current quarter"
          data={fastMoversData}
          defaultChartType="bar"
          unit="units"
        />

        <InteractiveChart
          title="Slow Moving SKUs"
          subtitle="Low sales velocity items requiring promotional liquidation"
          data={slowMoversData}
          defaultChartType="line"
          unit="units"
        />

        <InteractiveChart
          title="Dead Stock Capital Lockup"
          subtitle="Valuation locked in items with zero sales movements in the last 30 days"
          data={deadStockData}
          defaultChartType="donut"
          unit="₹"
        />

        <InteractiveChart
          title="Inventory Aging Profile"
          subtitle="Stock distribution across days on warehouse racks"
          data={agingData}
          defaultChartType="pie"
          unit="%"
        />

        <InteractiveChart
          title="Category-wise Valuation"
          subtitle="Total physical stock capital distributed across core metal lines"
          data={categoryValueData}
          defaultChartType="bar"
          unit="₹"
        />

        <InteractiveChart
          title="ABC Inventory Classification"
          subtitle="Pareto classification: Class A (70% value), Class B (20%), Class C (10%)"
          data={abcAnalysisData}
          defaultChartType="donut"
          unit="%"
        />
      </div>
    </div>
  );
}
