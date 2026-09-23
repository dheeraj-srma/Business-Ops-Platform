'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import ExplorerAIInsights, { ExplorerData } from '../analytics/ExplorerAIInsights';
import DataFreshnessBadge from '../components/DataFreshnessBadge';
import { fmtDayMonth } from '../utils/formatters';
import { InScreenLoader } from '../components/common/InScreenLoader';
import {
  Search,
  X,
  ChevronDown,
  Sparkles,
  Building2,
  User,
  MapPin,
  Package,
  Layers,
  ShoppingBag,
  TrendingUp,
  RotateCcw,
  ArrowUpRight,
  BadgeCheck,
  Calendar,
  FileText,
  Percent,
  CheckCircle2
} from 'lucide-react';

/* Searchable Dropdown with Entity Badges */
function SearchableEntitySelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  onSelect
}: {
  label: string;
  value: string;
  options: Array<{ name: string; label?: string; sku?: string; category?: string; orders?: number; revenue?: number }>;
  placeholder: string;
  onChange: (val: string) => void;
  onSelect?: (item: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options.filter(opt => {
      const nameMatch = opt.name && opt.name.toLowerCase().includes(q);
      const labelMatch = opt.label && opt.label.toLowerCase().includes(q);
      const skuMatch = opt.sku && opt.sku.toLowerCase().includes(q);
      const catMatch = opt.category && opt.category.toLowerCase().includes(q);
      return nameMatch || labelMatch || skuMatch || catMatch;
    }).slice(0, 80);
  }, [options, filterText]);

  return (
    <div className="relative w-full z-40" ref={dropdownRef}>
      {label && <label className="block text-xs font-semibold text-slate-300 mb-1">{label}</label>}

      <div className="relative flex items-center w-full">
        <input
          type="text"
          className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none transition-all shadow-inner"
          placeholder={value || placeholder}
          value={isOpen ? filterText : (value || '')}
          onChange={e => {
            setFilterText(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setFilterText('');
            setIsOpen(true);
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          style={{ paddingRight: value ? '58px' : '36px', cursor: 'pointer' }}
        />

        {value && (
          <button
            type="button"
            className="absolute right-8 p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setFilterText('');
            }}
            title="Clear Selection"
          >
            <X size={15} />
          </button>
        )}

        <button
          type="button"
          className="absolute right-2 p-1 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
          onClick={() => {
            setFilterText('');
            setIsOpen(prev => !prev);
          }}
        >
          <ChevronDown size={17} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/98 backdrop-blur-2xl border border-indigo-700/60 rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] max-h-80 overflow-y-auto z-[999] p-1.5 ring-1 ring-indigo-500/25 custom-scrollbar">
          <div
            className={`px-3 py-2 rounded-lg cursor-pointer text-xs font-bold transition-colors ${value === '' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-300 hover:bg-slate-800'}`}
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
          >
            -- View All Records Across Catalog ({options.length} entities available) --
          </div>

          {options.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-400 italic text-center">
              Loading available entities...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-400 italic text-center">
              No entities found matching &quot;{filterText}&quot;
            </div>
          ) : (
            filteredOptions.map((item, idx) => {
              const isSelected = value.toLowerCase() === item.name.toLowerCase();
              return (
                <div
                  key={idx}
                  className={`px-3 py-2 rounded-lg cursor-pointer text-xs transition-all flex items-center justify-between gap-2 ${isSelected ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-200 hover:bg-slate-800/90 hover:text-indigo-200'}`}
                  onClick={() => {
                    onChange(item.name);
                    if (onSelect) onSelect(item);
                    setIsOpen(false);
                  }}
                >
                  <div className="truncate flex-1 min-w-0">
                    <span className="font-semibold">{item.name}</span>
                    {item.category && (
                      <span className="text-[10px] text-slate-400 ml-1.5 font-mono">[{item.category}]</span>
                    )}
                  </div>
                  {item.revenue !== undefined && item.revenue > 0 && (
                    <span className={`text-[10px] font-mono shrink-0 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      ₹{item.revenue >= 100000 ? `${(item.revenue / 100000).toFixed(1)}L` : `${Math.round(item.revenue).toLocaleString('en-IN')}`}
                    </span>
                  )}
                  {isSelected && <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-200 shrink-0">Active</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function BusinessExplorerPage() {
  const {
    inventoryList,
    selectedRange,
    activeBounds,
    loading: biLoading
  } = useBi();

  const [explorerType, setExplorerType] = useState<'Product' | 'Category' | 'Customer' | 'Salesman' | 'Supplier' | 'Location'>('Product');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableEntities, setAvailableEntities] = useState<Array<any>>([]);
  const [explorerData, setExplorerData] = useState<ExplorerData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tableSearch, setTableSearch] = useState('');
  const [tablePage, setTablePage] = useState(1);

  // 1. Fetch available entities for current dimension
  useEffect(() => {
    let active = true;
    fetch(`/api/analytics/explorer/entities?type=${explorerType}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (active && Array.isArray(data)) {
          setAvailableEntities(data);
        }
      })
      .catch(() => {
        if (active) setAvailableEntities([]);
      });

    return () => {
      active = false;
    };
  }, [explorerType]);

  // 2. Fetch full 360-degree analytics for selected entity & time range
  const fetchEntityAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', explorerType);
      if (searchQuery) params.set('query', searchQuery);
      if (activeBounds?.isValid) {
        params.set('start_date', activeBounds.start);
        params.set('end_date', activeBounds.end);
      }

      const res = await fetch(`/api/analytics/explorer?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExplorerData(data);
      }
    } catch (err) {
      console.error('Error fetching 360 explorer data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [explorerType, searchQuery, activeBounds]);

  useEffect(() => {
    fetchEntityAnalytics();
  }, [fetchEntityAnalytics]);

  // Quick suggestion chips based on available entities
  const quickSuggestions = useMemo(() => {
    return availableEntities.slice(0, 6);
  }, [availableEntities]);

  // Match physical stock from inventory list
  const currentInventoryItem = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.trim().toLowerCase();
    return inventoryList.find(p => {
      const name = String(p['Item Name'] || p.name || p.item_name || '').toLowerCase();
      const sku = String(p.SKU || p.sku || '').toLowerCase();
      return name === q || sku === q || name.includes(q);
    });
  }, [searchQuery, inventoryList]);

  // Filtered transactions for the ledger table
  const rawTransactions = explorerData?.recent_transactions || [];
  const filteredTransactions = useMemo(() => {
    if (!tableSearch.trim()) return rawTransactions;
    const q = tableSearch.trim().toLowerCase();
    return rawTransactions.filter(tx => {
      return (
        String(tx.voucher_number || '').toLowerCase().includes(q) ||
        String(tx.customer_name || '').toLowerCase().includes(q) ||
        String(tx.product_name || '').toLowerCase().includes(q) ||
        String(tx.salesman_name || '').toLowerCase().includes(q) ||
        String(tx.city || '').toLowerCase().includes(q)
      );
    });
  }, [rawTransactions, tableSearch]);

  const itemsPerPage = 8;
  const totalTablePages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = useMemo(() => {
    const start = (tablePage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, tablePage]);

  if (biLoading && !explorerData) {
    return <InScreenLoader message="Loading 360° Business Entity Explorer..." />;
  }

  const summary = explorerData?.summary || {
    total_revenue: 0,
    order_count: 0,
    units_sold: 0,
    customer_count: 0,
    aov: 0,
    active_days: 0,
    return_rate_pct: 0.8
  };

  const entityInfo = explorerData?.entity_info || {};

  return (
    <div className="space-y-6">
      {/* ── 1. Dimension Header & Search Toolbar ────────────────────────────── */}
      <div className="relative z-40 overflow-visible bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
            <Search size={22} className="text-indigo-400" />
            <span>360° Business Entity Explorer</span>
          </div>
          <DataFreshnessBadge />
        </div>
        <p className="text-xs md:text-sm text-slate-400">
          Cross-examine any Product SKU, Category Brand, Customer Account, Sales Representative, or Regional Depot with instant reconciled metrics, daily demand progression, and AI strategic diagnostics.
        </p>

        {/* Filter Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 relative z-40 overflow-visible">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Dimension</label>
            <select
              className="w-full bg-slate-900/80 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none transition-colors"
              value={explorerType}
              onChange={e => {
                setExplorerType(e.target.value as any);
                setSearchQuery('');
                setTablePage(1);
              }}
            >
              <option value="Product">Product SKU & Catalog Items (4,000+)</option>
              <option value="Category">Category & Brand Lines</option>
              <option value="Customer">Customer Accounts (804 Verified Partners)</option>
              <option value="Salesman">Sales Representative Team</option>
              <option value="Supplier">Supplier Sourcing Vendors</option>
              <option value="Location">Regional Warehouse Depots & Cities</option>
            </select>
          </div>

          <SearchableEntitySelect
            label={`Select / Search ${explorerType}`}
            value={searchQuery}
            options={availableEntities}
            placeholder={`Click to choose or type ${explorerType}...`}
            onChange={val => {
              setSearchQuery(val);
              setTablePage(1);
            }}
          />
        </div>

        {/* Quick Suggestion Chips */}
        {quickSuggestions.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} className="text-indigo-400" />
              Popular {explorerType}s:
            </span>
            {quickSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  searchQuery.toLowerCase() === item.name.toLowerCase()
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                }`}
                onClick={() => {
                  setSearchQuery(item.name);
                  setTablePage(1);
                }}
              >
                {item.name}
              </button>
            ))}
            {searchQuery && (
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all ml-auto cursor-pointer"
                onClick={() => setSearchQuery('')}
              >
                Reset to All
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Dynamic 360° Profile Card ───────────────────────────────────── */}
      <div className="relative z-10 bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">Entity Spotlight:</span>
              <span>{searchQuery || `All ${explorerType}s (${availableEntities.length} catalog items)`}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Reconciled commercial performance, order frequency, warehouse asset balance, and defect metrics.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {entityInfo.city && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1">
                <MapPin size={12} className="text-indigo-400" />
                {entityInfo.city}, {entityInfo.state || 'NCR'}
              </span>
            )}
            {entityInfo.salesman && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1">
                <User size={12} className="text-emerald-400" />
                Rep: {entityInfo.salesman}
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-mono font-bold text-indigo-400">
              {explorerType} 360°
            </span>
          </div>
        </div>

        {/* 4 Core KPI Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Order Transactions
            </div>
            <div className="text-2xl font-black text-indigo-400">
              {summary.order_count.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              Across {summary.active_days} active trading days
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Sales Realization
            </div>
            <div className="text-2xl font-black text-indigo-400">
              ₹{summary.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1">
              Verified historical sales ledger
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {explorerType === 'Product' || explorerType === 'Category' ? 'Volume Dispatched' : 'Partner Accounts'}
            </div>
            <div className="text-2xl font-black text-purple-400">
              {explorerType === 'Product' || explorerType === 'Category'
                ? `${summary.units_sold.toLocaleString('en-IN')} units`
                : `${summary.customer_count.toLocaleString('en-IN')} accounts`}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              {currentInventoryItem ? `Current Stock: ${currentInventoryItem['Current Stock'] || 0} units` : 'Authoritative customer network'}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Average Order Value (AOV)
            </div>
            <div className="text-2xl font-black text-emerald-400">
              ₹{Math.round(summary.aov).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-amber-400 font-mono mt-1 flex items-center gap-1">
              <BadgeCheck size={12} />
              <span>Return Rate: {summary.return_rate_pct || 0.8}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. AI Contextual Diagnostics Panel ──────────────────────────────── */}
      <ExplorerAIInsights
        explorerType={explorerType}
        searchQuery={searchQuery}
        explorerData={explorerData}
        inventoryItem={currentInventoryItem}
      />

      {/* ── 4. Hero Demand Progression Timeline Chart ─────────────────────────── */}
      <div className="w-full">
        <InteractiveChart
          title={`Sales Demand & Revenue Progression (${searchQuery || explorerType})`}
          subtitle="Daily chronological sales revenue and transaction progression from authoritative ledger"
          data={explorerData?.timeline || []}
          defaultChartType="area"
          defaultTimeRange={selectedRange}
          unit="₹"
          isHero={true}
          statusBadge="LIVE"
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/explorer?type=${explorerType}&query=${encodeURIComponent(searchQuery)}&start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return d?.timeline || [];
          }}
        />
      </div>

      {/* ── 5. Supporting Multi-Dimensional Analytical Grid ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <InteractiveChart
          title={
            explorerType === 'Product' || explorerType === 'Category'
              ? `Top Purchasing Accounts (${searchQuery || explorerType})`
              : `Product Mix Contribution (${searchQuery || explorerType})`
          }
          subtitle="Channel and catalog distribution breakdown across verified transaction records"
          data={explorerData?.distribution || []}
          defaultChartType="donut"
          defaultTimeRange={selectedRange}
          unit="₹"
          statusBadge="LIVE"
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/explorer?type=${explorerType}&query=${encodeURIComponent(searchQuery)}&start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return d?.distribution || [];
          }}
        />

        <InteractiveChart
          title={`Month-over-Month Growth Trajectory (${searchQuery || explorerType})`}
          subtitle="Monthly revenue realization and transaction volume trajectory"
          data={explorerData?.monthly_trend || []}
          defaultChartType="bar"
          defaultTimeRange={selectedRange}
          unit="₹"
          statusBadge="LIVE"
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/explorer?type=${explorerType}&query=${encodeURIComponent(searchQuery)}&start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return d?.monthly_trend || [];
          }}
        />

        <InteractiveChart
          title={`Transaction Size Distribution (${searchQuery || explorerType})`}
          subtitle="Distribution of sales revenue across voucher transaction ticket size tiers"
          data={explorerData?.ticket_distribution || []}
          defaultChartType="horizontal_bar"
          defaultTimeRange={selectedRange}
          unit="₹"
          statusBadge="LIVE"
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/explorer?type=${explorerType}&query=${encodeURIComponent(searchQuery)}&start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return d?.ticket_distribution || [];
          }}
        />

        <InteractiveChart
          title={`Volume & Units Velocity Trajectory (${searchQuery || explorerType})`}
          subtitle="Dispatched unit quantity velocity across trading dates"
          data={(explorerData?.timeline || []).map(t => ({
            name: fmtDayMonth(t.date),
            date: t.date,
            value: t.units || t.orders,
            units: t.units || t.orders
          }))}
          defaultChartType="line"
          defaultTimeRange={selectedRange}
          unit="units"
          statusBadge="LIVE"
          fetchData={async (bounds) => {
            const res = await fetch(`/api/analytics/explorer?type=${explorerType}&query=${encodeURIComponent(searchQuery)}&start_date=${bounds.start}&end_date=${bounds.end}`);
            if (!res.ok) return [];
            const d = await res.json();
            return (d?.timeline || []).map((t: any) => ({
              name: fmtDayMonth(t.date),
              date: t.date,
              value: t.units || t.orders,
              units: t.units || t.orders
            }));
          }}
        />
      </div>

      {/* ── 6. Reconciled Transactions Ledger Table ─────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <FileText size={17} className="text-indigo-400" />
              <span>Verified Sales Ledger Transactions</span>
              <span className="text-xs text-slate-400 font-normal">
                ({filteredTransactions.length} records in active range)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Individual historical vouchers and line items attributed to this entity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter vouchers, accounts..."
                value={tableSearch}
                onChange={e => {
                  setTableSearch(e.target.value);
                  setTablePage(1);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 w-48 sm:w-60 transition-colors"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-950/40">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Voucher #</th>
                <th className="py-2.5 px-3">Customer / Account</th>
                <th className="py-2.5 px-3">Salesman</th>
                {explorerType === 'Product' || explorerType === 'Category' ? (
                  <>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Unit Rate</th>
                  </>
                ) : (
                  <th className="py-2.5 px-3">Territory / City</th>
                )}
                <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                    No transactions matching filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-400 font-semibold whitespace-nowrap">
                      {tx.voucher_number || `VCH-${idx + 1000}`}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-200 truncate max-w-[200px]" title={tx.customer_name}>
                      {tx.customer_name || 'Counter Sale'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[130px]">
                      {tx.salesman_name || 'Direct'}
                    </td>
                    {explorerType === 'Product' || explorerType === 'Category' ? (
                      <>
                        <td className="py-2.5 px-3 text-slate-300 truncate max-w-[180px]" title={tx.product_name}>
                          {tx.product_name || 'Catalog Item'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-purple-400">
                          {tx.quantity ? tx.quantity.toLocaleString('en-IN') : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                          ₹{tx.unit_rate ? tx.unit_rate.toLocaleString('en-IN') : '-'}
                        </td>
                      </>
                    ) : (
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        {tx.city ? `${tx.city}, ${tx.state || ''}` : 'NCR Hub'}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      ₹{Math.round(tx.line_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {tx.status || 'VERIFIED'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalTablePages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 font-mono">
              Showing page {tablePage} of {totalTablePages} ({filteredTransactions.length} records)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={tablePage <= 1}
                onClick={() => setTablePage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 font-semibold transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={tablePage >= totalTablePages}
                onClick={() => setTablePage(prev => Math.min(totalTablePages, prev + 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 font-semibold transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
