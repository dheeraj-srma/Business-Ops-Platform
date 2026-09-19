import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Ticket,
  Plus,
  Upload,
  Download,
  Search,
  Building2,
  Layers,
  Tag,
  IndianRupee,
  Hash,
  Filter,
  Trash2,
  Edit2,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  X,
  ArrowRight,
  BarChart3,
  PieChart,
} from 'lucide-react';
import {
  Coupon,
  CouponStats,
  Product,
  Category,
  UserRole,
  COUPON_CATALOG,
  COUPON_PRICE_MAP,
  CustomCouponOption,
  getCustomCoupons,
  saveCustomCoupon,
} from '../../types';
import { api } from '../../lib/api';
import { CouponFormModal } from './CouponFormModal';
import { CouponUploadModal } from './CouponUploadModal';

interface CouponsViewProps {
  role: UserRole;
  products: Product[];
  categories: Category[];
  onGoBack?: () => void;
}

type KpiModalType = 'coupons_used' | 'discount_disbursed' | 'brands' | 'series' | null;

export const CouponsView: React.FC<CouponsViewProps> = ({ role, products, categories }) => {
  const isManager = role === 'manager';

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // KPI Breakdown Modal state (opens detailed window when KPI cards are clicked)
  const [activeKpiModal, setActiveKpiModal] = useState<KpiModalType>(null);
  const [kpiSearchQuery, setKpiSearchQuery] = useState('');

  // Catalog coupons & Simple Add Coupon pop-up state on main panel
  const [catalogCoupons, setCatalogCoupons] = useState<CustomCouponOption[]>(getCustomCoupons);
  const [isAddCouponModalOpen, setIsAddCouponModalOpen] = useState(false);
  const [newCouponName, setNewCouponName] = useState('');
  const [newCouponPrice, setNewCouponPrice] = useState<number | ''>('');
  const [addCouponError, setAddCouponError] = useState<string | null>(null);
  const [couponAddSuccess, setCouponAddSuccess] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeries, setSelectedSeries] = useState('all');
  const [sortField, setSortField] = useState<'created_at' | 'total_value' | 'coupons_used' | 'coupon_amount'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deletingCouponId, setDeletingCouponId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch coupon data
  const loadCoupons = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getCoupons();
      setCoupons(res.coupons || []);
      setStats(res.stats || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load brand coupon records');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  // Derived unique lists for dropdown filters
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    coupons.forEach((c) => {
      if (c.brand_name) brands.add(c.brand_name);
    });
    return Array.from(brands).sort();
  }, [coupons]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    coupons.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats).sort();
  }, [coupons]);

  const uniqueSeries = useMemo(() => {
    const sers = new Set<string>();
    coupons.forEach((c) => {
      if (c.series_name) sers.add(c.series_name);
    });
    return Array.from(sers).sort();
  }, [coupons]);

  // Filtered & sorted coupons
  const filteredCoupons = useMemo(() => {
    return coupons
      .filter((c) => {
        const matchesSearch =
          !searchQuery.trim() ||
          c.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.series_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesBrand = selectedBrand === 'all' || c.brand_name.toLowerCase() === selectedBrand.toLowerCase();
        const matchesCat = selectedCategory === 'all' || c.category.toLowerCase() === selectedCategory.toLowerCase();
        const matchesSeries = selectedSeries === 'all' || c.series_name.toLowerCase() === selectedSeries.toLowerCase();

        return matchesSearch && matchesBrand && matchesCat && matchesSeries;
      })
      .sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        if (sortField === 'total_value') {
          valA = a.coupon_amount * a.coupons_used;
          valB = b.coupon_amount * b.coupons_used;
        } else if (sortField === 'coupons_used') {
          valA = a.coupons_used;
          valB = b.coupons_used;
        } else if (sortField === 'coupon_amount') {
          valA = a.coupon_amount;
          valB = b.coupon_amount;
        } else {
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [coupons, searchQuery, selectedBrand, selectedCategory, selectedSeries, sortField, sortOrder]);

  // Derived totals for KPIs
  const totalCouponsUsed = useMemo(() => {
    return stats?.totalCouponsUsed ?? coupons.reduce((acc, c) => acc + c.coupons_used, 0);
  }, [stats, coupons]);

  const totalDiscountValue = useMemo(() => {
    return stats?.totalDiscountValue ?? coupons.reduce((acc, c) => acc + c.coupon_amount * c.coupons_used, 0);
  }, [stats, coupons]);

  // Brand Breakdown computed from coupon records
  const brandBreakdownData = useMemo(() => {
    const map = new Map<string, { brand: string; count: number; totalValue: number; entriesCount: number }>();
    coupons.forEach((c) => {
      const b = c.brand_name || 'Unknown';
      const existing = map.get(b) || { brand: b, count: 0, totalValue: 0, entriesCount: 0 };
      existing.count += c.coupons_used;
      existing.totalValue += c.coupon_amount * c.coupons_used;
      existing.entriesCount += 1;
      map.set(b, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [coupons]);

  // Series Breakdown computed from coupon records & catalog
  const seriesBreakdownData = useMemo(() => {
    const map = new Map<string, { series: string; price: number; count: number; totalValue: number; products: Set<string> }>();

    catalogCoupons.forEach((cat) => {
      map.set(cat.name.toUpperCase(), {
        series: cat.name.toUpperCase(),
        price: cat.price,
        count: 0,
        totalValue: 0,
        products: new Set(),
      });
    });

    coupons.forEach((c) => {
      const s = (c.series_name || 'Unknown').toUpperCase();
      const existing = map.get(s) || {
        series: s,
        price: c.coupon_amount,
        count: 0,
        totalValue: 0,
        products: new Set(),
      };
      existing.count += c.coupons_used;
      existing.totalValue += c.coupon_amount * c.coupons_used;
      existing.price = c.coupon_amount;
      existing.products.add(c.product_name);
      map.set(s, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.price - a.price);
  }, [coupons, catalogCoupons]);

  // Category Breakdown computed from coupon records
  const categoryBreakdownData = useMemo(() => {
    const map = new Map<string, { category: string; count: number; totalValue: number; entriesCount: number }>();
    coupons.forEach((c) => {
      const cat = c.category || 'Uncategorized';
      const existing = map.get(cat) || { category: cat, count: 0, totalValue: 0, entriesCount: 0 };
      existing.count += c.coupons_used;
      existing.totalValue += c.coupon_amount * c.coupons_used;
      existing.entriesCount += 1;
      map.set(cat, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [coupons]);

  // Handle delete
  const handleDeleteCoupon = async (id: string) => {
    try {
      setIsDeleting(true);
      await api.deleteCoupon(id);
      setDeletingCouponId(null);
      await loadCoupons();
    } catch (err: any) {
      alert(err.message || 'Failed to delete coupon record');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export filtered coupons as CSV
  const handleExportCSV = () => {
    if (filteredCoupons.length === 0) return;

    const headers = [
      'Product Name',
      'Item Category',
      'Brand Name',
      'Coupon Series Name',
      'Coupon Amount (Rs)',
      'Number of Coupons Used',
      'Total Disbursed Value (Rs)',
      'Notes',
      'Recorded By',
      'Date Recorded',
    ];

    const rows = filteredCoupons.map((c) => [
      `"${c.product_name.replace(/"/g, '""')}"`,
      `"${c.category.replace(/"/g, '""')}"`,
      `"${c.brand_name.replace(/"/g, '""')}"`,
      `"${c.series_name.replace(/"/g, '""')}"`,
      c.coupon_amount,
      c.coupons_used,
      c.coupon_amount * c.coupons_used,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      `"${(c.created_by_name || 'Store Manager').replace(/"/g, '""')}"`,
      `"${new Date(c.created_at).toLocaleDateString()}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `brand_coupons_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = searchQuery !== '' || selectedBrand !== 'all' || selectedCategory !== 'all' || selectedSeries !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedBrand('all');
    setSelectedCategory('all');
    setSelectedSeries('all');
  };

  const handleSaveNewCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setAddCouponError(null);

    const trimmedName = newCouponName.trim().toUpperCase();
    const priceNum = Number(newCouponPrice);

    if (!trimmedName) {
      setAddCouponError('Please enter a coupon name.');
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setAddCouponError('Please enter a valid price in rupees (greater than 0).');
      return;
    }

    const updated = saveCustomCoupon(trimmedName, priceNum);
    setCatalogCoupons(updated);

    setNewCouponName('');
    setNewCouponPrice('');
    setIsAddCouponModalOpen(false);

    setCouponAddSuccess(`Coupon ${trimmedName} (₹${priceNum}) added to active catalog!`);
    setTimeout(() => setCouponAddSuccess(null), 4000);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Brand Coupon Management
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                STORE MANAGER
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Upload and audit brand coupons, series discounts, and redemption usage entered by the store manager.
              Track redeemed coupons across brands, categories, and promotional series in real-time.
            </p>
          </div>
        </div>

        {/* Top Action Buttons - Grouped & Aligned */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Secondary Utilities: Refresh & Export */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={loadCoupons}
              disabled={isLoading}
              className="p-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/80 transition-all cursor-pointer shadow-2xs"
              title="Refresh coupons"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredCoupons.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-2xs cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {isManager && (
            <>
              {/* Divider */}
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/80 mx-0.5 hidden sm:block" />

              {/* Manager Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                  title="Upload coupon data from CSV"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Upload Data</span>
                </button>

                <button
                  onClick={() => {
                    setNewCouponName('');
                    setNewCouponPrice('');
                    setAddCouponError(null);
                    setIsAddCouponModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                  title="Add a new coupon series with name & price"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Add Coupon</span>
                </button>

                <button
                  onClick={() => {
                    setEditingCoupon(null);
                    setIsFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-600/20 transition-all cursor-pointer whitespace-nowrap"
                  title="Record coupon redemptions for a product"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Coupon</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {couponAddSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">{couponAddSuccess}</span>
          </div>
          <button
            onClick={() => setCouponAddSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Metric Cards - Clickable with clean hover effects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Coupons Used */}
        <button
          type="button"
          onClick={() => {
            setKpiSearchQuery('');
            setActiveKpiModal('coupons_used');
          }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden text-left group hover:border-amber-400 dark:hover:border-amber-500/80 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Coupons Used
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalCouponsUsed.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">vouchers redeemed</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Across {stats?.totalSeries ?? uniqueSeries.length} active coupon series</span>
          </div>
        </button>

        {/* Metric 2: Total Disbursed Rupee Value */}
        <button
          type="button"
          onClick={() => {
            setKpiSearchQuery('');
            setActiveKpiModal('discount_disbursed');
          }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden text-left group hover:border-emerald-400 dark:hover:border-emerald-500/80 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Discount Disbursed
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{totalDiscountValue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Amount in rupees verified by store manager</span>
          </div>
        </button>

        {/* Metric 3: Active Brands */}
        <button
          type="button"
          onClick={() => {
            setKpiSearchQuery('');
            setActiveKpiModal('brands');
          }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden text-left group hover:border-indigo-400 dark:hover:border-indigo-500/80 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Brands Represented
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats?.totalBrands ?? uniqueBrands.length}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">manufacturing brands</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
            {uniqueBrands.slice(0, 3).map((b) => (
              <span
                key={b}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[90px]"
              >
                {b}
              </span>
            ))}
            {uniqueBrands.length > 3 && (
              <span className="text-[10px] text-slate-400">+{uniqueBrands.length - 3}</span>
            )}
          </div>
        </button>

        {/* Metric 4: Coupon Series Active */}
        <button
          type="button"
          onClick={() => {
            setKpiSearchQuery('');
            setActiveKpiModal('series');
          }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden text-left group hover:border-purple-400 dark:hover:border-purple-500/80 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Coupon Series
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats?.totalSeries ?? uniqueSeries.length}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">promotional batches</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>{coupons.length} distinct product coupon entries</span>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, brand, series, or category..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Brand Filter */}
          <div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Brands ({uniqueBrands.length})</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Categories ({uniqueCategories.length})</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Coupon Name Filter */}
          <div>
            <select
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            >
              <option value="all">All Coupons ({uniqueSeries.length})</option>
              <optgroup label="Available Coupons">
                {catalogCoupons.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} (₹{c.price})
                  </option>
                ))}
              </optgroup>
              {uniqueSeries.filter((s) => !catalogCoupons.some((c) => c.name.toUpperCase() === s.toUpperCase())).length > 0 && (
                <optgroup label="Other Logged Coupons">
                  {uniqueSeries
                    .filter((s) => !catalogCoupons.some((c) => c.name.toUpperCase() === s.toUpperCase()))
                    .map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong>{filteredCoupons.length}</strong> of <strong>{coupons.length}</strong> coupon records
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold text-xs cursor-pointer ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Sorting controls */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="px-2 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border-none text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="created_at">Date Added</option>
              <option value="total_value">Total Rupee Value</option>
              <option value="coupons_used">Coupons Used</option>
              <option value="coupon_amount">Coupon Amount (₹)</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Coupon Records Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading coupon records...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 mx-auto flex items-center justify-center mb-3">
              <Ticket className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No Coupon Records Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              {hasActiveFilters
                ? 'No coupons match your filter criteria. Try adjusting your search query or reset filters.'
                : 'No brand coupons have been uploaded yet. Click "Record Coupon" or "Upload Coupon Data" to get started.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {hasActiveFilters ? (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                >
                  Clear Filters
                </button>
              ) : isManager ? (
                <>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload CSV
                  </button>
                  <button
                    onClick={() => {
                      setEditingCoupon(null);
                      setIsFormOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add First Coupon
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Product Name</th>
                  <th className="px-4 py-3.5">Item Category</th>
                  <th className="px-4 py-3.5">Brand Name</th>
                  <th className="px-4 py-3.5">Coupon Name</th>
                  <th className="px-4 py-3.5 text-right">Price (₹)</th>
                  <th className="px-4 py-3.5 text-right">Coupons Used</th>
                  <th className="px-4 py-3.5 text-right">Total Rupee Value</th>
                  <th className="px-4 py-3.5">Recorded By</th>
                  {isManager && <th className="px-4 py-3.5 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCoupons.map((coupon) => {
                  const totalRupees = coupon.coupon_amount * coupon.coupons_used;

                  return (
                    <tr
                      key={coupon.id}
                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors group"
                    >
                      {/* 1. Product Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 max-w-[220px] truncate">
                          {coupon.product_name}
                        </div>
                        {coupon.notes && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[220px] mt-0.5">
                            {coupon.notes}
                          </p>
                        )}
                      </td>

                      {/* 2. Item Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg font-medium text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {coupon.category}
                        </span>
                      </td>

                      {/* 3. Brand Name */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                          <Building2 className="w-3 h-3 text-indigo-500" />
                          {coupon.brand_name}
                        </span>
                      </td>

                      {/* 4. Coupon Name */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                          <Tag className="w-3 h-3 text-purple-500" />
                          {coupon.series_name}
                        </span>
                      </td>

                      {/* 5. Coupon Amount in Rupees */}
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ₹{coupon.coupon_amount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* 6. Number of Coupons Used */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          {coupon.coupons_used.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* 7. Total Rupee Value */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          ₹{totalRupees.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* 8. Manager / Created At */}
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        <div>{coupon.created_by_name || 'Store Manager'}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(coupon.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* 9. Actions */}
                      {isManager && (
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingCoupon(coupon);
                                setIsFormOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit Coupon"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingCouponId(coupon.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Delete Coupon"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KPI Detail Breakdown Modal Window */}
      {activeKpiModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
          onClick={() => {
            setActiveKpiModal(null);
            setKpiSearchQuery('');
          }}
        >
          <div
            className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 bg-slate-50/70 dark:bg-slate-900">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md shrink-0 ${
                    activeKpiModal === 'brands'
                      ? 'bg-indigo-600 text-white shadow-indigo-600/20'
                      : activeKpiModal === 'coupons_used'
                      ? 'bg-amber-500 text-white shadow-amber-500/20'
                      : activeKpiModal === 'discount_disbursed'
                      ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                      : 'bg-purple-600 text-white shadow-purple-600/20'
                  }`}
                >
                  {activeKpiModal === 'brands' && <Building2 className="w-5 h-5" />}
                  {activeKpiModal === 'coupons_used' && <Hash className="w-5 h-5" />}
                  {activeKpiModal === 'discount_disbursed' && <IndianRupee className="w-5 h-5" />}
                  {activeKpiModal === 'series' && <Tag className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {activeKpiModal === 'brands' && 'Brand Redemption Breakdown'}
                    {activeKpiModal === 'coupons_used' && 'Coupons Used Breakdown'}
                    {activeKpiModal === 'discount_disbursed' && 'Discount Disbursed Financial Breakdown'}
                    {activeKpiModal === 'series' && 'Coupon Series & Catalog Breakdown'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeKpiModal === 'brands' && 'Detailed redemption volumes and disbursed discount values by brand'}
                    {activeKpiModal === 'coupons_used' && 'Vouchers redeemed across all coupon series in inventory'}
                    {activeKpiModal === 'discount_disbursed' && 'Financial discount values broken down by manufacturing brand and item category'}
                    {activeKpiModal === 'series' && 'Catalog series, face values, and redemption performance'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveKpiModal(null);
                  setKpiSearchQuery('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Search inside breakdown */}
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-slate-900">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={kpiSearchQuery}
                  onChange={(e) => setKpiSearchQuery(e.target.value)}
                  placeholder="Filter items in this breakdown..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline shrink-0">
                Click any row to filter main table
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-3 bg-white dark:bg-slate-900">
              {/* 1. Brands View */}
              {activeKpiModal === 'brands' && (
                <div className="space-y-3">
                  {brandBreakdownData
                    .filter((b) => b.brand.toLowerCase().includes(kpiSearchQuery.toLowerCase()))
                    .map((item) => {
                      const sharePercent = totalDiscountValue > 0 ? Math.round((item.totalValue / totalDiscountValue) * 100) : 0;
                      return (
                        <div
                          key={item.brand}
                          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {item.brand}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                                {item.count.toLocaleString('en-IN')} vouchers used
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({item.entriesCount} product entries)
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-2 flex items-center gap-2.5 max-w-md">
                              <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(sharePercent, 3)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                {sharePercent}% of total
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                                ₹{item.totalValue.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-400">Total Discount</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBrand(item.brand);
                                setActiveKpiModal(null);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <span>Filter Table</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  {brandBreakdownData.filter((b) => b.brand.toLowerCase().includes(kpiSearchQuery.toLowerCase())).length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No brands match "{kpiSearchQuery}".
                    </div>
                  )}
                </div>
              )}

              {/* 2. Coupons Used View */}
              {activeKpiModal === 'coupons_used' && (
                <div className="space-y-3">
                  {seriesBreakdownData
                    .filter((s) => s.series.toLowerCase().includes(kpiSearchQuery.toLowerCase()))
                    .map((item) => {
                      const sharePercent = totalCouponsUsed > 0 ? Math.round((item.count / totalCouponsUsed) * 100) : 0;
                      return (
                        <div
                          key={item.series}
                          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:border-amber-300 dark:hover:border-amber-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {item.series}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                ₹{item.price} per voucher
                              </span>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {item.count.toLocaleString('en-IN')} redeemed
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-2 flex items-center gap-2.5 max-w-md">
                              <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(sharePercent, 3)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                {sharePercent}% of vouchers
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                ₹{item.totalValue.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-400">Total Rupee Value</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSeries(item.series);
                                setActiveKpiModal(null);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <span>Filter Table</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  {seriesBreakdownData.filter((s) => s.series.toLowerCase().includes(kpiSearchQuery.toLowerCase())).length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No coupon series match "{kpiSearchQuery}".
                    </div>
                  )}
                </div>
              )}

              {/* 3. Discount Disbursed View (Financial Audit) */}
              {activeKpiModal === 'discount_disbursed' && (
                <div className="space-y-6">
                  {/* By Brand Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                      Disbursements by Manufacturing Brand
                    </h4>
                    <div className="space-y-2.5">
                      {brandBreakdownData
                        .filter((b) => b.brand.toLowerCase().includes(kpiSearchQuery.toLowerCase()))
                        .map((item) => {
                          const sharePercent = totalDiscountValue > 0 ? Math.round((item.totalValue / totalDiscountValue) * 100) : 0;
                          return (
                            <div
                              key={item.brand}
                              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {item.brand}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {item.count} vouchers
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden max-w-xs">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full"
                                      style={{ width: `${Math.max(sharePercent, 3)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-medium">{sharePercent}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  ₹{item.totalValue.toLocaleString('en-IN')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBrand(item.brand);
                                    setActiveKpiModal(null);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors cursor-pointer"
                                >
                                  Filter
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* By Category Breakdown */}
                  {categoryBreakdownData.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        Disbursements by Item Category
                      </h4>
                      <div className="space-y-2.5">
                        {categoryBreakdownData
                          .filter((c) => c.category.toLowerCase().includes(kpiSearchQuery.toLowerCase()))
                          .map((item) => {
                            const sharePercent = totalDiscountValue > 0 ? Math.round((item.totalValue / totalDiscountValue) * 100) : 0;
                            return (
                              <div
                                key={item.category}
                                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      {item.category}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {item.count} vouchers
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden max-w-xs">
                                      <div
                                        className="h-full bg-indigo-500 rounded-full"
                                        style={{ width: `${Math.max(sharePercent, 3)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium">{sharePercent}%</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    ₹{item.totalValue.toLocaleString('en-IN')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCategory(item.category);
                                      setActiveKpiModal(null);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                                  >
                                    Filter
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. Series View */}
              {activeKpiModal === 'series' && (
                <div className="space-y-3">
                  {seriesBreakdownData
                    .filter((s) => s.series.toLowerCase().includes(kpiSearchQuery.toLowerCase()))
                    .map((item) => (
                      <div
                        key={item.series}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {item.series}
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                              ₹{item.price} Voucher
                            </span>
                            <span className={`text-[11px] font-semibold ${item.count > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                              {item.count > 0 ? `${item.count.toLocaleString('en-IN')} redeemed` : 'No redemptions logged'}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                            {item.products.size > 0 ? (
                              <span>Linked to {item.products.size} distinct product{item.products.size > 1 ? 's' : ''}</span>
                            ) : (
                              <span>Available in catalog for new entries</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">
                              ₹{item.totalValue.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-400">Disbursed Value</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSeries(item.series);
                              setActiveKpiModal(null);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/80 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <span>Filter Table</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  {seriesBreakdownData.filter((s) => s.series.toLowerCase().includes(kpiSearchQuery.toLowerCase())).length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No coupon series match "{kpiSearchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingCouponId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Coupon Record?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to delete this coupon record? This action will remove it from total brand redemption calculations.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingCouponId(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCoupon(deletingCouponId)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple Pop-up Modal on Main Coupon Panel: Add New Coupon (Name & Price only) */}
      {isAddCouponModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add New Coupon</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Specify name and price in rupees</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCouponModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addCouponError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                {addCouponError}
              </div>
            )}

            <form onSubmit={handleSaveNewCoupon} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Coupon Name
                </label>
                <input
                  type="text"
                  value={newCouponName}
                  onChange={(e) => setNewCouponName(e.target.value)}
                  placeholder="e.g. BL16"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Price in Rupees (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={newCouponPrice}
                    onChange={(e) => setNewCouponPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 2000"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddCouponModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  Save Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Form Modal (Add / Edit) */}
      <CouponFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCoupon(null);
        }}
        onSuccess={loadCoupons}
        editingCoupon={editingCoupon}
        products={products}
        categories={categories}
      />

      {/* Upload Modal (CSV / JSON Bulk Upload) */}
      <CouponUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={loadCoupons}
      />
    </div>
  );
};
