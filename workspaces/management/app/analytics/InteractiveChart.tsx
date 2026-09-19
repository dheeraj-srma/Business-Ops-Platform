'use client';
import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter
} from 'recharts';
import {
  BarChart3,
  Maximize2,
  Download,
  RotateCcw,
  Sliders
} from 'lucide-react';

export type ChartType =
  | 'bar'
  | 'horizontal'
  | 'area'
  | 'line'
  | 'pie'
  | 'donut'
  | 'radar'
  | 'scatter'
  | 'table'
  | 'kpi';

export type TimeFilter = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type ComparePeriod = 'none' | 'prev_period' | 'yoy';

interface DataPoint {
  name: string;
  value: number;
  value2?: number;
  category?: string;
  [key: string]: unknown;
}

interface InteractiveChartProps {
  title: string;
  subtitle?: string;
  data: DataPoint[];
  dataKey?: string;
  dataKey2?: string;
  defaultChartType?: ChartType;
  unit?: string;
  onExpand?: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#c084fc', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];

export default function InteractiveChart({
  title,
  subtitle,
  data,
  dataKey = 'value',
  dataKey2 = 'value2',
  defaultChartType = 'bar',
  unit = '',
  onExpand
}: InteractiveChartProps) {
  const [chartType, setChartType]           = useState<ChartType>(defaultChartType);
  const [timeFilter, setTimeFilter]         = useState<TimeFilter>('month');
  const [comparePeriod, setComparePeriod]   = useState<ComparePeriod>('none');
  const [customStartDate, setCustomStartDate] = useState('2026-08-01');
  const [customEndDate, setCustomEndDate]   = useState('2026-08-05');

  // Reset controls
  function handleReset() {
    setChartType(defaultChartType);
    setTimeFilter('month');
    setComparePeriod('none');
    setCustomStartDate('2026-08-01');
    setCustomEndDate('2026-08-05');
  }

  // Dynamic Data Filtering based on Selected Time Filter
  let filteredData = [...data];
  if (timeFilter === 'today') {
    filteredData = data.slice(-2);
  } else if (timeFilter === 'week') {
    filteredData = data.slice(-4);
  } else if (timeFilter === 'month') {
    filteredData = data.slice(-10);
  } else if (timeFilter === 'quarter') {
    filteredData = data.slice(-15);
  } else if (timeFilter === 'custom') {
    filteredData = data.slice(-5);
  }

  // Time Range Label Generation
  const timeLabel =
    timeFilter === 'today'
      ? 'Today (Aug 05, 2026)'
      : timeFilter === 'week'
      ? 'This Week (Jul 30 - Aug 05, 2026)'
      : timeFilter === 'month'
      ? 'This Month (Jul 06 - Aug 05, 2026)'
      : timeFilter === 'quarter'
      ? 'This Quarter (Q3 2026)'
      : timeFilter === 'year'
      ? 'Full Year (FY 2026)'
      : `Custom Range (${customStartDate} to ${customEndDate})`;

  // Export CSV
  function handleDownloadCSV() {
    if (!filteredData || filteredData.length === 0) return;
    let csv = 'Name,Value\n';
    filteredData.forEach(d => {
      csv += `"${d.name}",${d[dataKey]}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Calculate KPI Total on filtered dataset
  const totalValue = filteredData.reduce((acc, curr) => acc + (Number(curr[dataKey]) || 0), 0);
  const avgValue = filteredData.length > 0 ? totalValue / filteredData.length : 0;

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', position: 'relative' }}>
      {/* CHART TOOLBAR HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={16} className="text-accent" />
            <span>{title}</span>
          </h3>
          {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{subtitle}</p>}
          
          {/* Time Range Pill Label & Custom Date Inputs */}
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366f1', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
              <span>Time Range: {timeLabel}</span>
            </div>

            {timeFilter === 'custom' && (
              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', background: 'rgba(15,23,42,0.8)', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>FROM:</span>
                <input
                  type="date"
                  className="form-input"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', width: 'auto', border: 'none', background: 'transparent', color: '#f8fafc', colorScheme: 'dark' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>TO:</span>
                <input
                  type="date"
                  className="form-input"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', width: 'auto', border: 'none', background: 'transparent', color: '#f8fafc', colorScheme: 'dark' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* TOOLBAR BUTTONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Chart Type Dropdown */}
          <select
            className="form-input form-select"
            value={chartType}
            onChange={e => setChartType(e.target.value as ChartType)}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', width: 'auto', background: 'rgba(15,23,42,0.6)' }}
          >
            <option value="bar">Bar Chart</option>
            <option value="horizontal">Horizontal Bar</option>
            <option value="area">Area Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="donut">Donut Chart</option>
            <option value="radar">Radar Chart</option>
            <option value="scatter">Scatter Plot</option>
            <option value="table">Table View</option>
            <option value="kpi">KPI Summary View</option>
          </select>

          {/* Time Filter Dropdown */}
          <select
            className="form-input form-select"
            value={timeFilter}
            onChange={e => setTimeFilter(e.target.value as TimeFilter)}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', width: 'auto', background: 'rgba(15,23,42,0.6)' }}
          >
            <option value="today">Today</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {/* Compare Period Toggle */}
          <button
            className={`btn btn-sm ${comparePeriod !== 'none' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setComparePeriod(comparePeriod === 'none' ? 'prev_period' : 'none')}
            title="Toggle Compare Period (YoY)"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
          >
            <Sliders size={13} />
            <span>{comparePeriod !== 'none' ? 'Vs Prev' : 'Compare'}</span>
          </button>

          {/* Download CSV */}
          <button
            className="btn btn-secondary btn-sm btn-icon"
            onClick={handleDownloadCSV}
            title="Export CSV Dataset"
          >
            <Download size={14} />
          </button>

          {/* Reset */}
          <button
            className="btn btn-secondary btn-sm btn-icon"
            onClick={handleReset}
            title="Reset Filters"
          >
            <RotateCcw size={14} />
          </button>

          {/* Expand Modal */}
          {onExpand && (
            <button
              className="btn btn-secondary btn-sm btn-icon"
              onClick={onExpand}
              title="Fullscreen Drill-Down View"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* CHART CANVAS RENDERING */}
      <div style={{ width: '100%', minHeight: 260, marginTop: '8px', position: 'relative' }}>
        {filteredData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No chart records available for selected timeframe.
          </div>
        ) : chartType === 'table' ? (
          <div style={{ overflowY: 'auto', maxHeight: 250, border: '1px solid var(--border)', borderRadius: '6px' }}>
            <table className="table" style={{ fontSize: '0.82rem', width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Dimension</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text)' }}>{row.name}</td>
                    <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: '#6366f1', fontFamily: 'monospace' }}>
                      {unit}{Number(row[dataKey] || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : chartType === 'kpi' ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 250, gap: '10px', background: 'rgba(15,23,42,0.4)', borderRadius: '8px', border: '1px solid var(--border)', padding: '1rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Aggregated Metric Total
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
              {unit}{totalValue.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '4px' }}>
              Average: <span style={{ color: '#6366f1', fontWeight: 700 }}>{unit}{avgValue.toFixed(1)}</span> across {filteredData.length} data points
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', height: (chartType === 'pie' || chartType === 'donut') ? 320 : 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '0.82rem' }} />
                  <Bar dataKey={dataKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  {comparePeriod !== 'none' && <Bar dataKey={dataKey2} fill="#94a3b8" radius={[4, 4, 0, 0]} />}
                </BarChart>
              ) : chartType === 'horizontal' ? (
                <BarChart data={filteredData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={80} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '0.82rem' }} />
                  <Bar dataKey={dataKey} fill="#60a5fa" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : chartType === 'area' ? (
                <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '0.82rem' }} />
                  <Area type="monotone" dataKey={dataKey} stroke="#3b82f6" fill="rgba(59,130,246,0.2)" strokeWidth={2} />
                </AreaChart>
              ) : chartType === 'line' ? (
                <LineChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '0.82rem' }} />
                  <Line type="monotone" dataKey={dataKey} stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              ) : chartType === 'pie' || chartType === 'donut' ? (
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Pie
                    data={filteredData}
                    cx="50%"
                    cy="42%"
                    innerRadius={chartType === 'donut' ? 52 : 0}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey={dataKey}
                    label={false}
                    labelLine={false}
                  >
                    {filteredData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', fontSize: '0.82rem' }}
                    formatter={(value) => [`${Number(value || 0).toLocaleString()}`, dataKey]}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={9}
                    wrapperStyle={{ fontSize: '0.72rem', paddingTop: '10px', lineHeight: '1.8' }}
                    formatter={(value: string, entry: { payload?: { value?: number }; color?: string }) => {
                      const total = filteredData.reduce((s, d) => s + (Number(d[dataKey]) || 0), 0);
                      const val = entry?.payload?.value ?? 0;
                      const pct = total > 0 ? ((val / total) * 100).toFixed(0) : '0';
                      return (
                        <span style={{ color: '#cbd5e1' }}>
                          {(value || '').length > 14 ? (value || '').slice(0, 14) + '…' : value}
                          <span style={{ color: entry?.color || '#60a5fa', fontWeight: 700, marginLeft: '4px' }}>({pct}%)</span>
                        </span>
                      );
                    }}
                  />
                </PieChart>
              ) : chartType === 'radar' ? (
                <RadarChart cx="50%" cy="50%" outerRadius={80} data={filteredData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                  <PolarRadiusAxis stroke="#94a3b8" fontSize={10} />
                  <Radar name={title} dataKey={dataKey} stroke="#c084fc" fill="#c084fc" fillOpacity={0.3} />
                </RadarChart>
              ) : (
                <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis dataKey={dataKey} stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '0.82rem' }} />
                  <Scatter name={title} data={filteredData} fill="#f59e0b" />
                </ScatterChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
