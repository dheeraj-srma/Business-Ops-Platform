'use client';

import React, { useMemo } from 'react';
import { 
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Target,
  Clock,
  ArrowUpRight,
  PackageCheck,
  Users
} from 'lucide-react';

export interface ExplorerData {
  entity_type: string;
  query: string;
  summary: {
    total_revenue: number;
    order_count: number;
    units_sold: number;
    customer_count: number;
    aov: number;
    active_days: number;
    first_date?: string | null;
    last_date?: string | null;
    return_rate_pct?: number;
  };
  entity_info: Record<string, any>;
  timeline: Array<{ date: string; name: string; revenue: number; value: number; orders: number; units?: number }>;
  distribution: Array<{ name: string; value: number; units?: number; orders?: number; category?: string }>;
  monthly_trend: Array<{ name: string; month: string; revenue: number; value: number; units?: number; orders: number }>;
  ticket_distribution: Array<{ name: string; range: string; count: number; value: number }>;
  recent_transactions: Array<any>;
}

interface ExplorerAIInsightsProps {
  explorerType: string;
  searchQuery: string;
  explorerData?: ExplorerData | null;
  inventoryItem?: any;
}

export default function ExplorerAIInsights({
  explorerType,
  searchQuery,
  explorerData,
  inventoryItem
}: ExplorerAIInsightsProps) {
  const summary = explorerData?.summary;
  const entityInfo = explorerData?.entity_info || {};
  const timeline = explorerData?.timeline || [];
  const distribution = explorerData?.distribution || [];

  // Compute calculated intelligence cards based on real transaction data
  const insights = useMemo(() => {
    if (!summary) return null;

    const rev = summary.total_revenue || 0;
    const orders = summary.order_count || 0;
    const units = summary.units_sold || 0;
    const days = summary.active_days || 1;
    const aov = summary.aov || (orders > 0 ? rev / orders : 0);

    const dailyBurnRate = days > 0 ? (units > 0 ? units / days : rev / days) : 0;
    const isProduct = explorerType.toLowerCase() === 'product';
    const isCategory = explorerType.toLowerCase() === 'category';
    const isCustomer = explorerType.toLowerCase() === 'customer';
    const isSalesman = explorerType.toLowerCase() === 'salesman';
    const isSupplier = explorerType.toLowerCase() === 'supplier';
    const isLocation = explorerType.toLowerCase() === 'location';

    // 1. Diagnostic Card 1: Velocity & Momentum
    let diagnosticTitle = 'Velocity & Commercial Momentum';
    let diagnosticStatus = 'OPTIMAL';
    let diagnosticBadgeColor = 'emerald';
    let diagnosticText = '';

    if (isProduct || isCategory) {
      const stock = Number(inventoryItem?.['Current Stock'] || inventoryItem?.stock || 0);
      const daysOfStock = dailyBurnRate > 0 && stock > 0 ? Math.round(stock / dailyBurnRate) : null;
      if (stock === 0 && units > 0) {
        diagnosticStatus = 'DEPLETED';
        diagnosticBadgeColor = 'rose';
        diagnosticText = `Zero physical inventory registered. High past demand (${units.toLocaleString('en-IN')} units across ${orders} orders) indicates an active backorder risk.`;
      } else if (daysOfStock !== null && daysOfStock <= 10) {
        diagnosticStatus = 'CRITICAL STOCKOUT';
        diagnosticBadgeColor = 'rose';
        diagnosticText = `Burn rate of ${dailyBurnRate.toFixed(1)} units/trading day will deplete remaining ${stock} units in ~${daysOfStock} days. Priority warehouse replenishment required.`;
      } else if (daysOfStock !== null && daysOfStock <= 30) {
        diagnosticStatus = 'REORDER SOON';
        diagnosticBadgeColor = 'amber';
        diagnosticText = `Healthy demand cadence (${dailyBurnRate.toFixed(1)} units/day). Inventory coverage is estimated at ${daysOfStock} days. Standard procurement recommended.`;
      } else {
        diagnosticStatus = 'STABLE HOLDING';
        diagnosticBadgeColor = 'emerald';
        diagnosticText = `Continuous demand with verified realization of ₹${rev.toLocaleString('en-IN')}. Active distribution across ${summary.customer_count || 1} distinct retail trade accounts.`;
      }
    } else if (isCustomer) {
      diagnosticTitle = 'Account Purchasing Cadence & Churn Risk';
      const activeTradingDays = summary.active_days;
      if (activeTradingDays >= 10) {
        diagnosticStatus = 'KEY ENTERPRISE ACCOUNT';
        diagnosticBadgeColor = 'indigo';
        diagnosticText = `High purchasing frequency with ${orders} orders totaling ₹${rev.toLocaleString('en-IN')}. Average ticket size is ₹${Math.round(aov).toLocaleString('en-IN')}.`;
      } else if (activeTradingDays >= 3) {
        diagnosticStatus = 'ACTIVE REGULAR';
        diagnosticBadgeColor = 'emerald';
        diagnosticText = `Steady recurring customer with ${orders} orders. Primary relationship managed by Salesman "${entityInfo.salesman || 'Direct'}".`;
      } else {
        diagnosticStatus = 'OCCASIONAL BUYER';
        diagnosticBadgeColor = 'amber';
        diagnosticText = `Recorded ${orders} transaction(s). Recommending targeted salesman follow-up to expand catalog basket size and repeat cycle.`;
      }
    } else if (isSalesman) {
      diagnosticTitle = 'Territory Sales Performance & Reach';
      diagnosticStatus = 'FIELD PRODUCTIVITY';
      diagnosticBadgeColor = 'indigo';
      diagnosticText = `Generated ₹${rev.toLocaleString('en-IN')} across ${summary.customer_count} verified partner dealers with ${orders} executed sales orders. Average order realization is ₹${Math.round(aov).toLocaleString('en-IN')}.`;
    } else {
      diagnosticStatus = 'ACTIVE LEDGER';
      diagnosticBadgeColor = 'indigo';
      diagnosticText = `Total trading volume of ₹${rev.toLocaleString('en-IN')} across ${orders} transactions spanning ${days} trading days.`;
    }

    // 2. Actionable Recommendation Card
    let recTitle = 'Strategic Recommendation';
    let recText = '';
    let recMetric = '';

    if (isProduct || isCategory) {
      recTitle = 'Fulfillment & Sourcing Advisory';
      const topDealer = distribution[0]?.name || 'Primary Dealers';
      const topDealerShare = distribution[0] && rev > 0 ? Math.round((distribution[0].value / rev) * 100) : null;
      recMetric = `Top Contributor: ${topDealer} ${topDealerShare ? `(${topDealerShare}%)` : ''}`;
      recText = `Channel demand is led by "${topDealer}". Recommend aligning safety stock parameters and maintaining minimum 21-day buffer at regional hubs.`;
    } else if (isCustomer) {
      recTitle = 'Dealer Commercial Strategy';
      const topProd = distribution[0]?.name || 'Top Line Products';
      recMetric = `Preferred Line: ${topProd}`;
      recText = `Highest purchase volume is concentrated in "${topProd}". Proactively propose cross-sell promotions for complementary fittings and accessories.`;
    } else if (isSalesman) {
      recTitle = 'Account Expansion Directive';
      const topAccount = distribution[0]?.name || 'Key Account';
      recMetric = `Leading Account: ${topAccount}`;
      recText = `Core revenue driver is "${topAccount}". Prioritize re-engaging long-tail accounts to diversify revenue spread across assigned territory.`;
    } else {
      recTitle = 'Operational Recommendation';
      recMetric = `Active Trading Span: ${summary.first_date || 'N/A'} to ${summary.last_date || 'N/A'}`;
      recText = `Reconciled across verified sales vouchers. Ensure continuous inventory allocation for core moving lines.`;
    }

    return {
      diagnosticTitle,
      diagnosticStatus,
      diagnosticBadgeColor,
      diagnosticText,
      recTitle,
      recMetric,
      recText
    };
  }, [summary, entityInfo, explorerType, inventoryItem, distribution]);

  if (!insights) return null;

  const badgeClass =
    insights.diagnosticBadgeColor === 'rose'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      : insights.diagnosticBadgeColor === 'amber'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : insights.diagnosticBadgeColor === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';

  return (
    <div className="bg-slate-900/70 border border-slate-800 border-l-4 border-l-indigo-500 rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
          <Sparkles size={18} className="text-indigo-400 animate-pulse" />
          <span>AI Contextual Diagnostics & Strategic Advisory</span>
        </div>
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">
          Live Reconciled Model
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Card 1: Diagnostic */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {insights.diagnosticTitle}
              </span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${badgeClass}`}>
                {insights.diagnosticStatus}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {insights.diagnosticText}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-3 pt-2 border-t border-slate-800/60">
            <Clock size={12} className="text-slate-400" />
            <span>Active Trading Span: {summary?.first_date || 'N/A'} – {summary?.last_date || 'N/A'}</span>
          </div>
        </div>

        {/* Card 2: Recommendation */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {insights.recTitle}
              </span>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {insights.recMetric}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {insights.recText}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/90 font-mono mt-3 pt-2 border-t border-slate-800/60">
            <Zap size={12} className="text-emerald-400" />
            <span>Recommended Action: Maintain active partner touchpoints and align procurement buffer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
