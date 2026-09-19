import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Package,
  TrendingUp,
  RotateCcw,
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  PlusCircle,
  HelpCircle,
  Sparkles,
  Calculator,
  ArrowRight,
  ArrowDownLeft,
  Eye,
  Layers,
  DollarSign,
  Boxes,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Plus,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Category, RestockPlanResponse, RestockPlanItem, UserRole } from '../../types';
import { formatCurrency, formatDate, formatNumber, cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';

interface RestockPlannerViewProps {
  categories: Category[];
  role: UserRole;
  onOpenStockIn: (productId: string, suggestedQty?: number) => void;
  onOpenProductDetail?: (productId: string) => void;
  onRefreshAll: () => void;
}

type SortField =
  | 'sku'
  | 'name'
  | 'category'
  | 'physicalStock'
  | 'availableStock'
  | 'reorderQuantity'
  | 'unitCost'
  | 'estimatedCost'
  | 'urgency';

type SortDirection = 'asc' | 'desc';

export const RestockPlannerView: React.FC<RestockPlannerViewProps> = ({
  categories,
  role,
  onOpenStockIn,
  onOpenProductDetail,
  onRefreshAll,
}) => {
  const { showSuccess, showError, showConfirm } = useDialog();
  const isManager = role === 'manager';
  const [multiplier, setMultiplier] = useState<number>(2.0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [data, setData] = useState<RestockPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedItems, setSelectedItems] = useState<{ [id: string]: boolean }>({});
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [bulkSupplier, setBulkSupplier] = useState<string>('Faridabad Central Plant / Primary Vendor');
  const [bulkRefNumber, setBulkRefNumber] = useState<string>('');
  const [bulkNotes, setBulkNotes] = useState<string>('Routine automated safety restock batch');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showFormulaGuide, setShowFormulaGuide] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

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

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const fetchPlan = async () => {
    setIsLoading(true);
    try {
      const res = await api.getRestockPlan({ multiplier });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load restock plan', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [multiplier]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
      if (selectedUrgency !== 'all' && item.urgency !== selectedUrgency) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchCat = item.categoryName.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat) return false;
      }
      return true;
    });
  }, [data, selectedCategory, selectedUrgency, searchQuery]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!filteredItems.length) return [];
    if (!sortField) return filteredItems;

    const urgencyRank: Record<string, number> = {
      EMERGENCY: 1,
      CRITICAL: 2,
      MEDIUM: 3,
    };

    return [...filteredItems].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'sku':
          comparison = a.sku.localeCompare(b.sku);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          comparison = a.categoryName.localeCompare(b.categoryName);
          break;
        case 'physicalStock':
          comparison = a.physicalStock - b.physicalStock;
          break;
        case 'availableStock':
          comparison = a.availableStock - b.availableStock;
          break;
        case 'reorderQuantity':
          comparison = a.reorderQuantity - b.reorderQuantity;
          break;
        case 'unitCost':
          comparison = a.unitCost - b.unitCost;
          break;
        case 'estimatedCost':
          comparison = a.estimatedCost - b.estimatedCost;
          break;
        case 'urgency':
          comparison = (urgencyRank[a.urgency] || 99) - (urgencyRank[b.urgency] || 99);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredItems, sortField, sortDirection]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedUrgency, multiplier, pageSize, sortField, sortDirection]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(sortedItems.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return sortedItems;
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, safeCurrentPage, pageSize]);

  const isAllFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((i) => selectedItems[i.id]);
  const isSomeFilteredSelected =
    filteredItems.some((i) => selectedItems[i.id]) && !isAllFilteredSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeFilteredSelected;
    }
  }, [isSomeFilteredSelected]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedItems).filter(Boolean).length;
  }, [selectedItems]);

  const selectedTotalUnits = useMemo(() => {
    if (!data?.items) return 0;
    return data.items
      .filter((i) => selectedItems[i.id])
      .reduce((sum, i) => sum + i.reorderQuantity, 0);
  }, [data, selectedItems]);

  const selectedTotalCost = useMemo(() => {
    if (!data?.items) return 0;
    return data.items
      .filter((i) => selectedItems[i.id])
      .reduce((sum, i) => sum + i.estimatedCost, 0);
  }, [data, selectedItems]);

  const handleSelectAll = (checked: boolean) => {
    const next: { [id: string]: boolean } = {};
    if (checked) {
      filteredItems.forEach((i) => {
        next[i.id] = true;
      });
    }
    setSelectedItems(next);
  };

  const toggleItemSelect = (id: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection(
        field === 'reorderQuantity' ||
          field === 'estimatedCost' ||
          field === 'physicalStock' ||
          field === 'availableStock'
          ? 'desc'
          : 'asc'
      );
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ChevronsUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
    );
  };

  const handleExportCSV = () => {
    if (!data?.items || data.items.length === 0) return;
    const headers = [
      'S.No',
      'SKU',
      'Item Name',
      'Category',
      'Unit',
      'Physical Stock',
      'Reserved Stock',
      'Available Stock',
      'Minimum Safe Stock',
      'Critical Threshold',
      'Target Buffer Stock',
      'Deficit',
      'Recommended Reorder Quantity',
      'Unit Cost (INR)',
      'Estimated Restock Cost (INR)',
      'Urgency Priority',
      'Restock Rationale',
    ];

    const rows = sortedItems.map((item, idx) => [
      idx + 1,
      `"${item.sku}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.categoryName}"`,
      item.unit,
      item.physicalStock,
      item.reservedStock,
      item.availableStock,
      item.minimumStock,
      item.criticalStock,
      item.targetStock,
      item.deficit,
      item.reorderQuantity,
      item.unitCost.toFixed(2),
      item.estimatedCost.toFixed(2),
      item.urgency,
      `"${item.reorderReason.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Nalka_Restock_Reorder_Plan_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.items) return;

    const itemsToProcess = data.items
      .filter((i) => selectedItems[i.id])
      .map((i) => ({
        productId: i.id,
        quantity: i.reorderQuantity,
      }));

    if (itemsToProcess.length === 0) return;

    const count = itemsToProcess.length;
    const confirmed = await showConfirm({
      title: 'Confirm Bulk Restock Receipt',
      message: `Are you sure you want to process and receive stock replenishment for ${count} selected item${count > 1 ? 's' : ''}?`,
      confirmText: 'Yes, Receive Stock',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    setIsSubmittingBulk(true);
    try {
      const res = await api.bulkRestock({
        items: itemsToProcess,
        supplier: bulkSupplier.trim(),
        referenceNumber: bulkRefNumber.trim() || `BULK-RESTOCK-${Date.now().toString().slice(-6)}`,
        notes: bulkNotes.trim(),
        reason: 'Restock Replenishment against Safety Stock Deficit',
      });

      setSuccessMessage(
        `Successfully received ${res.processedCount} items into inventory! Stock updated.`
      );
      setIsBulkModalOpen(false);
      setSelectedItems({});
      fetchPlan();
      onRefreshAll();
      setTimeout(() => setSuccessMessage(null), 6000);

      showSuccess({
        title: 'Bulk Restock Received',
        message: `Successfully restocked ${res.processedCount} items into inventory. Current stock balances have been updated.`,
      });
    } catch (err: any) {
      showError({
        title: 'Bulk Restock Failed',
        message: err.message || 'Failed to process bulk restock',
      });
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const summary = data?.summary;
  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedCategory !== 'all' || selectedUrgency !== 'all';

  return (
    <div id="restock-planner-view" className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header Toolbar (Consistent with Inventory & Transactions) */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Restock & Reorder Replenishment Planner
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-400">
                  Algorithmic replenishment engine for Nalka Metal Industries (Faridabad plant)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowFormulaGuide(!showFormulaGuide)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>{showFormulaGuide ? 'Hide Formula' : 'Calculation Logic'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              title={isFullScreen ? 'Exit Full Screen (Esc)' : 'Expand Table to Full Screen'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Screen Table</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!data?.items?.length}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {isManager && (
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                disabled={selectedCount === 0}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bulk Restock ({selectedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/70 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            {/* Urgency Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-400 font-medium">Urgency:</span>
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden text-xs text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Urgency Levels</option>
                <option value="EMERGENCY">Emergency (Negative Deficit)</option>
                <option value="CRITICAL">Critical & Out of Stock</option>
                <option value="MEDIUM">Medium (Low Buffer)</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-400 font-medium">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden text-xs text-slate-800 dark:text-slate-200 max-w-[200px]"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Buffer Multiplier */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-400 font-medium">Target Buffer:</span>
              <div className="flex items-center gap-1">
                {[1.5, 2.0, 2.5, 3.0].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMultiplier(m)}
                    className={cn(
                      'px-2 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer',
                      multiplier === m
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU or item..."
                className="w-full pl-8 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={fetchPlan}
              disabled={isLoading}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shrink-0"
              title="Refresh restock calculations"
            >
              <RotateCcw className={cn('w-4 h-4', isLoading && 'animate-spin text-indigo-600 dark:text-indigo-400')} />
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Formula Guide Drawer */}
      {showFormulaGuide && (
        <div className="p-5 rounded-2xl bg-slate-900 dark:bg-slate-950 text-slate-100 border border-slate-700 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-base text-slate-100">
                Mathematical Model & Restock Formulation
              </h3>
            </div>
            <button
              onClick={() => setShowFormulaGuide(false)}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-2">
              <span className="font-semibold text-amber-400 block uppercase tracking-wider text-[11px]">
                1. Effective Available Stock
              </span>
              <p className="text-slate-300 font-mono">
                S_available = S_physical - S_reserved
              </p>
              <p className="text-slate-400 leading-relaxed">
                Physical factory stock minus open reservations from unfulfilled sales orders.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-2">
              <span className="font-semibold text-blue-400 block uppercase tracking-wider text-[11px]">
                2. Target Safety Stock Level
              </span>
              <p className="text-slate-300 font-mono">
                S_target = max(S_min × Multiplier, S_min + 5)
              </p>
              <p className="text-slate-400 leading-relaxed">
                Dynamic target calculated from baseline safety threshold (current multiplier: <strong className="text-white">{multiplier}x</strong>).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-2">
              <span className="font-semibold text-emerald-400 block uppercase tracking-wider text-[11px]">
                3. Reorder Quantity (Q_reorder)
              </span>
              <p className="text-slate-300 font-mono">
                Q_reorder = S_target - S_available
              </p>
              <p className="text-slate-400 leading-relaxed">
                For <strong>Negative Stock</strong> (e.g. -12 available, Target 30): Q = 30 - (-12) = <strong>42 units</strong> (covers 12 deficit + 30 buffer).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Items Needing Restock */}
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>SKUs Needing Restock</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {summary ? formatNumber(summary.totalItemsToRestock) : '...'} Items
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-rose-600 dark:text-rose-400 font-semibold">{summary?.negativeCount || 0} Neg</span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">{summary?.outOfStockCount || 0} Out</span>
            <span>•</span>
            <span className="text-orange-600 dark:text-orange-400 font-semibold">{summary?.criticalCount || 0} Crit</span>
            <span>•</span>
            <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{summary?.lowCount || 0} Low</span>
          </div>
        </div>

        {/* Negative Deficit Units */}
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Negative Stock Deficit</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">
            {summary ? formatNumber(summary.totalNegativeDeficitUnits) : '...'}
          </div>
          <div className="text-xs text-rose-600/90 dark:text-rose-400/90 font-medium pt-1">
            Across {summary?.negativeCount || 0} backlogged items
          </div>
        </div>

        {/* Total Reorder Units Needed */}
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Total Units to Order</span>
            <Boxes className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono mt-1">
            {summary ? formatNumber(summary.totalRestockUnits) : '...'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            Restores all items to {multiplier}x buffer
          </div>
        </div>

        {/* Estimated Total Investment */}
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Estimated Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {summary ? formatCurrency(summary.estimatedTotalRestockCost) : '...'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            Based on Master unit purchase costs
          </div>
        </div>
      </div>

      {/* Selected Items Action Bar */}
      {selectedCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 text-white text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-emerald-400">{selectedCount} items selected</span>
            <span className="text-slate-500">|</span>
            <span>
              Total Units:{' '}
              <strong className="text-white font-mono">{formatNumber(selectedTotalUnits)}</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span>
              Total Cost:{' '}
              <strong className="text-emerald-300 font-mono">{formatCurrency(selectedTotalCost)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedItems({})}
              className="px-2.5 py-1 text-slate-400 hover:text-white cursor-pointer"
            >
              Deselect All
            </button>
            {isManager && (
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer transition-all shadow-md shadow-emerald-600/30"
              >
                Create Inbound Restock Receipt
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full Screen Backdrop with Blur & Inactive Dimming */}
      {isFullScreen && (
        <div
          onClick={() => setIsFullScreen(false)}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-40 animate-in fade-in duration-200 cursor-pointer"
          title="Click backdrop to exit full screen"
          aria-hidden="true"
        />
      )}

      {/* Main Restock Table (Centralized Consistent Design) */}
      <div
        className={cn(
          'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs transition-all',
          isFullScreen
            ? 'fixed inset-2 sm:inset-3 md:inset-4 lg:inset-5 z-50 flex flex-col shadow-2xl border-slate-300 dark:border-slate-600 rounded-2xl animate-in zoom-in-95 duration-200'
            : ''
        )}
      >
        {/* Table Title Bar (Exact match with Inventory Master Catalog header) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                Restock Replenishment Queue
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-md border border-amber-100 dark:border-amber-800">
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
              </span>
              {data?.items && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  (out of {data.items.length} restock candidates)
                </span>
              )}
              {isFullScreen && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5" />
                  <span>Full Screen Expanded</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
              Deficit mitigation, buffer replenishment targets, and purchase orders queue
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {searchQuery && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Matching:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">"{searchQuery}"</span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-1 cursor-pointer"
                  title="Clear keyword"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Full Screen Toggle Button on Top of Table */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
                isFullScreen
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              )}
              title={isFullScreen ? 'Exit Full Screen (Esc)' : 'Expand table across full screen width'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span>Exit Full Screen</span>
                  <span className="text-[10px] text-indigo-200 font-mono hidden sm:inline">(Esc)</span>
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

        {/* Responsive Table */}
        <div className={cn('overflow-x-auto', isFullScreen ? 'flex-1 overflow-y-auto' : '')}>
          <table className={cn('w-full text-left border-collapse', isFullScreen ? 'min-w-full' : 'min-w-[1080px]')}>
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-400 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100 dark:border-slate-700/70 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                {/* Select All Checkbox */}
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title={isAllFilteredSelected ? 'Deselect all' : 'Select all'}
                  />
                </th>

                {/* SKU */}
                <th className="py-3.5 px-4 w-[145px] min-w-[145px] whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('sku')}
                    className="group flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden"
                  >
                    <span>SKU / Code</span>
                    {renderSortIcon('sku')}
                  </button>
                </th>

                {/* Product Name & Category */}
                <th className="py-3.5 px-4 min-w-[240px]">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="group flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden"
                  >
                    <span>Product Name & Category</span>
                    {renderSortIcon('name')}
                  </button>
                </th>

                {/* Physical Stock */}
                <th className="py-3.5 px-4 w-[130px] min-w-[130px] text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('physicalStock')}
                    className="group inline-flex items-center justify-end gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden w-full"
                  >
                    <span>Physical Stock</span>
                    {renderSortIcon('physicalStock')}
                  </button>
                </th>

                {/* Available */}
                <th className="py-3.5 px-4 w-[110px] min-w-[110px] text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('availableStock')}
                    className="group inline-flex items-center justify-end gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden w-full"
                  >
                    <span>Available</span>
                    {renderSortIcon('availableStock')}
                  </button>
                </th>

                {/* Min / Target Buffer */}
                <th className="py-3.5 px-4 w-[130px] min-w-[130px] text-right">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400">
                    Min / Target
                  </span>
                </th>

                {/* Reorder Qty */}
                <th className="py-3.5 px-4 w-[130px] min-w-[130px] text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('reorderQuantity')}
                    className="group inline-flex items-center justify-end gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden w-full"
                  >
                    <span>Reorder Qty</span>
                    {renderSortIcon('reorderQuantity')}
                  </button>
                </th>

                {/* Unit Rate */}
                <th className="py-3.5 px-4 w-[105px] min-w-[105px] text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('unitCost')}
                    className="group inline-flex items-center justify-end gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden w-full"
                  >
                    <span>Unit Rate</span>
                    {renderSortIcon('unitCost')}
                  </button>
                </th>

                {/* Est. Cost */}
                <th className="py-3.5 px-4 w-[120px] min-w-[120px] text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('estimatedCost')}
                    className="group inline-flex items-center justify-end gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden w-full"
                  >
                    <span>Est. Cost</span>
                    {renderSortIcon('estimatedCost')}
                  </button>
                </th>

                {/* Priority */}
                <th className="py-3.5 px-4 w-[115px] min-w-[115px] text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('urgency')}
                    className="group inline-flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden w-full"
                  >
                    <span>Priority</span>
                    {renderSortIcon('urgency')}
                  </button>
                </th>

                {/* Actions */}
                <th className="py-3.5 px-4 w-[130px] min-w-[130px] text-right">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCcw className="w-6 h-6 animate-spin text-slate-400" />
                      <span>Computing safety stock deficits & reorder quantities across master inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    {hasActiveFilters ? (
                      <div>
                        <Filter className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          No matching restock items
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                          No replenishment candidates match your active urgency, category, or search filters.
                        </p>
                        <button
                          onClick={() => {
                            setSelectedUrgency('all');
                            setSelectedCategory('all');
                            setSearchQuery('');
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Clear Search & Filters</span>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          All Stock Levels Healthy
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          All inventory items currently have sufficient stock above minimum safety buffer thresholds.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isSelected = !!selectedItems[item.id];
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors',
                        isSelected && 'bg-indigo-50/50 dark:bg-indigo-950/40'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItemSelect(item.id)}
                          className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap text-xs">
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-800 dark:text-slate-200 inline-flex items-center tracking-tight whitespace-nowrap shadow-2xs">
                          {item.sku}
                        </span>
                      </td>

                      {/* Product Name & Category */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => onOpenProductDetail && onOpenProductDetail(item.id)}
                          className={cn(
                            'font-semibold text-slate-900 dark:text-slate-100 text-xs leading-snug',
                            onOpenProductDetail &&
                              'hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
                          )}
                        >
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-medium">
                            {item.categoryName}
                          </span>
                          <span>•</span>
                          <span
                            className="text-slate-400 dark:text-slate-500 truncate max-w-[280px]"
                            title={item.reorderReason}
                          >
                            {item.reorderReason}
                          </span>
                        </div>
                      </td>

                      {/* Physical Stock */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap text-xs">
                        {item.physicalStock < 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                            <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>
                              {formatNumber(item.physicalStock)} {item.unit}
                            </span>
                          </span>
                        ) : item.physicalStock === 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            0 {item.unit}
                          </span>
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {formatNumber(item.physicalStock)}{' '}
                            <span className="text-[11px] text-slate-400 font-normal">{item.unit}</span>
                          </span>
                        )}

                        {item.reservedStock > 0 && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-sans mt-0.5 flex items-center justify-end gap-1">
                            <span className="px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50 rounded font-semibold">
                              {item.reservedStock} reserved
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap text-xs">
                        {item.availableStock < 0 ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatNumber(item.availableStock)} {item.unit}
                          </span>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300">
                            {formatNumber(item.availableStock)} {item.unit}
                          </span>
                        )}
                      </td>

                      {/* Min / Target Buffer */}
                      <td className="py-3 px-4 text-right font-mono text-xs whitespace-nowrap">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          {formatNumber(item.targetStock)}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">target</span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          min: {formatNumber(item.minimumStock)} • crit: {formatNumber(item.criticalStock)}
                        </div>
                      </td>

                      {/* Reorder Qty */}
                      <td className="py-3 px-4 text-right whitespace-nowrap text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-md font-mono font-bold">
                          +{formatNumber(item.reorderQuantity)} {item.unit}
                        </span>
                      </td>

                      {/* Unit Rate */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">
                        {formatCurrency(item.unitCost)}
                      </td>

                      {/* Est. Cost */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                        {formatCurrency(item.estimatedCost)}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.urgency === 'EMERGENCY' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                            <span>DEFICIT</span>
                          </span>
                        )}
                        {item.urgency === 'CRITICAL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                            <AlertTriangle className="w-2.5 h-2.5 text-orange-600 dark:text-orange-400" />
                            <span>CRITICAL</span>
                          </span>
                        )}
                        {item.urgency === 'MEDIUM' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                            <span>ROUTINE</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {onOpenProductDetail && (
                            <button
                              type="button"
                              onClick={() => onOpenProductDetail(item.id)}
                              title="View product details & ledger"
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenStockIn(item.id, item.reorderQuantity)}
                            title={`Receive +${formatNumber(item.reorderQuantity)} ${item.unit} into stock`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white shadow-2xs transition-all cursor-pointer"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>Stock In</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Pagination */}
        {filteredItems.length > 0 && (
          <div className="p-4 bg-slate-50/60 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <span>
                Showing{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {pageSize === -1 ? 1 : (safeCurrentPage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {pageSize === -1
                    ? filteredItems.length
                    : Math.min(safeCurrentPage * pageSize, filteredItems.length)}
                </strong>{' '}
                of <strong className="text-slate-800 dark:text-slate-200">{filteredItems.length}</strong>{' '}
                items
              </span>

              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={-1}>All ({filteredItems.length})</option>
                </select>
              </div>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  title="First Page"
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  title="Previous Page"
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Page {safeCurrentPage} of {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  title="Next Page"
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  title="Last Page"
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Restock Inbound Receipt Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <PlusCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Bulk Restock Inbound Goods Receipt
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Record batch stock-in for {selectedCount} selected items
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkRestockSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Selected Items:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCount} SKUs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total Units to Receive:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                    +{formatNumber(selectedTotalUnits)} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total Estimated Valuation:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(selectedTotalCost)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Manufacturing Plant Source *
                </label>
                <input
                  type="text"
                  required
                  value={bulkSupplier}
                  onChange={(e) => setBulkSupplier(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="e.g. Faridabad Central Plant / Tarun Hardware Supplier"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference / GRN / Challan Number
                </label>
                <input
                  type="text"
                  value={bulkRefNumber}
                  onChange={(e) => setBulkRefNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder={`Auto: RESTOCK-${Date.now().toString().slice(-6)}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction Notes / Audit Memo
                </label>
                <textarea
                  rows={2}
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="Additional audit verification details..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBulk}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 dark:bg-emerald-500 rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  {isSubmittingBulk ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Receiving Inbound Stock...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm & Inbound {formatNumber(selectedTotalUnits)} Units
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

