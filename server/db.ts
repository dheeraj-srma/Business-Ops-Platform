import fs from 'fs';
import path from 'path';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'staff';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  description: string;
  unit: string;
  current_stock: number; // Physical Stock
  reserved_stock?: number; // Reserved for open Tally Sales Orders
  minimum_stock: number;
  critical_stock: number;
  unit_cost: number;
  standard_selling_price?: number;
  valuation_method?: string;
  stock_group?: string;
  tally_guid?: string;
  tally_master_id?: string;
  last_synced_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockTransactionRow {
  id: string;
  product_id: string;
  transaction_type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT_INCREASE' | 'ADJUSTMENT_DECREASE' | 'INITIAL_STOCK' | 'CUSTOMER_RETURN';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  supplier_or_recipient: string;
  reference_number: string;
  notes?: string;
  source?: 'MANUAL' | 'TALLY' | 'IMPORT' | 'SYSTEM';
  external_reference?: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
}

export interface ExportRow {
  id: string;
  export_type: 'FULL' | 'INCREMENTAL' | 'CUSTOM_RANGE';
  export_format: 'JSON' | 'XML';
  product_count: number;
  date_from?: string;
  date_to?: string;
  file_name: string;
  file_content?: string;
  status: 'COMPLETED' | 'FAILED';
  exported_by: string;
  error_summary?: string;
  created_at: string;
}

export interface ExportItemRow {
  id: string;
  export_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  stock_quantity: number;
  product_updated_at: string;
}

export interface SettingsRow {
  company_name: string;
  tally_company_name: string;
  default_critical_threshold: number;
  default_minimum_threshold: number;
  tally_xml_guid_prefix: string;
  last_export_checkpoint?: string;
  allow_negative_orders?: boolean;
}

export interface TallyConnectionRow {
  id: string;
  name: string;
  server_url: string;
  port: number;
  company_name: string;
  integration_mode: 'POLLING' | 'EVENT_BASED';
  data_format: 'JSON' | 'XML';
  api_key?: string;
  webhook_secret?: string;
  is_active: boolean;
  auto_sync: boolean;
  sync_interval_seconds: number;
  connection_status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  last_checked_at?: string;
  last_sync_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface TallyProductMappingRow {
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

export interface SyncEventRow {
  id: string;
  connection_id: string;
  source_system: string; // 'TALLY'
  external_transaction_id: string; // e.g. 'SO-1024', 'INV-2041'
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

export interface SyncCheckpointRow {
  id: string;
  connection_id: string;
  transaction_type: string;
  last_successful_sync: string;
  last_external_transaction_id: string;
  checkpoint_data?: string;
  created_at: string;
  updated_at: string;
}

export type ReservationStatus =
  | 'ACTIVE'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'RELEASED';

export interface StockReservationRow {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  source_transaction_id: string;
  external_order_id: string; // e.g. 'SO-1024'
  customer_name?: string;
  reserved_quantity: number;
  fulfilled_quantity: number;
  released_quantity: number;
  status: ReservationStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VoucherMappingRuleRow {
  id: string;
  tally_voucher_type: string; // 'Sales Order', 'Sales Invoice', 'Delivery Note', 'Purchase Invoice', 'Sales Return', 'Purchase Return'
  inventory_action:
    | 'RESERVE_STOCK'
    | 'REDUCE_STOCK_FULFILL_RESERVATION'
    | 'REDUCE_STOCK_DIRECT'
    | 'INCREASE_STOCK'
    | 'DECREASE_STOCK';
  description: string;
  is_enabled: boolean;
}

// ----------------------------------------------------
// NEW TALLY INTEGRATION MODELS
// ----------------------------------------------------

export interface TallyCompanyRow {
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

export interface TallyStockGroupRow {
  id: string;
  tally_guid: string;
  name: string;
  parent_group?: string;
  hierarchy_path?: string;
  is_active: boolean;
  last_synced_at: string;
}

export interface TallyUnitRow {
  id: string;
  name: string;
  symbol: string;
  formal_name?: string;
  decimal_places: number;
  is_compound?: boolean;
  conversion_factor?: number;
  last_synced_at: string;
}

export interface TallyGodownRow {
  id: string;
  tally_guid: string;
  name: string;
  parent_godown?: string;
  address?: string;
  is_primary?: boolean;
  total_items?: number;
  total_stock_value?: number;
  last_synced_at: string;
}

export interface TallyGodownStockRow {
  id: string;
  godown_id: string;
  godown_name: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  rate: number;
  value: number;
  batch_name?: string;
  last_updated_at: string;
}

export interface TallyLedgerRow {
  id: string;
  tally_guid: string;
  name: string;
  parent_group: string; // 'Sundry Debtors', 'Sundry Creditors', 'Sales Accounts', 'Bank Accounts', etc.
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

export interface TallyPartyRow {
  id: string;
  tally_guid: string;
  ledger_id: string;
  party_type: 'CUSTOMER' | 'SUPPLIER'; // Customer = Sundry Debtors, Supplier = Sundry Creditors
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

export interface TallyVoucherItemRow {
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

export interface TallyVoucherRow {
  id: string;
  tally_guid: string;
  voucher_master_id?: string;
  voucher_number: string;
  voucher_type: string; // 'Sales', 'Purchase', 'Credit Note', 'Debit Note', 'Receipt Note', 'Delivery Note', 'Stock Journal', 'Payment', 'Receipt'
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
  items: TallyVoucherItemRow[];
  created_at: string;
  last_synced_at: string;
}

export interface SyncHistoryLogRow {
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

export interface ProcessedOrderRow {
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

export interface ProcessedOrderItemRow {
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

export interface CouponRow {
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

export interface DatabaseState {
  users: UserRow[];
  categories: CategoryRow[];
  products: ProductRow[];
  stock_transactions: StockTransactionRow[];
  exports: ExportRow[];
  export_items: ExportItemRow[];
  settings: SettingsRow;
  tally_connections: TallyConnectionRow[];
  tally_product_mappings: TallyProductMappingRow[];
  sync_events: SyncEventRow[];
  sync_checkpoints: SyncCheckpointRow[];
  stock_reservations: StockReservationRow[];
  voucher_rules: VoucherMappingRuleRow[];
  tally_companies: TallyCompanyRow[];
  tally_stock_groups: TallyStockGroupRow[];
  tally_units: TallyUnitRow[];
  tally_godowns: TallyGodownRow[];
  tally_godown_stocks: TallyGodownStockRow[];
  tally_ledgers: TallyLedgerRow[];
  tally_parties: TallyPartyRow[];
  tally_vouchers: TallyVoucherRow[];
  sync_history_logs: SyncHistoryLogRow[];
  processed_orders: ProcessedOrderRow[];
  processed_order_items: ProcessedOrderItemRow[];
  coupons: CouponRow[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'inventory_db.json');

class TransactionalDatabase {
  private state: DatabaseState;
  private isLocked: boolean = false;

  constructor() {
    this.state = this.loadOrCreate();
  }

  private loadOrCreate(): DatabaseState {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseState;
        
        // If products are legacy dummy sample (< 50), load full master inventory
        if (!parsed.products || parsed.products.length < 50) {
          return this.generateSeedData();
        }

        // Schema migrations & defaults
        if (!parsed.tally_connections) parsed.tally_connections = [];
        if (!parsed.tally_product_mappings) parsed.tally_product_mappings = [];
        if (!parsed.sync_events) parsed.sync_events = [];
        if (!parsed.sync_checkpoints) parsed.sync_checkpoints = [];
        if (!parsed.stock_reservations) parsed.stock_reservations = [];
        if (!parsed.voucher_rules) parsed.voucher_rules = [];
        if (!parsed.tally_companies) parsed.tally_companies = [];
        if (!parsed.tally_stock_groups) parsed.tally_stock_groups = [];
        if (!parsed.tally_units) parsed.tally_units = [];
        if (!parsed.tally_godowns) parsed.tally_godowns = [];
        if (!parsed.tally_godown_stocks) parsed.tally_godown_stocks = [];
        if (!parsed.tally_ledgers) parsed.tally_ledgers = [];
        if (!parsed.tally_parties) parsed.tally_parties = [];
        if (!parsed.tally_vouchers) parsed.tally_vouchers = [];
        if (!parsed.sync_history_logs) parsed.sync_history_logs = [];
        if (!parsed.processed_orders) parsed.processed_orders = [];
        if (!parsed.processed_order_items) parsed.processed_order_items = [];
        if (!parsed.coupons) {
          parsed.coupons = [
            {
              id: 'cpn-1',
              product_name: 'Brass Bib Cock 15mm Premium',
              category: 'Taps, Cocks & Mixers',
              brand_name: 'Nalka Metal',
              series_name: 'BL09',
              coupon_amount: 5,
              coupons_used: 120,
              notes: 'Redeemed during plumber loyalty drive Q1',
              created_by_id: 'usr-1',
              created_by_name: 'Director (Operations)',
              created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
            },
            {
              id: 'cpn-2',
              product_name: 'Angle Valve Chrome Heavy',
              category: 'Taps, Cocks & Mixers',
              brand_name: 'Nalka Metal',
              series_name: 'BL10',
              coupon_amount: 10,
              coupons_used: 85,
              notes: 'Retailer loyalty scheme',
              created_by_id: 'usr-1',
              created_by_name: 'Director (Operations)',
              created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
            },
            {
              id: 'cpn-3',
              product_name: 'Concealed Stop Cock 20mm',
              category: 'Taps, Cocks & Mixers',
              brand_name: 'Apex Precision',
              series_name: 'BL11',
              coupon_amount: 20,
              coupons_used: 40,
              notes: 'Promotional series for contractor network',
              created_by_id: 'usr-1',
              created_by_name: 'Director (Operations)',
              created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
            },
            {
              id: 'cpn-4',
              product_name: 'Sink Mixer Wall Mounted Swivel',
              category: 'Taps, Cocks & Mixers',
              brand_name: 'Nalka Metal',
              series_name: 'BL12',
              coupon_amount: 50,
              coupons_used: 35,
              notes: 'Direct packaging scratch coupon',
              created_by_id: 'usr-1',
              created_by_name: 'Director (Operations)',
              created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
            },
            {
              id: 'cpn-5',
              product_name: 'Overhead Rain Shower 8x8 Brass',
              category: 'Showers & Accessories',
              brand_name: 'Jaquar Allied',
              series_name: 'BL13',
              coupon_amount: 100,
              coupons_used: 20,
              notes: 'Sanitary fittings installer program',
              created_by_id: 'usr-1',
              created_by_name: 'Director (Operations)',
              created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
            },
            {
              id: 'cpn-6',
              product_name: 'Thermostatic Bath & Shower Mixer',
              category: 'Luxury Bath',
              brand_name: 'Nalka Metal',
              series_name: 'BL14',
              coupon_amount: 500,
              coupons_used: 10,
              notes: 'High-end series contractor voucher',
              created_by_id: 'usr-1',
              created_by_name: 'Director (Operations)',
              created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
            },
            {
              id: 'cpn-7',
              product_name: 'Sensor Basin Tap Automatic',
              category: 'Commercial Fittings',
              brand_name: 'Apex Precision',
              series_name: 'BL15',
              coupon_amount: 1000,
              coupons_used: 5,
              notes: 'Commercial institutional project rebate',
              created_by_id: 'usr-1',
              created_by_name: 'Director (Operations)',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        }

        // Ensure settings has allow_negative_orders
        if (parsed.settings) {
          if (parsed.settings.allow_negative_orders === undefined) {
            parsed.settings.allow_negative_orders = false;
          }
        }

        // Ensure products have reserved_stock and Tally fields defined
        if (Array.isArray(parsed.products)) {
          for (const p of parsed.products) {
            if (p.reserved_stock === undefined) p.reserved_stock = 0;
            if (p.valuation_method === undefined) p.valuation_method = 'Avg Cost';
            if (p.standard_selling_price === undefined) p.standard_selling_price = Math.round(p.unit_cost * 1.25);
          }
        }

        // If tally connections is empty, seed defaults
        if (parsed.tally_connections.length === 0) {
          const seed = this.generateSeedData();
          parsed.tally_connections = seed.tally_connections;
          parsed.tally_product_mappings = seed.tally_product_mappings;
          parsed.voucher_rules = seed.voucher_rules;
          parsed.sync_events = seed.sync_events;
          parsed.stock_reservations = seed.stock_reservations;
          parsed.sync_checkpoints = seed.sync_checkpoints;
          parsed.tally_companies = seed.tally_companies;
          parsed.tally_stock_groups = seed.tally_stock_groups;
          parsed.tally_units = seed.tally_units;
          parsed.tally_godowns = seed.tally_godowns;
          parsed.tally_godown_stocks = seed.tally_godown_stocks;
          parsed.tally_ledgers = seed.tally_ledgers;
          parsed.tally_parties = seed.tally_parties;
          parsed.tally_vouchers = seed.tally_vouchers;
          parsed.sync_history_logs = seed.sync_history_logs;
        }

        return parsed;
      } catch (err) {
        console.error('Failed reading DB file, reinitializing default seed:', err);
      }
    }

    const defaultSeed = this.generateSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultSeed, null, 2), 'utf-8');
    return defaultSeed;
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database to disk:', err);
    }
  }

  public reload(): DatabaseState {
    this.state = this.loadOrCreate();
    return this.state;
  }

  public resetSeed() {
    this.state = this.generateSeedData();
    this.persist();
    return this.state;
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public ensureProducts(): void {
    if (!this.state.products || this.state.products.length === 0) {
      console.warn('[DB] Products list is empty! Auto-recovering products from master catalog...');
      const seed = this.generateSeedData();
      if (seed && seed.products && seed.products.length > 0) {
        this.state.products = seed.products;
        if (!this.state.categories || this.state.categories.length === 0) {
          this.state.categories = seed.categories;
        }
        this.persist();
      }
    }
  }

  // --- Safe Transaction Runner with Mutex & Rollback ---
  public async transaction<T>(callback: (db: DatabaseState) => T | Promise<T>): Promise<T> {
    while (this.isLocked) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.isLocked = true;
    const snapshot = JSON.stringify(this.state);

    try {
      const result = await callback(this.state);
      this.persist();
      return result;
    } catch (err) {
      this.state = JSON.parse(snapshot); // Rollback state
      throw err;
    } finally {
      this.isLocked = false;
    }
  }

  // --- Seed Data Generator with Realistic Inventory & History ---
  private generateSeedData(): DatabaseState {
    const dbFilePath = path.join(DATA_DIR, 'inventory_db.json');
    if (fs.existsSync(dbFilePath)) {
      try {
        const raw = fs.readFileSync(dbFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseState;
        if (parsed.products && parsed.products.length > 50) {
          return parsed;
        }
      } catch (err) {
        console.error('Error reading inventory_db.json in seed:', err);
      }
    }

    const masterPath = path.join(process.cwd(), 'server', 'nalka_master.json');
    if (fs.existsSync(masterPath)) {
      try {
        const content = fs.readFileSync(masterPath, 'utf-8');
        const parsed = JSON.parse(content) as any;
        if (parsed.products && parsed.products.length > 50) {
          return parsed;
        }
      } catch (err) {
        console.error('Error reading nalka_master.json:', err);
      }
    }

    const now = new Date();
    const isoNow = now.toISOString();

    const users: UserRow[] = [
      {
        id: 'usr-1',
        name: 'Rajesh Sharma',
        email: 'rajesh.sharma@apexenterprise.com',
        role: 'manager',
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        updated_at: isoNow,
      },
      {
        id: 'usr-2',
        name: 'Amit Verma',
        email: 'amit.verma@apexenterprise.com',
        role: 'staff',
        is_active: true,
        created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
        updated_at: isoNow,
      },
    ];

    const categories: CategoryRow[] = [
      {
        id: 'cat-1',
        name: 'Bathroom Fittings',
        description: 'Brass & chrome precision valves, bib cocks, faucets, and mixers',
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        updated_at: isoNow,
      },
      {
        id: 'cat-2',
        name: 'Plumbing & Pipes',
        description: 'CPVC, UPVC pipes, high-pressure fittings and union joints',
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        updated_at: isoNow,
      },
      {
        id: 'cat-3',
        name: 'Electrical Accessories',
        description: 'Industrial switches, copper wiring spools, MCB units and conduits',
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        updated_at: isoNow,
      },
      {
        id: 'cat-4',
        name: 'Fasteners & Hardware',
        description: 'Stainless steel hex bolts, anchors, wall plugs and brackets',
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        updated_at: isoNow,
      },
      {
        id: 'cat-5',
        name: 'Paints & Sealants',
        description: 'Silicone sealants, epoxy adhesives, primer cans and waterproofing',
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        updated_at: isoNow,
      },
    ];

    const products: ProductRow[] = [
      {
        id: 'prod-1',
        sku: 'BF-AV-01',
        name: 'Angle Valve 1/2" Brass Chrome',
        category_id: 'cat-1',
        description: 'Heavy duty quarter turn brass angle valve with wall flange',
        unit: 'Pieces',
        current_stock: 145,
        minimum_stock: 30,
        critical_stock: 10,
        unit_cost: 320,
        is_active: true,
        created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 'prod-2',
        sku: 'BF-BC-02',
        name: 'Bib Cock 2-in-1 Wall Mount',
        category_id: 'cat-1',
        description: 'Dual outlet bib cock with health faucet connection port',
        unit: 'Pieces',
        current_stock: 18,
        minimum_stock: 25,
        critical_stock: 8,
        unit_cost: 650,
        is_active: true,
        created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 'prod-3',
        sku: 'BF-OHS-03',
        name: 'Overhead Rain Shower 8" SS304',
        category_id: 'cat-1',
        description: 'Slim stainless steel 304 anti-clogging silicon nozzles',
        unit: 'Pieces',
        current_stock: 4,
        minimum_stock: 15,
        critical_stock: 5,
        unit_cost: 1150,
        is_active: true,
        created_at: new Date(Date.now() - 26 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      },
      {
        id: 'prod-4',
        sku: 'PP-CPVC-01',
        name: 'CPVC Pipe 1" SDR-11 (3 Meter)',
        category_id: 'cat-2',
        description: 'Hot & cold potable water distribution pipe ASTM D2846',
        unit: 'Meters',
        current_stock: 320,
        minimum_stock: 80,
        critical_stock: 20,
        unit_cost: 180,
        is_active: true,
        created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        id: 'prod-5',
        sku: 'PP-SLV-02',
        name: 'CPVC Solvent Cement Heavy 250ml',
        category_id: 'cat-2',
        description: 'Fast setting medium-bodied orange CPVC cement tin',
        unit: 'Boxes',
        current_stock: 0,
        minimum_stock: 12,
        critical_stock: 4,
        unit_cost: 210,
        is_active: true,
        created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      },
      {
        id: 'prod-6',
        sku: 'EA-CW-01',
        name: 'Copper Wire 2.5 sq mm FR (90m)',
        category_id: 'cat-3',
        description: 'Flame retardant electrolytic grade copper multi-strand spool',
        unit: 'Packs',
        current_stock: 42,
        minimum_stock: 15,
        critical_stock: 5,
        unit_cost: 2450,
        is_active: true,
        created_at: new Date(Date.now() - 24 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 'prod-7',
        sku: 'EA-MCB-02',
        name: 'MCB Single Pole 16A C-Curve',
        category_id: 'cat-3',
        description: '10kA breaking capacity DIN rail mounted circuit breaker',
        unit: 'Pieces',
        current_stock: 85,
        minimum_stock: 20,
        critical_stock: 6,
        unit_cost: 175,
        is_active: true,
        created_at: new Date(Date.now() - 24 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
      {
        id: 'prod-8',
        sku: 'FH-SSB-01',
        name: 'SS304 Hex Bolt M8 x 50mm (Pack of 50)',
        category_id: 'cat-4',
        description: 'Corrosion resistant stainless steel full thread fastener',
        unit: 'Boxes',
        current_stock: 60,
        minimum_stock: 15,
        critical_stock: 5,
        unit_cost: 490,
        is_active: true,
        created_at: new Date(Date.now() - 22 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 'prod-9',
        sku: 'PS-SIL-01',
        name: 'Neutral Silicone Sealant Clear 300ml',
        category_id: 'cat-5',
        description: 'Weatherproof elastic sealant cartridge for glass and sanitary ware',
        unit: 'Pieces',
        current_stock: 6,
        minimum_stock: 20,
        critical_stock: 8,
        unit_cost: 280,
        is_active: true,
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 'prod-10',
        sku: 'PP-BALL-03',
        name: 'UPVC Ball Valve 1.5" Socket End',
        category_id: 'cat-2',
        description: 'High flow PVC quarter turn shut-off valve with ergonomic lever',
        unit: 'Pieces',
        current_stock: 92,
        minimum_stock: 20,
        critical_stock: 5,
        unit_cost: 410,
        is_active: true,
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ];

    const stock_transactions: StockTransactionRow[] = [
      {
        id: 'tx-101',
        product_id: 'prod-1',
        transaction_type: 'INITIAL_STOCK',
        quantity: 100,
        previous_stock: 0,
        new_stock: 100,
        reason: 'Initial system inventory setup',
        supplier_or_recipient: 'Apex Central Warehouse',
        reference_number: 'INIT-2026-01',
        notes: 'Verified against opening physical audit sheet',
        created_by_id: 'usr-1',
        created_by_name: 'Rajesh Sharma',
        created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
      },
      {
        id: 'tx-102',
        product_id: 'prod-1',
        transaction_type: 'STOCK_IN',
        quantity: 65,
        previous_stock: 100,
        new_stock: 165,
        reason: 'Supplier Shipment',
        supplier_or_recipient: 'Jaquar Industrial Vendor Ltd',
        reference_number: 'INV-JQ-8831',
        notes: 'Batch #B26-09. Standard quality inspection passed.',
        created_by_id: 'usr-1',
        created_by_name: 'Rajesh Sharma',
        created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      },
      {
        id: 'tx-103',
        product_id: 'prod-1',
        transaction_type: 'STOCK_OUT',
        quantity: 20,
        previous_stock: 165,
        new_stock: 145,
        reason: 'Customer Order',
        supplier_or_recipient: 'Metro Plaza Renovation Phase 2',
        reference_number: 'SO-MP-1049',
        notes: 'Dispatched via Express Delivery van',
        created_by_id: 'usr-2',
        created_by_name: 'Amit Verma',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 'tx-104',
        product_id: 'prod-2',
        transaction_type: 'INITIAL_STOCK',
        quantity: 40,
        previous_stock: 0,
        new_stock: 40,
        reason: 'Initial Inventory Entry',
        supplier_or_recipient: 'Central Stores',
        reference_number: 'INIT-2026-02',
        created_by_id: 'usr-1',
        created_by_name: 'Rajesh Sharma',
        created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
      },
      {
        id: 'tx-105',
        product_id: 'prod-2',
        transaction_type: 'STOCK_OUT',
        quantity: 22,
        previous_stock: 40,
        new_stock: 18,
        reason: 'Customer Order',
        supplier_or_recipient: 'Skyline Heights Commercial Project',
        reference_number: 'SO-SK-4921',
        notes: 'Bulk plumbing order issue',
        created_by_id: 'usr-2',
        created_by_name: 'Amit Verma',
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 'tx-106',
        product_id: 'prod-3',
        transaction_type: 'INITIAL_STOCK',
        quantity: 25,
        previous_stock: 0,
        new_stock: 25,
        reason: 'Opening Balance',
        supplier_or_recipient: 'Apex Central',
        reference_number: 'INIT-2026-03',
        created_by_id: 'usr-1',
        created_by_name: 'Rajesh Sharma',
        created_at: new Date(Date.now() - 26 * 86400000).toISOString(),
      },
      {
        id: 'tx-107',
        product_id: 'prod-3',
        transaction_type: 'STOCK_OUT',
        quantity: 20,
        previous_stock: 25,
        new_stock: 5,
        reason: 'Customer Order',
        supplier_or_recipient: 'Grand Hyatt Villa Suites',
        reference_number: 'SO-GH-7721',
        created_by_id: 'usr-1',
        created_by_name: 'Rajesh Sharma',
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: 'tx-108',
        product_id: 'prod-3',
        transaction_type: 'ADJUSTMENT_DECREASE',
        quantity: 1,
        previous_stock: 5,
        new_stock: 4,
        reason: 'Damage / Defect on shelf',
        supplier_or_recipient: 'Internal Audit',
        reference_number: 'ADJ-2026-08',
        notes: 'Chrome scratch identified during weekly spot check; moved to scrap buffer',
        created_by_id: 'usr-1',
        created_by_name: 'Rajesh Sharma',
        created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      },
      {
        id: 'tx-109',
        product_id: 'prod-5',
        transaction_type: 'STOCK_OUT',
        quantity: 15,
        previous_stock: 15,
        new_stock: 0,
        reason: 'Production / Installation Consumable',
        supplier_or_recipient: 'Plumbing Service Team A',
        reference_number: 'INT-SRV-901',
        notes: 'Completely exhausted all inventory. Urgent supplier reorder required.',
        created_by_id: 'usr-2',
        created_by_name: 'Amit Verma',
        created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      },
      {
        id: 'tx-110',
        product_id: 'prod-9',
        transaction_type: 'STOCK_OUT',
        quantity: 14,
        previous_stock: 20,
        new_stock: 6,
        reason: 'Customer Order',
        supplier_or_recipient: 'Universal Glass & Glazing',
        reference_number: 'SO-UG-3329',
        created_by_id: 'usr-2',
        created_by_name: 'Amit Verma',
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ];

    const settings: SettingsRow = {
      company_name: 'Apex Industrial Solutions Pvt Ltd',
      tally_company_name: 'Apex Industrial Solutions (2026-27)',
      default_critical_threshold: 5,
      default_minimum_threshold: 20,
      tally_xml_guid_prefix: 'APEX-STOCK-',
      last_export_checkpoint: new Date(Date.now() - 7 * 86400000).toISOString(),
      allow_negative_orders: false,
    };

    const exports: ExportRow[] = [
      {
        id: 'EXP-2026-001',
        export_type: 'FULL',
        export_format: 'XML',
        product_count: 10,
        date_from: new Date(Date.now() - 30 * 86400000).toISOString(),
        date_to: new Date(Date.now() - 7 * 86400000).toISOString(),
        file_name: 'Tally_Inventory_Full_2026-08-14.xml',
        status: 'COMPLETED',
        exported_by: 'Rajesh Sharma',
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
    ];

    const export_items: ExportItemRow[] = products.map((p, idx) => ({
      id: `expitem-${idx + 1}`,
      export_id: 'EXP-2026-001',
      product_id: p.id,
      product_sku: p.sku,
      product_name: p.name,
      stock_quantity: p.current_stock,
      product_updated_at: p.updated_at,
    }));

    const tally_connections: TallyConnectionRow[] = [
      {
        id: 'conn-tally-primary',
        name: 'TallyPrime Head Office (LAN)',
        server_url: 'http://192.168.1.100',
        port: 9000,
        company_name: 'Apex Industrial Solutions (2026-27)',
        integration_mode: 'POLLING',
        data_format: 'JSON',
        api_key: 'tally_live_sec_9938210',
        webhook_secret: 'whsec_tally_apex_2026',
        is_active: true,
        auto_sync: true,
        sync_interval_seconds: 10,
        connection_status: 'CONNECTED',
        last_checked_at: new Date().toISOString(),
        last_sync_at: new Date(Date.now() - 2 * 60000).toISOString(),
        created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const voucher_rules: VoucherMappingRuleRow[] = [
      {
        id: 'vr-1',
        tally_voucher_type: 'Sales Order',
        inventory_action: 'RESERVE_STOCK',
        description: 'Increases reserved stock; decreases available stock without reducing physical warehouse stock.',
        is_enabled: true,
      },
      {
        id: 'vr-2',
        tally_voucher_type: 'Sales Invoice',
        inventory_action: 'REDUCE_STOCK_FULFILL_RESERVATION',
        description: 'Deducts physical stock and releases active sales order reservations for the customer order.',
        is_enabled: true,
      },
      {
        id: 'vr-3',
        tally_voucher_type: 'Delivery Note',
        inventory_action: 'REDUCE_STOCK_FULFILL_RESERVATION',
        description: 'Physical dispatch reduces on-hand warehouse stock and fulfills pending order reservation.',
        is_enabled: true,
      },
      {
        id: 'vr-4',
        tally_voucher_type: 'Purchase',
        inventory_action: 'INCREASE_STOCK',
        description: 'Supplier goods receipt / purchase increases physical stock and recalculates available stock.',
        is_enabled: true,
      },
      {
        id: 'vr-5',
        tally_voucher_type: 'Sales Return',
        inventory_action: 'INCREASE_STOCK',
        description: 'Customer return receipt restores physical inventory to warehouse and updates available stock.',
        is_enabled: true,
      },
      {
        id: 'vr-6',
        tally_voucher_type: 'Purchase Return',
        inventory_action: 'DECREASE_STOCK',
        description: 'Debit note / return to vendor reduces physical inventory with negative-stock prevention.',
        is_enabled: true,
      },
    ];

    const tally_product_mappings: TallyProductMappingRow[] = products.map((p, idx) => ({
      id: `map-${idx + 1}`,
      product_id: p.id,
      product_sku: p.sku,
      product_name: p.name,
      tally_stock_item_id: `TALLY-ITEM-${p.sku}`,
      tally_stock_item_name: p.name,
      tally_alias: p.sku,
      mapping_status: 'MAPPED',
      auto_matched: true,
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Add a reservation for prod-1 (Angle Valve)
    const stock_reservations: StockReservationRow[] = [
      {
        id: 'res-101',
        product_id: 'prod-1',
        product_sku: 'BF-AV-01',
        product_name: 'Angle Valve 1/2" Brass Chrome',
        source_transaction_id: 'sync-ev-101',
        external_order_id: 'SO-1024',
        customer_name: 'Godrej Properties Ltd',
        reserved_quantity: 30,
        fulfilled_quantity: 0,
        released_quantity: 0,
        status: 'ACTIVE',
        notes: 'Sales Order SO-1024 synced from Tally - awaiting dispatch',
        created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
    ];

    // Ensure prod-1 reflects the 30 reserved units
    const p1 = products.find((p) => p.id === 'prod-1');
    if (p1) {
      p1.reserved_stock = 30;
    }

    const sync_events: SyncEventRow[] = [
      {
        id: 'sync-ev-101',
        connection_id: 'conn-tally-primary',
        source_system: 'TALLY',
        external_transaction_id: 'SO-1024',
        external_transaction_type: 'SALES_ORDER',
        event_type: 'CREATED',
        payload_hash: 'hash-so-1024-godrej',
        status: 'SYNCED',
        retry_count: 0,
        max_retries: 4,
        received_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        processed_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        normalized_data: {
          external_id: 'SO-1024',
          voucher_type: 'Sales Order',
          normalized_type: 'SALES_ORDER',
          party_name: 'Godrej Properties Ltd',
          items: [{ product_sku: 'BF-AV-01', product_name: 'Angle Valve 1/2" Brass Chrome', quantity: 30 }],
        },
      },
      {
        id: 'sync-ev-102',
        connection_id: 'conn-tally-primary',
        source_system: 'TALLY',
        external_transaction_id: 'PUR-044',
        external_transaction_type: 'PURCHASE_INVOICE',
        event_type: 'CREATED',
        payload_hash: 'hash-pur-044-jaquar',
        status: 'SYNCED',
        retry_count: 0,
        max_retries: 4,
        received_at: new Date(Date.now() - 5 * 3600000).toISOString(),
        processed_at: new Date(Date.now() - 5 * 3600000).toISOString(),
        created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 3600000).toISOString(),
        normalized_data: {
          external_id: 'PUR-044',
          voucher_type: 'Purchase',
          normalized_type: 'PURCHASE_INVOICE',
          party_name: 'Jaquar Industrial Vendor Ltd',
          items: [{ product_sku: 'PP-CPVC-01', product_name: 'CPVC Pipe 1" SDR-11 (3 Meter)', quantity: 50 }],
        },
      },
    ];

    const sync_checkpoints: SyncCheckpointRow[] = [
      {
        id: 'chk-1',
        connection_id: 'conn-tally-primary',
        transaction_type: 'ALL',
        last_successful_sync: new Date(Date.now() - 2 * 60000).toISOString(),
        last_external_transaction_id: 'SO-1024',
        checkpoint_data: JSON.stringify({ lastVoucherDate: new Date().toISOString().slice(0, 10), count: 2 }),
        created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const tally_companies: TallyCompanyRow[] = [
      {
        id: 'comp-1',
        tally_guid: 'tally-comp-apex-2026',
        name: 'Apex Industrial Solutions (2026-27)',
        mailing_name: 'Apex Industrial Solutions Private Limited',
        address: 'Plot 42, Sector 18, Phase IV, Udyog Vihar',
        state: 'Haryana',
        country: 'India',
        pincode: '122015',
        phone: '+91 124 4892000',
        email: 'accounts@apexenterprise.com',
        website: 'https://apexenterprise.com',
        financial_year_start: '2026-04-01',
        books_start: '2026-04-01',
        currency: 'INR (₹)',
        gstin: '06AAACA9821L1ZM',
        pan: 'AAACA9821L',
        tally_version: 'TallyPrime Server Release 4.1',
        last_synced_at: new Date(Date.now() - 2 * 60000).toISOString(),
      },
    ];

    const tally_stock_groups: TallyStockGroupRow[] = [
      { id: 'grp-1', tally_guid: 'grp-bf', name: 'Bathroom Fittings', is_active: true, last_synced_at: new Date().toISOString() },
      { id: 'grp-2', tally_guid: 'grp-pp', name: 'Plumbing & Pipes', is_active: true, last_synced_at: new Date().toISOString() },
      { id: 'grp-3', tally_guid: 'grp-ea', name: 'Electrical Accessories', is_active: true, last_synced_at: new Date().toISOString() },
      { id: 'grp-4', tally_guid: 'grp-fh', name: 'Fasteners & Hardware', is_active: true, last_synced_at: new Date().toISOString() },
      { id: 'grp-5', tally_guid: 'grp-ps', name: 'Paints & Sealants', is_active: true, last_synced_at: new Date().toISOString() },
    ];

    const tally_units: TallyUnitRow[] = [
      { id: 'u-1', name: 'Pieces', symbol: 'PCS', formal_name: 'Pieces', decimal_places: 0, last_synced_at: new Date().toISOString() },
      { id: 'u-2', name: 'Meters', symbol: 'MTR', formal_name: 'Meters', decimal_places: 2, last_synced_at: new Date().toISOString() },
      { id: 'u-3', name: 'Kilograms', symbol: 'KGS', formal_name: 'Kilograms', decimal_places: 2, last_synced_at: new Date().toISOString() },
      { id: 'u-4', name: 'Numbers', symbol: 'NOS', formal_name: 'Numbers', decimal_places: 0, last_synced_at: new Date().toISOString() },
      { id: 'u-5', name: 'Boxes', symbol: 'BOX', formal_name: 'Boxes (100 Pcs)', decimal_places: 0, last_synced_at: new Date().toISOString() },
    ];

    const tally_godowns: TallyGodownRow[] = [
      {
        id: 'gdn-1',
        tally_guid: 'gdn-main',
        name: 'Main Central Godown',
        address: 'Warehouse Block A, Sector 18, Gurgaon',
        is_primary: true,
        total_items: 24,
        total_stock_value: 385000,
        last_synced_at: new Date().toISOString(),
      },
      {
        id: 'gdn-2',
        tally_guid: 'gdn-wh-b',
        name: 'Warehouse B - Dispatch Depot',
        address: 'Transport Nagar, Delhi Bypass',
        is_primary: false,
        total_items: 12,
        total_stock_value: 145000,
        last_synced_at: new Date().toISOString(),
      },
    ];

    const tally_godown_stocks: TallyGodownStockRow[] = [
      {
        id: 'gs-1',
        godown_id: 'gdn-1',
        godown_name: 'Main Central Godown',
        product_id: 'prod-1',
        product_sku: 'BF-AV-01',
        product_name: 'Angle Valve 1/2" Brass Chrome',
        quantity: 110,
        rate: 320,
        value: 35200,
        last_updated_at: new Date().toISOString(),
      },
      {
        id: 'gs-2',
        godown_id: 'gdn-2',
        godown_name: 'Warehouse B - Dispatch Depot',
        product_id: 'prod-1',
        product_sku: 'BF-AV-01',
        product_name: 'Angle Valve 1/2" Brass Chrome',
        quantity: 35,
        rate: 320,
        value: 11200,
        last_updated_at: new Date().toISOString(),
      },
    ];

    const tally_ledgers: TallyLedgerRow[] = [
      {
        id: 'led-1',
        tally_guid: 'led-godrej',
        name: 'Godrej Properties Ltd',
        parent_group: 'Sundry Debtors',
        opening_balance: 145000,
        closing_balance: 215000,
        current_balance: 215000,
        balance_type: 'Dr',
        address: 'Godrej One, Pirojshanagar, Vikhroli East, Mumbai',
        state: 'Maharashtra',
        gstin: '27AABCG1234F1Z8',
        pan: 'AABCG1234F',
        credit_period_days: 30,
        last_synced_at: new Date().toISOString(),
      },
      {
        id: 'led-2',
        tally_guid: 'led-lnt',
        name: 'L&T Construction Infrastructure',
        parent_group: 'Sundry Debtors',
        opening_balance: 350000,
        closing_balance: 480000,
        current_balance: 480000,
        balance_type: 'Dr',
        address: 'Mount Poonamallee Road, Manapakkam, Chennai',
        state: 'Tamil Nadu',
        gstin: '33AABCL2345K1Z9',
        pan: 'AABCL2345K',
        credit_period_days: 45,
        last_synced_at: new Date().toISOString(),
      },
      {
        id: 'led-3',
        tally_guid: 'led-jaquar',
        name: 'Jaquar & Company Pvt Ltd',
        parent_group: 'Sundry Creditors',
        opening_balance: 85000,
        closing_balance: 142000,
        current_balance: 142000,
        balance_type: 'Cr',
        address: 'Plot 306, Phase II, IMT Manesar, Gurugram',
        state: 'Haryana',
        gstin: '06AAACJ4492K1ZO',
        pan: 'AAACJ4492K',
        credit_period_days: 30,
        last_synced_at: new Date().toISOString(),
      },
      {
        id: 'led-4',
        tally_guid: 'led-astral',
        name: 'Astral Poly Technik Ltd',
        parent_group: 'Sundry Creditors',
        opening_balance: 120000,
        closing_balance: 95000,
        current_balance: 95000,
        balance_type: 'Cr',
        address: '207/1, Astral House, B/h Rajpath Club, Ahmedabad',
        state: 'Gujarat',
        gstin: '24AAACA1294F1ZK',
        pan: 'AAACA1294F',
        credit_period_days: 30,
        last_synced_at: new Date().toISOString(),
      },
      {
        id: 'led-5',
        tally_guid: 'led-hdfc',
        name: 'HDFC Bank Current Account',
        parent_group: 'Bank Accounts',
        opening_balance: 840000,
        closing_balance: 1250000,
        current_balance: 1250000,
        balance_type: 'Dr',
        last_synced_at: new Date().toISOString(),
      },
    ];

    const tally_parties: TallyPartyRow[] = [
      {
        id: 'pty-1',
        tally_guid: 'led-godrej',
        ledger_id: 'led-1',
        party_type: 'CUSTOMER',
        name: 'Godrej Properties Ltd',
        opening_balance: 145000,
        closing_balance: 215000,
        outstanding_amount: 215000,
        balance_type: 'Dr',
        address: 'Godrej One, Pirojshanagar, Vikhroli East, Mumbai',
        state: 'Maharashtra',
        gstin: '27AABCG1234F1Z8',
        pan: 'AABCG1234F',
        credit_period_days: 30,
        total_orders_count: 14,
        total_invoiced_value: 840000,
        last_synced_at: new Date().toISOString(),
      },
      {
        id: 'pty-2',
        tally_guid: 'led-lnt',
        ledger_id: 'led-2',
        party_type: 'CUSTOMER',
        name: 'L&T Construction Infrastructure',
        opening_balance: 350000,
        closing_balance: 480000,
        outstanding_amount: 480000,
        balance_type: 'Dr',
        address: 'Mount Poonamallee Road, Manapakkam, Chennai',
        state: 'Tamil Nadu',
        gstin: '33AABCL2345K1Z9',
        pan: 'AABCL2345K',
        credit_period_days: 45,
        total_orders_count: 9,
        total_invoiced_value: 1250000,
        last_synced_at: new Date().toISOString(),
      },
      {
        id: 'pty-3',
        tally_guid: 'led-jaquar',
        ledger_id: 'led-3',
        party_type: 'SUPPLIER',
        name: 'Jaquar & Company Pvt Ltd',
        opening_balance: 85000,
        closing_balance: 142000,
        outstanding_amount: 142000,
        balance_type: 'Cr',
        address: 'Plot 306, Phase II, IMT Manesar, Gurugram',
        state: 'Haryana',
        gstin: '06AAACJ4492K1ZO',
        pan: 'AAACJ4492K',
        credit_period_days: 30,
        total_orders_count: 8,
        total_invoiced_value: 620000,
        last_synced_at: new Date().toISOString(),
      },
      {
        id: 'pty-4',
        tally_guid: 'led-astral',
        ledger_id: 'led-4',
        party_type: 'SUPPLIER',
        name: 'Astral Poly Technik Ltd',
        opening_balance: 120000,
        closing_balance: 95000,
        outstanding_amount: 95000,
        balance_type: 'Cr',
        address: '207/1, Astral House, B/h Rajpath Club, Ahmedabad',
        state: 'Gujarat',
        gstin: '24AAACA1294F1ZK',
        pan: 'AAACA1294F',
        credit_period_days: 30,
        total_orders_count: 11,
        total_invoiced_value: 780000,
        last_synced_at: new Date().toISOString(),
      },
    ];

    const tally_vouchers: TallyVoucherRow[] = [
      {
        id: 'vch-101',
        tally_guid: 'vch-guid-101',
        voucher_number: 'INV-2026-084',
        voucher_type: 'Sales',
        normalized_type: 'SALES_INVOICE',
        date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        party_name: 'Godrej Properties Ltd',
        party_ledger: 'Godrej Properties Ltd',
        reference_number: 'SO-1024',
        billing_address: 'Godrej One, Pirojshanagar, Vikhroli East, Mumbai',
        gstin: '27AABCG1234F1Z8',
        place_of_supply: 'Maharashtra (27)',
        total_amount: 45000,
        tax_amount: 8100,
        status: 'POSTED',
        source_godown: 'Main Central Godown',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        last_synced_at: new Date().toISOString(),
        items: [
          {
            id: 'vchi-1',
            voucher_id: 'vch-101',
            stock_item_name: 'Angle Valve 1/2" Brass Chrome',
            sku: 'BF-AV-01',
            quantity: 30,
            unit: 'PCS',
            rate: 350,
            amount: 10500,
            tax_percentage: 18,
            godown_name: 'Main Central Godown',
          },
          {
            id: 'vchi-2',
            voucher_id: 'vch-101',
            stock_item_name: 'CPVC Pipe 1" SDR-11 (3 Meter)',
            sku: 'PP-CPVC-01',
            quantity: 20,
            unit: 'PCS',
            rate: 450,
            amount: 9000,
            tax_percentage: 18,
            godown_name: 'Main Central Godown',
          },
        ],
      },
      {
        id: 'vch-102',
        tally_guid: 'vch-guid-102',
        voucher_number: 'PUR-2026-044',
        voucher_type: 'Purchase',
        normalized_type: 'PURCHASE_INVOICE',
        date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
        party_name: 'Jaquar & Company Pvt Ltd',
        party_ledger: 'Jaquar & Company Pvt Ltd',
        supplier_invoice_number: 'JAQ/INV/9932',
        supplier_invoice_date: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
        gstin: '06AAACJ4492K1ZO',
        total_amount: 58000,
        tax_amount: 10440,
        status: 'POSTED',
        destination_godown: 'Main Central Godown',
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        last_synced_at: new Date().toISOString(),
        items: [
          {
            id: 'vchi-3',
            voucher_id: 'vch-102',
            stock_item_name: 'Angle Valve 1/2" Brass Chrome',
            sku: 'BF-AV-01',
            quantity: 50,
            unit: 'PCS',
            rate: 290,
            amount: 14500,
            tax_percentage: 18,
            godown_name: 'Main Central Godown',
          },
        ],
      },
    ];

    const sync_history_logs: SyncHistoryLogRow[] = [
      {
        id: 'synclog-1',
        sync_type: 'FULL',
        mode: 'FULL',
        company_name: 'Apex Industrial Solutions (2026-27)',
        started_at: new Date(Date.now() - 2 * 60000).toISOString(),
        completed_at: new Date(Date.now() - 1.8 * 60000).toISOString(),
        status: 'SUCCESS',
        records_processed: 48,
        records_created: 12,
        records_updated: 36,
        records_skipped: 0,
        records_failed: 0,
        details: { company: 1, items: 24, godowns: 2, vouchers: 2, ledgers: 5 },
      },
    ];

    return {
      users,
      categories,
      products,
      stock_transactions,
      exports,
      export_items,
      settings,
      tally_connections,
      tally_product_mappings,
      sync_events,
      sync_checkpoints,
      stock_reservations,
      voucher_rules,
      tally_companies,
      tally_stock_groups,
      tally_units,
      tally_godowns,
      tally_godown_stocks,
      tally_ledgers,
      tally_parties,
      tally_vouchers,
      sync_history_logs,
      processed_orders: [],
      processed_order_items: [],
      coupons: [],
    };
  }
}

export const db = new TransactionalDatabase();

