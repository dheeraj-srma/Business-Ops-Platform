'use client';

import React from 'react';
import { useBi } from '../context/BiDataContext';
import AIDecisionIntelligence from '../analytics/AIDecisionIntelligence';
import DataFreshnessBadge from '../components/DataFreshnessBadge';
import { Sparkles, Brain, Cpu, TrendingUp } from 'lucide-react';

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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading AI Demand Intelligence Model...</p>
        </div>
      </div>
    );
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
