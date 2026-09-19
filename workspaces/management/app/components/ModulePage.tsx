'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Download,
  RefreshCw,
  FileText,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Layers
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface Row {
  [key: string]: unknown;
}

interface ModulePageProps {
  endpoint: string;
  title: string;
  subtitle: string;
}

const PRIORITY_COLUMNS: Record<string, string[]> = {
  '/api/inwards': ['Inward ID', 'SKU', 'Item Name', 'Quantity', 'Supplier Name', 'Timestamp'],
  '/api/suppliers': ['Supplier ID', 'Supplier Name', 'Contact Person', 'Phone', 'Status'],
  '/api/returns': ['Return ID', 'SKU', 'Item Name', 'Quantity', 'Condition', 'Status'],
  '/api/adjustments': ['Txn ID', 'Type', 'SKU', 'Item Name', 'Quantity', 'Date'],
  '/api/transactions': ['Txn ID', 'Type', 'SKU', 'Item Name', 'Quantity', 'Unit Cost', 'Total Cost', 'Date'],
  '/api/orders': ['Order ID', 'SKU', 'Shop Name', 'Salesman Name', 'Quantity', 'Status', 'Timestamp'],
};

function ModulePageContent({ endpoint, title, subtitle }: ModulePageProps) {
  const searchParams = useSearchParams();

  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [showAllCols, setShowAllCols] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`${API}${endpoint}`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((res) => setData(Array.isArray(res) ? res : []))
      .catch((err) => console.warn(`Failed to fetch ${endpoint}:`, err))
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('search') || '';
    if (q && q !== search) setSearch(q);
  }, [searchParams, search]);

  useEffect(() => {
    fetchData();
    Promise.resolve().then(() => setCurrentPage(1));
  }, [fetchData]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allColumns = data.length > 0 ? Object.keys(data[0]) : [];

  const displayColumns = useMemo(() => {
    if (!showAllCols && allColumns.length > 5) {
      const definedPriority = PRIORITY_COLUMNS[endpoint];
      if (definedPriority) {
        return allColumns.filter((c) => definedPriority.includes(c));
      }
      return allColumns.slice(0, 7);
    }
    return allColumns;
  }, [showAllCols, allColumns, endpoint]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <div className="p-3.5 sm:p-6 space-y-4 w-full max-w-[1760px] 2xl:max-w-[1880px] mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 rounded-full">
              {filtered.length} Records
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
          <button
            onClick={exportJson}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Toolbar with Search and Column Switch */}
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={`Search ${title} records...`}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {allColumns.length > 5 && (
            <button
              onClick={() => setShowAllCols((v) => !v)}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showAllCols ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showAllCols ? 'Compact View' : 'All Columns'}</span>
            </button>
          )}
          <span className="text-xs text-slate-500 font-mono">
            {filtered.length} total entries
          </span>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px]">
              <tr>
                {displayColumns.map((col) => (
                  <th key={col} className="py-3 px-3.5 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-750">
              {loading ? (
                <tr>
                  <td colSpan={displayColumns.length} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-indigo-500" />
                      <span>Loading database records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={displayColumns.length} className="py-12 text-center text-slate-400">
                    <FileText size={28} className="mx-auto mb-2 opacity-40" />
                    <span>No records found matching &quot;{search}&quot;.</span>
                  </td>
                </tr>
              ) : (
                paginated.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors"
                  >
                    {displayColumns.map((col) => {
                      const val = row[col];
                      let strVal = String(val ?? '—');
                      const lower = col.toLowerCase();
                      const isCode = lower.includes('id') || lower === 'sku' || lower.includes('code');
                      const isType = lower === 'type' || lower === 'status';

                      if (lower === 'timestamp' && strVal !== '—') {
                        strVal = strVal.split('.')[0].replace('T', ' ').replace(/\+00:00$/, '');
                      }

                      return (
                        <td key={col} className="py-2.5 px-3.5 whitespace-nowrap">
                          {isType ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                strVal === 'IN' ||
                                strVal === 'Approved' ||
                                strVal === 'Active' ||
                                strVal === 'Completed' ||
                                strVal === 'Restocked'
                                  ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-indigo-600 dark:text-indigo-400 border border-cyan-200 dark:border-cyan-800'
                                  : strVal === 'OUT' || strVal === 'SALE'
                                  ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-indigo-600 dark:text-indigo-400 border border-cyan-200 dark:border-cyan-800'
                                  : strVal === 'Rejected' || strVal.includes('DEFECTIVE')
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {strVal}
                            </span>
                          ) : isCode ? (
                            <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                              {strVal}
                            </span>
                          ) : lower.includes('price') || lower.includes('cost') ? (
                            <span className="font-mono text-slate-800 dark:text-slate-200">
                              {typeof val === 'number' ? `₹${val.toLocaleString('en-IN')}` : strVal}
                            </span>
                          ) : lower === 'quantity' || lower.includes('qty') ? (
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {strVal}
                            </span>
                          ) : (
                            <span className="text-slate-800 dark:text-slate-200">{strVal}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
            >
              {[15, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>
              Showing {Math.min(filtered.length, (safePage - 1) * pageSize + 1)} –{' '}
              {Math.min(filtered.length, safePage * pageSize)} of {filtered.length} entries
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ModulePage(props: ModulePageProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs">Loading records...</div>}>
      <ModulePageContent {...props} />
    </Suspense>
  );
}
