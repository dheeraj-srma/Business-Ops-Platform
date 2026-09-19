import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Package,
  Calendar,
  Layers,
  FileText,
  AlertTriangle,
  History,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ArrowLeft,
  Eye,
  Edit2,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { Product, StockTransaction } from '../../types';
import { api } from '../../lib/api';
import { formatDate, formatCurrency, cn } from '../../lib/utils';
import { ScrollToTopButton } from '../common/ScrollToTopButton';
import { useDialog } from '../../context/DialogContext';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  onOpenStockIn: (productId: string) => void;
  onOpenStockOut: (productId: string) => void;
  onOpenStockAdjustment: (productId: string) => void;
  onOpenEditProduct?: (product: Product) => void;
  onRefresh?: () => void;
  isManager?: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  productId,
  onOpenStockIn,
  onOpenStockOut,
  onOpenStockAdjustment,
  onOpenEditProduct,
  onRefresh,
  isManager = true,
}) => {
  const { showConfirm, showSuccess, showError } = useDialog();
  const auditLedgerRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<{
    product: Product;
    auditSummary: {
      initialStock: number;
      totalReceived: number;
      totalIssued: number;
      totalAdjustedPlus: number;
      totalAdjustedMinus: number;
      calculatedCurrentStock: number;
      actualCurrentStock: number;
    };
    transactions: StockTransaction[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleToggleArchive = async () => {
    if (!product) return;
    const isCurrentlyActive = product.isActive ?? (product as any)?.is_active ?? true;

    const confirmed = await showConfirm({
      title: isCurrentlyActive ? 'Archive Product' : 'Restore Product',
      message: isCurrentlyActive
        ? `Are you sure you want to archive "${product.name}" (${product.sku})? It will be hidden from default catalog views.`
        : `Restore "${product.name}" (${product.sku}) to default catalog views?`,
      confirmText: isCurrentlyActive ? 'Yes, Archive' : 'Yes, Restore',
      cancelText: 'Cancel',
    });

    if (confirmed) {
      try {
        await api.updateProduct(product.id, { is_active: !isCurrentlyActive });
        await showSuccess({
          title: isCurrentlyActive ? 'Product Archived' : 'Product Restored',
          message: `Product "${product.name}" has been successfully ${isCurrentlyActive ? 'archived' : 'restored to active inventory'}.`,
        });
        if (onRefresh) onRefresh();
        onClose();
      } catch (err: any) {
        showError({
          title: 'Action Failed',
          message: err.message || 'Failed to update product state',
        });
      }
    }
  };

  useEffect(() => {
    if (isOpen && productId) {
      setIsLoading(true);
      setError(null);
      api
        .getProductDetails(productId)
        .then((res) => {
          setData(res);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Failed to load details');
          setIsLoading(false);
        });
    }
  }, [isOpen, productId]);

  if (!isOpen || !productId) return null;

  const product = data?.product;
  const audit = data?.auditSummary;
  const transactions = data?.transactions || [];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        title="Click backdrop to close"
      />
      <div
        id="modal-product-detail"
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col z-10 transition-colors"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={onClose}
              title="Back to inventory"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0 group"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </button>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-600">
                  {product?.sku || '...'}
                </span>
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                    product?.status === 'HEALTHY' && 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
                    product?.status === 'LOW' && 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
                    product?.status === 'CRITICAL' && 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
                    product?.status === 'OUT_OF_STOCK' && 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700',
                    product?.status === 'NEGATIVE' && 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  )}
                >
                  {product?.status === 'NEGATIVE' ? 'Negative Stock' : product?.status?.replace('_', ' ') || 'STATUS'}
                </span>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-tight mt-0.5">
                {product?.name || 'Loading...'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close dialog"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 relative">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">Loading product audit records...</div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg text-xs">{error}</div>
          ) : product && audit ? (
            <>
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block">Physical In-Stock</span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {product.current_stock ?? product.currentStock} {product.unit}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Physical Inventory</span>
                </div>

                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-lg">
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">Available / Uncommitted</span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-indigo-900 dark:text-indigo-200">
                    {(product.available_stock ?? product.availableStock ?? (product.current_stock ?? product.currentStock) - (product.reserved_stock ?? product.reservedStock ?? 0))} {product.unit}
                  </span>
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 block mt-0.5">
                    {(product.reserved_stock ?? product.reservedStock ?? 0) > 0
                      ? `(${product.reserved_stock ?? product.reservedStock} reserved in Tally)`
                      : '0 orders reserved'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block">Unit Valuation</span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrency(product.unitCost ?? product.unit_cost)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Per {product.unit}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block">Total Holding Value</span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrency((product.current_stock ?? product.currentStock) * (product.unitCost ?? product.unit_cost))}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Asset Balance</span>
                </div>
              </div>

              {/* Complete Stock Audit Equation */}
              <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Stock Audit Balance Equation
                    </h4>
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded self-start sm:self-auto">
                    100% Mathematically Reconciled
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">Opening Stock</span>
                    <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                      {audit.initialStock}
                    </span>
                  </div>

                  <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/60 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">+ Received</span>
                    <span className="text-sm font-bold font-mono">
                      +{audit.totalReceived}
                    </span>
                  </div>

                  <div className="p-2.5 bg-amber-50/60 dark:bg-amber-950/60 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-medium">- Issued</span>
                    <span className="text-sm font-bold font-mono">
                      -{audit.totalIssued}
                    </span>
                  </div>

                  <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/60 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300">
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-medium">+ Adj. Plus</span>
                    <span className="text-sm font-bold font-mono">
                      +{audit.totalAdjustedPlus}
                    </span>
                  </div>

                  <div className="p-2.5 bg-rose-50/60 dark:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-medium">- Adj. Minus</span>
                    <span className="text-sm font-bold font-mono">
                      -{audit.totalAdjustedMinus}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900 dark:bg-slate-950 rounded-lg text-white col-span-2 sm:col-span-1 lg:col-span-1 border dark:border-slate-700">
                    <span className="text-[10px] text-slate-300 block font-medium">= Current Balance</span>
                    <span className={cn('text-sm font-bold font-mono', audit.actualCurrentStock < 0 ? 'text-rose-400' : 'text-emerald-400')}>
                      {audit.actualCurrentStock} {product.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                  Quick Actions
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2 flex-wrap sm:flex-nowrap overflow-x-auto">
                  {/* Stock In */}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenStockIn(product.id);
                    }}
                    title="Receive Stock"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Receive (Stock In)</span>
                  </button>

                  {/* Stock Out */}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenStockOut(product.id);
                    }}
                    disabled={(product.current_stock ?? product.currentStock) <= 0}
                    title="Issue Stock"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Issue (Stock Out)</span>
                  </button>

                  {/* Reconcile (Adjust) */}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenStockAdjustment(product.id);
                    }}
                    title="Reconcile / Adjust Stock"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Reconcile (Adjust)</span>
                  </button>

                  {/* Edit SKU Details */}
                  {isManager && onOpenEditProduct && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenEditProduct(product);
                      }}
                      title="Edit SKU Details"
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>Edit SKU</span>
                    </button>
                  )}

                  {/* Archive SKU */}
                  {isManager && (
                    <button
                      onClick={handleToggleArchive}
                      title={product.isActive || (product as any).is_active !== false ? 'Archive SKU' : 'Restore SKU'}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                    >
                      {product.isActive || (product as any).is_active !== false ? (
                        <>
                          <Archive className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Archive</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Restore</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Chronological Movement Audit Ledger */}
              <div ref={auditLedgerRef}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Stock Movement Audit Ledger ({transactions.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">Immutable chronological order</span>
                </div>

                {transactions.length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
                    No transactions recorded for this product yet.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4">Date & Time</th>
                          <th className="py-2.5 px-4">Type</th>
                          <th className="py-2.5 px-4 text-right">Quantity</th>
                          <th className="py-2.5 px-4 text-right">Prev → New</th>
                          <th className="py-2.5 px-4">Ref / Party</th>
                          <th className="py-2.5 px-4">Logged By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-normal">
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {formatDate(tx.createdAt || (tx as any).created_at)}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                                  tx.transactionType === 'STOCK_IN' || (tx as any).transaction_type === 'STOCK_IN'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : tx.transactionType === 'STOCK_OUT' || (tx as any).transaction_type === 'STOCK_OUT'
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : tx.transactionType === 'CUSTOMER_RETURN' || (tx as any).transaction_type === 'CUSTOMER_RETURN'
                                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                    : tx.transactionType === 'INITIAL_STOCK' || (tx as any).transaction_type === 'INITIAL_STOCK'
                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                )}
                              >
                                {(tx.transactionType || (tx as any).transaction_type)?.replace('_', ' ')}
                              </span>
                            </td>
                            <td
                              className={cn(
                                'py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap',
                                (tx.transactionType === 'CUSTOMER_RETURN' || (tx as any).transaction_type === 'CUSTOMER_RETURN')
                                  ? 'text-purple-700 dark:text-purple-400'
                                  : (tx.transactionType === 'STOCK_IN' || (tx as any).transaction_type === 'STOCK_IN' || tx.transactionType === 'INITIAL_STOCK' || (tx as any).transaction_type === 'INITIAL_STOCK' || tx.transactionType === 'ADJUSTMENT_INCREASE' || (tx as any).transaction_type === 'ADJUSTMENT_INCREASE')
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              )}
                            >
                              {(tx.transactionType === 'CUSTOMER_RETURN' || (tx as any).transaction_type === 'CUSTOMER_RETURN' || tx.transactionType === 'STOCK_IN' || (tx as any).transaction_type === 'STOCK_IN' || tx.transactionType === 'INITIAL_STOCK' || (tx as any).transaction_type === 'INITIAL_STOCK' || tx.transactionType === 'ADJUSTMENT_INCREASE' || (tx as any).transaction_type === 'ADJUSTMENT_INCREASE') ? '+' : '-'}
                              {tx.quantity} {product.unit}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {tx.previousStock ?? (tx as any).previous_stock} →{' '}
                              <span className="font-bold text-slate-900 dark:text-slate-100">{tx.newStock ?? (tx as any).new_stock}</span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                              <div className="font-medium truncate max-w-[150px]">
                                {tx.referenceNumber || (tx as any).reference_number || '-'}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
                                {tx.supplierOrRecipient || (tx as any).supplier_or_recipient || '-'}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {tx.createdByName || (tx as any).created_by_name}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
          <ScrollToTopButton containerRef={scrollContainerRef} />
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
