export type UserRole = 'manager' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type StockStatus = 'HEALTHY' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK' | 'NEGATIVE';

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category_id?: string;
  categoryName?: string;
  category_name?: string;
  stock_group?: string;
  description: string;
  unit: string;
  currentStock: number; // Physical Stock
  current_stock?: number;
  reservedStock?: number; // Open Tally Sales Order reservations
  reserved_stock?: number;
  availableStock?: number; // Physical - Reserved
  available_stock?: number;
  physicalStock?: number; // Current physical
  physical_stock?: number;
  minimumStock: number;
  minimum_stock?: number;
  min_stock_level?: number;
  criticalStock: number;
  critical_stock?: number;
  unitCost: number;
  unit_cost?: number;
  isActive: boolean;
  is_active?: boolean;
  status: StockStatus;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
}

export type TransactionType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'ADJUSTMENT_INCREASE'
  | 'ADJUSTMENT_DECREASE'
  | 'INITIAL_STOCK'
  | 'CUSTOMER_RETURN';

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  categoryName?: string;
  unit: string;
  transactionType: TransactionType;
  quantity: number; // positive delta or magnitude
  previousStock: number;
  newStock: number;
  reason: string;
  supplierOrRecipient: string;
  referenceNumber: string;
  notes?: string;
  source?: 'MANUAL' | 'TALLY' | 'IMPORT' | 'SYSTEM';
  external_reference?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export type ExportType = 'FULL' | 'INCREMENTAL' | 'CUSTOM_RANGE';
export type ExportFormat = 'JSON' | 'XML';
export type ExportStatus = 'COMPLETED' | 'FAILED';

export interface TallyExportRecord {
  id: string;
  exportType: ExportType;
  exportFormat: ExportFormat;
  productCount: number;
  dateFrom?: string;
  dateTo?: string;
  fileName: string;
  status: ExportStatus;
  exportedByName: string;
  downloadUrl?: string;
  errorSummary?: string;
  createdAt: string;
}

export interface TallyExportItem {
  id: string;
  exportId: string;
  productId: string;
  productSku: string;
  productName: string;
  stockQuantity: number;
  productUpdatedAt: string;
}

export interface ValidationIssue {
  productId?: string;
  productSku?: string;
  productName?: string;
  field: string;
  issue: string;
  severity: 'ERROR' | 'WARNING';
}

export interface PreExportValidationReport {
  totalChecked: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  issues: ValidationIssue[];
  canProceed: boolean;
}

export interface DashboardStats {
  totalProducts: number;
  totalActiveSkus: number;
  totalUnitsInStock: number;
  totalStockValue: number;
  healthyCount: number;
  lowStockCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  negativeStockCount?: number;
  movementsToday: number;
  stockAddedThisMonth: number;
  stockIssuedThisMonth: number;
  trend: Array<{
    date: string;
    stockIn: number;
    stockOut: number;
    adjustments: number;
  }>;
  recentMovements: StockTransaction[];
  lowStockItems: Product[];
  categoryBreakdown: Array<{
    name: string;
    count: number;
    units: number;
  }>;
}

export interface AppSettings {
  companyName: string;
  tallyCompanyName: string;
  defaultCriticalThreshold?: number;
  defaultMinimumThreshold?: number;
  defaultCriticalStock?: number;
  defaultMinimumStock?: number;
  tallyXmlGuidPrefix: string;
  lastExportCheckpoint?: string;
  allow_negative_orders?: boolean;
  allowNegativeOrders?: boolean;
  company_name?: string;
  tally_company_name?: string;
  default_critical_threshold?: number;
  default_minimum_threshold?: number;
  tally_xml_guid_prefix?: string;
  last_export_checkpoint?: string;
}

// ----------------------------------------------------
// TALLY LIVE INTEGRATION & SYNC TYPES
// ----------------------------------------------------

export type IntegrationMode = 'POLLING' | 'EVENT_BASED';
export type TallyConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface TallyConnection {
  id: string;
  name: string;
  server_url: string;
  port: number;
  company_name: string;
  integration_mode: IntegrationMode;
  data_format: 'JSON' | 'XML';
  api_key?: string;
  webhook_secret?: string;
  is_active: boolean;
  auto_sync: boolean;
  sync_interval_seconds: number;
  connection_status: TallyConnectionStatus;
  last_checked_at?: string;
  last_sync_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export type ExternalTransactionType =
  | 'SALES_ORDER'
  | 'SALES_INVOICE'
  | 'DELIVERY_NOTE'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'SALES_RETURN'
  | 'STOCK_JOURNAL';

export type SyncEventStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SYNCED'
  | 'FAILED'
  | 'RETRYING'
  | 'IGNORED';

export interface SyncEvent {
  id: string;
  connection_id: string;
  source_system: string;
  external_transaction_id: string;
  external_transaction_type: ExternalTransactionType;
  event_type: 'CREATED' | 'MODIFIED' | 'CANCELLED' | 'SYNC';
  payload_hash: string;
  status: SyncEventStatus;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  last_error?: string;
  raw_payload?: string;
  normalized_data?: any;
  received_at: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export type ReservationStatus =
  | 'ACTIVE'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'RELEASED';

export interface StockReservation {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  source_transaction_id: string;
  external_order_id: string;
  customer_name?: string;
  reserved_quantity: number;
  fulfilled_quantity: number;
  released_quantity: number;
  status: ReservationStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TallyProductMapping {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  tally_stock_item_id: string;
  tally_stock_item_name: string;
  tally_alias?: string;
  mapping_status: 'MAPPED' | 'UNMAPPED' | 'SUGGESTED';
  auto_matched: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoucherMappingRule {
  id: string;
  tally_voucher_type: string;
  inventory_action:
    | 'RESERVE_STOCK'
    | 'REDUCE_STOCK_FULFILL_RESERVATION'
    | 'REDUCE_STOCK_DIRECT'
    | 'INCREASE_STOCK'
    | 'DECREASE_STOCK';
  description: string;
  is_enabled: boolean;
}

export interface TallySyncStatusResponse {
  connection: TallyConnection;
  company?: TallyCompany | null;
  metrics: {
    totalEvents: number;
    syncedEvents: number;
    failedEvents: number;
    processingEvents: number;
    retryingEvents: number;
    activeReservationsCount: number;
    totalReservedUnits: number;
    unmappedMappingsCount: number;
    totalGodowns?: number;
    totalLedgers?: number;
    totalParties?: number;
    totalVouchers?: number;
    lastSyncAt?: string;
    lastCheckedAt?: string;
  };
}

export interface TallyCompany {
  id: string;
  tally_guid: string;
  name: string;
  mailing_name?: string;
  address?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  financial_year_start?: string;
  books_start?: string;
  currency?: string;
  gstin?: string;
  pan?: string;
  tally_version?: string;
  last_synced_at: string;
}

export interface TallyStockGroup {
  id: string;
  tally_guid: string;
  name: string;
  parent_group?: string;
  hierarchy_path?: string;
  is_active: boolean;
  last_synced_at: string;
}

export interface TallyUnit {
  id: string;
  name: string;
  symbol: string;
  formal_name?: string;
  decimal_places: number;
  is_compound?: boolean;
  conversion_factor?: number;
  last_synced_at: string;
}

export interface TallyGodown {
  id: string;
  tally_guid: string;
  name: string;
  parent_godown?: string;
  address?: string;
  is_primary?: boolean;
  total_items?: number;
  total_stock_value?: number;
  itemCount?: number;
  totalUnits?: number;
  calculatedStockValue?: number;
  last_synced_at: string;
}

export interface TallyLedger {
  id: string;
  tally_guid: string;
  name: string;
  parent_group: string;
  opening_balance: number;
  closing_balance: number;
  current_balance: number;
  balance_type: 'Dr' | 'Cr';
  address?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  credit_period_days?: number;
  last_synced_at: string;
}

export interface TallyParty {
  id: string;
  tally_guid: string;
  ledger_id: string;
  party_type: 'CUSTOMER' | 'SUPPLIER';
  name: string;
  opening_balance: number;
  closing_balance: number;
  outstanding_amount: number;
  balance_type: 'Dr' | 'Cr';
  address?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  credit_period_days?: number;
  total_orders_count?: number;
  total_invoiced_value?: number;
  last_synced_at: string;
}

export interface TallyVoucherItem {
  id: string;
  voucher_id: string;
  stock_item_id?: string;
  stock_item_name: string;
  sku?: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_percentage?: number;
  tax_percentage?: number;
  amount: number;
  godown_name?: string;
  batch_name?: string;
}

export interface TallyVoucher {
  id: string;
  tally_guid: string;
  voucher_master_id?: string;
  voucher_number: string;
  voucher_type: string;
  normalized_type: ExternalTransactionType;
  date: string;
  effective_date?: string;
  party_name?: string;
  party_ledger?: string;
  reference_number?: string;
  supplier_invoice_number?: string;
  supplier_invoice_date?: string;
  billing_address?: string;
  shipping_address?: string;
  gstin?: string;
  place_of_supply?: string;
  narration?: string;
  total_amount: number;
  tax_amount?: number;
  discount_amount?: number;
  round_off?: number;
  status: 'POSTED' | 'CANCELLED';
  source_godown?: string;
  destination_godown?: string;
  items: TallyVoucherItem[];
  created_at: string;
  last_synced_at: string;
}

export interface SyncHistoryLog {
  id: string;
  sync_type: 'COMPANY' | 'INVENTORY' | 'STOCK_TRANSACTIONS' | 'SALES' | 'PURCHASES' | 'ACCOUNTING' | 'FULL';
  mode: 'INCREMENTAL' | 'FULL';
  company_name: string;
  started_at: string;
  completed_at: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  error_summary?: string;
  details?: any;
}

export interface TallyFinancialOverview {
  company: TallyCompany;
  metrics: {
    totalSales: number;
    totalPurchases: number;
    salesCount: number;
    purchaseCount: number;
    returnsCount: number;
    totalReceivables: number;
    totalPayables: number;
    cashBalance: number;
    bankBalance: number;
    totalInventoryValue: number;
    totalUnits: number;
    totalProducts: number;
    totalGodowns: number;
    totalLedgers: number;
    totalParties: number;
  };
}

export type RestockUrgency = 'EMERGENCY' | 'CRITICAL' | 'MEDIUM';

export interface RestockPlanItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  unitCost: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  minimumStock: number;
  criticalStock: number;
  targetStock: number;
  deficit: number;
  reorderQuantity: number;
  estimatedCost: number;
  status: StockStatus;
  urgency: RestockUrgency;
  reorderReason: string;
}

export interface RestockCategoryBreakdown {
  name: string;
  count: number;
  restockUnits: number;
  estimatedCost: number;
}

export interface RestockPlanSummary {
  totalItemsToRestock: number;
  negativeCount: number;
  outOfStockCount: number;
  criticalCount: number;
  lowCount: number;
  totalNegativeDeficitUnits: number;
  totalRestockUnits: number;
  estimatedTotalRestockCost: number;
  targetMultiplier: number;
}

export interface RestockPlanResponse {
  summary: RestockPlanSummary;
  categoryBreakdown: RestockCategoryBreakdown[];
  items: RestockPlanItem[];
}

// ----------------------------------------------------
// PENDING & COMPLETED ORDERS (SUPABASE & FILE ENGINE)
// ----------------------------------------------------

export interface OrderPreviewItem {
  id?: string;
  item_name: string;
  category?: string;
  quantity: number;
  price: number;
  total_price: number;
  matched: boolean;
  matchType: 'EXACT' | 'NORMALIZED' | 'MANUAL' | 'UNMATCHED';
  matchedProductId?: string;
  matchedProductSku?: string;
  matchedProductName?: string;
  currentStock: number;
  unit: string;
  hasSufficientStock: boolean;
}

export interface OrderPreview {
  order_id: string;
  salesman_id?: string;
  salesman_name: string;
  shop_name: string;
  city?: string;
  state?: string;
  location_id?: string;
  total_amount: number;
  created_at: string;
  source: 'supabase' | 'file';
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  isDuplicate: boolean;
  alreadyProcessedAt?: string;
  hasUnmatchedItems: boolean;
  hasStockExceeded: boolean;
  items: OrderPreviewItem[];
}

export interface ProcessedOrder {
  id: string;
  order_id: string;
  salesman_id?: string;
  salesman_name: string;
  shop_name: string;
  city?: string;
  state?: string;
  location_id?: string;
  total_amount: number;
  source: 'supabase' | 'file';
  status: 'CONFIRMED' | 'REJECTED';
  processed_at: string;
  processed_by_id?: string;
  processed_by_name?: string;
  items_count: number;
  notes?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessedOrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  sku?: string;
  item_name: string;
  category?: string;
  quantity: number;
  price: number;
  total_price: number;
  matched: boolean;
  stock_deducted: number;
  created_at: string;
}

// ----------------------------------------------------
// TALLY ACCOUNTANT IMPORT & RECONCILIATION
// ----------------------------------------------------

export interface TallyReconciliationItem {
  id: string;
  itemName: string;
  sku?: string;
  categoryName?: string;
  unit: string;
  tallyStock: number;
  nalkaStock: number;
  stockVariance: number;
  tallyRate: number;
  nalkaRate: number;
  rateVariance: number;
  tallyValue: number;
  nalkaValue: number;
  valueVariance: number;
  status: 'IN_SYNC' | 'STOCK_DISCREPANCY' | 'PRICE_CHANGE' | 'NEW_ITEM';
  matchedProductId?: string;
  selected: boolean;
}

export interface TallyImportPreview {
  fileType: 'XML' | 'CSV' | 'JSON';
  fileName?: string;
  summary: {
    totalItems: number;
    inSyncCount: number;
    discrepancyCount: number;
    newItemsCount: number;
    priceChangeCount: number;
    totalNalkaValuation: number;
    totalTallyValuation: number;
    netValuationDiff: number;
  };
  items: TallyReconciliationItem[];
}

export interface TallyImportApplyOptions {
  updateStock: boolean;
  updatePrices: boolean;
  createNewProducts: boolean;
  referenceNote?: string;
  selectedItemIds?: string[];
}

// ----------------------------------------------------
// BRAND COUPONS TYPES
// ----------------------------------------------------

export interface Coupon {
  id: string;
  product_name: string;
  category: string;
  brand_name: string;
  series_name: string;
  coupon_amount: number;
  coupons_used: number;
  notes?: string;
  created_by_id?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CouponStats {
  totalCouponsUsed: number;
  totalDiscountValue: number;
  totalBrands: number;
  totalSeries: number;
  brandBreakdown: Array<{ brand: string; count: number; totalValue: number }>;
  categoryBreakdown: Array<{ category: string; count: number; totalValue: number }>;
}

export const COUPON_CATALOG = [
  { name: 'BL09', price: 5 },
  { name: 'BL10', price: 10 },
  { name: 'BL11', price: 20 },
  { name: 'BL12', price: 50 },
  { name: 'BL13', price: 100 },
  { name: 'BL14', price: 500 },
  { name: 'BL15', price: 1000 },
] as const;

export type CouponName = (typeof COUPON_CATALOG)[number]['name'];

export const COUPON_PRICE_MAP: Record<string, number> = {
  BL09: 5,
  BL10: 10,
  BL11: 20,
  BL12: 50,
  BL13: 100,
  BL14: 500,
  BL15: 1000,
};

export interface CustomCouponOption {
  name: string;
  price: number;
}

export const LOCAL_STORAGE_CUSTOM_COUPONS_KEY = 'nalka_custom_coupons';

export const getCustomCoupons = (): CustomCouponOption[] => {
  const list: CustomCouponOption[] = [...COUPON_CATALOG];
  if (typeof window === 'undefined' || !window.localStorage) {
    return list;
  }
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_CUSTOM_COUPONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const names = new Set(list.map((c) => c.name.toUpperCase()));
        for (const item of parsed) {
          if (item?.name && typeof item?.price !== 'undefined' && !names.has(item.name.toUpperCase())) {
            list.push({ name: item.name.toUpperCase(), price: Number(item.price) });
            names.add(item.name.toUpperCase());
          }
        }
      }
    }
  } catch {}
  return list;
};

export const saveCustomCoupon = (name: string, price: number): CustomCouponOption[] => {
  const list = getCustomCoupons();
  const trimmed = name.trim().toUpperCase();
  const existingIdx = list.findIndex((c) => c.name.toUpperCase() === trimmed);
  if (existingIdx !== -1) {
    list[existingIdx] = { name: trimmed, price: Number(price) };
  } else {
    list.push({ name: trimmed, price: Number(price) });
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_COUPONS_KEY, JSON.stringify(list));
    } catch {}
  }
  return list;
};

