import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Edit2,
  Eye,
  Archive,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  Layers,
  Sparkles,
  X,
  Tag,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowUpDown,
} from 'lucide-react';
import { Product, Category, UserRole } from '../../types';
import { formatDate, formatCurrency, cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';
import { DataExchangeModal } from './DataExchangeModal';

interface InventoryViewProps {
  products: Product[];
  categories: Category[];
  role: UserRole;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenNewProduct: () => void;
  onOpenEditProduct: (product: Product) => void;
  onOpenProductDetail: (productId: string) => void;
  onOpenStockIn: (productId: string) => void;
  onOpenStockOut: (productId: string) => void;
  onOpenStockAdjustment: (productId: string) => void;
  initialStatusFilter?: string;
  onGoBack?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categories,
  role,
  isLoading,
  onRefresh,
  onOpenNewProduct,
  onOpenEditProduct,
  onOpenProductDetail,
  onOpenStockIn,
  onOpenStockOut,
  onOpenStockAdjustment,
  initialStatusFilter = 'all',
  onGoBack,
}) => {
  const { showConfirm, showSuccess, showError } = useDialog();
  const isManager = role === 'manager';
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter);
  const [sortBy, setSortBy] = useState<string>('updated_desc');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isDataExchangeModalOpen, setIsDataExchangeModalOpen] = useState<boolean>(false);

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

  // Keyboard shortcut "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const safeProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const seen = new Set<string>();
    const unique: Product[] = [];
    for (const p of products) {
      const key = String(p.id || p.sku || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      unique.push(p);
    }
    return unique;
  }, [products]);

  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);

  // Sync initialStatusFilter prop if it changes
  useEffect(() => {
    if (initialStatusFilter) {
      setSelectedStatus(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  // Safe field extractors
  const getNumberField = (item: any, key1: string, key2: string): number => {
    if (!item) return 0;
    const v1 = item[key1];
    const v2 = item[key2];

    const parse = (v: any) => {
      if (v === undefined || v === null || v === '') return NaN;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return isNaN(n) ? NaN : n;
    };

    const n1 = parse(v1);
    const n2 = parse(v2);

    if (!isNaN(n1) && n1 !== 0) return n1;
    if (!isNaN(n2) && n2 !== 0) return n2;
    if (!isNaN(n1)) return n1;
    if (!isNaN(n2)) return n2;
    return 0;
  };

  const getDateField = (item: any): number => {
    if (!item) return 0;
    const candidates = [item.updatedAt, item.updated_at, item.createdAt, item.created_at];
    for (const c of candidates) {
      if (c) {
        const t = new Date(c).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
    }
    return 0;
  };

  const getStringField = (item: any, key1: string, key2: string): string => {
    if (!item) return '';
    const v1 = item[key1];
    const v2 = item[key2];
    if (typeof v1 === 'string' && v1.trim()) return v1.trim();
    if (typeof v2 === 'string' && v2.trim()) return v2.trim();
    return '';
  };

  const computeStockStatus = (item: any): string => {
    if (!item) return 'HEALTHY';
    if (item.status && typeof item.status === 'string' && item.status.trim()) {
      return item.status.toUpperCase().trim();
    }
    const current = getNumberField(item, 'currentStock', 'current_stock');
    const min = getNumberField(item, 'minimumStock', 'minimum_stock');
    const crit = getNumberField(item, 'criticalStock', 'critical_stock') || (min > 0 ? Math.ceil(min / 3) : 0);

    if (current < 0) return 'NEGATIVE';
    if (current === 0) return 'OUT_OF_STOCK';
    if (crit > 0 && current <= crit) return 'CRITICAL';
    if (min > 0 && current <= min) return 'LOW';
    return 'HEALTHY';
  };

  // Filter and sort products locally or from server
  const filteredProducts = useMemo(() => {
    return safeProducts.filter((p) => {
      // Archived toggle
      const isItemActive = p.isActive ?? (p as any).is_active ?? true;
      if (!showArchived && !isItemActive) return false;
      if (showArchived && isItemActive) return false;

      // Category filter (robust ID/Name matching)
      if (selectedCategory !== 'all') {
        const catId = String(p.categoryId || (p as any).category_id || '').toLowerCase().trim();
        const catName = String(p.categoryName || (p as any).category_name || '').toLowerCase().trim();
        const target = String(selectedCategory).toLowerCase().trim();
        if (catId !== target && catName !== target) return false;
      }

      // Status filter (case-insensitive with computed fallback)
      if (selectedStatus !== 'all') {
        const itemStatus = computeStockStatus(p);
        const targetStatus = String(selectedStatus).toUpperCase().trim();
        if (itemStatus !== targetStatus) return false;
      }

      // Comprehensive search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesSku = (p.sku || '').toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const matchesCat = (p.categoryName || (p as any).category_name || '').toLowerCase().includes(q);
        const matchesUnit = (p.unit || '').toLowerCase().includes(q);
        const matchesStatus = computeStockStatus(p).toLowerCase().replace(/_/g, ' ').includes(q);
        if (!matchesName && !matchesSku && !matchesDesc && !matchesCat && !matchesUnit && !matchesStatus) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const stockA = getNumberField(a, 'currentStock', 'current_stock');
      const stockB = getNumberField(b, 'currentStock', 'current_stock');

      const costA = getNumberField(a, 'unitCost', 'unit_cost');
      const costB = getNumberField(b, 'unitCost', 'unit_cost');

      const timeA = getDateField(a);
      const timeB = getDateField(b);

      const nameA = getStringField(a, 'name', 'product_name');
      const nameB = getStringField(b, 'name', 'product_name');

      const skuA = getStringField(a, 'sku', 'product_sku');
      const skuB = getStringField(b, 'sku', 'product_sku');

      switch (sortBy) {
        case 'stock_asc':
          return stockA - stockB;
        case 'stock_desc':
          return stockB - stockA;
        case 'name_asc':
          return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        case 'name_desc':
          return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
        case 'sku_asc':
          return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
        case 'sku_desc':
          return skuB.localeCompare(skuA, undefined, { numeric: true, sensitivity: 'base' });
        case 'val_desc':
          return costB - costA;
        case 'val_asc':
          return costA - costB;
        case 'updated_asc':
          return timeA - timeB;
        case 'updated_desc':
        default:
          return timeB - timeA;
      }
    });
  }, [safeProducts, searchQuery, selectedCategory, selectedStatus, sortBy, showArchived]);

  // Reset page when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus, sortBy, showArchived, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredProducts.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProducts = useMemo(() => {
    if (pageSize === -1) return filteredProducts;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, safeCurrentPage, pageSize]);

  const handleToggleArchive = async (prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    const isCurrentlyActive = prod ? (prod.isActive ?? (prod as any).is_active !== false) : true;

    const confirmed = await showConfirm({
      title: isCurrentlyActive ? 'Archive Product' : 'Restore Product',
      message: isCurrentlyActive
        ? `Are you sure you want to archive "${prod?.name || 'this product'}" (${prod?.sku || ''})? It will be hidden from default catalog views.`
        : `Are you sure you want to restore "${prod?.name || 'this product'}" (${prod?.sku || ''}) to active inventory?`,
      confirmText: isCurrentlyActive ? 'Yes, Archive' : 'Yes, Restore',
      isDestructive: isCurrentlyActive,
    });

    if (!confirmed) return;

    try {
      await api.toggleProductStatus(prodId);
      onRefresh();
      showSuccess({
        title: isCurrentlyActive ? 'Product Archived' : 'Product Restored',
        message: `Product "${prod?.name || 'Item'}" has been successfully ${isCurrentlyActive ? 'archived' : 'restored to active inventory'}.`,
      });
    } catch (err: any) {
      showError({
        title: 'Status Update Failed',
        message: err.message || 'Failed to update product status',
      });
    }
  };

  const hasActiveFilters = searchQuery.trim() !== '' || selectedCategory !== 'all' || selectedStatus !== 'all' || showArchived;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setShowArchived(false);
  };

  return (
    <div id="inventory-view" className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Controls & Search Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            {/* Module Back Button */}
            {onGoBack && (
              <button
                id="btn-inventory-back"
                onClick={onGoBack}
                title="Go back to previous state"
                className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0 group"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              </button>
            )}

            {/* Prominent Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                id="input-inventory-search"
                type="text"
                placeholder="Search by SKU, Product Name, Category, Unit, or Status... (Press '/' to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-20 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden transition-all shadow-2xs"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    title="Clear search"
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-2xs">
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons & Add Product */}
          <div className="flex items-center gap-2 shrink-0 justify-end">
            <button
              id="btn-filter-archived"
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer',
                showArchived
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              {showArchived ? 'Showing Archived Items' : 'Active Catalog'}
            </button>

            {isManager && (
              <button
                id="btn-add-product"
                onClick={onOpenNewProduct}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters Bar: Category, Status, Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/70 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-400 font-medium">Category:</span>
              <select
                id="select-filter-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Categories ({safeCategories.length})</option>
                {safeCategories.map((c) => (
                  <option key={c.id || c.name} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 dark:text-slate-400 font-medium">Status:</span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  onClick={() => setSelectedStatus('all')}
                  className={cn(
                    'px-2 py-1 rounded-md font-medium transition-all cursor-pointer',
                    selectedStatus === 'all'
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedStatus('HEALTHY')}
                  className={cn(
                    'px-2 py-1 rounded-md font-medium transition-all cursor-pointer',
                    selectedStatus === 'HEALTHY'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Healthy
                </button>
                <button
                  onClick={() => setSelectedStatus('LOW')}
                  className={cn(
                    'px-2 py-1 rounded-md font-medium transition-all cursor-pointer',
                    selectedStatus === 'LOW'
                      ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Low Stock
                </button>
                <button
                  onClick={() => setSelectedStatus('CRITICAL')}
                  className={cn(
                    'px-2 py-1 rounded-md font-medium transition-all cursor-pointer',
                    selectedStatus === 'CRITICAL'
                      ? 'bg-white dark:bg-slate-800 text-orange-700 dark:text-orange-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Critical
                </button>
                <button
                  onClick={() => setSelectedStatus('OUT_OF_STOCK')}
                  className={cn(
                    'px-2 py-1 rounded-md font-medium transition-all cursor-pointer',
                    selectedStatus === 'OUT_OF_STOCK'
                      ? 'bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Out of Stock
                </button>
                <button
                  onClick={() => setSelectedStatus('NEGATIVE')}
                  className={cn(
                    'px-2 py-1 rounded-md font-medium transition-all cursor-pointer',
                    selectedStatus === 'NEGATIVE'
                      ? 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Negative Stock
                </button>
              </div>
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium underline-offset-2 hover:underline cursor-pointer pl-1"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-400 font-medium">Sort:</span>
            <select
              id="select-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="updated_desc">Recently Updated</option>
              <option value="updated_asc">Oldest Updated</option>
              <option value="stock_desc">Highest Stock First</option>
              <option value="stock_asc">Lowest Stock First</option>
              <option value="name_asc">Product Name (A-Z)</option>
              <option value="name_desc">Product Name (Z-A)</option>
              <option value="sku_asc">SKU (A-Z)</option>
              <option value="sku_desc">SKU (Z-A)</option>
              <option value="val_desc">Highest Valuation</option>
              <option value="val_asc">Lowest Valuation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Full Screen Backdrop with Blur & Inactive Dimming */}
      {isFullScreen && (
        <div
          onClick={() => setIsFullScreen(false)}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-40 animate-in fade-in duration-200 cursor-pointer"
          title="Click backdrop to exit full screen"
          aria-hidden="true"
        />
      )}

      {/* Main Inventory Table */}
      <div
        className={cn(
          'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs transition-all',
          isFullScreen
            ? 'fixed inset-2 sm:inset-3 md:inset-4 lg:inset-5 z-50 flex flex-col shadow-2xl border-slate-300 dark:border-slate-600 rounded-2xl animate-in zoom-in-95 duration-200'
            : ''
        )}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                Inventory Master Catalog
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                {isLoading ? (
                  <span className="inline-flex items-center gap-1">
                    <span>Getting Inventory</span>
                    <span className="inline-flex font-black text-indigo-600 dark:text-indigo-400">
                      <span className="animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }}>.</span>
                    </span>
                  </span>
                ) : (
                  `${filteredProducts.length} ${filteredProducts.length === 1 ? 'item' : 'items'}`
                )}
              </span>
              {hasActiveFilters && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  (filtered from {products.length} total)
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
              Live operational quantities, reorder thresholds, and unit valuation records
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Catalog search status / quick filter indicator */}
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

            {/* Dedicated Data Exchange Button (JSON, XML, Excel, CSV) */}
            <button
              type="button"
              id="btn-inventory-data-exchange"
              onClick={() => setIsDataExchangeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer shadow-2xs group"
              title="Open Data Exchange: Import and Export catalog in JSON, XML, Excel, and CSV formats"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>Data Exchange</span>
              <span className="text-[10px] py-0.2 px-1 bg-white dark:bg-slate-800 rounded text-indigo-600 dark:text-indigo-400 font-mono text-[9px] ml-0.5 font-bold border border-indigo-100 dark:border-indigo-900/60">
                JSON • XML • XLS
              </span>
            </button>

            {/* Full Screen Toggle Button */}
            <button
              type="button"
              id="btn-inventory-fullscreen"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
                isFullScreen
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              )}
              title={isFullScreen ? 'Exit Full Screen (Esc)' : 'Expand table across whole screen width'}
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

        <div className={cn('overflow-x-auto', isFullScreen ? 'flex-1 overflow-y-auto' : '')}>
          <table className="w-full text-left border-collapse min-w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-400 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100 dark:border-slate-700/70 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="py-3 px-3 w-[120px] min-w-[120px] whitespace-nowrap">SKU / Code</th>
                <th className="py-3 px-3 min-w-[200px]">Product Name</th>
                <th className="py-3 px-3 w-[115px] min-w-[115px]">Category</th>
                <th className="py-3 px-3 w-[105px] min-w-[105px] text-right">Current Stock</th>
                <th className="py-3 px-3 w-[95px] min-w-[95px] text-right">Reserved</th>
                <th className="py-3 px-3 w-[105px] min-w-[105px] text-right">Available</th>
                <th className="py-3 px-3 w-[90px] min-w-[90px] text-right">Min Stock</th>
                <th className="py-3 px-3 w-[145px] min-w-[145px] text-center">Status</th>
                <th className="py-3 px-3 w-[110px] min-w-[110px] text-right">Unit Valuation</th>
                <th className="py-3 px-3 w-[125px] min-w-[125px] text-right">Total Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-2xs">
                        <RotateCcw className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" style={{ animationDirection: 'reverse' }} />
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide">
                        <span>Getting Inventory</span>
                        <span className="inline-flex gap-0.5 font-black text-indigo-600 dark:text-indigo-400">
                          <span className="animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }}>.</span>
                          <span className="animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }}>.</span>
                          <span className="animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }}>.</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                        Fetching live catalog items, stock balances, and valuation records...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No products found</p>
                    <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                      {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                        ? 'No inventory items match your current search query or active status filters.'
                        : 'Get started by creating your first inventory product.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Search & Filters</span>
                      </button>
                    )}
                    <button
                      onClick={onRefresh}
                      className="mt-3 ml-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Reload Inventory Data</span>
                    </button>
                    {isManager && !hasActiveFilters && (
                      <button
                        onClick={onOpenNewProduct}
                        className="mt-3 ml-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Product</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p, idx) => {
                  const currentStock = getNumberField(p, 'currentStock', 'current_stock');
                  const minStock = getNumberField(p, 'minimumStock', 'minimum_stock');
                  const unitCost = getNumberField(p, 'unitCost', 'unit_cost');
                  const reservedStock = getNumberField(p, 'reservedStock', 'reserved_stock');
                  const availableStock = currentStock - reservedStock;
                  const totalValuation = currentStock > 0 ? currentStock * unitCost : 0;
                  const unit = p.unit || 'Pieces';
                  const rowKey = `prod-${p.id || p.sku || idx}-${idx}`;

                  return (
                    <tr key={rowKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                      {/* SKU */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs">
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-800 dark:text-slate-200 inline-flex items-center tracking-tight whitespace-nowrap shadow-2xs">
                          {p.sku}
                        </span>
                      </td>

                      {/* Name & Description */}
                      <td className="py-3 px-3">
                        <div
                          onClick={() => onOpenProductDetail(p.id)}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer flex items-center gap-1.5 text-xs"
                        >
                          <span>{p.name}</span>
                        </div>
                        {p.description && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[220px]">
                            {p.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-[11px] font-medium">
                          {p.categoryName || 'General'}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap text-xs">
                        {currentStock < 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            <span>{currentStock}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {currentStock}
                          </span>
                        )}{' '}
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">{unit}</span>
                      </td>

                      {/* Reserved Stock */}
                      <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap">
                        {reservedStock > 0 ? (
                          <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50 rounded font-semibold text-amber-700 dark:text-amber-300">
                            {reservedStock} {unit}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap">
                        {availableStock < 0 ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {availableStock} {unit}
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {availableStock} {unit}
                          </span>
                        )}
                      </td>

                      {/* Minimum Stock */}
                      <td className="py-3 px-3 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                        {minStock} {unit}
                      </td>

                      {/* Status Badge & Last Updated Subtext */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider',
                              p.status === 'HEALTHY' && 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
                              p.status === 'LOW' && 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
                              p.status === 'CRITICAL' && 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300',
                              p.status === 'OUT_OF_STOCK' && 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300',
                              p.status === 'NEGATIVE' && 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            )}
                          >
                            {p.status === 'HEALTHY' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />}
                            {p.status === 'LOW' && <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />}
                            {p.status === 'CRITICAL' && <AlertTriangle className="w-2.5 h-2.5 text-orange-600 dark:text-orange-400" />}
                            {p.status === 'OUT_OF_STOCK' && <XCircle className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />}
                            {p.status === 'NEGATIVE' && <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />}
                            <span>{p.status === 'NEGATIVE' ? 'Negative Stock' : p.status.replace('_', ' ')}</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-1 whitespace-nowrap">
                          Updated {formatDate(p.updatedAt || (p as any).updated_at)}
                        </div>
                      </td>

                      {/* Valuation */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs">
                        {formatCurrency(unitCost)}
                      </td>

                      {/* Total Valuation */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap text-xs">
                        {formatCurrency(totalValuation)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredProducts.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40 text-xs shrink-0">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <span>
                Showing <strong className="text-slate-700 dark:text-slate-200">
                  {pageSize === -1 ? 1 : (safeCurrentPage - 1) * pageSize + 1}
                </strong> to <strong className="text-slate-700 dark:text-slate-200">
                  {pageSize === -1 ? filteredProducts.length : Math.min(safeCurrentPage * pageSize, filteredProducts.length)}
                </strong> of <strong className="text-slate-700 dark:text-slate-200">{filteredProducts.length}</strong> items
              </span>

              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Per page:</span>
                <select
                  id="select-page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={-1}>All ({filteredProducts.length})</option>
                </select>
              </div>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  id="btn-page-first"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  title="First Page"
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  id="btn-page-prev"
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
                  id="btn-page-next"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  title="Next Page"
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  id="btn-page-last"
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

      {/* Dedicated Data Exchange Modal */}
      <DataExchangeModal
        isOpen={isDataExchangeModalOpen}
        onClose={() => setIsDataExchangeModalOpen(false)}
        filteredProducts={filteredProducts}
        allProducts={products}
        categories={categories}
        onSuccess={() => {
          onRefresh();
        }}
      />
    </div>
  );
};
