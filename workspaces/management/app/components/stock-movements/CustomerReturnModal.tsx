'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  UserCheck,
  FileText,
  Boxes,
  ShieldCheck,
  AlertTriangle,
  Archive,
} from 'lucide-react';
import { Product } from '../../types';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';
import { TransactionCompletionPromptModal } from '../transactions/TransactionCompletionPromptModal';
import { ExportableConsignment } from '../../lib/transactionExport';

interface ReturnLineItem {
  rowId: string;
  productId: string;
  quantity: string;
  condition: string;
}

interface CustomerReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  initialProductId?: string;
  onViewInLedger?: () => void;
}

const RETURN_REASONS_GOOD = [
  'Customer Cancellation / Change of Mind',
  'Excess / Over-Ordered Quantity',
  'Wrong Item Delivered',
  'Exchange / Resalable Return',
  'Other',
];

const RETURN_REASONS_DEFECTIVE = [
  'Defective / Damaged Goods',
  'Transit / Packaging Damage',
  'Quality Reject / Specification Mismatch',
  'Missing Parts / Accessories',
  'Other',
];

export const GOOD_ITEM_CONDITIONS = [
  'Unopened / Brand New',
  'Box Opened / Intact',
];

export const DEFECTIVE_ITEM_CONDITIONS = [
  'Damaged / Defective',
  'Missing Parts / Accessories',
  'Transit / Packaging Damaged',
  'Quality Reject / Broken',
];

export const CustomerReturnModal: React.FC<CustomerReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  products,
  initialProductId,
  onViewInLedger,
}) => {
  const { showSuccess, showError } = useDialog();

  const activeProducts = products.filter((p) => p.is_active || (p as any).isActive !== false);

  const [customer, setCustomer] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [reason, setReason] = useState<string>('Customer Cancellation / Change of Mind');
  const [restockAction, setRestockAction] = useState<'RESTOCK_TO_INVENTORY' | 'QUARANTINE_DAMAGED'>('RESTOCK_TO_INVENTORY');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [items, setItems] = useState<ReturnLineItem[]>([
    {
      rowId: 'item-1',
      productId: initialProductId || '',
      quantity: '',
      condition: GOOD_ITEM_CONDITIONS[0],
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State for immediate export prompt upon completion
  const [completionConsignment, setCompletionConsignment] = useState<ExportableConsignment | null>(null);
  const [isCompletionPromptOpen, setIsCompletionPromptOpen] = useState<boolean>(false);

  // Reset form when modal opens or initialProductId changes
  useEffect(() => {
    if (isOpen) {
      setCustomer('');
      setReferenceNumber('');
      setReason('Customer Cancellation / Change of Mind');
      setRestockAction('RESTOCK_TO_INVENTORY');
      setNotes('');
      setDate(new Date().toISOString().slice(0, 10));
      setItems([
        {
          rowId: 'item-1',
          productId: initialProductId || '',
          quantity: '',
          condition: GOOD_ITEM_CONDITIONS[0],
        },
      ]);
      setErrorMessage(null);
    }
  }, [isOpen, initialProductId]);

  if (!isOpen && !isCompletionPromptOpen) return null;

  const handleRestockActionChange = (action: 'RESTOCK_TO_INVENTORY' | 'QUARANTINE_DAMAGED') => {
    setRestockAction(action);
    const isGood = action === 'RESTOCK_TO_INVENTORY';
    const defaultCondition = isGood ? GOOD_ITEM_CONDITIONS[0] : DEFECTIVE_ITEM_CONDITIONS[0];

    // Automatically align existing item conditions to the selected disposition
    setItems((prev) =>
      prev.map((it) => {
        const itIsGood = GOOD_ITEM_CONDITIONS.includes(it.condition);
        if (isGood && !itIsGood) {
          return { ...it, condition: defaultCondition };
        }
        if (!isGood && itIsGood) {
          return { ...it, condition: defaultCondition };
        }
        return it;
      })
    );

    // Auto-align reason if it is currently conflicting
    if (
      isGood &&
      (reason === 'Defective / Damaged Goods' ||
        reason === 'Transit / Packaging Damage' ||
        reason === 'Quality Reject / Specification Mismatch')
    ) {
      setReason('Customer Cancellation / Change of Mind');
    } else if (
      !isGood &&
      (reason === 'Customer Cancellation / Change of Mind' ||
        reason === 'Excess / Over-Ordered Quantity' ||
        reason === 'Wrong Item Delivered')
    ) {
      setReason('Defective / Damaged Goods');
    }
  };

  const handleReasonChange = (newReason: string) => {
    setReason(newReason);
    // If user picks a defective reason while in restock to inventory, auto-toggle to quarantine
    if (RETURN_REASONS_DEFECTIVE.includes(newReason) && newReason !== 'Other') {
      if (restockAction !== 'QUARANTINE_DAMAGED') {
        handleRestockActionChange('QUARANTINE_DAMAGED');
      }
    } else if (RETURN_REASONS_GOOD.includes(newReason) && newReason !== 'Other') {
      if (restockAction !== 'RESTOCK_TO_INVENTORY') {
        handleRestockActionChange('RESTOCK_TO_INVENTORY');
      }
    }
  };

  const handleAddItem = () => {
    const defaultCondition =
      restockAction === 'RESTOCK_TO_INVENTORY'
        ? GOOD_ITEM_CONDITIONS[0]
        : DEFECTIVE_ITEM_CONDITIONS[0];

    setItems((prev) => [
      ...prev,
      {
        rowId: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId: '',
        quantity: '',
        condition: defaultCondition,
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

  const handleItemConditionChange = (rowId: string, newCondition: string) => {
    setItems((prev) =>
      prev.map((it) => (it.rowId === rowId ? { ...it, condition: newCondition } : it))
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

    if (items.length === 0) {
      setErrorMessage('Please add at least one line item to record a customer return.');
      return;
    }

    const seenProducts = new Set<string>();
    const preparedItems: Array<{ productId: string; quantity: number; condition: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) {
        setErrorMessage(`Please select an item for line #${i + 1}.`);
        return;
      }
      const qtyNum = parseInt(it.quantity) || 0;
      if (qtyNum <= 0) {
        setErrorMessage(`Please enter a valid return quantity (> 0) for line #${i + 1}.`);
        return;
      }

      // Check condition compatibility with warehouse disposition
      if (restockAction === 'RESTOCK_TO_INVENTORY') {
        if (
          DEFECTIVE_ITEM_CONDITIONS.includes(it.condition) ||
          /defect|damag|broken|scrap|missing/i.test(it.condition)
        ) {
          setErrorMessage(
            `Line #${i + 1} has condition "${it.condition}", but disposition is set to Restock Available Inventory. Good condition items only.`
          );
          return;
        }
      } else {
        if (
          GOOD_ITEM_CONDITIONS.includes(it.condition) ||
          /unopened|brand new|intact/i.test(it.condition)
        ) {
          setErrorMessage(
            `Line #${i + 1} has condition "${it.condition}", but disposition is set to Quarantine / Defective Hold. Defective/damaged items only.`
          );
          return;
        }
      }

      if (seenProducts.has(it.productId)) {
        const prod = activeProducts.find((p) => p.id === it.productId);
        setErrorMessage(
          `Product "${prod?.name || it.productId}" is selected multiple times. Please combine quantities into a single row.`
        );
        return;
      }
      seenProducts.add(it.productId);
      preparedItems.push({ productId: it.productId, quantity: qtyNum, condition: it.condition });
    }

    try {
      setIsSubmitting(true);
      const res = await api.recordCustomerReturn({
        items: preparedItems,
        customer: customer.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        reason: reason,
        restockAction: restockAction,
        notes: notes.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
      });

      const totalReturnedUnits = calculateTotalQuantity();

      // Prepare consignment data for export
      const txList = res.transactions || (res.transaction ? [res.transaction] : []);
      const prodMap = new Map<string, Product>(products.map((p) => [p.id, p]));

      const exportable: ExportableConsignment = {
        referenceNumber: res.batchSummary?.referenceNumber || referenceNumber || 'RET-MEMO',
        type: 'CUSTOMER_RETURN',
        partyName: res.batchSummary?.customer || customer || 'Direct Customer',
        partyRole: 'Customer / Client',
        date: res.batchSummary?.date || (date ? new Date(date).toISOString() : new Date().toISOString()),
        notes: `Reason: ${reason}. Action: ${restockAction === 'RESTOCK_TO_INVENTORY' ? 'Restocked to Inventory' : 'Quarantined Hold'}. ${notes.trim()}`.trim(),
        items: txList.map((tx: any, idx: number) => {
          const p = prodMap.get(tx.productId || tx.product_id);
          return {
            id: tx.id || `ret-${idx}`,
            sku: p?.sku || tx.productSku || tx.sku || '',
            productName: p?.name || tx.productName || tx.product_name || 'Item',
            categoryName: p?.categoryName || tx.categoryName || '',
            quantity: tx.quantity,
            unit: p?.unit || tx.unit || 'Units',
            previousStock: tx.previousStock ?? tx.previous_stock,
            newStock: tx.newStock ?? tx.new_stock,
            reason: reason,
            notes: tx.notes,
          };
        }),
      };

      onSuccess();
      setCompletionConsignment(exportable);
      setIsCompletionPromptOpen(true);

      showSuccess({
        title: 'Customer Return Recorded',
        message: `Successfully recorded return of ${totalReturnedUnits.toLocaleString('en-IN')} units across ${preparedItems.length} items from "${customer.trim() || 'Direct Customer'}".`,
      });
    } catch (err: any) {
      console.error('Failed to record customer return:', err);
      const msg = err.message || 'Failed to record customer return.';
      setErrorMessage(msg);
      showError({
        title: 'Return Failed',
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

  const totalUnits = calculateTotalQuantity();

  return (
    <>
      {/* 1-Click Export Prompt on Completion */}
      <TransactionCompletionPromptModal
        isOpen={isCompletionPromptOpen}
        onClose={handleCloseAll}
        consignment={completionConsignment}
        onViewInLedger={onViewInLedger}
      />

      {/* Main Customer Return Modal */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer transition-opacity"
              onClick={onClose}
              aria-hidden="true"
              title="Click background to close"
            />
            <div
              id="modal-customer-return"
              className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 z-10 transition-colors flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4.5 bg-slate-50/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center shadow-2xs border border-purple-500/20">
                    <RotateCcw className="w-5 h-5 -rotate-45" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-tight">
                        Customer Return Memo (Sales Return)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                        INWARD RETURN
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Record items returned by clients with inventory restock or quarantine disposition
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Close modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                {errorMessage && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Customer & Return Reference Information */}
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/70 space-y-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-purple-500/80" />
                    Customer & Return Memo Details
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Customer Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Customer / Client Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="input-return-customer"
                        type="text"
                        placeholder="e.g. Sharma Sanitary Mart"
                        value={customer}
                        onChange={(e) => setCustomer(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 dark:focus:border-purple-400/50 focus:outline-hidden"
                        required
                      />
                    </div>

                    {/* Return Memo / Ref # */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Return Memo / Inv # <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="input-return-ref"
                        type="text"
                        placeholder="e.g. RET-2026-01 or INV-9844"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 dark:focus:border-purple-400/50 focus:outline-hidden font-mono"
                        required
                      />
                    </div>

                    {/* Receipt Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Return Date
                      </label>
                      <input
                        id="input-return-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 dark:focus:border-purple-400/50 focus:outline-hidden"
                      />
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Return Reason
                      </label>
                      <select
                        id="input-return-reason"
                        value={reason}
                        onChange={(e) => handleReasonChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 dark:focus:border-purple-400/50 focus:outline-hidden"
                      >
                        <optgroup label="Good Condition / Resalable">
                          {RETURN_REASONS_GOOD.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Defective / Damaged Hold">
                          {RETURN_REASONS_DEFECTIVE.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Restock Disposition Segmented Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Warehouse Disposition Action:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          restockAction === 'RESTOCK_TO_INVENTORY'
                            ? 'border-purple-500/40 dark:border-purple-500/30 bg-purple-500/[0.04] dark:bg-purple-500/[0.08] text-slate-900 dark:text-slate-100 shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restockAction"
                          value="RESTOCK_TO_INVENTORY"
                          checked={restockAction === 'RESTOCK_TO_INVENTORY'}
                          onChange={() => handleRestockActionChange('RESTOCK_TO_INVENTORY')}
                          className="mt-0.5 text-purple-600 focus:ring-purple-500/30"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Restock to Available Inventory</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Goods in salable condition; physical stock count will immediately increase. (Allows only good condition items)
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          restockAction === 'QUARANTINE_DAMAGED'
                            ? 'border-amber-500/40 dark:border-amber-600/40 bg-amber-500/[0.04] dark:bg-amber-950/20 text-slate-900 dark:text-slate-100 shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restockAction"
                          value="QUARANTINE_DAMAGED"
                          checked={restockAction === 'QUARANTINE_DAMAGED'}
                          onChange={() => handleRestockActionChange('QUARANTINE_DAMAGED')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500/40"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Archive className="w-3.5 h-3.5 text-amber-600/90 dark:text-amber-400/90" />
                            <span>Quarantine / Defective Hold</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Damaged or scrap; audit trail is preserved but salable inventory is not increased. (Allows only defective/damaged items)
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Return Notes / Remarks */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Inspection Notes / Return Remarks
                    </label>
                    <input
                      id="input-return-notes"
                      type="text"
                      placeholder="e.g. Inspected by warehouse manager, items in original packaging."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 dark:focus:border-purple-400/50 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Returned Line Items Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-purple-500/80" />
                      Returned Line Items ({items.length})
                    </span>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
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
                      const availableConditions =
                        restockAction === 'RESTOCK_TO_INVENTORY'
                          ? GOOD_ITEM_CONDITIONS
                          : DEFECTIVE_ITEM_CONDITIONS;

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
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 dark:focus:border-purple-400/50 focus:outline-hidden font-semibold"
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
                          <div className="w-28 shrink-0">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                              Return Qty
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="e.g. 5"
                              value={item.quantity}
                              onChange={(e) => handleItemQuantityChange(item.rowId, e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 dark:focus:border-purple-400/50 focus:outline-hidden font-mono font-bold"
                              required
                            />
                          </div>

                          {/* Item Condition */}
                          <div className="w-44 shrink-0">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Item Condition
                              </label>
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                                  restockAction === 'RESTOCK_TO_INVENTORY'
                                    ? 'text-cyan-700 dark:text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/40'
                                    : 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20'
                                }`}
                              >
                                {restockAction === 'RESTOCK_TO_INVENTORY' ? 'Good' : 'Defective'}
                              </span>
                            </div>
                            <select
                              value={item.condition}
                              onChange={(e) => handleItemConditionChange(item.rowId, e.target.value)}
                              className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 dark:focus:border-purple-400/50 focus:outline-hidden font-medium"
                            >
                              {availableConditions.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Projected Stock Preview */}
                          <div className="sm:w-36 text-right shrink-0">
                            {selectedProd ? (
                              <>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                  Current: <strong className="text-slate-700 dark:text-slate-300">{currentStock}</strong>
                                </span>
                                {restockAction === 'RESTOCK_TO_INVENTORY' ? (
                                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                    → New: {projectedStock} {selectedProd.unit}
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-amber-600/90 dark:text-amber-400/90">
                                    (Quarantine Hold)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Select item</span>
                            )}
                          </div>

                          {/* Remove Row Button */}
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

                {/* Consignment Return Summary Banner */}
                <div className="p-4 rounded-2xl bg-purple-500/[0.04] dark:bg-purple-500/[0.08] border border-purple-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Consignment Return Total:</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      <strong className="text-slate-900 dark:text-white font-mono">{items.length}</strong>{' '}
                      {items.length === 1 ? 'Product' : 'Products'}
                    </span>
                    <span className="text-purple-700 dark:text-purple-300 font-mono font-black text-sm">
                      +{totalUnits.toLocaleString('en-IN')} Total Units Returned
                    </span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || totalUnits <= 0}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-purple-900/20 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Recording Return...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          Confirm Customer Return (+{totalUnits} {totalUnits === 1 ? 'Unit' : 'Units'})
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
