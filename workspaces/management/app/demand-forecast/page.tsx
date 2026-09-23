'use client';

import React from 'react';
import { useBi } from '../context/BiDataContext';
import AIDecisionIntelligence from '../analytics/AIDecisionIntelligence';
import DataFreshnessBadge from '../components/DataFreshnessBadge';
import { Sparkles, Brain, Cpu, TrendingUp } from 'lucide-react';
import { InScreenLoader } from '../components/common/InScreenLoader';

export default function DemandForecastPage() {
  const {
    inventoryList,
    ordersList,
    returnsList,
    suppliersList,
    inwardsList,
    biData,
    loading
  } = useBi();

  if (loading) {
    return <InScreenLoader message="Loading AI Demand Forecast & Predictive Modeling..." />;
  }

  return (
    <div className="space-y-6">
      {/* Module Banner */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-lg mb-1">
            <Sparkles size={22} className="text-indigo-600 dark:text-indigo-400" />
            <span>AI Demand Forecast & Scenario Simulator</span>
          </div>
          <p className="text-xs md:text-sm text-slate-400">
            Multi-variate predictive demand modeling, dynamic safety buffer calculations, simulated stockout probabilities, and automated PO reordering proposals.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          <DataFreshnessBadge />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-cyan-800/40 text-xs text-indigo-700 dark:text-indigo-300 font-mono">
            <Brain size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>Scenario Simulator</span>
          </div>
        </div>
      </div>

      {/* Main Intelligence Engine View */}
      <AIDecisionIntelligence
        inventoryList={inventoryList}
        ordersList={ordersList}
        returnsList={returnsList}
        suppliersList={suppliersList}
        inwardsList={inwardsList}
        biData={biData}
      />
    </div>
  );
}
