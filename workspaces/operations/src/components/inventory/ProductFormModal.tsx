import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, PackagePlus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  editingProduct?: Product | null;
}

const COMMON_UNITS = [
  'Pieces',
  'Boxes',
  'Packs',
  'Meters',
  'Kg',
  'Grams',
  'Litres',
  'Rolls',
  'Sets',
  'Pairs',
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
  editingProduct,
}) => {
  const { showSuccess, showError } = useDialog();
  const isEdit = !!editingProduct;

  const [sku, setSku] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [unit, setUnit] = useState<string>('Pieces');
  const [initialStock, setInitialStock] = useState<string>('0');
  const [minimumStock, setMinimumStock] = useState<string>('15');
  const [criticalStock, setCriticalStock] = useState<string>('5');
  const [unitCost, setUnitCost] = useState<string>('0');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (editingProduct) {
      setSku(editingProduct.sku || '');
      setName(editingProduct.name || '');
      setCategoryId(editingProduct.categoryId || (editingProduct as any).category_id || '');
      setDescription(editingProduct.description || '');
      setUnit(editingProduct.unit || 'Pieces');
      setMinimumStock((editingProduct.minimumStock ?? (editingProduct as any).minimum_stock ?? 15).toString());
      setCriticalStock((editingProduct.criticalStock ?? (editingProduct as any).critical_stock ?? 5).toString());
      setUnitCost((editingProduct.unitCost ?? (editingProduct as any).unit_cost ?? 0).toString());
    } else {
      setSku('');
      setName('');
      setCategoryId(categories[0]?.id || '');
      setDescription('');
      setUnit('Pieces');
      setInitialStock('0');
      setMinimumStock('15');
      setCriticalStock('5');
      setUnitCost('0');
    }
    setErrorMessage(null);
  }, [editingProduct, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!sku.trim() || !name.trim() || !categoryId || !unit.trim()) {
      setErrorMessage('SKU, Product Name, Category, and Unit of Measurement are required.');
      return;
    }

    const targetName = name.trim();
    const targetSku = (isEdit ? editingProduct?.sku : sku.trim()).toUpperCase();

    try {
      setIsSubmitting(true);

      if (isEdit && editingProduct) {
        await api.updateProduct(editingProduct.id, {
          name: targetName,
          categoryId,
          description: description.trim(),
          unit: unit.trim(),
          minimumStock: parseInt(minimumStock) || 0,
          criticalStock: parseInt(criticalStock) || 0,
          unitCost: parseFloat(unitCost) || 0,
        });
      } else {
        await api.createProduct({
          sku: targetSku,
          name: targetName,
          categoryId,
          description: description.trim(),
          unit: unit.trim(),
          initialStock: parseInt(initialStock) || 0,
          minimumStock: parseInt(minimumStock) || 15,
          criticalStock: parseInt(criticalStock) || 5,
          unitCost: parseFloat(unitCost) || 0,
        });
      }

      onSuccess();
      onClose();

      showSuccess({
        title: isEdit ? 'Product Updated' : 'New Product Created',
        message: isEdit
          ? `Product "${targetName}" (${targetSku}) details have been successfully updated.`
          : `Product "${targetName}" (${targetSku}) has been created and added to the inventory catalog.`,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save product');
      showError({
        title: isEdit ? 'Product Update Failed' : 'Product Creation Failed',
        message: err.message || 'Failed to save product details.',
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
        id="modal-product-form"
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 z-10 transition-colors"
      >
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center shadow-2xs">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                  {isEdit ? 'Edit Product Details' : 'Add New Inventory Product'}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                  {isEdit ? 'EDIT' : 'NEW SKU'}
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {isEdit ? 'Update SKU information and threshold parameters' : 'Register product master into catalog'}
              </p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SKU and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                SKU / Product Code <span className="text-red-500">*</span>
              </label>
              <input
                id="input-product-sku"
                type="text"
                disabled={isEdit}
                placeholder="e.g. BF-AV-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-400/50 focus:outline-hidden font-mono uppercase disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500"
                required
              />
              {isEdit && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">SKU identifier cannot be modified once registered.</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category (Tally Stock Group) <span className="text-red-500">*</span>
              </label>
              <select
                id="input-product-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-400/50 focus:outline-hidden"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Product Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="input-product-name"
              type="text"
              placeholder="e.g. Angle Valve 1/2 inch Brass Chrome Heavy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-400/50 focus:outline-hidden"
              required
            />
          </div>

          {/* Unit & Unit Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Base Unit of Measurement <span className="text-red-500">*</span>
              </label>
              <select
                id="input-product-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-400/50 focus:outline-hidden"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unit Cost Valuation (₹)
              </label>
              <input
                id="input-product-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 350.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-400/50 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Stock Thresholds and Initial Stock */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Inventory Thresholds & Opening Stock</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {!isEdit && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Initial Stock
                  </label>
                  <input
                    id="input-product-initial-stock"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-400/50 font-mono"
                  />
                </div>
              )}

              <div className={isEdit ? 'col-span-1' : ''}>
                <label className="block text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  Minimum Stock (Low)
                </label>
                <input
                  id="input-product-min-stock"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="15"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/60 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 dark:focus:border-amber-400/50 font-mono"
                />
              </div>

              <div className={isEdit ? 'col-span-1' : ''}>
                <label className="block text-[11px] font-semibold text-red-700 dark:text-red-400 mb-1">
                  Critical Level
                </label>
                <input
                  id="input-product-crit-stock"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="5"
                  value={criticalStock}
                  onChange={(e) => setCriticalStock(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700/60 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 dark:focus:border-red-400/50 font-mono"
                />
              </div>

              {isEdit && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Current Balance
                  </label>
                  <div className="px-2.5 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono font-bold text-slate-800 dark:text-slate-200">
                    {editingProduct.current_stock ?? (editingProduct as any).currentStock} {editingProduct.unit}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Specifications
            </label>
            <textarea
              id="input-product-desc"
              rows={2}
              placeholder="e.g. Chrome finish, ASTM specification compliance, wall flange included"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-400/50 focus:outline-hidden"
            />
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
              id="btn-submit-product-form"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl transition-all shadow-sm shadow-indigo-900/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
