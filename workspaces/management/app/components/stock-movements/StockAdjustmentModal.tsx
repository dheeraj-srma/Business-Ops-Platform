'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, SlidersHorizontal, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Product } from '../../types';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  initialProductId?: string;
}

const ADJUSTMENT_REASONS = [
  'Physical Stock Count Verification',
  'Periodic Warehouse Audit Discrepancy',
  'Damaged / Broken in Storage',
  'Supplier Quantity Mismatch',
  'Expired / Obsolete Material Write-off',
  'Found Unrecorded Stock on Shelf',
  'Data Correction / Reversal',
  'Other Reason',
];

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  products,
  initialProductId,
}) => {
  const { showSuccess, showError } = useDialog();
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || '');
  const [actualStock, setActualStock] = useState<string>('');
  const [reason, setReason] = useState<string>('Physical Stock Count Verification');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
      const p = products.find((x) => x.id === initialProductId);
      if (p) setActualStock((p.current_stock ?? p.currentStock ?? 0).toString());
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
      setActualStock((products[0].current_stock ?? products[0].currentStock ?? 0).toString());
    }
  }, [initialProductId, products]);

  // When product changes, reset actual stock placeholder to current
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const p = products.find((x) => x.id === prodId);
    if (p) setActualStock((p.current_stock ?? p.currentStock ?? 0).toString());
  };

  if (!isOpen) return null;

  const currentSystemStock = selectedProduct ? (selectedProduct.current_stock ?? selectedProduct.currentStock ?? 0) : 0;
  const actualStockNum = actualStock === '' ? NaN : parseInt(actualStock);
  const difference = isNaN(actualStockNum) ? 0 : actualStockNum - currentSystemStock;
  const hasVariance = !isNaN(actualStockNum) && difference !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProductId) {
      setErrorMessage('Please select a product.');
      return;
    }

    if (isNaN(actualStockNum)) {
      setErrorMessage('Please enter a valid physical stock count.');
      return;
    }

    if (difference === 0) {
      setErrorMessage('Physical stock matches system stock exactly (variance is 0). No adjustment is required.');
      return;
    }

    if (!reason) {
      setErrorMessage('Adjustment reason is mandatory for audit compliance.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.recordStockAdjustment({
        productId: selectedProductId,
        actualStock: actualStockNum,
        reason,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();

      const diffSign = difference > 0 ? `+${difference}` : `${difference}`;
      showSuccess({
        title: 'Stock Adjustment Reconciled',
        message: `Stock level for "${selectedProduct?.name}" has been adjusted to ${actualStockNum} ${selectedProduct?.unit || 'units'} (${diffSign} variance recorded in audit log).`,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete stock adjustment.');
      showError({
        title: 'Adjustment Failed',
        message: err.message || 'Failed to complete physical stock adjustment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-200">
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        title="Click background to close"
      />
      <div
        id="modal-stock-adjustment"
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700 z-10 transition-colors"
      >
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-2xl flex items-center justify-center shadow-2xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">Stock Adjustment & Reconciliation</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                  ADJUSTMENT
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Reconcile physical stock count with audit trail log</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Product <span className="text-red-500">*</span>
            </label>
            <select
              id="input-adjust-product"
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 dark:focus:border-blue-400/50 focus:outline-hidden"
              required
            >
              {products
                .filter((p) => p.is_active || (p as any).isActive !== false)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} (System: {p.current_stock ?? p.currentStock} {p.unit})
                  </option>
                ))}
            </select>
          </div>

          {/* Comparison Cards */}
          {selectedProduct && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block">Current System</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {currentSystemStock} {selectedProduct.unit}
                </span>
              </div>

              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl text-center">
                <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium block">Actual Physical</span>
                <span className="text-sm font-bold text-blue-900 dark:text-blue-200 font-mono">
                  {isNaN(actualStockNum) ? '-' : actualStockNum} {selectedProduct.unit}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border text-center ${
                  difference > 0
                    ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-indigo-700 dark:text-indigo-300'
                    : difference < 0
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span className="text-[11px] font-medium block">Audit Variance</span>
                <span className="text-sm font-bold font-mono">
                  {difference > 0 ? `+${difference}` : difference} {selectedProduct.unit}
                </span>
              </div>
            </div>
          )}

          {/* Physical Count Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Actual Counted Physical Stock <span className="text-red-500">*</span>
            </label>
            <input
              id="input-adjust-actual-stock"
              type="number"
              step="1"
              placeholder="e.g. 115"
              value={actualStock}
              onChange={(e) => setActualStock(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 dark:focus:border-blue-400/50 focus:outline-hidden font-mono"
              required
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Enter the exact count verified during physical warehouse stocktaking.
            </p>
          </div>

          {/* Reason & Audit Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Discrepancy <span className="text-red-500">*</span>
              </label>
              <select
                id="input-adjust-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 dark:focus:border-blue-400/50 focus:outline-hidden"
              >
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Audit Verification Ref #
              </label>
              <input
                id="input-adjust-ref"
                type="text"
                placeholder="e.g. AUDIT-2026-Q3"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 dark:focus:border-blue-400/50 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Detailed Audit Justification / Remarks
            </label>
            <textarea
              id="input-adjust-notes"
              rows={2}
              placeholder="e.g. 5 units damaged during handling. Written off per manager approval."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 dark:focus:border-blue-400/50 focus:outline-hidden"
            />
          </div>

          {/* Warning banner */}
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold">Audit Trail Notice:</span> This action will immediately adjust the inventory balance and record an immutable transaction in the historical ledger.
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-stock-adjust"
              type="submit"
              disabled={isSubmitting || !hasVariance}
              className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl transition-all shadow-sm shadow-blue-900/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Reconciling...' : 'Confirm Reconciliation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
