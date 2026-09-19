import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Layers,
  Search,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Edit2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  DollarSign,
  Boxes,
} from 'lucide-react';
import { Category, Product, UserRole } from '../../types';
import { formatDate, formatCurrency, formatNumber, cn } from '../../lib/utils';
import { ScrollToTopButton } from '../common/ScrollToTopButton';

interface CategoryProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  products: Product[];
  role: UserRole;
  onOpenProductDetail?: (productId: string) => void;
  onOpenStockIn?: (productId: string) => void;
  onOpenStockOut?: (productId: string) => void;
  onOpenEditProduct?: (product: Product) => void;
  onOpenNewProduct?: () => void;
}

type SortField = 'sku' | 'name' | 'stock' | 'minStock' | 'unitCost' | 'totalValue' | 'status';

export const CategoryProductsModal: React.FC<CategoryProductsModalProps> = ({
  isOpen,
  onClose,
  category,
  products,
  role,
  onOpenProductDetail,
  onOpenStockIn,
  onOpenStockOut,
  onOpenEditProduct,
  onOpenNewProduct,
}) => {
  const isManager = role === 'manager';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Reset state when category or modal changes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setStatusFilter('all');
      setSortField('name');
      setSortDirection('asc');
      setIsFullScreen(false);
    }
  }, [isOpen, category?.id]);

  // Handle ESC key to exit full screen or close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullScreen, onClose]);

  // Lock body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // All products belonging to this category
  const categoryProducts = useMemo(() => {
    if (!category) return [];
    return products.filter((p) => {
      const pCatId = p.categoryId || (p as any).category_id;
      const isActive = p.isActive ?? (p as any).is_active !== false;
      return pCatId === category.id && isActive;
    });
  }, [category, products]);

  // Metrics summary
  const metrics = useMemo(() => {
    const totalCount = categoryProducts.length;
    const totalUnits = Math.round(
      categoryProducts.reduce(
        (sum, p) => sum + (p.currentStock ?? (p as any).current_stock ?? 0),
        0
      )
    );
    const totalValuation = categoryProducts.reduce((sum, p) => {
      const stock = p.currentStock ?? (p as any).current_stock ?? 0;
      const cost = p.unitCost ?? (p as any).unit_cost ?? (p as any).unitPrice ?? (p as any).unit_price ?? 0;
      return sum + Math.max(0, stock) * cost;
    }, 0);
    const lowStockCount = categoryProducts.filter((p) => p.status === 'LOW').length;
    const criticalCount = categoryProducts.filter(
      (p) => p.status === 'CRITICAL' || p.status === 'OUT_OF_STOCK'
    ).length;
    const negativeCount = categoryProducts.filter((p) => {
      const stock = p.currentStock ?? (p as any).current_stock ?? 0;
      return stock < 0 || p.status === 'NEGATIVE';
    }).length;

    return {
      totalCount,
      totalUnits,
      totalValuation,
      lowStockCount,
      criticalCount,
      negativeCount,
    };
  }, [categoryProducts]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    let result = categoryProducts.filter((p) => {
      const stock = p.currentStock ?? (p as any).current_stock ?? 0;
      const isNeg = stock < 0 || p.status === 'NEGATIVE';

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'negative') {
          if (!isNeg) return false;
        } else if (statusFilter === 'low_critical') {
          if (p.status !== 'LOW' && p.status !== 'CRITICAL' && p.status !== 'OUT_OF_STOCK') return false;
        } else if (p.status !== statusFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const skuMatch = (p.sku || '').toLowerCase().includes(q);
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        if (!skuMatch && !nameMatch && !descMatch) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      const aStock = a.currentStock ?? (a as any).current_stock ?? 0;
      const bStock = b.currentStock ?? (b as any).current_stock ?? 0;
      const aMin = a.minimumStock ?? (a as any).minimum_stock ?? (a as any).minStockLevel ?? 0;
      const bMin = b.minimumStock ?? (b as any).minimum_stock ?? (b as any).minStockLevel ?? 0;
      const aCost = a.unitCost ?? (a as any).unit_cost ?? (a as any).unitPrice ?? (a as any).unit_price ?? 0;
      const bCost = b.unitCost ?? (b as any).unit_cost ?? (b as any).unitPrice ?? (b as any).unit_price ?? 0;

      switch (sortField) {
        case 'sku':
          aVal = (a.sku || '').toLowerCase();
          bVal = (b.sku || '').toLowerCase();
          break;
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'stock':
          aVal = aStock;
          bVal = bStock;
          break;
        case 'minStock':
          aVal = aMin;
          bVal = bMin;
          break;
        case 'unitCost':
          aVal = aCost;
          bVal = bCost;
          break;
        case 'totalValue':
          aVal = Math.max(0, aStock) * aCost;
          bVal = Math.max(0, bStock) * bCost;
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [categoryProducts, statusFilter, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 inline ml-1" />
    );
  };

  if (!isOpen || !category) return null;

  return createPortal(
    <div
      id="category-products-modal-overlay"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center overflow-hidden animate-in fade-in duration-200',
        isFullScreen ? 'p-2 sm:p-3 md:p-4' : 'p-3 sm:p-5 md:p-6'
      )}
    >
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
        title="Click background to close"
      />

      {/* Modal Dialog Container - Perfectly Centered */}
      <div
        className={cn(
          'relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col z-10 w-full transition-all overflow-hidden',
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none'
            : 'max-w-5xl max-h-[90vh] h-full sm:h-auto'
        )}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  {category.name}
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800">
                  {category.id}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                  {categoryProducts.length} {categoryProducts.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xl">
                {category.description || 'Stock category product catalog and inventory balances'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Full Screen Toggle Button */}
            <button
              type="button"
              id="btn-category-modal-fullscreen"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
                isFullScreen
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              )}
              title={isFullScreen ? 'Exit Full Screen (Esc)' : 'Expand table across whole screen width'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="hidden sm:inline">Full Screen</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              id="btn-close-category-products-modal"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close popup (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Statistics Summary Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total SKUs</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                  {metrics.totalCount}
                </span>
                <span className="text-[10px] text-slate-400">products</span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Physical Stock</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base sm:text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {formatNumber(metrics.totalUnits)}
                </span>
                <span className="text-[10px] text-slate-400">units</span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category Value</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base sm:text-lg font-bold font-mono text-indigo-700 dark:text-indigo-400 truncate">
                  {formatCurrency(metrics.totalValuation)}
                </span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stock Alerts</span>
              <div className="flex items-center gap-2 mt-0.5">
                {metrics.lowStockCount + metrics.criticalCount + metrics.negativeCount > 0 ? (
                  <span className="text-sm sm:text-base font-bold font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {metrics.lowStockCount + metrics.criticalCount + metrics.negativeCount} flagged
                  </span>
                ) : (
                  <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    All Healthy
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${category.name} (SKU, name)...`}
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                id="select-category-modal-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Statuses ({categoryProducts.length})</option>
                <option value="HEALTHY">Healthy Stock</option>
                <option value="LOW">Low Stock</option>
                <option value="CRITICAL">Critical Threshold</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
                <option value="negative">Negative Deficit ({metrics.negativeCount})</option>
              </select>

              {isManager && onOpenNewProduct && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewProduct();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add SKU</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Products Table Container */}
        <div ref={tableContainerRef} className="flex-1 overflow-y-auto overflow-x-auto min-h-[240px] relative">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-400 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th
                  onClick={() => handleSort('sku')}
                  className="py-3 px-4 w-[150px] min-w-[150px] whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors group select-none"
                >
                  SKU / Code {getSortIcon('sku')}
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 min-w-[240px] cursor-pointer hover:text-indigo-600 transition-colors group select-none"
                >
                  Product Name {getSortIcon('name')}
                </th>
                <th
                  onClick={() => handleSort('stock')}
                  className="py-3 px-4 w-[125px] min-w-[125px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
                >
                  Current Stock {getSortIcon('stock')}
                </th>
                <th
                  onClick={() => handleSort('minStock')}
                  className="py-3 px-4 w-[105px] min-w-[105px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
                >
                  Min Level {getSortIcon('minStock')}
                </th>
                <th
                  onClick={() => handleSort('unitCost')}
                  className="py-3 px-4 w-[115px] min-w-[115px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
                >
                  Unit Cost {getSortIcon('unitCost')}
                </th>
                <th
                  onClick={() => handleSort('totalValue')}
                  className="py-3 px-4 w-[125px] min-w-[125px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
                >
                  Total Value {getSortIcon('totalValue')}
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 w-[125px] min-w-[125px] text-center cursor-pointer hover:text-indigo-600 transition-colors group select-none"
                >
                  Status {getSortIcon('status')}
                </th>
                <th className="py-3 px-4 w-[130px] min-w-[130px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {categoryProducts.length === 0
                        ? `No products assigned to ${category.name} yet.`
                        : 'No items match your active search or status filter.'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {categoryProducts.length === 0
                        ? 'Create products and select this category to populate this group.'
                        : 'Try adjusting your keyword or reset filters.'}
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                        }}
                        className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear Filter</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const stock = p.currentStock ?? (p as any).current_stock ?? 0;
                  const minStock = p.minimumStock ?? (p as any).minimum_stock ?? (p as any).minStockLevel ?? 0;
                  const cost = p.unitCost ?? (p as any).unit_cost ?? (p as any).unitPrice ?? (p as any).unit_price ?? 0;
                  const totalValue = Math.max(0, stock) * cost;
                  const isNegative = stock < 0 || p.status === 'NEGATIVE';
                  const unit = p.unit || 'NOS';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* SKU - Fixed with nowrap and generous pill padding */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 px-2.5 py-1 rounded-md tracking-tight whitespace-nowrap inline-flex items-center shadow-2xs">
                          {p.sku}
                        </span>
                      </td>

                      {/* Product Name */}
                      <td className="py-3.5 px-4 min-w-[240px]">
                        <button
                          type="button"
                          onClick={() => onOpenProductDetail && onOpenProductDetail(p.id)}
                          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left cursor-pointer leading-snug block"
                          title="View Product Audit Ledger"
                        >
                          {p.name}
                        </button>
                        {p.description && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-xs mt-0.5">
                            {p.description}
                          </p>
                        )}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 font-mono font-bold">
                          {isNegative ? (
                            <span className="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-200 dark:border-red-800/60 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                              {stock}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                p.status === 'LOW' || p.status === 'CRITICAL'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : p.status === 'OUT_OF_STOCK'
                                  ? 'text-slate-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              )}
                            >
                              {formatNumber(stock)}
                            </span>
                          )}
                          <span className="text-[10px] font-normal text-slate-400">{unit}</span>
                        </div>
                      </td>

                      {/* Min Stock */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {minStock} <span className="text-[10px]">{unit}</span>
                      </td>

                      {/* Unit Cost */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatCurrency(cost)}
                      </td>

                      {/* Total Value */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(totalValue)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block',
                            isNegative && 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
                            !isNegative && p.status === 'HEALTHY' && 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
                            !isNegative && p.status === 'LOW' && 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
                            !isNegative && p.status === 'CRITICAL' && 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
                            !isNegative && p.status === 'OUT_OF_STOCK' && 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          )}
                        >
                          {isNegative ? 'DEFICIT' : p.status || 'HEALTHY'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Stock In */}
                          {onOpenStockIn && (
                            <button
                              type="button"
                              onClick={() => onOpenStockIn(p.id)}
                              title="Stock In"
                              className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition-all cursor-pointer"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Stock Out */}
                          {onOpenStockOut && (
                            <button
                              type="button"
                              onClick={() => onOpenStockOut(p.id)}
                              title="Stock Out"
                              className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-md transition-all cursor-pointer"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Detail Modal */}
                          {onOpenProductDetail && (
                            <button
                              type="button"
                              onClick={() => onOpenProductDetail(p.id)}
                              title="View Audit Ledger & History"
                              className="p-1.5 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-md transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit Product (Manager Only) */}
                          {isManager && onOpenEditProduct && (
                            <button
                              type="button"
                              onClick={() => onOpenEditProduct(p)}
                              title="Edit Product"
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <ScrollToTopButton containerRef={tableContainerRef} />
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredProducts.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{categoryProducts.length}</strong> SKUs in {category.name}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
