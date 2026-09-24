'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  RefreshCw,
  Info,
  AlertCircle
} from 'lucide-react';

export interface ForecastChartProps {
  metric: 'sales_and_purchases' | 'demand' | 'profit' | 'procurement_refill';
  title: string;
  subtitle: string;
  unit: string;
  defaultHorizon?: 7 | 30 | 90;
  demandShift?: number;
  safetyStockFactor?: number;
}

export default function ForecastChart({
  metric,
  title,
  subtitle,
  unit,
  defaultHorizon = 7,
  demandShift = 0,
  safetyStockFactor = 1.0
}: ForecastChartProps) {
  const [horizon, setHorizon] = useState<7 | 30 | 90>(defaultHorizon);
  const [forecastData, setForecastData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchData = useCallback(async (h: number, shift: number, ssFactor: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/forecast?metric=${metric}&horizon=${h}&demand_shift=${shift}&safety_stock_factor=${ssFactor}`);
      if (res.ok) {
        const data = await res.json();
        setForecastData(data);
      }
    } catch (err) {
      console.error(`Error fetching forecast for ${metric}:`, err);
    } finally {
      setLoading(false);
    }
  }, [metric]);

  useEffect(() => {
    fetchData(horizon, demandShift, safetyStockFactor);
  }, [horizon, demandShift, safetyStockFactor, fetchData]);

  const timeline = useMemo(() => {
    return forecastData?.timeline || [];
  }, [forecastData]);

  const bridgePoint = useMemo(() => {
    return timeline.find((d: any) => d.is_boundary);
  }, [timeline]);

  const bridgeLabel = useMemo(() => {
    return bridgePoint?.name || '';
  }, [bridgePoint]);

  // Format Y-axis tick values (units vs ₹)
  const formatYAxis = useCallback((val: number) => {
    if (val == null || isNaN(val)) return '0';
    if (unit === '₹') {
      if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
      if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
      if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
      return `₹${val}`;
    }
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return `${val}`;
  }, [unit]);

  const formatValue = useCallback((val: number) => {
    if (val == null || isNaN(val)) return '—';
    if (unit === '₹') {
      return `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    }
    return `${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 1 })} ${unit}`;
  }, [unit]);

  // Dynamic X-Axis tick interval for clean readability
  const xAxisInterval = useMemo(() => {
    const total = timeline.length;
    if (total <= 14) return 0;
    if (total <= 35) return 2;
    if (total <= 80) return 5;
    return Math.ceil(total / 15);
  }, [timeline.length]);

  // Safe deterministic SVG Gradient ID
  const gradId = useMemo(() => `forecast_grad_${metric}`, [metric]);

  // Custom tooltips depending on chart type
  const renderCustomTooltip = (props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      const d = payload[0]?.payload;
      if (!d) return null;

      const isBridge = d.is_boundary;
      const isFuture = metric === 'procurement_refill' ? true : (d.actual == null && d.sales_actual == null && !isBridge);

      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3.5 rounded-xl shadow-xl text-xs backdrop-blur-md min-w-[240px] text-slate-800 dark:text-slate-100">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-2">
            <span>{d.date || label}</span>
            {isBridge ? (
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/30">
                TRANSITION POINT
              </span>
            ) : isFuture ? (
              <span className="text-[10px] bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                FORECAST (+{horizon}D)
              </span>
            ) : (
              <span className="text-[10px] bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-500/30">
                HISTORICAL
              </span>
            )}
          </div>

          <div className="space-y-1.5 font-mono">
            {/* Sales & Purchases Tooltip */}
            {metric === 'sales_and_purchases' && (
              <>
                {d.sales_actual != null && (
                  <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 font-bold text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      Historical Sales:
                    </span>
                    <span>{formatValue(d.sales_actual)}</span>
                  </div>
                )}
                {d.sales_forecast != null && !isBridge && (
                  <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 font-bold text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Forecasted Sales:
                    </span>
                    <span>{formatValue(d.sales_forecast)}</span>
                  </div>
                )}
                {d.purchases_actual != null && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Historical Purchases:
                    </span>
                    <span>{formatValue(d.purchases_actual)}</span>
                  </div>
                )}
                {d.purchases_forecast != null && !isBridge && (
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-bold text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Forecasted Purchases:
                    </span>
                    <span>{formatValue(d.purchases_forecast)}</span>
                  </div>
                )}
              </>
            )}

            {/* Standard Single Series (Demand, Profit) Tooltip */}
            {(metric === 'demand' || metric === 'profit') && (
              <>
                {d.actual != null && (
                  <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 font-bold text-[13px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      Historical Actual:
                    </span>
                    <span>{formatValue(d.actual)}</span>
                  </div>
                )}
                {d.forecast != null && !isBridge && (
                  <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 font-bold text-[13px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Forecast Projection:
                    </span>
                    <span>{formatValue(d.forecast)}</span>
                  </div>
                )}
                {d.lowerBound != null && d.upperBound != null && !isBridge && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-1 mt-1 flex items-center justify-between">
                    <span>80% Confidence Range:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">
                      [{formatValue(d.lowerBound)} – {formatValue(d.upperBound)}]
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Procurement / Refill Tooltip */}
            {metric === 'procurement_refill' && (
              <>
                <div className="flex items-center justify-between text-violet-600 dark:text-violet-400 font-bold text-[13px]">
                  <span>Projected Inventory:</span>
                  <span>{formatValue(d.projected_stock)}</span>
                </div>
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-[12px]">
                  <span>Daily Consumption:</span>
                  <span>{formatValue(d.expected_demand)}</span>
                </div>
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-[11px] border-t border-slate-200 dark:border-slate-800 pt-1">
                  <span>Reorder Trigger Level:</span>
                  <span>{formatValue(d.reorder_threshold)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px]">
                  <span>Safety Stock Buffer:</span>
                  <span>{formatValue(d.safety_buffer)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col w-full box-border gap-4 bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs dark:shadow-2xl">
      {/* ── Header Row ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 m-0">{title}</h3>
            {loading && <RefreshCw size={14} className="animate-spin text-indigo-600 dark:text-indigo-400" />}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">{subtitle}</p>
        </div>

        {/* Horizon Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 px-2">Forecast Horizon:</span>
          {([7, 30, 90] as const).map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-3 py-1 rounded-md text-xs font-semibold font-mono cursor-pointer transition-all border-none ${
                horizon === h
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {h} Days
            </button>
          ))}
          <button
            onClick={() => fetchData(horizon, demandShift, safetyStockFactor)}
            className="p-1.5 rounded-md bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-none cursor-pointer"
            title="Refresh Forecast"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Metadata Summary Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 bg-slate-50 dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
        <div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Historical Period</span>
          <span className="text-slate-900 dark:text-slate-100 font-bold font-mono block mt-0.5">
            {forecastData?.historical_period ? `${forecastData.historical_period.start} → ${forecastData.historical_period.end}` : 'Jun 1 – Sep 21'}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            {forecastData?.historical_period?.days || 113} daily observations
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Forecast Horizon</span>
          <span className="text-purple-600 dark:text-purple-300 font-bold font-mono block mt-0.5">
            +{horizon} Days Projection
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            {forecastData?.forecast_period ? `${forecastData.forecast_period.start} → ${forecastData.forecast_period.end}` : 'Active Horizon'}
          </span>
        </div>

        {/* Dynamic Metric Display based on Chart Type */}
        {metric === 'sales_and_purchases' ? (
          <>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Sales Benchmark</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-bold font-mono block mt-0.5">
                Latest: {formatValue(forecastData?.latest_sales)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Avg Forecast: {formatValue(forecastData?.forecast_sales_avg)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Procurement Inflow</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono block mt-0.5">
                Latest: {formatValue(forecastData?.latest_purchases)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Avg Forecast: {formatValue(forecastData?.forecast_purchases_avg)}
              </span>
            </div>
          </>
        ) : metric === 'procurement_refill' ? (
          <>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Starting Inventory</span>
              <span className="text-purple-600 dark:text-purple-300 font-bold font-mono block mt-0.5">
                {formatValue(forecastData?.starting_stock)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Available catalog stock
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Total Refill Needed</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold font-mono block mt-0.5">
                {formatValue(forecastData?.total_replenishment_needed)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Reorder by {forecastData?.reorder_milestone_date}
              </span>
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Latest Actual</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-bold font-mono block mt-0.5">
                {formatValue(forecastData?.latest_actual)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                as of Sep 21, 2026
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Forecast End / Avg</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono block mt-0.5">
                {formatValue(forecastData?.forecast_end)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Avg: {formatValue(forecastData?.forecast_avg)} ({forecastData?.expected_change_pct > 0 ? `+${forecastData?.expected_change_pct}` : forecastData?.expected_change_pct}%)
              </span>
            </div>
          </>
        )}

        <div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Engine & Validation</span>
          <span className="text-indigo-600 dark:text-indigo-300 font-bold font-mono block mt-0.5 truncate" title={forecastData?.model}>
            {forecastData?.model || 'AutoETS (StatsForecast)'}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            {forecastData?.backtest?.mape != null ? `${forecastData.backtest.mape}% holdout MAPE` : '14-day holdout backtest'}
          </span>
        </div>
      </div>

      {/* ── Main Full-Width Chart Canvas ─────────────────────────────────────── */}
      <div style={{ width: '100%', height: '380px', minHeight: '380px', position: 'relative' }}>
        {isMounted && timeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={380} minHeight={380}>
            <ComposedChart
              data={timeline}
              margin={{ top: 15, right: 25, left: 10, bottom: 25 }}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity={0.03} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #cbd5e1)" opacity={0.6} />

              <XAxis
                dataKey="name"
                stroke="var(--chart-axis, #64748b)"
                fontSize={11}
                tickLine={false}
                interval={xAxisInterval}
                axisLine={{ stroke: 'var(--chart-grid, #cbd5e1)' }}
              />

              <YAxis
                stroke="var(--chart-axis, #64748b)"
                fontSize={11}
                tickLine={false}
                tickFormatter={formatYAxis}
                axisLine={{ stroke: 'var(--chart-grid, #cbd5e1)' }}
              />

              <Tooltip content={renderCustomTooltip} />

              {/* Forecast Begins Boundary Line */}
              {bridgeLabel && (
                <ReferenceLine
                  x={bridgeLabel}
                  stroke="var(--accent, #6366f1)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'FORECAST BEGINS ➔',
                    position: 'insideTopRight',
                    fill: 'var(--accent, #6366f1)',
                    fontSize: 10,
                    fontWeight: 700,
                    offset: 10
                  }}
                />
              )}

              {/* ── CASE 1: Combined Sales & Purchases ── */}
              {metric === 'sales_and_purchases' && (
                <>
                  {/* Historical Sales Solid Line */}
                  <Line
                    type="linear"
                    dataKey="sales_actual"
                    name="Historical Sales"
                    stroke="#0284c7"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#0284c7' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  {/* Forecast Sales Dashed Line */}
                  <Line
                    type="linear"
                    dataKey="sales_forecast"
                    name="Forecasted Sales"
                    stroke="#9333ea"
                    strokeWidth={2.2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#9333ea' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />

                  {/* Historical Purchases Solid Line */}
                  <Line
                    type="linear"
                    dataKey="purchases_actual"
                    name="Historical Purchases"
                    stroke="#059669"
                    strokeWidth={2.0}
                    dot={false}
                    activeDot={{ r: 4, fill: '#059669' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  {/* Forecast Purchases Dashed Line */}
                  <Line
                    type="linear"
                    dataKey="purchases_forecast"
                    name="Forecasted Purchases"
                    stroke="#d97706"
                    strokeWidth={2.0}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#d97706' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </>
              )}

              {/* ── CASE 2: Single Series (Demand, Profit) ── */}
              {(metric === 'demand' || metric === 'profit') && (
                <>
                  <Area
                    type="linear"
                    dataKey="upperBound"
                    stroke="rgba(192, 132, 252, 0.4)"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                    fill={`url(#${gradId})`}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Line
                    type="linear"
                    dataKey="actual"
                    name="Historical Actual"
                    stroke="#0284c7"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#0284c7' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Line
                    type="linear"
                    dataKey="forecast"
                    name="Forecast Projection"
                    stroke="#9333ea"
                    strokeWidth={2.2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#9333ea' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </>
              )}

              {/* ── CASE 3: Procurement & Refill Depletion ── */}
              {metric === 'procurement_refill' && (
                <>
                  <Line
                    type="monotone"
                    dataKey="projected_stock"
                    name="Projected Inventory Stock"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#7c3aed' }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="expected_demand"
                    name="Daily Demand Consumption"
                    stroke="#e11d48"
                    strokeWidth={2.0}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#e11d48' }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="step"
                    dataKey="reorder_threshold"
                    name="Reorder Trigger Level"
                    stroke="#d97706"
                    strokeWidth={1.8}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="step"
                    dataKey="safety_buffer"
                    name="Safety Buffer Reserve"
                    stroke="#059669"
                    strokeWidth={1.8}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
              <RefreshCw size={14} className="animate-spin text-indigo-600 dark:text-indigo-400" />
              <span>Generating StatsForecast models...</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Legend Footer ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-6 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
        {metric === 'sales_and_purchases' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#0284c7] rounded-xs" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Historical Sales (units/day)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t-2 border-dashed border-[#9333ea]" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Forecasted Sales ({forecastData?.model ? forecastData.model.split('|')[0].replace('Sales:', '').trim() : 'AutoETS'})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#059669] rounded-xs" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Historical Purchases (units/day)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t-2 border-dashed border-[#d97706]" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Forecasted Purchases ({forecastData?.model && forecastData.model.includes('|') ? forecastData.model.split('|')[1].replace('Purchases:', '').trim() : 'AutoARIMA'})</span>
            </div>
          </>
        )}

        {(metric === 'demand' || metric === 'profit') && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#0284c7] rounded-xs" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Historical Actual ({unit})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t-2 border-dashed border-[#9333ea]" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Forecast Projection ({forecastData?.model || 'AutoETS'})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 bg-purple-500/20 border border-purple-500/40 rounded-xs" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">80% Prediction Interval</span>
            </div>
          </>
        )}

        {metric === 'procurement_refill' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#7c3aed] rounded-xs" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Projected Inventory Stock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t-2 border-dashed border-[#e11d48]" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Daily Demand Consumption</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t-2 border-dashed border-[#d97706]" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Reorder Trigger Level</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t-2 border-dashed border-[#059669]" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Safety Buffer</span>
            </div>
          </>
        )}
      </div>

      {/* ── Actionable Analytical Insights Banner ────────────────────────────── */}
      {forecastData?.insights && forecastData.insights.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-3.5 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 uppercase text-[10px] tracking-wider">
            <Info size={13} className="text-indigo-600 dark:text-indigo-400" />
            <span>Key Forecast Intelligence</span>
          </div>
          <ul className="list-disc pl-4 m-0 flex flex-col gap-1 text-[11px] leading-relaxed">
            {forecastData.insights.map((ins: string, idx: number) => (
              <li key={idx}>{ins}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Audit Basis Note for Profit */}
      {forecastData?.audit_info && (
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <strong className="font-bold">Cost Basis Audit Note:</strong> {forecastData.audit_info.cogs_basis}. {forecastData.audit_info.data_integrity}
          </div>
        </div>
      )}
    </div>
  );
}
