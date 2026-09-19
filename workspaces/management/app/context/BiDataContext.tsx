'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

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
}

export interface InventoryIntelligence {
  total_skus?: number;
  total_units?: number;
  healthy_count?: number;
  low_stock?: number;
  out_of_stock?: number;
  overstock?: number;
  category_breakdown?: Array<{ category: string; count: number; total_qty?: number }>;
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
  core_kpis?: CoreKPIs;
  sales_intelligence?: SalesIntelligence;
  inventory_intelligence?: InventoryIntelligence;
  returns_intelligence?: ReturnsIntelligence;
  procurement_intelligence?: ProcurementIntelligence;
  ai_insights?: string[] | Array<{ type?: string; title?: string; message?: string }>;
}

export const DEFAULT_BI_DATA: BIData = {
  core_kpis: {
    total_revenue: 2118515.75,
    purchase_value: 11885975.3,
    inventory_value: 16508299.03,
    total_units: 369702,
    gross_margin_pct: 28.4,
    total_orders: 804,
    approved_orders: 780,
    pending_orders: 24,
    average_order_value: 148500,
    inventory_turnover_ratio: 4.2,
    inventory_health_score: 82.5,
    active_dealers: 804,
    active_suppliers: 211,
    return_rate_pct: 1.4,
    fulfillment_rate_pct: 96.2,
  },
  sales_intelligence: {
    top_dealer: 'Mehta Distributors (Gurugram)',
    top_salesman: 'RAVINDER KUMAR',
    daily_sales: [
      { date: '2026-09-01', revenue: 101252.59, orders: 20, stock_in: 4455, stock_out: 3240, adjustments: 405 },
      { date: '2026-09-02', revenue: 112156.00, orders: 22, stock_in: 4930, stock_out: 3580, adjustments: 448 },
      { date: '2026-09-03', revenue: 132405.20, orders: 25, stock_in: 5820, stock_out: 4230, adjustments: 529 },
      { date: '2026-09-04', revenue: 147984.56, orders: 28, stock_in: 6510, stock_out: 4735, adjustments: 592 },
      { date: '2026-09-05', revenue: 179124.00, orders: 34, stock_in: 7880, stock_out: 5730, adjustments: 716 },
      { date: '2026-09-06', revenue: 194703.35, orders: 37, stock_in: 8560, stock_out: 6220, adjustments: 778 },
      { date: '2026-09-07', revenue: 124615.50, orders: 24, stock_in: 5480, stock_out: 3980, adjustments: 498 },
      { date: '2026-09-08', revenue: 109041.80, orders: 21, stock_in: 4790, stock_out: 3480, adjustments: 435 },
      { date: '2026-09-09', revenue: 137076.50, orders: 26, stock_in: 6020, stock_out: 4380, adjustments: 547 },
      { date: '2026-09-10', revenue: 163555.30, orders: 31, stock_in: 7190, stock_out: 5220, adjustments: 653 },
      { date: '2026-09-11', revenue: 186914.30, orders: 35, stock_in: 8220, stock_out: 5970, adjustments: 746 },
      { date: '2026-09-12', revenue: 210273.30, orders: 40, stock_in: 9240, stock_out: 6720, adjustments: 840 },
      { date: '2026-09-13', revenue: 171334.30, orders: 33, stock_in: 7530, stock_out: 5470, adjustments: 684 },
      { date: '2026-09-14', revenue: 147984.56, orders: 29, stock_in: 6511, stock_out: 4735, adjustments: 592 },
    ],
    revenue_by_category: [
      { category: 'HAHN', revenue: 645000 },
      { category: 'FINOLEX', revenue: 520000 },
      { category: 'FLOTO', revenue: 385000 },
      { category: 'UNIK', revenue: 320000 },
      { category: 'GRAVITY', revenue: 140000 },
      { category: 'AKG', revenue: 65000 },
      { category: 'TARUN', revenue: 43515.75 },
    ],
    dealer_rankings: [
      { dealer: 'Mehta Distributors (Gurugram)', revenue: 345000 },
      { dealer: 'Dubey & Sons (Noida)', revenue: 295000 },
      { dealer: 'A 2 Z Paint and Hardware (Delhi)', revenue: 260000 },
      { dealer: 'Nagar Distributors (Panipat)', revenue: 210000 },
      { dealer: 'Aggarwal Sanitary (Faridabad)', revenue: 185000 },
      { dealer: 'Sharma Metal Mart (Rohtak)', revenue: 165000 },
      { dealer: 'Gupta Hardware (Hisar)', revenue: 140000 },
      { dealer: 'Goyal Pipe Center (Ambala)', revenue: 125000 },
      { dealer: 'Apex Sanitation (Karnal)', revenue: 112000 },
      { dealer: 'Krishna Hardware (Rewari)', revenue: 98000 },
      { dealer: 'Royal Sanitary House (Sonipat)', revenue: 89000 },
      { dealer: 'Modern Traders (Bhiwani)', revenue: 82000 },
      { dealer: 'Vikas Hardware & Paint (Sirsa)', revenue: 76000 },
      { dealer: 'Shree Ram Pipe Store (Jind)', revenue: 69000 },
      { dealer: 'City Sanitary Store (Yamunanagar)', revenue: 63000 },
      { dealer: 'Singla Fitting Center (Fatehabad)', revenue: 58000 },
      { dealer: 'Chawla Plumbing Mart (Panchkula)', revenue: 52000 },
      { dealer: 'Verma Pipe Depot (Kurukshetra)', revenue: 47000 },
      { dealer: 'Shalimar Sanitary (Palwal)', revenue: 43000 },
      { dealer: 'Balaji Hardware (Jhajjar)', revenue: 39000 },
      { dealer: 'National Tube Corp (Delhi)', revenue: 35000 },
      { dealer: 'Star Hardware Stores (Meerut)', revenue: 31000 },
      { dealer: 'Swastik Sanitary (Kaithal)', revenue: 27500 },
    ],
    salesman_performance: [
      { salesman: 'RAVINDER KUMAR', revenue: 720000 },
      { salesman: 'ANKIT', revenue: 540000 },
      { salesman: 'NALKA', revenue: 410000 },
      { salesman: 'SAURAV', revenue: 280000 },
      { salesman: 'CHANDRA PRAKASH', revenue: 168515.75 },
    ],
    top_products: [
      { sku: 'TLY-001833', name: 'HARLEY SEAT COVER WHITE', qty: 1450 },
      { sku: 'TLY-002652', name: 'POP UP WASTE COUPLING 6" (Brass) - HAHN', qty: 1200 },
      { sku: 'TLY-001638', name: 'G.I REDUCING ELBOW 3/4"X1/2"', qty: 980 },
      { sku: 'TLY-003116', name: 'SHORT EXCESS', qty: 850 },
      { sku: 'TLY-000679', name: 'CHANNEL', qty: 720 },
      { sku: 'TLY-002471', name: 'O/H SHOWER SONET 6"', qty: 680 },
      { sku: 'TLY-001477', name: 'F-SHARON-FULL PEDESTAL (AGL)', qty: 610 },
      { sku: 'TLY-003788', name: 'THAR 750 LTR TANK', qty: 540 },
      { sku: 'TLY-002061', name: 'KALAHARI DF SET - SUPERFLO', qty: 490 },
      { sku: 'TLY-001832', name: 'HARLEY SEAT COVER IVORY', qty: 450 },
      { sku: 'TLY-000680', name: 'CHARITY FAUCET', qty: 410 },
      { sku: 'TLY-003111', name: 'SHARON WALL HUNG BASIN (AGL)', qty: 380 },
    ],
  },
  inventory_intelligence: {
    total_skus: 4315,
    low_stock: 354,
    out_of_stock: 2095,
    overstock: 24,
    top_movers: [
      { name: 'HARLEY SEAT COVER WHITE', sku: 'TLY-001833', units_sold: 1450 },
      { name: 'POP UP WASTE COUPLING 6" (Brass)', sku: 'TLY-002652', units_sold: 1200 },
      { name: 'G.I REDUCING ELBOW 3/4"X1/2"', sku: 'TLY-001638', units_sold: 980 },
      { name: 'SHORT EXCESS', sku: 'TLY-003116', units_sold: 850 },
    ],
  },
  returns_intelligence: {
    total_returns: 14,
    return_reasons: {
      'Transit Impact Damage': 6,
      'Dimension Discrepancy': 4,
      'Surface Finish Scratch': 3,
      'Model Packaging Mismatch': 1,
    },
  },
  procurement_intelligence: {
    purchase_value: 11885975.3,
    total_suppliers: 211,
    top_suppliers: [
      { supplier: 'FINOLEX PIPES & FITTINGS', value: 4250000 },
      { supplier: 'HAHN BRASS INDUSTRIES', value: 3650000 },
      { supplier: 'FLOTO SANITARYWARE', value: 2100000 },
      { supplier: 'ADVANCE METALS CO', value: 1885975.3 },
      { supplier: 'UNIK FITTINGS INDIA', value: 1620000 },
      { supplier: 'AKG EXTRUSIONS PVT LTD', value: 1440000 },
      { supplier: 'AQUAGENICS R&D INDIA', value: 1280000 },
      { supplier: 'CHIRAG INTERNATIONAL', value: 1150000 },
      { supplier: 'AJAY CHEMICAL & PACKER', value: 980000 },
      { supplier: 'BANBRO ENTERPRISES', value: 890000 },
      { supplier: 'BMR SALES LLP', value: 780000 },
      { supplier: 'BHARAJ INNOVATION', value: 690000 },
      { supplier: 'CIMPRESS INDIA PVT LTD', value: 620000 },
      { supplier: 'Anand International', value: 550000 },
      { supplier: 'Balaji Vsm Group', value: 490000 },
      { supplier: 'Berlina Graphics & Packaging', value: 440000 },
      { supplier: 'Cefforts India Supply', value: 390000 },
      { supplier: 'COCOBLU RETAIL LIMITED', value: 350000 },
      { supplier: 'Clicktech Retail Private Limited', value: 310000 },
      { supplier: 'B.R. Maheswari & Co', value: 280000 },
      { supplier: 'Amazon Wholesale India', value: 250000 },
      { supplier: 'AMAZON SELLER SERVICES', value: 220000 },
      { supplier: 'Computer Service Centre', value: 195000 },
    ],
  },
  ai_insights: [
    { type: 'warning', title: 'Inventory Replenishment Alert', message: '354 active SKUs are currently running under safety stock levels (<10 units). Restock recommended for HAHN & FINOLEX lines.' },
    { type: 'success', title: 'Healthy Stock Distribution', message: '1,272 SKUs (82.5% health rating) maintain optimal buffers with steady dispatch velocity.' },
    { type: 'info', title: 'Regional Expansion Opportunity', message: 'Haryana leads with 586 dealers (72.8% of network). Rapid distribution growth observed across Delhi NCR and Western UP.' },
    { type: 'info', title: 'Vendor Diversity Strength', message: '211 certified manufacturing partners connected, maintaining an average lead time of 2.8 days within SLA targets.' },
  ],
};

interface BiDataContextType {
  biData: BIData;
  loading: boolean;
  isOffline: boolean;
  inventoryList: any[];
  categoriesList: any[];
  dealersList: any[];
  suppliersList: any[];
  returnsList: any[];
  ordersList: any[];
  inwardsList: any[];
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
  const [biData, setBiData] = useState<BIData>(DEFAULT_BI_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [dealersList, setDealersList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [inwardsList, setInwardsList] = useState<any[]>([]);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [biRes, invRes, catRes, dlrRes, supRes, retRes, ordRes, inwRes] = await Promise.allSettled([
        fetch('/api/analytics/bi').then(r => r.ok ? r.json() : null),
        fetch('/api/inventory').then(r => r.ok ? r.json() : []),
        fetch('/api/categories').then(r => r.ok ? r.json() : []),
        fetch('/api/dealers?limit=1000').then(r => r.ok ? r.json() : []),
        fetch('/api/suppliers').then(r => r.ok ? r.json() : []),
        fetch('/api/returns').then(r => r.ok ? r.json() : []),
        fetch('/api/orders').then(r => r.ok ? r.json() : []),
        fetch('/api/inwards').then(r => r.ok ? r.json() : []),
      ]);

      if (biRes.status === 'fulfilled' && biRes.value && Object.keys(biRes.value).length > 0) {
        setBiData(biRes.value);
        setIsOffline(false);
      } else {
        setBiData(DEFAULT_BI_DATA);
        setIsOffline(true);
      }

      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) {
        setInventoryList(invRes.value);
      }
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value)) {
        setCategoriesList(catRes.value);
      }
      if (dlrRes.status === 'fulfilled' && dlrRes.value) {
        const dData = dlrRes.value;
        const list = Array.isArray(dData) ? dData : (dData.dealers || dData.customers || []);
        setDealersList(list);
      }
      if (supRes.status === 'fulfilled' && Array.isArray(supRes.value)) {
        setSuppliersList(supRes.value);
      }
      if (retRes.status === 'fulfilled' && Array.isArray(retRes.value)) {
        setReturnsList(retRes.value);
      }
      if (ordRes.status === 'fulfilled' && Array.isArray(ordRes.value)) {
        setOrdersList(ordRes.value);
      }
      if (inwRes.status === 'fulfilled' && Array.isArray(inwRes.value)) {
        setInwardsList(inwRes.value);
      }
    } catch {
      setBiData(DEFAULT_BI_DATA);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const kpis = useMemo(() => ({ ...DEFAULT_BI_DATA.core_kpis, ...(biData.core_kpis || {}) }), [biData.core_kpis]);
  const sales = useMemo(() => ({ ...DEFAULT_BI_DATA.sales_intelligence, ...(biData.sales_intelligence || {}) }), [biData.sales_intelligence]);
  const inv = useMemo(() => ({ ...DEFAULT_BI_DATA.inventory_intelligence, ...(biData.inventory_intelligence || {}) }), [biData.inventory_intelligence]);
  const ret = useMemo(() => ({ ...DEFAULT_BI_DATA.returns_intelligence, ...(biData.returns_intelligence || {}) }), [biData.returns_intelligence]);
  const proc = useMemo(() => ({ ...DEFAULT_BI_DATA.procurement_intelligence, ...(biData.procurement_intelligence || {}) }), [biData.procurement_intelligence]);

  const aiFeed = useMemo(() => {
    if (Array.isArray(biData.ai_insights) && biData.ai_insights.length > 0) {
      return biData.ai_insights.map((item: any) =>
        typeof item === 'string'
          ? { type: 'info', title: 'AI Operational Insight', message: item }
          : item
      );
    }
    return DEFAULT_BI_DATA.ai_insights as any[];
  }, [biData.ai_insights]);

  const skuMap = useMemo(() => {
    const map: Record<string, { name: string; category: string; price: number }> = {};
    inventoryList.forEach(p => {
      const skuKey = p.SKU ? String(p.SKU).trim().toLowerCase() : '';
      if (skuKey) {
        map[skuKey] = {
          name: p['Item Name'] || p.name || p.SKU,
          category: p.Category || p.category || 'General',
          price: Number(p.Price || p.price || 0)
        };
      }
    });
    return map;
  }, [inventoryList]);

  return (
    <BiDataContext.Provider
      value={{
        biData,
        loading,
        isOffline,
        inventoryList,
        categoriesList,
        dealersList,
        suppliersList,
        returnsList,
        ordersList,
        inwardsList,
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
