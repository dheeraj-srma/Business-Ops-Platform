import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  FolderPlus,
  Package,
  Boxes,
  ChevronRight,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import { Category, Product, UserRole } from '../../types';
import { formatDate, formatNumber } from '../../lib/utils';
import { CategoryProductsModal } from './CategoryProductsModal';

interface CategoriesViewProps {
  categories: Category[];
  products: Product[];
  role: UserRole;
  onOpenNewCategory: () => void;
  onOpenEditCategory: (cat: Category) => void;
  onOpenProductDetail?: (productId: string) => void;
  onOpenStockIn?: (productId: string) => void;
  onOpenStockOut?: (productId: string) => void;
  onOpenEditProduct?: (product: Product) => void;
  onOpenNewProduct?: () => void;
  onFilterByCategory?: (categoryId: string) => void;
  onGoBack?: () => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  products,
  role,
  onOpenNewCategory,
  onOpenEditCategory,
  onOpenProductDetail,
  onOpenStockIn,
  onOpenStockOut,
  onOpenEditProduct,
  onOpenNewProduct,
  onFilterByCategory,
  onGoBack,
}) => {
  const isManager = role === 'manager';
  const [selectedCategoryForProducts, setSelectedCategoryForProducts] = useState<Category | null>(null);

  // Calculate statistics per category
  const categoryStats = categories.map((cat) => {
    const catProducts = products.filter(
      (p) => (p.categoryId || (p as any).category_id) === cat.id && (p.isActive ?? (p as any).is_active !== false)
    );
    const totalUnits = Math.round(
      catProducts.reduce(
        (acc, p) => acc + (p.currentStock ?? (p as any).current_stock ?? 0),
        0
      )
    );
    const lowStockCount = catProducts.filter((p) => {
      const stock = p.currentStock ?? (p as any).current_stock ?? 0;
      const min = p.minimumStock ?? (p as any).minimum_stock ?? 0;
      const crit = p.criticalStock ?? (p as any).critical_stock ?? 0;
      const status = p.status || (stock < 0 ? 'NEGATIVE' : stock === 0 ? 'OUT_OF_STOCK' : stock <= crit ? 'CRITICAL' : stock <= min ? 'LOW' : 'HEALTHY');
      return status === 'LOW' || status === 'CRITICAL' || status === 'OUT_OF_STOCK' || status === 'NEGATIVE' || stock <= min;
    }).length;

    return {
      ...cat,
      productCount: catProducts.length,
      totalUnits,
      lowStockCount,
    };
  });

  return (
    <div id="categories-view" className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {onGoBack && (
            <button
              id="btn-categories-back"
              onClick={onGoBack}
              title="Go back to previous state"
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0 group"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </button>
          )}

          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Categories & Stock Groups ({categories.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Organize inventory items into hierarchical groups synchronized with Tally masters.
            </p>
          </div>
        </div>

        {isManager && (
          <button
            id="btn-add-category"
            onClick={onOpenNewCategory}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-500/25 transition-all cursor-pointer w-full sm:w-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Category</span>
          </button>
        )}
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {categoryStats.map((cat) => (
          <div
            key={cat.id}
            className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-2xs transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight truncate">{cat.name}</h3>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">ID: {cat.id}</span>
                  </div>
                </div>

                {isManager && (
                  <button
                    onClick={() => onOpenEditCategory(cat)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md transition-all cursor-pointer shrink-0"
                    title="Edit Category Name & Description"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 line-clamp-2 min-h-[32px]">
                {cat.description || 'No description provided.'}
              </p>

              {/* Statistics row */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/70 text-center">
                <div
                  onClick={() => setSelectedCategoryForProducts(cat)}
                  className="p-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer transition-colors"
                  title={`View ${cat.name} products`}
                >
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">SKUs</span>
                  <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">{cat.productCount}</span>
                </div>

                <div
                  onClick={() => setSelectedCategoryForProducts(cat)}
                  className="p-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer transition-colors"
                  title={`View ${cat.name} products`}
                >
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">Total Units</span>
                  <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400 truncate block" title={String(cat.totalUnits)}>
                    {formatNumber(cat.totalUnits)}
                  </span>
                </div>

                <div
                  onClick={() => setSelectedCategoryForProducts(cat)}
                  className="p-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer transition-colors"
                  title={`View ${cat.name} products`}
                >
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">Low Stock</span>
                  <span
                    className={`text-sm font-bold font-mono ${
                      cat.lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {cat.lowStockCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom action */}
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Created {formatDate(cat.createdAt || (cat as any).created_at)}
              </span>
              <button
                type="button"
                id={`btn-view-category-${cat.id}`}
                onClick={() => setSelectedCategoryForProducts(cat)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-all cursor-pointer"
                title={`Open items popup for ${cat.name}`}
              >
                <span>View Products</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fresh Category Products Modal Popup */}
      <CategoryProductsModal
        isOpen={!!selectedCategoryForProducts}
        onClose={() => setSelectedCategoryForProducts(null)}
        category={selectedCategoryForProducts}
        products={products}
        role={role}
        onOpenProductDetail={onOpenProductDetail}
        onOpenStockIn={onOpenStockIn}
        onOpenStockOut={onOpenStockOut}
        onOpenEditProduct={onOpenEditProduct}
        onOpenNewProduct={onOpenNewProduct}
      />
    </div>
  );
};

