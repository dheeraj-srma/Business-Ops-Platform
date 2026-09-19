import React, { useState, useEffect } from 'react';
import {
  X,
  Ticket,
  Sparkles,
  Building2,
  Tag,
  Layers,
  IndianRupee,
  Hash,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Coupon, Product, Category, COUPON_CATALOG, COUPON_PRICE_MAP, CustomCouponOption, getCustomCoupons } from '../../types';
import { api } from '../../lib/api';

interface CouponFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCoupon?: Coupon | null;
  products: Product[];
  categories: Category[];
}

const COMMON_BRANDS = ['Nalka Metal', 'Apex Precision', 'Jaquar Allied', 'Hindware', 'Parryware', 'Cera'];

export const CouponFormModal: React.FC<CouponFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingCoupon,
  products,
  categories,
}) => {
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [brandName, setBrandName] = useState('Nalka Metal');
  const [seriesName, setSeriesName] = useState('BL09');
  const [couponAmount, setCouponAmount] = useState<number | ''>(5);
  const [couponsUsed, setCouponsUsed] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available coupon chips/labels loaded from catalog and custom additions
  const [availableCoupons, setAvailableCoupons] = useState<CustomCouponOption[]>(getCustomCoupons);

  // Sync state when modal opens or editingCoupon changes
  useEffect(() => {
    const currentCoupons = getCustomCoupons();
    if (editingCoupon) {
      setProductName(editingCoupon.product_name);
      setCategory(editingCoupon.category);
      setBrandName(editingCoupon.brand_name);
      setSeriesName(editingCoupon.series_name);
      setCouponAmount(editingCoupon.coupon_amount);
      setCouponsUsed(editingCoupon.coupons_used);
      setNotes(editingCoupon.notes || '');

      // Ensure editing coupon name is present in availableCoupons
      const existingName = editingCoupon.series_name.toUpperCase();
      if (!currentCoupons.some((c) => c.name.toUpperCase() === existingName)) {
        currentCoupons.push({ name: editingCoupon.series_name, price: editingCoupon.coupon_amount });
      }
      setAvailableCoupons(currentCoupons);
    } else {
      setProductName('');
      setCategory(categories[0]?.name || 'Taps, Cocks & Mixers');
      setBrandName('Nalka Metal');
      setSeriesName('BL09');
      setCouponAmount(COUPON_PRICE_MAP['BL09'] || 5);
      setCouponsUsed('');
      setNotes('');
      setAvailableCoupons(currentCoupons);
    }
    setErrorMessage(null);
  }, [editingCoupon, isOpen, categories]);

  if (!isOpen) return null;

  const handleCouponSelect = (selectedName: string, price?: number) => {
    setSeriesName(selectedName);
    if (price !== undefined) {
      setCouponAmount(price);
    } else if (COUPON_PRICE_MAP[selectedName.toUpperCase()] !== undefined) {
      setCouponAmount(COUPON_PRICE_MAP[selectedName.toUpperCase()]);
    } else {
      const match = availableCoupons.find((c) => c.name.toUpperCase() === selectedName.toUpperCase());
      if (match) setCouponAmount(match.price);
    }
  };

  const handleProductSelect = (selectedName: string) => {
    setProductName(selectedName);
    const matched = products.find((p) => p.name.toLowerCase() === selectedName.toLowerCase());
    if (matched && matched.categoryName) {
      setCategory(matched.categoryName);
    }
  };

  const calculatedTotal =
    typeof couponAmount === 'number' && typeof couponsUsed === 'number' && couponAmount > 0 && couponsUsed >= 0
      ? couponAmount * couponsUsed
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!productName.trim()) {
      setErrorMessage('Please enter or select a product name.');
      return;
    }
    if (!category.trim()) {
      setErrorMessage('Please specify an item category.');
      return;
    }
    if (!brandName.trim()) {
      setErrorMessage('Please enter the brand name.');
      return;
    }
    if (!seriesName.trim()) {
      setErrorMessage('Please select or specify a coupon name.');
      return;
    }
    if (couponAmount === '' || Number(couponAmount) <= 0) {
      setErrorMessage('Coupon price in rupees must be a positive number.');
      return;
    }
    if (couponsUsed === '' || Number(couponsUsed) < 0) {
      setErrorMessage('Number of coupons used must be 0 or more.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingCoupon) {
        await api.updateCoupon(editingCoupon.id, {
          product_name: productName.trim(),
          category: category.trim(),
          brand_name: brandName.trim(),
          series_name: seriesName.trim(),
          coupon_amount: Number(couponAmount),
          coupons_used: Number(couponsUsed),
          notes: notes.trim(),
        });
      } else {
        await api.createCoupon({
          product_name: productName.trim(),
          category: category.trim(),
          brand_name: brandName.trim(),
          series_name: seriesName.trim(),
          coupon_amount: Number(couponAmount),
          coupons_used: Number(couponsUsed),
          notes: notes.trim(),
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save coupon details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Ticket className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingCoupon ? 'Edit Brand Coupon' : 'Record Brand Coupon'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select coupon label and enter redemption quantity used by the brand
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <span className="font-semibold">Error:</span> {errorMessage}
            </div>
          )}

          {/* Scrollable Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* 1. Product Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Product Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="product-suggestions"
                  value={productName}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  placeholder="e.g. Brass Bib Cock 15mm Premium"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all shadow-2xs"
                  required
                />
                <datalist id="product-suggestions">
                  {products.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.sku} - {p.categoryName || 'Inventory SKU'}
                    </option>
                  ))}
                </datalist>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Select an existing inventory product or type a custom product name.
              </p>
            </div>

            {/* 2. Item Category & Brand Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Item Category <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  list="category-suggestions"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Taps, Cocks & Mixers"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all shadow-2xs"
                  required
                />
                <datalist id="category-suggestions">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  Brand Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Nalka Metal"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* Quick Brand Selector Chips */}
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 block">
                Quick Brand Suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_BRANDS.map((b) => (
                  <button
                    type="button"
                    key={b}
                    onClick={() => setBrandName(b)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                      brandName.toLowerCase() === b.toLowerCase()
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Coupon Selection (LABELS ONLY - Click label to select & auto-fetch price) */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  Coupon Name <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  Click a label to select & auto-fetch price
                </span>
              </div>

              {/* Clickable Coupon Labels */}
              <div className="flex flex-wrap gap-2">
                {availableCoupons.map((c) => {
                  const isSelected = seriesName.toUpperCase() === c.name.toUpperCase();
                  return (
                    <button
                      type="button"
                      key={c.name}
                      onClick={() => handleCouponSelect(c.name, c.price)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400 dark:ring-indigo-700 scale-105'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{c.name}</span>
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
                          isSelected
                            ? 'bg-indigo-500 text-white'
                            : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
                        }`}
                      >
                        ₹{c.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Auto-fetched Price in Rupees & Number of Coupons Used */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
                    Price in Rupees (₹) <span className="text-rose-500">*</span>
                  </label>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Auto-fetched
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={couponAmount}
                    onChange={(e) => setCouponAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Price in rupees"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all shadow-2xs"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Auto-fetched from selected coupon label ({seriesName || 'None'}).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-amber-500" />
                  Number of Coupons Used <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={couponsUsed}
                  onChange={(e) => setCouponsUsed(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 50"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden transition-all shadow-2xs"
                  required
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Quantity of coupons redeemed by brand.
                </p>
              </div>
            </div>

            {/* Real-time Computed Total Value Banner */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">
                  Total Rupee Value Disbursed
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  (Coupon {seriesName}: ₹{Number(couponAmount) || 0} × {Number(couponsUsed) || 0} used)
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{calculatedTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* 5. Notes / Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Redeemed by plumber club at regional convention or scratch coupon batch #3"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all shadow-2xs resize-none"
              />
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Ticket className="w-3.5 h-3.5" />
                {isSubmitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Save Coupon Record'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
