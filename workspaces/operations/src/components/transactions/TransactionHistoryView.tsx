import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  RefreshCw,
  FileSpreadsheet,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Boxes,
  Eye,
  ChevronDown,
  ChevronUp,
  Building2,
  UserCheck,
  Package,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { StockTransaction, Category, TransactionType } from '../../types';
import { api } from '../../lib/api';
import { formatDate, cn } from '../../lib/utils';
import { TransactionDetailModal } from './TransactionDetailModal';
import { ExportableConsignment } from '../../lib/transactionExport';

interface TransactionHistoryViewProps {
  categories: Category[];
  onOpenProductDetail: (productId: string) => void;
  onGoBack?: () => void;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  categories,
  onOpenProductDetail,
  onGoBack,
}) => {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // View Mode: 'grouped' (Consignments & Orders) vs 'flat' (Individual Item Ledger)
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  // Detail Modal State
  const [selectedConsignment, setSelectedConsignment] = useState<ExportableConsignment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Handle ESC key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Lock body scrolling when full screen is active
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const res = await api.getTransactions({
        type: typeFilter !== 'all' ? typeFilter : undefined,
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
        search: searchQuery.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setTransactions(res.transactions);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [typeFilter, categoryFilter, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTransactions();
  };

  // Group transactions into Batched Consignments / Orders
  const groupedConsignments = useMemo(() => {
    const groupsMap = new Map<string, ExportableConsignment>();

    transactions.forEach((tx) => {
      const txType = tx.transactionType || (tx as any).transaction_type;
      const refNum = tx.referenceNumber || (tx as any).reference_number || tx.id;
      const party = tx.supplierOrRecipient || (tx as any).supplier_or_recipient || 'Internal';
      const notes = tx.notes || '';

      // Extract Salesman name if present in notes (e.g. "Salesman: Rajesh")
      let salesmanName = '';
      if (notes.toLowerCase().includes('salesman:')) {
        const match = notes.match(/salesman:\s*([^,\n]+)/i);
        if (match) salesmanName = match[1].trim();
      }

      // Grouping key:
      // - Stock-In: grouped by reference number + supplier
      // - Stock-Out: grouped by reference number + salesman/party
      // - Adjustments: grouped by reference number
      let groupKey = '';
      let partyDisplayName = party;
      let partyRole = 'Party';

      if (txType === 'STOCK_IN') {
        groupKey = `IN_${refNum}_${party}`;
        partyDisplayName = party || 'Direct Supplier';
        partyRole = 'Supplier / Vendor';
      } else if (txType === 'STOCK_OUT') {
        groupKey = `OUT_${refNum}_${salesmanName || party}`;
        partyDisplayName = salesmanName ? `${salesmanName} (${party})` : party || 'Direct Recipient';
        partyRole = salesmanName ? 'Salesman & Shop' : 'Customer / Recipient';
      } else if (txType === 'CUSTOMER_RETURN') {
        groupKey = `RET_${refNum}_${party}`;
        partyDisplayName = party || 'Direct Customer';
        partyRole = 'Customer / Client';
      } else {
        groupKey = `ADJ_${refNum}_${tx.id}`;
        partyDisplayName = party || 'Stock Audit Adjustment';
        partyRole = 'Inventory Audit';
      }

      const existing = groupsMap.get(groupKey);

      const lineItem = {
        id: tx.id,
        sku: tx.productSku || '',
        productName: tx.productName || 'Unknown Product',
        categoryName: tx.categoryName || '',
        quantity: tx.quantity,
        unit: tx.unit || 'Units',
        previousStock: tx.previousStock ?? (tx as any).previous_stock,
        newStock: tx.newStock ?? (tx as any).new_stock,
        reason: tx.reason || (tx as any).reason,
        notes: tx.notes,
      };

      if (existing) {
        existing.items.push(lineItem);
      } else {
        groupsMap.set(groupKey, {
          referenceNumber: refNum,
          type: txType,
          partyName: partyDisplayName,
          partyRole,
          date: tx.createdAt || (tx as any).created_at,
          loggedBy: tx.createdByName || (tx as any).created_by_name || 'Store Staff',
          notes: tx.notes || tx.reason || (tx as any).reason,
          items: [lineItem],
        });
      }
    });

    return Array.from(groupsMap.values());
  }, [transactions]);

  const toggleGroupExpand = (groupRef: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupRef)) next.delete(groupRef);
      else next.add(groupRef);
      return next;
    });
  };

  const handleOpenDetailModal = (consignment: ExportableConsignment) => {
    setSelectedConsignment(consignment);
    setIsDetailModalOpen(true);
  };

  // Export full ledger to CSV
  const handleExportCsv = () => {
    if (transactions.length === 0) return;

    const headers = [
      'Transaction ID',
      'Date & Time',
      'SKU',
      'Product Name',
      'Category',
      'Transaction Type',
      'Quantity Delta',
      'Previous Stock',
      'New Stock',
      'Reason',
      'Party / Supplier / Recipient',
      'Reference Number',
      'Notes',
      'Authorized User',
    ];

    const rows = transactions.map((t) => [
      `"${t.id}"`,
      `"${t.createdAt || (t as any).created_at}"`,
      `"${t.productSku}"`,
      `"${t.productName.replace(/"/g, '""')}"`,
      `"${t.categoryName || ''}"`,
      `"${t.transactionType || (t as any).transaction_type}"`,
      `${t.quantity}`,
      `${t.previousStock ?? (t as any).previous_stock}`,
      `${t.newStock ?? (t as any).new_stock}`,
      `"${(t.reason || '').replace(/"/g, '""')}"`,
      `"${(t.supplierOrRecipient || (t as any).supplier_or_recipient || '').replace(/"/g, '""')}"`,
      `"${(t.referenceNumber || (t as any).reference_number || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      `"${t.createdByName || (t as any).created_by_name}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Transactions_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="transactions-view" className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header & Controls Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            {/* Back Button */}
            {onGoBack && (
              <button
                id="btn-transactions-back"
                onClick={onGoBack}
                title="Go back to previous state"
                className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0 group"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              </button>
            )}

            {/* Search form */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-transactions-search"
                type="text"
                placeholder="Search reference #, supplier, salesman, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
              />
            </form>
          </div>

          {/* View Mode Toggle, Export CSV & Refresh */}
          <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                  viewMode === 'grouped'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
                title="View grouped by Supplier Inward consignments and Salesman Outward orders"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Batched Consignments</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-mono">
                  {groupedConsignments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                  viewMode === 'flat'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
                title="View granular itemized transaction ledger"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Itemized Table</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                  {transactions.length}
                </span>
              </button>
            </div>

            <button
              id="btn-refresh-transactions"
              onClick={loadTransactions}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin text-indigo-600 dark:text-indigo-400')} />
            </button>

            <button
              id="btn-export-transactions-csv"
              onClick={handleExportCsv}
              disabled={transactions.length === 0}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Export all filtered ledger records to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/70 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            {/* Movement Type */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="select-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Movements</option>
                <option value="STOCK_IN">Stock In (Receive)</option>
                <option value="STOCK_OUT">Stock Out (Issue)</option>
                <option value="CUSTOMER_RETURN">Customer Returns</option>
                <option value="INITIAL_STOCK">Initial Setup</option>
                <option value="ADJUSTMENT_INCREASE">Adjustment (+)</option>
                <option value="ADJUSTMENT_DECREASE">Adjustment (-)</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="select-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                id="input-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                placeholder="From"
              />
              <span className="text-slate-400">to</span>
              <input
                id="input-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                placeholder="To"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline text-[11px] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            Showing <span className="font-bold text-slate-900 dark:text-slate-100">{transactions.length}</span> raw movement rows
          </div>
        </div>
      </div>

      {/* Full Screen Backdrop */}
      {isFullScreen && (
        <div
          onClick={() => setIsFullScreen(false)}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-40 animate-in fade-in duration-200 cursor-pointer"
          title="Click backdrop to exit full screen"
          aria-hidden="true"
        />
      )}

      {/* Main Ledger Container */}
      <div
        className={cn(
          'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs transition-all',
          isFullScreen
            ? 'fixed inset-2 sm:inset-3 md:inset-4 lg:inset-5 z-50 flex flex-col shadow-2xl border-slate-300 dark:border-slate-600 rounded-3xl animate-in zoom-in-95 duration-200'
            : ''
        )}
      >
        {/* Table Title Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                {viewMode === 'grouped' ? 'Batched Consignments & Orders' : 'Granular Movement Ledger'}
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                {viewMode === 'grouped'
                  ? `${groupedConsignments.length} batched groups`
                  : `${transactions.length} items`}
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {viewMode === 'grouped'
                ? 'Stock-in receipts grouped by Supplier & Invoice, and sales dispatches grouped by Salesman & Order'
                : 'Immutable chronological ledger of individual product inventory movements'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-transactions-fullscreen"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
                isFullScreen
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                  : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              )}
              title={isFullScreen ? 'Exit Full Screen (Esc)' : 'Expand table across whole screen width'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Full Screen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content View: Grouped Consignments vs Flat Table */}
        <div className={cn('overflow-x-auto', isFullScreen ? 'flex-1 overflow-y-auto' : '')}>
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              <p className="text-xs font-semibold">Loading inventory movement ledger...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No transactions match the criteria</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Try widening your date range or filter selection.</p>
            </div>
          ) : viewMode === 'grouped' ? (
            /* 1. Grouped Consignments Cards */
            <div className="p-4 sm:p-5 space-y-3">
              {groupedConsignments.map((group) => {
                const isStockIn = group.type === 'STOCK_IN';
                const isStockOut = group.type === 'STOCK_OUT';
                const isReturn = group.type === 'CUSTOMER_RETURN';
                const isExpanded = expandedGroupIds.has(group.referenceNumber);
                const totalUnits = group.items.reduce((sum, it) => sum + (it.quantity || 0), 0);

                return (
                  <div
                    key={`${group.type}_${group.referenceNumber}_${group.partyName}`}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/40 hover:border-indigo-300 dark:hover:border-indigo-700/70 transition-all overflow-hidden"
                  >
                    {/* Card Header Row */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                        {/* Type Icon */}
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0',
                            isStockIn && 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80',
                            isStockOut && 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80',
                            isReturn && 'bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/80',
                            !isStockIn && !isStockOut && !isReturn && 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80'
                          )}
                        >
                          {isStockIn && <ArrowDownLeft className="w-5 h-5" />}
                          {isStockOut && <ArrowUpRight className="w-5 h-5" />}
                          {isReturn && <RotateCcw className="w-5 h-5 -rotate-45" />}
                          {!isStockIn && !isStockOut && !isReturn && <SlidersHorizontal className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                              {group.referenceNumber}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                                isStockIn && 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
                                isStockOut && 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
                                isReturn && 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
                                !isStockIn && !isStockOut && !isReturn && 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              )}
                            >
                              {isReturn ? 'Customer Return' : isStockIn ? 'Stock In (Consignment)' : isStockOut ? 'Outward Dispatch' : group.type.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {formatDate(group.date)}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                            <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                              {isStockIn ? <Building2 className="w-3.5 h-3.5 text-slate-400" /> : <UserCheck className="w-3.5 h-3.5 text-slate-400" />}
                              <span>{group.partyName}</span>
                            </div>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="text-slate-400 dark:text-slate-500">
                              By {group.loggedBy}
                            </span>
                            {group.notes && (
                              <>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="italic text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                  "{group.notes}"
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Metrics & Actions */}
                      <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60 dark:border-slate-800">
                        <div className="text-right">
                          <span
                            className={cn(
                              'text-sm font-black font-mono block',
                              isReturn
                                ? 'text-purple-600 dark:text-purple-400'
                                : isStockIn
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            )}
                          >
                            {isStockOut ? '-' : '+'}{totalUnits.toLocaleString('en-IN')} units
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            across {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>

                        {/* View & Export Detail Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(group)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-800 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                          title="View consignment details and export to CSV, Excel, PDF, or JSON"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View &amp; Export</span>
                        </button>

                        {/* Expand / Collapse Button */}
                        <button
                          type="button"
                          onClick={() => toggleGroupExpand(group.referenceNumber)}
                          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title={isExpanded ? 'Collapse items' : 'Expand line items'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Accordion Line Items Table */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 sm:p-5 animate-in slide-in-from-top-2 duration-150">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                              <tr>
                                <th className="py-2 px-3">SKU</th>
                                <th className="py-2 px-3">Product Name</th>
                                <th className="py-2 px-3">Category</th>
                                <th className="py-2 px-3 text-right">Prev Stock</th>
                                <th className="py-2 px-3 text-right">Quantity</th>
                                <th className="py-2 px-3 text-right">Final Balance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {group.items.map((it) => (
                                <tr key={it.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                  <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">
                                    {it.sku}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div
                                      onClick={() => onOpenProductDetail(it.id)}
                                      className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                    >
                                      {it.productName}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                    {it.categoryName || 'General'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                                    {it.previousStock !== undefined ? `${it.previousStock} ${it.unit}` : '-'}
                                  </td>
                                  <td
                                    className={cn(
                                      'py-2.5 px-3 text-right font-mono font-bold',
                                      isStockIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                    )}
                                  >
                                    {isStockIn ? '+' : '-'}{it.quantity} {it.unit}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                    {it.newStock !== undefined ? `${it.newStock} ${it.unit}` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* 2. Flat Itemized Table */
            <table className={cn('w-full text-left border-collapse', isFullScreen ? 'min-w-full' : 'min-w-[1080px]')}>
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-400 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100 dark:border-slate-700/70 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-4 w-[145px] min-w-[145px]">Date &amp; Time</th>
                  <th className="py-3 px-4 min-w-[240px]">Product</th>
                  <th className="py-3 px-4 w-[140px] min-w-[140px]">Type</th>
                  <th className="py-3 px-4 w-[110px] min-w-[110px] text-right">Quantity</th>
                  <th className="py-3 px-4 w-[75px] min-w-[75px] text-right">Prev</th>
                  <th className="py-3 px-4 w-[85px] min-w-[85px] text-right">Balance</th>
                  <th className="py-3 px-4 min-w-[220px]">Reference / Reason</th>
                  <th className="py-3 px-4 min-w-[180px]">Party</th>
                  <th className="py-3 px-4 w-[130px] min-w-[130px]">Logged By</th>
                  <th className="py-3 px-4 w-[90px] text-center">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                {transactions.map((tx) => {
                  const txType = tx.transactionType || (tx as any).transaction_type;
                  const isPositive =
                    txType === 'STOCK_IN' ||
                    txType === 'INITIAL_STOCK' ||
                    txType === 'ADJUSTMENT_INCREASE' ||
                    txType === 'CUSTOMER_RETURN';

                  const singleConsignment: ExportableConsignment = {
                    referenceNumber: tx.referenceNumber || (tx as any).reference_number || tx.id,
                    type: txType,
                    partyName: tx.supplierOrRecipient || (tx as any).supplier_or_recipient || 'Internal',
                    partyRole: txType === 'CUSTOMER_RETURN' ? 'Customer' : txType === 'STOCK_IN' ? 'Supplier' : 'Recipient',
                    date: tx.createdAt || (tx as any).created_at,
                    loggedBy: tx.createdByName || (tx as any).created_by_name || 'Staff',
                    notes: tx.notes || tx.reason || (tx as any).reason,
                    items: [
                      {
                        id: tx.id,
                        sku: tx.productSku || '',
                        productName: tx.productName || 'Product',
                        categoryName: tx.categoryName || '',
                        quantity: tx.quantity,
                        unit: tx.unit || 'Units',
                        previousStock: tx.previousStock ?? (tx as any).previous_stock,
                        newStock: tx.newStock ?? (tx as any).new_stock,
                        notes: tx.notes,
                      },
                    ],
                  };

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                        {formatDate(tx.createdAt || (tx as any).created_at)}
                      </td>

                      <td className="py-3 px-4 min-w-[240px]">
                        <div
                          onClick={() => onOpenProductDetail(tx.productId || (tx as any).product_id)}
                          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-xs leading-snug"
                        >
                          {tx.productName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            {tx.productSku}
                          </span>
                          {tx.categoryName && (
                            <span className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                              {tx.categoryName}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap inline-block',
                            txType === 'STOCK_IN' && 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60',
                            txType === 'STOCK_OUT' && 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60',
                            txType === 'CUSTOMER_RETURN' && 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60',
                            txType === 'INITIAL_STOCK' && 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600',
                            txType === 'ADJUSTMENT_INCREASE' && 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60',
                            txType === 'ADJUSTMENT_DECREASE' && 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                          )}
                        >
                          {txType?.replace('_', ' ')}
                        </span>
                      </td>

                      <td
                        className={cn(
                          'py-3 px-4 text-right font-mono font-bold whitespace-nowrap text-xs',
                          txType === 'CUSTOMER_RETURN'
                            ? 'text-purple-700 dark:text-purple-400'
                            : isPositive
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        )}
                      >
                        {isPositive ? '+' : '-'}
                        {tx.quantity} {tx.unit}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                        {tx.previousStock ?? (tx as any).previous_stock}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap text-xs">
                        {tx.newStock ?? (tx as any).new_stock}
                      </td>

                      <td className="py-3 px-4 min-w-[220px] text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {tx.referenceNumber || (tx as any).reference_number || '-'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {tx.reason || (tx as any).reason}
                        </div>
                        {tx.notes && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-0.5">
                            {tx.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 min-w-[180px] text-slate-700 dark:text-slate-300 text-xs">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {tx.supplierOrRecipient || (tx as any).supplier_or_recipient || 'Internal'}
                        </div>
                      </td>

                      <td className="py-3 px-4 w-[130px] min-w-[130px] text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                        {tx.createdByName || (tx as any).created_by_name}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(singleConsignment)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="View and Export Transaction"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Transaction Detail & Export Modal (CSV, Excel, PDF, JSON) */}
      <TransactionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedConsignment(null);
        }}
        consignment={selectedConsignment}
        onOpenProductDetail={onOpenProductDetail}
      />
    </div>
  );
};
