'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export type DataQualityStatus = 'LIVE' | 'SNAPSHOT' | 'UNAVAILABLE';

export interface CoreKPIs {
  total_revenue?: number;
  purchase_value?: number;
  inventory_value?: number;
  total_units?: number;
  gross_margin_pct?: number;
  total_orders?: number;
  approved_orders?: number;
  pending_orders?: number;
  average_order_value?: number;
  aov?: number;
  inventory_turnover_ratio?: number;
  inventory_health_score?: number;
  active_dealers?: number;
  active_suppliers?: number;
  return_rate_pct?: number;
  fulfillment_rate_pct?: number;
}

export interface SalesIntelligence {
  top_dealer?: string;
  top_salesman?: string;
  daily_sales?: Array<{
    date: string;
    revenue: number;
    orders: number;
    stock_in?: number;
    stock_out?: number;
    adjustments?: number;
  }>;
  revenue_by_category?: Array<{ category: string; revenue: number }>;
  dealer_rankings?: Array<{ dealer: string; revenue: number }>;
  salesman_performance?: Array<{ salesman: string; revenue: number }>;
  dealer_states?: Record<string, number>;
  top_products?: Array<{ sku: string; name: string; qty: number }>;
  geographic_sales?: Record<string, number>;
  by_region?: Array<{ region: string; revenue: number; percentage?: number; share_percent?: number }>;
  by_state?: Array<{ state: string; revenue: number; percentage?: number; share_percent?: number }>;
  by_city?: Array<{ city: string; revenue: number }>;
}

export interface InventoryIntelligence {
  total_skus?: number;
  total_units?: number;
  healthy_count?: number;
  low_stock?: number;
  out_of_stock?: number;
  overstock?: number;
  category_breakdown?: Array<{ category: string; count: number; total_qty?: number }>;
  category_valuation?: Array<{ category: string; value: number }>;
  top_movers?: Array<{ name: string; sku: string; units_sold: number }>;
}

export interface ReturnsIntelligence {
  total_returns?: number;
  return_reasons?: Record<string, number>;
  reasons?: Record<string, number>;
  defective_count?: number;
  good_count?: number;
}

export interface ProcurementIntelligence {
  purchase_value?: number;
  total_suppliers?: number;
  top_suppliers?: Array<{ supplier: string; value: number }>;
}

export interface BIData {
  status?: string;
  data_mode?: string;
  data_as_of?: string;
  snapshot_updated_at?: string;
  core_kpis?: CoreKPIs;
  sales_intelligence?: SalesIntelligence;
  inventory_intelligence?: InventoryIntelligence;
  returns_intelligence?: ReturnsIntelligence;
  procurement_intelligence?: ProcurementIntelligence;
  ai_insights?: string[] | Array<{ type?: string; title?: string; message?: string }>;
}

export const EMPTY_BI_DATA: BIData = {
  core_kpis: {},
  sales_intelligence: {
    daily_sales: [],
    revenue_by_category: [],
    dealer_rankings: [],
    salesman_performance: [],
    top_products: [],
  },
  inventory_intelligence: {
    top_movers: [],
    category_breakdown: [],
  },
  returns_intelligence: {
    total_returns: 0,
    return_reasons: {},
    reasons: {},
    defective_count: 0,
    good_count: 0,
  },
  procurement_intelligence: {
    purchase_value: 0,
    total_suppliers: 0,
    top_suppliers: [],
  },
  ai_insights: [],
};

export interface DataQualityReport {
  total_historical_vouchers: number;
  total_line_items: number;
  total_voucher_amount: number;
  total_line_amount: number;
  reconciliation_difference: number;
  is_fully_reconciled: boolean;
  customer_mapping: { mapped: number; unresolved: number; percentage: number };
  salesman_mapping: { mapped: number; unresolved: number; percentage: number };
  location_mapping: { resolved: number; unresolved: number; percentage: number };
  product_mapping: { mapped: number; unresolved: number; percentage: number };
  category_mapping: { mapped: number; unresolved: number; percentage: number };
  unresolved_customers?: Array<{ name: string; gstin: string | null; address: string | null; vouchers: number; amount: number }>;
  unresolved_products?: Array<{ name: string; lines: number; amount: number }>;
}

interface BiDataContextType {
  biData: BIData;
  dataQuality: DataQualityReport | null;
  loading: boolean;
  dataStatus: DataQualityStatus;
  dataAsOf: string | null;
  snapshotUpdatedAt: string | null;
  isOffline: boolean;
  inventoryList: any[];
  categoriesList: any[];
  dealersList: any[];
  suppliersList: any[];
  returnsList: any[];
  ordersList: any[];
  inwardsList: any[];
  customersAnalyticsList: any[];
  kpis: CoreKPIs;
  sales: SalesIntelligence;
  inv: InventoryIntelligence;
  ret: ReturnsIntelligence;
  proc: ProcurementIntelligence;
  aiFeed: any[];
  skuMap: Record<string, { name: string; category: string; price: number }>;
  refreshBiData: () => Promise<void>;
}

const BiDataContext = createContext<BiDataContextType | null>(null);

export const BiDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [biData, setBiData] = useState<BIData>(EMPTY_BI_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataStatus, setDataStatus] = useState<DataQualityStatus>('LIVE');
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityReport | null>(null);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [dealersList, setDealersList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [inwardsList, setInwardsList] = useState<any[]>([]);
  const [customersAnalyticsList, setCustomersAnalyticsList] = useState<any[]>([]);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);

      const [biFetch, dqFetch, invRes, catRes, dlrRes, supRes, retRes, ordRes, inwRes, custRes] = await Promise.allSettled([
        fetch('/api/analytics/bi'),
        fetch('/api/analytics/data-quality'),
        fetch('/api/inventory').then(r => (r.ok ? r.json() : [])),
        fetch('/api/categories').then(r => (r.ok ? r.json() : [])),
        fetch('/api/dealers?limit=1000').then(r => (r.ok ? r.json() : [])),
        fetch('/api/suppliers').then(r => (r.ok ? r.json() : [])),
        fetch('/api/returns').then(r => (r.ok ? r.json() : [])),
        fetch('/api/orders').then(r => (r.ok ? r.json() : [])),
        fetch('/api/inwards').then(r => (r.ok ? r.json() : [])),
        fetch('/api/analytics/customers?limit=500').then(r => (r.ok ? r.json() : [])),
      ]);

      if (biFetch.status === 'fulfilled' && biFetch.value.ok) {
        const res = biFetch.value;
        const dbMode = res.headers.get('x-database-mode');
        const snapHeaderTime = res.headers.get('x-snapshot-captured-at');
        const val: BIData = await res.json();

        if (val && Object.keys(val).length > 0) {
          setBiData(val);
          const isSnapshot = val.data_mode === 'SNAPSHOT' || val.status === 'SNAPSHOT' || dbMode === 'READ_ONLY';
          setDataStatus(isSnapshot ? 'SNAPSHOT' : 'LIVE');
          setDataAsOf(val.data_as_of || new Date().toISOString().slice(0, 10));
          setSnapshotUpdatedAt(val.snapshot_updated_at || snapHeaderTime || null);
        } else {
          setBiData(EMPTY_BI_DATA);
          setDataStatus('UNAVAILABLE');
          setDataAsOf(null);
        }
      } else {
        setBiData(EMPTY_BI_DATA);
        setDataStatus('UNAVAILABLE');
        setDataAsOf(null);
      }

      if (dqFetch.status === 'fulfilled' && dqFetch.value.ok) {
        const dqData: DataQualityReport = await dqFetch.value.json();
        setDataQuality(dqData);
      }

      if (invRes.status === 'fulfilled' && invRes.value) {
        const val = invRes.value;
        const list = Array.isArray(val) ? val : (val.items || val.products || []);
        setInventoryList(list);
      }
      if (catRes.status === 'fulfilled' && catRes.value) {
        const val = catRes.value;
        const list = Array.isArray(val) ? val : (val.categories || val.items || []);
        setCategoriesList(list);
      }
      if (dlrRes.status === 'fulfilled' && dlrRes.value) {
        const dData = dlrRes.value;
        const list = Array.isArray(dData) ? dData : (dData.dealers || dData.customers || dData.items || []);
        setDealersList(list);
      }
      if (supRes.status === 'fulfilled' && supRes.value) {
        const val = supRes.value;
        const list = Array.isArray(val) ? val : (val.suppliers || val.items || []);
        setSuppliersList(list);
      }
      if (retRes.status === 'fulfilled' && retRes.value) {
        const val = retRes.value;
        const list = Array.isArray(val) ? val : (val.returns || val.items || []);
        setReturnsList(list);
      }
      if (ordRes.status === 'fulfilled' && ordRes.value) {
        const val = ordRes.value;
        const list = Array.isArray(val) ? val : (val.orders || val.items || []);
        setOrdersList(list);
      }
      if (inwRes.status === 'fulfilled' && inwRes.value) {
        const val = inwRes.value;
        const list = Array.isArray(val) ? val : (val.inwards || val.items || []);
        setInwardsList(list);
      }
      if (custRes.status === 'fulfilled' && custRes.value) {
        const val = custRes.value;
        const list = Array.isArray(val) ? val : (val.customers || val.items || []);
        setCustomersAnalyticsList(list);
      }
    } catch {
      setBiData(EMPTY_BI_DATA);
      setDataStatus('UNAVAILABLE');
      setDataAsOf(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Strict Authoritative Metrics: No fallback to synthetic numbers
  const kpis: CoreKPIs = useMemo(() => biData.core_kpis || {}, [biData.core_kpis]);
  const sales: SalesIntelligence = useMemo(() => biData.sales_intelligence || EMPTY_BI_DATA.sales_intelligence!, [biData.sales_intelligence]);
  const inv: InventoryIntelligence = useMemo(() => biData.inventory_intelligence || EMPTY_BI_DATA.inventory_intelligence!, [biData.inventory_intelligence]);
  const ret: ReturnsIntelligence = useMemo(() => biData.returns_intelligence || EMPTY_BI_DATA.returns_intelligence!, [biData.returns_intelligence]);
  const proc: ProcurementIntelligence = useMemo(() => biData.procurement_intelligence || EMPTY_BI_DATA.procurement_intelligence!, [biData.procurement_intelligence]);

  const aiFeed = useMemo(() => {
    if (Array.isArray(biData.ai_insights) && biData.ai_insights.length > 0) {
      return biData.ai_insights.map((item: any) =>
        typeof item === 'string'
          ? { type: 'info', title: 'Operational Insight', message: item }
          : item
      );
    }
    return [];
  }, [biData.ai_insights]);

  const skuMap = useMemo(() => {
    const map: Record<string, { name: string; category: string; price: number }> = {};
    inventoryList.forEach(p => {
      const skuKey = p.SKU ? String(p.SKU).trim().toLowerCase() : '';
      if (skuKey) {
        map[skuKey] = {
          name: p['Item Name'] || p.name || p.SKU,
          category: p.Category || p.category || 'General',
          price: Number(p.Price || p.price || 0),
        };
      }
    });
    return map;
  }, [inventoryList]);

  return (
    <BiDataContext.Provider
      value={{
        biData,
        dataQuality,
        loading,
        dataStatus,
        dataAsOf,
        snapshotUpdatedAt,
        isOffline: dataStatus !== 'LIVE',
        inventoryList,
        categoriesList,
        dealersList,
        suppliersList,
        returnsList,
        ordersList,
        inwardsList,
        customersAnalyticsList,
        kpis,
        sales,
        inv,
        ret,
        proc,
        aiFeed,
        skuMap,
        refreshBiData: fetchAllData,
      }}
    >
      {children}
    </BiDataContext.Provider>
  );
};

export const useBi = () => {
  const ctx = useContext(BiDataContext);
  if (!ctx) {
    throw new Error('useBi must be used within a BiDataProvider');
  }
  return ctx;
};
