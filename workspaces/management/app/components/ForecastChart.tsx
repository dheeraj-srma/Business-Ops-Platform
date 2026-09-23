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
        <div className="bg-slate-900/95 border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs backdrop-blur-md min-w-[240px]">
          <div className="flex items-center justify-between text-slate-400 font-semibold border-b border-slate-800 pb-1.5 mb-2">
            <span>{d.date || label}</span>
            {isBridge ? (
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">
                TRANSITION POINT
              </span>
            ) : isFuture ? (
              <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-1.5 py-0.5 rounded border border-purple-500/30">
                FORECAST (+{horizon}D)
              </span>
            ) : (
              <span className="text-[10px] bg-sky-500/20 text-sky-300 font-bold px-1.5 py-0.5 rounded border border-sky-500/30">
                HISTORICAL
              </span>
            )}
          </div>

          <div className="space-y-1.5 font-mono">
            {/* Sales & Purchases Tooltip */}
            {metric === 'sales_and_purchases' && (
              <>
                {d.sales_actual != null && (
                  <div className="flex items-center justify-between text-cyan-400 font-bold text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      Historical Sales:
                    </span>
                    <span>{formatValue(d.sales_actual)}</span>
                  </div>
                )}
                {d.sales_forecast != null && !isBridge && (
                  <div className="flex items-center justify-between text-purple-400 font-bold text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      Forecasted Sales:
                    </span>
                    <span>{formatValue(d.sales_forecast)}</span>
                  </div>
                )}
                {d.purchases_actual != null && (
                  <div className="flex items-center justify-between text-emerald-400 font-bold text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Historical Purchases:
                    </span>
                    <span>{formatValue(d.purchases_actual)}</span>
                  </div>
                )}
                {d.purchases_forecast != null && !isBridge && (
                  <div className="flex items-center justify-between text-amber-400 font-bold text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
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
                  <div className="flex items-center justify-between text-cyan-400 font-bold text-[13px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      Historical Actual:
                    </span>
                    <span>{formatValue(d.actual)}</span>
                  </div>
                )}
                {d.forecast != null && !isBridge && (
                  <div className="flex items-center justify-between text-purple-400 font-bold text-[13px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      Forecast Projection:
                    </span>
                    <span>{formatValue(d.forecast)}</span>
                  </div>
                )}
                {d.lowerBound != null && d.upperBound != null && !isBridge && (
                  <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-1 mt-1 flex items-center justify-between">
                    <span>80% Confidence Range:</span>
                    <span className="text-slate-200">
                      [{formatValue(d.lowerBound)} – {formatValue(d.upperBound)}]
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Procurement / Refill Tooltip */}
            {metric === 'procurement_refill' && (
              <>
                <div className="flex items-center justify-between text-violet-400 font-bold text-[13px]">
                  <span>Projected Inventory:</span>
                  <span>{formatValue(d.projected_stock)}</span>
                </div>
                <div className="flex items-center justify-between text-rose-400 text-[12px]">
                  <span>Daily Consumption:</span>
                  <span>{formatValue(d.expected_demand)}</span>
                </div>
                <div className="flex items-center justify-between text-amber-400 text-[11px] border-t border-slate-800 pt-1">
                  <span>Reorder Trigger Level:</span>
                  <span>{formatValue(d.reorder_threshold)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400 text-[11px]">
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        gap: '1rem',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid #1e293b',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* ── Header Row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TrendingUp size={18} className="text-indigo-400" style={{ flexShrink: 0 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>{title}</h3>
            {loading && <RefreshCw size={14} className="animate-spin text-indigo-400" />}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0' }}>{subtitle}</p>
        </div>

        {/* Horizon Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: '#020617', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', padding: '0 0.5rem' }}>Forecast Horizon:</span>
          {([7, 30, 90] as const).map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'monospace',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: horizon === h ? '#4f46e5' : 'transparent',
                color: horizon === h ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease'
              }}
            >
              {h} Days
            </button>
          ))}
          <button
            onClick={() => fetchData(horizon, demandShift, safetyStockFactor)}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Refresh Forecast"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Metadata Summary Grid ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', backgroundColor: 'rgba(2, 6, 23, 0.7)', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #1e293b', fontSize: '0.75rem' }}>
        <div>
          <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Historical Period</span>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
            {forecastData?.historical_period ? `${forecastData.historical_period.start} → ${forecastData.historical_period.end}` : 'Jun 1 – Sep 21'}
          </span>
          <span style={{ fontSize: '0.625rem', color: '#64748b', fontFamily: 'monospace' }}>
            {forecastData?.historical_period?.days || 113} daily observations
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Forecast Horizon</span>
          <span style={{ color: '#c084fc', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
            +{horizon} Days Projection
          </span>
          <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontFamily: 'monospace' }}>
            {forecastData?.forecast_period ? `${forecastData.forecast_period.start} → ${forecastData.forecast_period.end}` : 'Active Horizon'}
          </span>
        </div>

        {/* Dynamic Metric Display based on Chart Type */}
        {metric === 'sales_and_purchases' ? (
          <>
            <div>
              <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Sales Benchmark</span>
              <span style={{ color: '#22d3ee', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
                Latest: {formatValue(forecastData?.latest_sales)}
              </span>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                Avg Forecast: {formatValue(forecastData?.forecast_sales_avg)}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Procurement Inflow</span>
              <span style={{ color: '#34d399', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
                Latest: {formatValue(forecastData?.latest_purchases)}
              </span>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                Avg Forecast: {formatValue(forecastData?.forecast_purchases_avg)}
              </span>
            </div>
          </>
        ) : metric === 'procurement_refill' ? (
          <>
            <div>
              <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Starting Inventory</span>
              <span style={{ color: '#a78bfa', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
                {formatValue(forecastData?.starting_stock)}
              </span>
              <span style={{ fontSize: '0.625rem', color: '#64748b', fontFamily: 'monospace' }}>
                Available catalog stock
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Total Refill Needed</span>
              <span style={{ color: '#fbbf24', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
                {formatValue(forecastData?.total_replenishment_needed)}
              </span>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                Reorder by {forecastData?.reorder_milestone_date}
              </span>
            </div>
          </>
        ) : (
          <>
            <div>
              <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Latest Actual</span>
              <span style={{ color: '#22d3ee', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
                {formatValue(forecastData?.latest_actual)}
              </span>
              <span style={{ fontSize: '0.625rem', color: '#64748b', fontFamily: 'monospace' }}>
                as of Sep 21, 2026
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Forecast End / Avg</span>
              <span style={{ color: '#34d399', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
                {formatValue(forecastData?.forecast_end)}
              </span>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                Avg: {formatValue(forecastData?.forecast_avg)} ({forecastData?.expected_change_pct > 0 ? `+${forecastData?.expected_change_pct}` : forecastData?.expected_change_pct}%)
              </span>
            </div>
          </>
        )}

        <div>
          <span style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Engine & Validation</span>
          <span style={{ color: '#a5b4fc', fontWeight: 700, fontFamily: 'monospace', display: 'block', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={forecastData?.model}>
            {forecastData?.model || 'AutoETS (StatsForecast)'}
          </span>
          <span style={{ fontSize: '0.625rem', color: '#64748b', fontFamily: 'monospace' }}>
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

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />

              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                interval={xAxisInterval}
                axisLine={{ stroke: '#334155' }}
              />

              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={formatYAxis}
                axisLine={{ stroke: '#334155' }}
              />

              <Tooltip content={renderCustomTooltip} />

              {/* Forecast Begins Boundary Line */}
              {bridgeLabel && (
                <ReferenceLine
                  x={bridgeLabel}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'FORECAST BEGINS ➔',
                    position: 'insideTopRight',
                    fill: '#cbd5e1',
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
                    stroke="#06b6d4"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#06b6d4' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  {/* Forecast Sales Dashed Line */}
                  <Line
                    type="linear"
                    dataKey="sales_forecast"
                    name="Forecasted Sales"
                    stroke="#a855f7"
                    strokeWidth={2.2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#a855f7' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />

                  {/* Historical Purchases Solid Line */}
                  <Line
                    type="linear"
                    dataKey="purchases_actual"
                    name="Historical Purchases"
                    stroke="#10b981"
                    strokeWidth={2.0}
                    dot={false}
                    activeDot={{ r: 4, fill: '#10b981' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  {/* Forecast Purchases Dashed Line */}
                  <Line
                    type="linear"
                    dataKey="purchases_forecast"
                    name="Forecasted Purchases"
                    stroke="#f59e0b"
                    strokeWidth={2.0}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#f59e0b' }}
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
                    stroke="#06b6d4"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#06b6d4' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Line
                    type="linear"
                    dataKey="forecast"
                    name="Forecast Projection"
                    stroke="#a855f7"
                    strokeWidth={2.2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#a855f7' }}
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
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#8b5cf6' }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="expected_demand"
                    name="Daily Demand Consumption"
                    stroke="#f43f5e"
                    strokeWidth={2.0}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#f43f5e' }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="step"
                    dataKey="reorder_threshold"
                    name="Reorder Trigger Level"
                    stroke="#f59e0b"
                    strokeWidth={1.8}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="step"
                    dataKey="safety_buffer"
                    name="Safety Buffer Reserve"
                    stroke="#10b981"
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
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2, 6, 23, 0.4)', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
              <RefreshCw size={14} className="animate-spin text-indigo-400" />
              <span>Generating StatsForecast models...</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Legend Footer ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', paddingTop: '0.625rem', borderTop: '1px solid #1e293b', fontSize: '0.75rem', color: '#94a3b8', flexWrap: 'wrap' }}>
        {metric === 'sales_and_purchases' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '2px', backgroundColor: '#06b6d4', borderRadius: '1px' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Historical Sales (units/day)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '0', borderTop: '2px dashed #a855f7' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Forecasted Sales ({forecastData?.model ? forecastData.model.split('|')[0].replace('Sales:', '').trim() : 'AutoETS'})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '2px', backgroundColor: '#10b981', borderRadius: '1px' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Historical Purchases (units/day)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '0', borderTop: '2px dashed #f59e0b' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Forecasted Purchases ({forecastData?.model && forecastData.model.includes('|') ? forecastData.model.split('|')[1].replace('Purchases:', '').trim() : 'AutoARIMA'})</span>
            </div>
          </>
        )}

        {(metric === 'demand' || metric === 'profit') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '2px', backgroundColor: '#06b6d4', borderRadius: '1px' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Historical Actual ({unit})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '0', borderTop: '2px dashed #a855f7' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Forecast Projection ({forecastData?.model || 'AutoETS'})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '0.875rem', height: '0.625rem', backgroundColor: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '2px' }} />
              <span style={{ fontWeight: 600, color: '#cbd5e1' }}>80% Prediction Interval</span>
            </div>
          </>
        )}

        {metric === 'procurement_refill' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '2px', backgroundColor: '#8b5cf6', borderRadius: '1px' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Projected Inventory Stock</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '0', borderTop: '2px dashed #f43f5e' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Daily Demand Consumption</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '0', borderTop: '2px dashed #f59e0b' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Reorder Trigger Level</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '1rem', height: '0', borderTop: '2px dashed #10b981' }} />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Safety Buffer</span>
            </div>
          </>
        )}
      </div>

      {/* ── Actionable Analytical Insights Banner ────────────────────────────── */}
      {forecastData?.insights && forecastData.insights.length > 0 && (
        <div style={{ backgroundColor: 'rgba(2, 6, 23, 0.5)', borderRadius: '0.5rem', padding: '0.75rem 1rem', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 700, color: '#f1f5f9', textTransform: 'uppercase', fontSize: '0.625rem', letterSpacing: '0.05em' }}>
            <Info size={13} className="text-indigo-400" />
            <span>Key Forecast Intelligence</span>
          </div>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.7rem', lineHeight: '1.4' }}>
            {forecastData.insights.map((ins: string, idx: number) => (
              <li key={idx}>{ins}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Audit Basis Note for Profit */}
      {forecastData?.audit_info && (
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.7rem', color: '#fcd34d', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Cost Basis Audit Note:</strong> {forecastData.audit_info.cogs_basis}. {forecastData.audit_info.data_integrity}
          </div>
        </div>
      )}
    </div>
  );
}
