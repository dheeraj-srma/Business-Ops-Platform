'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, Category, DashboardStats, AppSettings, UserRole } from '../types';
import { api } from '../lib/api';

interface AppContextType {
  products: Product[];
  categories: Category[];
  stats: DashboardStats | null;
  settings: AppSettings | null;
  isLoading: boolean;
  role: UserRole;
  setRole: (role: UserRole) => void;
  fetchData: () => Promise<void>;

  // Modals state & handlers
  isStockInOpen: boolean;
  isStockOutOpen: boolean;
  isStockAdjustOpen: boolean;
  isCustomerReturnOpen: boolean;
  isNewProductOpen: boolean;
  isEditProductOpen: boolean;
  isProductDetailOpen: boolean;
  selectedProductId?: string;
  productToEdit?: Product;
  detailProductId?: string;

  handleOpenStockIn: (productId?: string) => void;
  handleCloseStockIn: () => void;
  handleOpenStockOut: (productId?: string) => void;
  handleCloseStockOut: () => void;
  handleOpenStockAdjustment: (productId?: string) => void;
  handleCloseStockAdjustment: () => void;
  handleOpenCustomerReturn: () => void;
  handleCloseCustomerReturn: () => void;
  handleOpenNewProduct: () => void;
  handleCloseNewProduct: () => void;
  handleOpenEditProduct: (p: Product) => void;
  handleCloseEditProduct: () => void;
  handleOpenProductDetail: (productId: string) => void;
  handleCloseProductDetail: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [role, setRole] = useState<UserRole>('manager');

  // Modal states
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [isStockAdjustOpen, setIsStockAdjustOpen] = useState(false);
  const [isCustomerReturnOpen, setIsCustomerReturnOpen] = useState(false);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [productToEdit, setProductToEdit] = useState<Product | undefined>(undefined);
  const [detailProductId, setDetailProductId] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statsRes, prodsRes, catsRes, setsRes] = await Promise.allSettled([
        api.getDashboardStats({ days: 7 }),
        api.getProducts(),
        api.getCategories(),
        api.getSettings(),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      
      let loadedProducts: Product[] = [];
      if (prodsRes.status === 'fulfilled') {
        const val = prodsRes.value;
        loadedProducts = Array.isArray(val) ? val : Array.isArray(val?.products) ? val.products : [];
        setProducts(loadedProducts);
      }

      let loadedCategories: Category[] = [];
      if (catsRes.status === 'fulfilled') {
        const val = catsRes.value;
        loadedCategories = Array.isArray(val) ? val : Array.isArray(val?.categories) ? val.categories : [];
      }

      if (loadedCategories.length === 0 && loadedProducts.length > 0) {
        const catSet = new Set<string>();
        loadedProducts.forEach((p) => {
          const c = String(p.categoryName || (p as any).Category || (p as any).category_id || (p as any).brand || 'General').trim();
          if (c) catSet.add(c);
        });
        const nowIso = new Date().toISOString();
        loadedCategories = Array.from(catSet).sort().map((name) => ({
          id: name,
          name,
          description: `${name} catalog category`,
          isActive: true,
          is_active: true,
          createdAt: nowIso,
          updatedAt: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        } as any));
      }

      setCategories(loadedCategories);
      if (setsRes.status === 'fulfilled') setSettings(setsRes.value.settings);
    } catch (err) {
      console.error('Error fetching application state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenStockIn = useCallback((productId?: string) => {
    setSelectedProductId(productId);
    setIsStockInOpen(true);
  }, []);

  const handleCloseStockIn = useCallback(() => {
    setIsStockInOpen(false);
    setSelectedProductId(undefined);
  }, []);

  const handleOpenStockOut = useCallback((productId?: string) => {
    setSelectedProductId(productId);
    setIsStockOutOpen(true);
  }, []);

  const handleCloseStockOut = useCallback(() => {
    setIsStockOutOpen(false);
    setSelectedProductId(undefined);
  }, []);

  const handleOpenStockAdjustment = useCallback((productId?: string) => {
    setSelectedProductId(productId);
    setIsStockAdjustOpen(true);
  }, []);

  const handleCloseStockAdjustment = useCallback(() => {
    setIsStockAdjustOpen(false);
    setSelectedProductId(undefined);
  }, []);

  const handleOpenCustomerReturn = useCallback(() => {
    setIsCustomerReturnOpen(true);
  }, []);

  const handleCloseCustomerReturn = useCallback(() => {
    setIsCustomerReturnOpen(false);
  }, []);

  const handleOpenNewProduct = useCallback(() => {
    setIsNewProductOpen(true);
  }, []);

  const handleCloseNewProduct = useCallback(() => {
    setIsNewProductOpen(false);
  }, []);

  const handleOpenEditProduct = useCallback((p: Product) => {
    setProductToEdit(p);
    setIsEditProductOpen(true);
  }, []);

  const handleCloseEditProduct = useCallback(() => {
    setIsEditProductOpen(false);
    setProductToEdit(undefined);
  }, []);

  const handleOpenProductDetail = useCallback((productId: string) => {
    setDetailProductId(productId);
    setIsProductDetailOpen(true);
  }, []);

  const handleCloseProductDetail = useCallback(() => {
    setIsProductDetailOpen(false);
    setDetailProductId(undefined);
  }, []);

  return (
    <AppContext.Provider
      value={{
        products,
        categories,
        stats,
        settings,
        isLoading,
        role,
        setRole,
        fetchData,
        isStockInOpen,
        isStockOutOpen,
        isStockAdjustOpen,
        isCustomerReturnOpen,
        isNewProductOpen,
        isEditProductOpen,
        isProductDetailOpen,
        selectedProductId,
        productToEdit,
        detailProductId,
        handleOpenStockIn,
        handleCloseStockIn,
        handleOpenStockOut,
        handleCloseStockOut,
        handleOpenStockAdjustment,
        handleCloseStockAdjustment,
        handleOpenCustomerReturn,
        handleCloseCustomerReturn,
        handleOpenNewProduct,
        handleCloseNewProduct,
        handleOpenEditProduct,
        handleCloseEditProduct,
        handleOpenProductDetail,
        handleCloseProductDetail,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
