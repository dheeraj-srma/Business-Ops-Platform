import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Package,
  Calendar,
  Building2,
  FileText,
  Boxes,
} from 'lucide-react';
import { Product } from '../../types';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';
import { TransactionCompletionPromptModal } from '../transactions/TransactionCompletionPromptModal';
import { ExportableConsignment } from '../../lib/transactionExport';

interface StockInLineItem {
  rowId: string;
  productId: string;
  quantity: string;
}

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  initialProductId?: string;
  onViewInLedger?: () => void;
}

export const StockInModal: React.FC<StockInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  products,
  initialProductId,
  onViewInLedger,
}) => {
  const { showSuccess, showError } = useDialog();

  const activeProducts = products.filter((p) => p.is_active || (p as any).isActive !== false);

  const [supplier, setSupplier] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [items, setItems] = useState<StockInLineItem[]>([
    {
      rowId: 'item-1',
      productId: initialProductId || '',
      quantity: '',
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State for immediate export prompt upon processing completion
  const [completionConsignment, setCompletionConsignment] = useState<ExportableConsignment | null>(null);
  const [isCompletionPromptOpen, setIsCompletionPromptOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSupplier('');
      setReferenceNumber('');
      setNotes('');
      setDate(new Date().toISOString().slice(0, 10));
      setItems([
        {
          rowId: 'item-1',
          productId: initialProductId || '',
          quantity: '',
        },
      ]);
      setErrorMessage(null);
    }
  }, [isOpen, initialProductId]);

  if (!isOpen && !isCompletionPromptOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        rowId: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId: '',
        quantity: '',
      },
    ]);
  };

  const handleRemoveItem = (rowId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.rowId !== rowId));
  };

  const handleItemProductChange = (rowId: string, newProductId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.rowId === rowId ? { ...it, productId: newProductId } : it))
    );
  };

  const handleItemQuantityChange = (rowId: string, newQuantity: string) => {
    setItems((prev) =>
      prev.map((it) => (it.rowId === rowId ? { ...it, quantity: newQuantity } : it))
    );
  };

  const calculateTotalQuantity = () => {
    return items.reduce((sum, it) => {
      const q = parseInt(it.quantity) || 0;
      return sum + Math.max(q, 0);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate items
    if (items.length === 0) {
      setErrorMessage('Please add at least one item to inward.');
      return;
    }

    const seenProducts = new Set<string>();
    const preparedItems: Array<{ productId: string; quantity: number }> = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) {
        setErrorMessage(`Please select a product for line #${i + 1}.`);
        return;
      }
      const qtyNum = parseInt(it.quantity);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setErrorMessage(`Quantity for line #${i + 1} must be greater than zero.`);
        return;
      }

      if (seenProducts.has(it.productId)) {
        const prod = activeProducts.find((p) => p.id === it.productId);
        setErrorMessage(
          `Product "${prod?.name || it.productId}" is selected multiple times. Please combine quantities into a single row.`
        );
        return;
      }
      seenProducts.add(it.productId);
      preparedItems.push({ productId: it.productId, quantity: qtyNum });
    }

    try {
      setIsSubmitting(true);
      const res = await api.recordStockIn({
        items: preparedItems,
        supplier: supplier.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
      });

      const totalReceivedUnits = calculateTotalQuantity();

      // Prepare consignment data for export
      const txList = res.transactions || (res.transaction ? [res.transaction] : []);
      const prodMap = new Map<string, Product>(products.map((p) => [p.id, p]));

      const exportable: ExportableConsignment = {
        referenceNumber: res.batchSummary?.referenceNumber || referenceNumber || 'GRN-RECEIPT',
        type: 'STOCK_IN',
        partyName: res.batchSummary?.supplier || supplier || 'Direct Supplier',
        partyRole: 'Supplier / Vendor',
        date: res.batchSummary?.date || (date ? new Date(date).toISOString() : new Date().toISOString()),
        notes: notes.trim() || undefined,
        items: txList.map((tx) => {
          const p = prodMap.get(tx.productId || (tx as any).product_id);
          return {
            id: tx.id,
            sku: p?.sku || tx.productSku || '',
            productName: p?.name || tx.productName || 'Item',
            categoryName: p?.categoryName || tx.categoryName || '',
            quantity: tx.quantity,
            unit: p?.unit || tx.unit || 'Units',
            previousStock: tx.previousStock ?? (tx as any).previous_stock,
            newStock: tx.newStock ?? (tx as any).new_stock,
            notes: tx.notes,
          };
        }),
      };

      // Reset form
      setSupplier('');
      setReferenceNumber('');
      setNotes('');
      setItems([
        {
          rowId: 'item-1',
          productId: activeProducts[0]?.id || '',
          quantity: '',
        },
      ]);

      onSuccess();
      setCompletionConsignment(exportable);
      setIsCompletionPromptOpen(true);

      showSuccess({
        title: 'Inward Consignment Recorded',
        message: `Successfully received +${totalReceivedUnits.toLocaleString('en-IN')} units across ${preparedItems.length} products under "${supplier.trim() || 'Direct Supplier'}".`,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record stock in consignment.');
      showError({
        title: 'Stock In Failed',
        message: err.message || 'Failed to record incoming stock receipt.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalUnits = calculateTotalQuantity();

  return (
    <>
      {/* 1. Main Multi-Item Stock In Modal */}
      {isOpen && (
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer transition-opacity"
              onClick={onClose}
              aria-hidden="true"
              title="Click background to close"
            />
            <div
              id="modal-stock-in"
              className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 z-10 transition-colors flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4.5 bg-slate-50/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shadow-xs border border-emerald-200 dark:border-emerald-800/60">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                        Stock In (Multi-Item Consignment)
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        INWARD GRN
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Receive multiple products and quantities under a single supplier &amp; invoice
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                {errorMessage && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Consignment Shared Details */}
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/70 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500/80 dark:text-emerald-400/80" />
                    Consignment &amp; Supplier Information
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Supplier */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Supplier / Vendor Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="input-stock-in-supplier"
                        type="text"
                        placeholder="e.g. Acme Supplies Ltd"
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 dark:focus:border-emerald-400/50 focus:outline-hidden font-medium"
                        required
                      />
                    </div>

                    {/* Invoice / Reference Number */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Invoice / Bill Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="input-stock-in-ref"
                        type="text"
                        placeholder="e.g. INV-2026-99"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 dark:focus:border-emerald-400/50 focus:outline-hidden font-mono"
                        required
                      />
                    </div>

                    {/* Receipt Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Receipt Date
                      </label>
                      <input
                        id="input-stock-in-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 dark:focus:border-emerald-400/50 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Remarks / Inspection Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Inspection Notes / Delivery Remarks
                    </label>
                    <input
                      id="input-stock-in-notes"
                      type="text"
                      placeholder="e.g. Delivery received in good condition, batch inspected by store manager."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 dark:focus:border-emerald-400/50 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Inward Items Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-emerald-500/80 dark:text-emerald-400/80" />
                      Inward Line Items ({items.length})
                    </span>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Product</span>
                    </button>
                  </div>

                  {/* Items List */}
                  <div className="space-y-3">
                    {items.map((item, index) => {
                      const selectedProd = activeProducts.find((p) => p.id === item.productId);
                      const currentStock = selectedProd
                        ? (selectedProd.current_stock ?? selectedProd.currentStock ?? 0)
                        : 0;
                      const itemQty = parseInt(item.quantity) || 0;
                      const projectedStock = currentStock + itemQty;

                      return (
                        <div
                          key={item.rowId}
                          className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center gap-3 group transition-all"
                        >
                          <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {index + 1}
                          </div>

                          {/* Product Selector */}
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                              Select Product
                            </label>
                            <select
                              value={item.productId}
                              onChange={(e) => handleItemProductChange(item.rowId, e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 dark:focus:border-emerald-400/50 focus:outline-hidden font-semibold"
                              required
                            >
                              <option value="">Select Item</option>
                              {activeProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  [{p.sku}] {p.name} ({p.current_stock ?? p.currentStock} {p.unit} in stock)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity Input */}
                          <div className="w-36 shrink-0">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                              Quantity {selectedProd?.unit ? `(${selectedProd.unit})` : ''}
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="e.g. 25"
                              value={item.quantity}
                              onChange={(e) => handleItemQuantityChange(item.rowId, e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 dark:focus:border-emerald-400/50 focus:outline-hidden font-mono font-bold"
                              required
                            />
                          </div>

                          {/* Projected Stock Preview */}
                          <div className="sm:w-44 text-right shrink-0">
                            {selectedProd ? (
                              <>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                  Current: <strong className="text-slate-700 dark:text-slate-300">{currentStock}</strong>
                                </span>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                                  → New: {projectedStock} {selectedProd.unit || ''}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 italic block">
                                Select item to view stock
                              </span>
                            )}
                          </div>

                          {/* Remove Item */}
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.rowId)}
                              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer self-end sm:self-center"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary Metrics Banner */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Consignment Total:
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {items.length} {items.length === 1 ? 'Product' : 'Products'}
                    </span>
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm">
                      +{totalUnits.toLocaleString('en-IN')} Total Units Inwarded
                    </span>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-stock-in"
                    type="submit"
                    disabled={isSubmitting || totalUnits <= 0}
                    className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? 'Recording Inward...' : `Confirm Stock In (+${totalUnits} Units)`}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      )}

      {/* 2. Direct Export Prompt Modal upon completion */}
      <TransactionCompletionPromptModal
        isOpen={isCompletionPromptOpen}
        onClose={() => {
          setIsCompletionPromptOpen(false);
          setCompletionConsignment(null);
          onClose();
        }}
        consignment={completionConsignment}
        onViewInLedger={onViewInLedger}
      />
    </>
  );
};
