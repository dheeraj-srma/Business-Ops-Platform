'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DateRangeType,
  DateRangeBounds,
  getDateRangeBounds,
  getBusinessTodayDate,
  BUSINESS_TIMEZONE,
  EARLIEST_DATA_DATE,
} from '../utils/dateRange';

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
    outward_qty?: number;
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

export interface FinancialIntelligence {
  summary?: {
    total_sales: number;
    total_purchases: number;
    net_trading_surplus: number;
    gross_margin_pct: number;
    total_inventory_valuation: number;
    annual_carrying_cost: number;
    dead_stock_locked_capital: number;
    active_working_capital: number;
  };
  gross_margin_by_brand?: Array<{ brand: string; sales: number; purchases: number; margin: number; margin_pct: number }>;
  net_margin_contribution?: Array<{ brand: string; net_margin: number }>;
  working_capital_allocation?: Array<{ name: string; value: number; color?: string }>;
  carrying_cost_breakdown?: Array<{ name: string; value: number; pct: number }>;
  monthly_cashflow?: Array<{ month: string; sales: number; purchases: number; surplus: number }>;
  order_ticket_distribution?: Array<{ range: string; count: number; revenue: number }>;
}

export interface BIData {
  status?: string;
  data_mode?: string;
  data_as_of?: string;
  data_min_date?: string;
  generated_at?: string;
  snapshot_updated_at?: string;
  applied_filters?: Record<string, any>;
  core_kpis?: CoreKPIs;
  sales_intelligence?: SalesIntelligence;
  inventory_intelligence?: InventoryIntelligence;
  returns_intelligence?: ReturnsIntelligence;
  procurement_intelligence?: ProcurementIntelligence;
  financial_intelligence?: FinancialIntelligence;
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
  dataMinDate: string;
  referenceDate: string;
  snapshotUpdatedAt: string | null;
  lastSyncedAt: string;
  isOffline: boolean;
  
  // Date range state
  selectedRange: DateRangeType;
  customStart: string | null;
  customEnd: string | null;
  activeBounds: DateRangeBounds;
  setSelectedRange: (range: DateRangeType, customStart?: string, customEnd?: string) => void;

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
  fin?: FinancialIntelligence;
  aiFeed: any[];
  skuMap: Record<string, { name: string; category: string; price: number }>;
  refreshBiData: () => Promise<void>;
  invalidateAnalytics: (scope?: string) => Promise<void>;
}

const BiDataContext = createContext<BiDataContextType | null>(null);

export const BiDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [biData, setBiData] = useState<BIData>(EMPTY_BI_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataStatus, setDataStatus] = useState<DataQualityStatus>('LIVE');
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [dataMinDate, setDataMinDate] = useState<string>(EARLIEST_DATA_DATE);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [dataQuality, setDataQuality] = useState<DataQualityReport | null>(null);
  
  // Global Canonical Date Range State
  const [selectedRange, setSelectedRangeState] = useState<DateRangeType>('30d');
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);

  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [dealersList, setDealersList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [inwardsList, setInwardsList] = useState<any[]>([]);
  const [customersAnalyticsList, setCustomersAnalyticsList] = useState<any[]>([]);

  const referenceDate = useMemo(() => getBusinessTodayDate(BUSINESS_TIMEZONE), []);

  const activeBounds = useMemo(() => {
    return getDateRangeBounds(
      selectedRange,
      referenceDate,
      customStart || undefined,
      customEnd || undefined,
      dataMinDate
    );
  }, [selectedRange, referenceDate, customStart, customEnd, dataMinDate]);

  const setSelectedRange = useCallback((range: DateRangeType, cStart?: string, cEnd?: string) => {
    setSelectedRangeState(range);
    if (range === 'custom') {
      setCustomStart(cStart || null);
      setCustomEnd(cEnd || null);
    } else {
      setCustomStart(null);
      setCustomEnd(null);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);

      const bounds = getDateRangeBounds(
        selectedRange,
        referenceDate,
        customStart || undefined,
        customEnd || undefined,
        dataMinDate
      );

      const queryParams = new URLSearchParams();
      if (bounds.isValid && selectedRange !== 'all') {
        queryParams.set('start_date', bounds.start);
        queryParams.set('end_date', bounds.end);
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const [biFetch, dqFetch, invRes, catRes, dlrRes, supRes, retRes, ordRes, inwRes, custRes] = await Promise.allSettled([
        fetch(`/api/analytics/bi${queryString}`),
        fetch('/api/analytics/data-quality'),
        fetch('/api/inventory').then(r => (r.ok ? r.json() : [])),
        fetch('/api/categories').then(r => (r.ok ? r.json() : [])),
        fetch('/api/dealers?limit=1000').then(r => (r.ok ? r.json() : [])),
        fetch('/api/suppliers').then(r => (r.ok ? r.json() : [])),
        fetch(`/api/returns${queryString}`).then(r => (r.ok ? r.json() : [])),
        fetch('/api/orders').then(r => (r.ok ? r.json() : [])),
        fetch('/api/inwards').then(r => (r.ok ? r.json() : [])),
        fetch(`/api/analytics/customers?limit=500${queryString ? `&${queryParams.toString()}` : ''}`).then(r => (r.ok ? r.json() : [])),
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
          setDataAsOf(val.data_as_of || null);
          if (val.data_min_date) {
            setDataMinDate(val.data_min_date);
          }
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

      // Record last sync time in Asia/Kolkata
      try {
        const nowFormatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: BUSINESS_TIMEZONE,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date());
        setLastSyncedAt(nowFormatted);
      } catch {
        setLastSyncedAt(new Date().toLocaleTimeString());
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
  }, [selectedRange, referenceDate, customStart, customEnd, dataMinDate]);

  // Initial fetch and fetch on range change
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Automatic refresh on tab focus / window visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchAllData();
      }
    };
    const handleFocus = () => {
      fetchAllData();
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [fetchAllData]);

  // Periodic refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchAllData();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const invalidateAnalytics = useCallback(async (scope?: string) => {
    await fetchAllData();
  }, [fetchAllData]);

  // Strict Authoritative Metrics
  const kpis: CoreKPIs = useMemo(() => biData.core_kpis || {}, [biData.core_kpis]);
  const sales: SalesIntelligence = useMemo(() => biData.sales_intelligence || EMPTY_BI_DATA.sales_intelligence!, [biData.sales_intelligence]);
  const inv: InventoryIntelligence = useMemo(() => biData.inventory_intelligence || EMPTY_BI_DATA.inventory_intelligence!, [biData.inventory_intelligence]);
  const ret: ReturnsIntelligence = useMemo(() => biData.returns_intelligence || EMPTY_BI_DATA.returns_intelligence!, [biData.returns_intelligence]);
  const proc: ProcurementIntelligence = useMemo(() => biData.procurement_intelligence || EMPTY_BI_DATA.procurement_intelligence!, [biData.procurement_intelligence]);
  const fin: FinancialIntelligence | undefined = useMemo(() => biData.financial_intelligence, [biData.financial_intelligence]);

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
        dataMinDate,
        referenceDate,
        snapshotUpdatedAt,
        lastSyncedAt,
        isOffline: dataStatus !== 'LIVE',
        selectedRange,
        customStart,
        customEnd,
        activeBounds,
        setSelectedRange,
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
        fin,
        aiFeed,
        skuMap,
        refreshBiData: fetchAllData,
        invalidateAnalytics,
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
