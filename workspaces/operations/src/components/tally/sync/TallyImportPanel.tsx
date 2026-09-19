import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Check,
  X,
  Layers,
  ArrowUpDown,
  Filter,
  Info,
  Sliders,
  DollarSign,
  PackagePlus,
  ShieldCheck,
  FileText,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  TallyImportPreview,
  TallyReconciliationItem,
  TallyImportApplyOptions,
  Product,
} from '../../../types';
import { api } from '../../../lib/api';
import { useDialog } from '../../../context/DialogContext';
import { cn } from '../../../lib/utils';

interface TallyImportPanelProps {
  products: Product[];
  onRefreshAll?: () => void;
}

export const TallyImportPanel: React.FC<TallyImportPanelProps> = ({
  products,
  onRefreshAll,
}) => {
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload & Preview State
  const [isParsing, setIsParsing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [preview, setPreview] = useState<TallyImportPreview | null>(null);
  const [items, setItems] = useState<TallyReconciliationItem[]>([]);

  // Apply Options
  const [updateStock, setUpdateStock] = useState(true);
  const [updatePrices, setUpdatePrices] = useState(true);
  const [createNewProducts, setCreateNewProducts] = useState(true);
  const [referenceNote, setReferenceNote] = useState('Accountant Coordination & Reconciliation');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DISCREPANCY' | 'NEW' | 'PRICE' | 'IN_SYNC'>('ALL');

  // Handle file drop / selection
  const handleFile = async (file: File) => {
    if (!file) return;

    setIsParsing(true);
    try {
      const content = await file.text();
      const ext = file.name.split('.').pop()?.toUpperCase();

      const res = await api.parseTallyImport({
        content,
        fileTypeHint: ext === 'XML' ? 'XML' : ext === 'JSON' ? 'JSON' : 'CSV',
        fileName: file.name,
      });

      setPreview(res.preview);
      setItems(res.preview.items);

      dialog.showSuccess({
        title: 'Tally File Parsed Successfully',
        message: `Extracted ${res.preview.summary.totalItems} stock item(s) from "${file.name}". Found ${res.preview.summary.discrepancyCount} stock discrepancy(ies) and ${res.preview.summary.newItemsCount} new item(s).`,
      });
    } catch (err: any) {
      dialog.showError({
        title: 'Parsing Failed',
        message: err.message || 'Failed to parse Tally export file.',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Load sample Tally Stock Summary CSV/XML for testing
  const handleLoadSample = async (type: 'csv' | 'xml') => {
    setIsParsing(true);
    try {
      let sampleContent = '';
      if (type === 'xml') {
        sampleContent = `<ENVELOPE>
  <BODY>
    <DATA>
      <TALLYMESSAGE>
        <STOCKITEM NAME="1\\"x6\\" BRASS CHAAL NIPPLE - TARUN">
          <PARENT>Pipes &amp; Pipe Fittings</PARENT>
          <BASEUNITS>Pieces</BASEUNITS>
          <CLOSINGBALANCE>50.00 Pieces</CLOSINGBALANCE>
          <CLOSINGRATE>525.00/Pieces</CLOSINGRATE>
          <CLOSINGVALUE>26250.00</CLOSINGVALUE>
        </STOCKITEM>
        <STOCKITEM NAME="10\\" SINGLE PIECE SET W/BIV 3-SUPERFLO">
          <PARENT>Taps, Cocks &amp; Mixers</PARENT>
          <BASEUNITS>Pieces</BASEUNITS>
          <CLOSINGBALANCE>35.00 Pieces</CLOSINGBALANCE>
          <CLOSINGRATE>665.85/Pieces</CLOSINGRATE>
          <CLOSINGVALUE>23304.75</CLOSINGVALUE>
        </STOCKITEM>
        <STOCKITEM NAME="PREMIUM BRASS SINK COCK HEAVY">
          <PARENT>Taps, Cocks &amp; Mixers</PARENT>
          <BASEUNITS>Pieces</BASEUNITS>
          <CLOSINGBALANCE>20.00 Pieces</CLOSINGBALANCE>
          <CLOSINGRATE>890.00/Pieces</CLOSINGRATE>
          <CLOSINGVALUE>17800.00</CLOSINGVALUE>
        </STOCKITEM>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`;
      } else {
        sampleContent = `Item Name,Category,Closing Balance,Rate,Amount
"1\\"x6\\" BRASS CHAAL NIPPLE - TARUN",Pipes & Pipe Fittings,60,525.00,31500.00
"10\\" SINGLE PIECE SET W/BIV 3-SUPERFLO",Taps & Cocks,40,665.85,26634.00
"15MM HEAVY BRASS BALL VALVE",Valves & Fittings,25,450.00,11250.00
"CHROME FINISH BASIN MIXER FOAM FLOW",Mixers & Faucets,15,1250.00,18750.00`;
      }

      const res = await api.parseTallyImport({
        content: sampleContent,
        fileTypeHint: type.toUpperCase(),
        fileName: `Sample_Tally_Stock_Summary.${type}`,
      });

      setPreview(res.preview);
      setItems(res.preview.items);

      dialog.showSuccess({
        title: 'Sample Tally Data Loaded',
        message: `Parsed ${res.preview.summary.totalItems} stock item(s) from sample ${type.toUpperCase()}.`,
      });
    } catch (err: any) {
      dialog.showError({
        title: 'Sample Load Failed',
        message: err.message,
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Toggle selection for a single item
  const toggleItemSelection = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Select / Deselect All
  const setAllSelected = (selected: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected })));
  };

  // Select only items with differences
  const selectDiscrepanciesOnly = () => {
    setItems((prev) =>
      prev.map((item) => ({ ...item, selected: item.status !== 'IN_SYNC' }))
    );
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.itemName.toLowerCase().includes(q);
        const matchesSku = item.sku?.toLowerCase().includes(q);
        const matchesCat = item.categoryName?.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesCat) return false;
      }

      // Status
      if (statusFilter === 'DISCREPANCY' && item.status !== 'STOCK_DISCREPANCY') return false;
      if (statusFilter === 'NEW' && item.status !== 'NEW_ITEM') return false;
      if (statusFilter === 'PRICE' && item.status !== 'PRICE_CHANGE') return false;
      if (statusFilter === 'IN_SYNC' && item.status !== 'IN_SYNC') return false;

      return true;
    });
  }, [items, searchQuery, statusFilter]);

  const selectedCount = items.filter((i) => i.selected).length;

  // Apply Reconciliation & Import
  const handleApplyImport = () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      dialog.showWarning({
        title: 'No Items Selected',
        message: 'Please check at least one item from the reconciliation table to apply.',
      });
      return;
    }

    dialog.showConfirm({
      title: 'Apply Tally Reconciliation?',
      message: `You are about to update ${selectedItems.length} product(s) in Nalka inventory based on the accountant's Tally export.\n\n• Stock Updates: ${updateStock ? 'ENABLED' : 'DISABLED'}\n• Price Updates: ${updatePrices ? 'ENABLED' : 'DISABLED'}\n• New Products: ${createNewProducts ? 'ENABLED' : 'DISABLED'}\n\nStock transactions and audit ledger entries will be recorded. Proceed?`,
      confirmText: 'Apply & Update Inventory',
      onConfirm: async () => {
        setIsApplying(true);
        try {
          const options: TallyImportApplyOptions = {
            updateStock,
            updatePrices,
            createNewProducts,
            referenceNote,
            selectedItemIds: selectedItems.map((i) => i.id),
          };

          const res = await api.applyTallyImport({
            items,
            options,
          });

          dialog.showSuccess({
            title: 'Tally Import Applied Successfully',
            message: `Reconciliation complete: ${res.updatedCount} product(s) updated, ${res.createdCount} new product(s) created, and ${res.discrepanciesResolved} stock discrepancy(ies) resolved and logged.`,
          });

          // Reset preview and refresh catalog
          setPreview(null);
          setItems([]);
          if (onRefreshAll) onRefreshAll();
        } catch (err: any) {
          dialog.showError({
            title: 'Import Application Failed',
            message: err.message || 'Failed to apply Tally reconciliation changes.',
          });
        } finally {
          setIsApplying(false);
        }
      },
    });
  };

  // Export Discrepancy Report CSV
  const handleExportDiscrepancyCsv = () => {
    if (items.length === 0) return;

    const headers = [
      'Item Name',
      'SKU',
      'Category',
      'Unit',
      'Nalka Warehouse Stock',
      'Tally Accountant Stock',
      'Stock Variance',
      'Nalka Cost (INR)',
      'Tally Rate (INR)',
      'Rate Variance',
      'Nalka Valuation (INR)',
      'Tally Valuation (INR)',
      'Valuation Variance (INR)',
      'Reconciliation Status',
    ];

    const rows = items.map((i) => [
      `"${i.itemName.replace(/"/g, '""')}"`,
      `"${i.sku || ''}"`,
      `"${i.categoryName || 'General'}"`,
      `"${i.unit}"`,
      i.nalkaStock,
      i.tallyStock,
      i.stockVariance > 0 ? `+${i.stockVariance}` : i.stockVariance,
      i.nalkaRate.toFixed(2),
      i.tallyRate.toFixed(2),
      i.rateVariance > 0 ? `+${i.rateVariance.toFixed(2)}` : i.rateVariance.toFixed(2),
      i.nalkaValue.toFixed(2),
      i.tallyValue.toFixed(2),
      i.valueVariance > 0 ? `+${i.valueVariance.toFixed(2)}` : i.valueVariance.toFixed(2),
      `"${i.status}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tally_Warehouse_Discrepancy_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    dialog.showSuccess({
      title: 'Discrepancy Report Exported',
      message: 'Downloaded CSV audit report for accountant and warehouse coordination.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        accept=".xml,.csv,.tsv,.json,.txt"
        className="hidden"
      />

      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tally Import & Warehouse Coordination Panel
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 uppercase">
                Accountant Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Import TallyPrime XML, Stock Summary CSV, or JSON exports to reconcile physical inventory counts, detect stock discrepancies, and synchronize catalog valuations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoadSample('csv')}
            disabled={isParsing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Sample CSV
          </button>
          <button
            onClick={() => handleLoadSample('xml')}
            disabled={isParsing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Sample XML
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isParsing ? 'Parsing File...' : 'Upload Tally Export'}</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload Zone (when no file is loaded) */}
      {!preview && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white/50 dark:bg-slate-800/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 p-10 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Drag & Drop your Tally Export File here
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports <code className="font-mono text-indigo-600">.XML</code> (Tally Envelope),{' '}
              <code className="font-mono text-indigo-600">.CSV / .XLS</code> (Stock Summary Sheet), or{' '}
              <code className="font-mono text-indigo-600">.JSON</code>
            </p>
          </div>
          <button
            type="button"
            className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors pointer-events-none"
          >
            Select File from Computer
          </button>
        </div>
      )}

      {/* PREVIEW & RECONCILIATION WORKSPACE (when file is loaded) */}
      {preview && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Total Items */}
            <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Total File Items
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {preview.summary.totalItems}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Format: {preview.fileType}</div>
            </div>

            {/* In-Sync */}
            <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40 shadow-xs">
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>In-Sync</span>
              </div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {preview.summary.inSyncCount}
              </div>
              <div className="text-[10px] text-emerald-600/70">Balances & Prices Match</div>
            </div>

            {/* Stock Discrepancies */}
            <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 shadow-xs">
              <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Stock Discrepancies</span>
              </div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                {preview.summary.discrepancyCount}
              </div>
              <div className="text-[10px] text-amber-600/70">Warehouse vs Tally diffs</div>
            </div>

            {/* New Catalog Items */}
            <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/40 shadow-xs">
              <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-1">
                <PackagePlus className="w-3 h-3" />
                <span>New Items</span>
              </div>
              <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">
                {preview.summary.newItemsCount}
              </div>
              <div className="text-[10px] text-indigo-600/70">Not in Nalka yet</div>
            </div>

            {/* Net Valuation Variance */}
            <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs col-span-2 sm:col-span-4 lg:col-span-1">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Net Value Variance
              </div>
              <div
                className={cn(
                  'text-xl font-bold mt-1 flex items-center gap-1',
                  preview.summary.netValuationDiff > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : preview.summary.netValuationDiff < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-300'
                )}
              >
                {preview.summary.netValuationDiff > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : preview.summary.netValuationDiff < 0 ? (
                  <TrendingDown className="w-4 h-4" />
                ) : null}
                <span>
                  ₹{Math.abs(preview.summary.netValuationDiff).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {preview.summary.netValuationDiff > 0 ? 'Tally is higher' : 'Nalka is higher'}
              </div>
            </div>
          </div>

          {/* Import Controls & Options Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateStock}
                  onChange={(e) => setUpdateStock(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Update Stock Balances</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updatePrices}
                  onChange={(e) => setUpdatePrices(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Update Unit Rates / Costs</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createNewProducts}
                  onChange={(e) => setCreateNewProducts(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Create New Catalog Products</span>
              </label>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                placeholder="Audit Reference Note..."
                className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex-1 md:w-64 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Table Toolbar (Search & Filter) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items by name, SKU, or category..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {/* Filter Pills */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-all',
                    statusFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  )}
                >
                  All ({items.length})
                </button>
                <button
                  onClick={() => setStatusFilter('DISCREPANCY')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-all',
                    statusFilter === 'DISCREPANCY'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  )}
                >
                  Discrepancies ({preview.summary.discrepancyCount})
                </button>
                <button
                  onClick={() => setStatusFilter('NEW')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-all',
                    statusFilter === 'NEW'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  )}
                >
                  New ({preview.summary.newItemsCount})
                </button>
                <button
                  onClick={() => setStatusFilter('IN_SYNC')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-all',
                    statusFilter === 'IN_SYNC'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  )}
                >
                  In-Sync ({preview.summary.inSyncCount})
                </button>
              </div>

              {/* Quick Select Buttons */}
              <button
                onClick={() => setAllSelected(true)}
                className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Select All
              </button>
              <button
                onClick={selectDiscrepanciesOnly}
                className="px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Only Discrepancies
              </button>
            </div>
          </div>

          {/* Reconciliation Audit Table */}
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every((i) => i.selected)}
                        onChange={(e) => setAllSelected(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                    </th>
                    <th className="py-3 px-3">Item Particulars & SKU</th>
                    <th className="py-3 px-3">Category / Group</th>
                    <th className="py-3 px-3 text-center">Nalka Warehouse</th>
                    <th className="py-3 px-3 text-center">Tally Closing</th>
                    <th className="py-3 px-3 text-center">Stock Variance</th>
                    <th className="py-3 px-3 text-right">Nalka Cost</th>
                    <th className="py-3 px-3 text-right">Tally Rate</th>
                    <th className="py-3 px-3 text-right">Value Difference</th>
                    <th className="py-3 px-3 text-center">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => toggleItemSelection(item.id)}
                      className={cn(
                        'hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors cursor-pointer',
                        item.selected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                      )}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleItemSelection(item.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                      </td>

                      {/* Name & SKU */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.itemName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          SKU: {item.sku || 'N/A'} • {item.unit}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {item.categoryName}
                      </td>

                      {/* Nalka Warehouse Stock */}
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                        {item.matchedProductId ? item.nalkaStock : '—'}
                      </td>

                      {/* Tally Closing Stock */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {item.tallyStock}
                      </td>

                      {/* Stock Variance */}
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        {item.status === 'NEW_ITEM' ? (
                          <span className="text-indigo-600 dark:text-indigo-400">
                            +{item.tallyStock} (New)
                          </span>
                        ) : item.stockVariance === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">0</span>
                        ) : item.stockVariance > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{item.stockVariance}
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">
                            {item.stockVariance}
                          </span>
                        )}
                      </td>

                      {/* Nalka Cost */}
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">
                        ₹{item.nalkaRate.toFixed(2)}
                      </td>

                      {/* Tally Rate */}
                      <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        ₹{item.tallyRate.toFixed(2)}
                      </td>

                      {/* Valuation Difference */}
                      <td className="py-3 px-3 text-right font-mono font-medium">
                        <span
                          className={cn(
                            item.valueVariance > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.valueVariance < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-400'
                          )}
                        >
                          {item.valueVariance > 0 ? '+' : ''}
                          ₹{item.valueVariance.toFixed(2)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {item.status === 'IN_SYNC' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            In-Sync
                          </span>
                        )}
                        {item.status === 'STOCK_DISCREPANCY' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            Discrepancy
                          </span>
                        )}
                        {item.status === 'NEW_ITEM' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                            New Catalog Item
                          </span>
                        )}
                        {item.status === 'PRICE_CHANGE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                            Rate Update
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {selectedCount} of {items.length} item(s) selected
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setPreview(null);
                  setItems([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Clear / Reset
              </button>

              <button
                onClick={handleExportDiscrepancyCsv}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Discrepancy Report (.csv)</span>
              </button>

              <button
                onClick={handleApplyImport}
                disabled={isApplying || selectedCount === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isApplying ? 'Applying Changes...' : 'Apply Reconciled Stock & Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
