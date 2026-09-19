import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Package,
  Calendar,
  UserCheck,
  FileText,
  Boxes,
  Truck,
} from 'lucide-react';
import { Product } from '../../types';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';
import { TransactionCompletionPromptModal } from '../transactions/TransactionCompletionPromptModal';
import { ExportableConsignment } from '../../lib/transactionExport';

interface StockOutLineItem {
  rowId: string;
  productId: string;
  quantity: string;
}

interface StockOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  initialProductId?: string;
  onViewInLedger?: () => void;
}

const STOCK_OUT_REASONS = [
  'Customer Order',
  'Project Site Dispatch',
  'Internal Department Use',
  'Production / Assembly Consumable',
  'Sample / Client Demo',
  'Damaged / Scrap Write-off',
  'Inter-Branch Transfer',
  'Other',
];

export const StockOutModal: React.FC<StockOutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  products,
  initialProductId,
  onViewInLedger,
}) => {
  const { showSuccess, showError } = useDialog();

  const activeProducts = products.filter((p) => p.is_active || (p as any).isActive !== false);

  const [recipient, setRecipient] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [reason, setReason] = useState<string>('Customer Order');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [items, setItems] = useState<StockOutLineItem[]>([
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

  // Reset form whenever modal opens or initialProductId changes
  useEffect(() => {
    if (isOpen) {
      setRecipient('');
      setReferenceNumber('');
      setReason('Customer Order');
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

  // Calculate total quantities per product across all rows to check combined stock availability
  const productQuantitiesMap: Record<string, number> = {};
  for (const it of items) {
    if (it.productId) {
      const q = parseInt(it.quantity) || 0;
      productQuantitiesMap[it.productId] = (productQuantitiesMap[it.productId] || 0) + Math.max(q, 0);
    }
  }

  const hasAnyInsufficientStock = items.some((it) => {
    if (!it.productId) return false;
    const prod = activeProducts.find((p) => p.id === it.productId);
    if (!prod) return false;
    const currentStock = prod.current_stock ?? prod.currentStock ?? 0;
    const totalRequested = productQuantitiesMap[it.productId] || 0;
    return totalRequested > currentStock;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic Validations
    if (items.length === 0) {
      setErrorMessage('Please add at least one line item to dispatch.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) {
        setErrorMessage(`Please select an item for line #${i + 1}.`);
        return;
      }
      const qty = parseInt(it.quantity) || 0;
      if (qty <= 0) {
        setErrorMessage(`Please enter a valid dispatch quantity (> 0) for line #${i + 1}.`);
        return;
      }
    }

    // Check inventory availability
    for (const [productId, totalReq] of Object.entries(productQuantitiesMap)) {
      const prod = activeProducts.find((p) => p.id === productId);
      const currentStock = prod ? (prod.current_stock ?? prod.currentStock ?? 0) : 0;
      if (totalReq > currentStock) {
        setErrorMessage(
          `Insufficient stock for "${prod?.name || 'Product'}". Total requested across lines is ${totalReq} ${prod?.unit || 'units'}, but only ${currentStock} ${prod?.unit || 'units'} are available.`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const preparedItems = items.map((it) => ({
        productId: it.productId,
        quantity: parseInt(it.quantity),
      }));

      const res = await api.recordStockOut({
        items: preparedItems,
        recipient: recipient.trim() || undefined,
        reason: reason,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
      });

      const totalDispatched = calculateTotalQuantity();
      showSuccess({
        title: 'Stock Dispatched',
        message: `Successfully dispatched ${totalDispatched} units across ${items.length} items.`,
      });

      // Prepare consignment payload for instant export prompt modal
      const txList = res.transactions || (res.transaction ? [res.transaction] : []);
      const prodMap = new Map<string, Product>(products.map((p) => [p.id, p]));

      const finalConsignment: ExportableConsignment = {
        referenceNumber: res.batchSummary?.referenceNumber || referenceNumber.trim() || `DC-${Date.now().toString().slice(-6)}`,
        type: 'STOCK_OUT',
        partyName: res.batchSummary?.recipient || recipient.trim() || 'Direct Dispatch / Customer',
        partyRole: 'Recipient / Customer',
        date: res.batchSummary?.date || (date ? new Date(date).toISOString() : new Date().toISOString()),
        notes: notes.trim() || `Reason: ${reason}`,
        items: txList.length > 0 ? txList.map((tx: any, idx: number) => {
          const p = prodMap.get(tx.productId || tx.product_id);
          return {
            id: tx.id || `out-${idx}`,
            sku: p?.sku || tx.productSku || tx.sku || '',
            productName: p?.name || tx.productName || tx.product_name || 'Item',
            categoryName: p?.categoryName || tx.categoryName || '',
            quantity: Math.abs(tx.quantity),
            unit: p?.unit || tx.unit || 'units',
            previousStock: tx.previousStock ?? tx.previous_stock,
            newStock: tx.newStock ?? tx.new_stock,
            reason: reason,
            notes: tx.notes,
          };
        }) : preparedItems.map((it, idx) => {
          const p = activeProducts.find((prod) => prod.id === it.productId);
          return {
            id: `item-${idx}`,
            sku: p?.sku || '',
            productName: p?.name || 'Item',
            categoryName: p?.categoryName || '',
            quantity: it.quantity,
            unit: p?.unit || 'units',
            reason: reason,
          };
        }),
      };

      setCompletionConsignment(finalConsignment);
      setIsCompletionPromptOpen(true);

      onSuccess();
    } catch (err: any) {
      console.error('Failed to record stock out:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to record stock out.';
      setErrorMessage(msg);
      showError({
        title: 'Stock Out Error',
        message: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAll = () => {
    setIsCompletionPromptOpen(false);
    setCompletionConsignment(null);
    onClose();
  };

  const totalQuantity = calculateTotalQuantity();

  return (
    <>
      {/* 1-Click Export Prompt Modal on Completion */}
      <TransactionCompletionPromptModal
        isOpen={isCompletionPromptOpen}
        onClose={handleCloseAll}
        consignment={completionConsignment}
        onViewInLedger={onViewInLedger}
      />

      {/* Main Stock Out Consignment Modal */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-2xs">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Stock Out (Multi-Item Consignment)
                      </h2>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        OUTWARD DC
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Dispatch multiple products and quantities under a single recipient, customer, or sales order
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {errorMessage && (
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-xs font-semibold">{errorMessage}</div>
                  </div>
                )}

                {/* Dispatch & Consignee Information */}
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/70 space-y-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-500/80 dark:text-amber-400/80" />
                    Dispatch & Recipient Information
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Recipient Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Recipient / Customer Name
                      </label>
                      <input
                        id="input-stock-out-recipient"
                        type="text"
                        placeholder="e.g. Metro Builders / John"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:outline-hidden"
                      />
                    </div>

                    {/* Dispatch Ref / Order # */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dispatch Ref / Order #
                      </label>
                      <input
                        id="input-stock-out-ref"
                        type="text"
                        placeholder="e.g. ORD-2026-99 or DC-101"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:outline-hidden font-mono"
                      />
                    </div>

                    {/* Dispatch Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dispatch Date
                      </label>
                      <input
                        id="input-stock-out-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:outline-hidden"
                      />
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dispatch Reason
                      </label>
                      <select
                        id="input-stock-out-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:outline-hidden"
                      >
                        {STOCK_OUT_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Remarks / Delivery Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Dispatch Notes / Delivery Remarks
                    </label>
                    <input
                      id="input-stock-out-notes"
                      type="text"
                      placeholder="e.g. Dispatched via Express Logistics, driver contact: 98765-XXXXX."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Outward Items Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-amber-500/80 dark:text-amber-400/80" />
                      Outward Line Items ({items.length})
                    </span>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
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
                      const totalReqForProd = item.productId ? (productQuantitiesMap[item.productId] || 0) : 0;
                      const isItemOverStock = item.productId ? (totalReqForProd > currentStock) : false;
                      const remainingStock = currentStock - itemQty;

                      return (
                        <div
                          key={item.rowId}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center gap-3 group ${
                            isItemOverStock
                              ? 'border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                          }`}
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
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:outline-hidden font-semibold"
                              required
                            >
                              <option value="">Select Item</option>
                              {activeProducts.map((p) => {
                                const pStock = p.current_stock ?? p.currentStock ?? 0;
                                return (
                                  <option key={p.id} value={p.id} disabled={pStock <= 0}>
                                    [{p.sku}] {p.name} ({pStock} {p.unit} in stock) {pStock <= 0 ? '— Out of Stock' : ''}
                                  </option>
                                );
                              })}
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
                              max={selectedProd ? (selectedProd.current_stock ?? selectedProd.currentStock ?? 1) : undefined}
                              step="1"
                              placeholder="e.g. 10"
                              value={item.quantity}
                              onChange={(e) => handleItemQuantityChange(item.rowId, e.target.value)}
                              className={`w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:outline-hidden font-mono font-bold ${
                                isItemOverStock
                                  ? 'border-rose-400 focus:ring-rose-500 text-rose-600 dark:text-rose-400'
                                  : 'border-slate-200 dark:border-slate-700 focus:ring-amber-500/20 focus:border-amber-500/50 dark:focus:border-amber-400/50'
                              }`}
                              required
                            />
                          </div>

                          {/* Remaining Stock Preview */}
                          <div className="sm:w-44 text-right shrink-0">
                            {selectedProd ? (
                              <>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                  Current: <strong className="text-slate-700 dark:text-slate-300">{currentStock}</strong> {selectedProd.unit}
                                </span>
                                {isItemOverStock ? (
                                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Exceeds stock!</span>
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    → Remaining:{' '}
                                    <span className={remainingStock < (selectedProd.min_stock_level ?? 5) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}>
                                      {Math.max(remainingStock, 0)} {selectedProd.unit}
                                    </span>
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Select an item</span>
                            )}
                          </div>

                          {/* Delete Item Button */}
                          <div className="flex justify-end sm:block shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.rowId)}
                              disabled={items.length <= 1}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                              title={items.length <= 1 ? 'At least one item is required' : 'Remove item'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Consignment Dispatched Summary Banner */}
                <div className="p-4 rounded-2xl bg-amber-500/[0.04] dark:bg-amber-500/[0.08] border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Consignment Outward Total:</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      <strong className="text-slate-900 dark:text-white font-mono">{items.length}</strong>{' '}
                      {items.length === 1 ? 'Product' : 'Products'}
                    </span>
                    <span className="text-amber-700 dark:text-amber-300 font-mono font-black text-sm">
                      -{totalQuantity.toLocaleString('en-IN')} Total Units Dispatched
                    </span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || totalQuantity <= 0 || hasAnyInsufficientStock}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-amber-900/20 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing Dispatch...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          Confirm Stock Out (-{totalQuantity} {totalQuantity === 1 ? 'Unit' : 'Units'})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
