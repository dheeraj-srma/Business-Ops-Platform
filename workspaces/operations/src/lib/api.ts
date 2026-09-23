import { recordStockOut as sharedRecordStockOut } from '@/shared/api/inventory';
import {
  DashboardStats,
  Product,
  StockTransaction,
  Category,
  User,
  AppSettings,
  PreExportValidationReport,
  TallyExportRecord,
  TallyConnection,
  TallyProductMapping,
  SyncEvent,
  StockReservation,
  VoucherMappingRule,
  TallySyncStatusResponse,
  TallyCompany,
  TallyParty,
  TallyGodown,
  SyncHistoryLog,
  TallyFinancialOverview,
  Coupon,
  CouponStats,
} from '../types';

export const api = {
  // Auth & Roles
  async getMe(): Promise<{ user: User; allUsers: User[] }> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Failed to fetch user session');
    return res.json();
  },

  async switchRole(role: 'manager' | 'staff', userId?: string): Promise<{ success: boolean; user: User }> {
    const res = await fetch('/api/auth/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, userId }),
    });
    if (!res.ok) throw new Error('Failed to switch role');
    return res.json();
  },

  // Dashboard
  async getDashboardStats(params?: { days?: number; startDate?: string; endDate?: string }): Promise<DashboardStats> {
    const query = new URLSearchParams();
    if (params?.days) query.set('days', String(params.days));
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    const res = await fetch(`/api/dashboard/stats${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error('Failed to load dashboard statistics');
    return res.json();
  },

  // Products
  async getProducts(params?: {
    search?: string;
    categoryId?: string;
    status?: string;
    sort?: string;
    showArchived?: boolean;
  }): Promise<{ products: Product[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.status) query.set('status', params.status);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.showArchived) query.set('showArchived', 'true');

    const res = await fetch(`/api/products?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load inventory products');
    const data = await res.json();
    const rawList: any[] = Array.isArray(data)
      ? data
      : (Array.isArray(data?.products) ? data.products : (Array.isArray(data?.items) ? data.items : []));

    const products: Product[] = rawList.map((p: any) => {
      const stock = Number(p.currentStock ?? p.current_stock ?? p.physical_stock ?? p.physicalStock ?? p.stock ?? 0);
      const resStock = Number(p.reservedStock ?? p.reserved_stock ?? 0);
      const availStock = Number(p.availableStock ?? p.available_stock ?? (stock - resStock));
      const minStock = Number(p.minimumStock ?? p.minimum_stock ?? p.min_stock ?? 15);
      const critStock = Number(p.criticalStock ?? p.critical_stock ?? 5);
      const cost = Number(p.unitCost ?? p.unit_cost ?? p.cost_price ?? 0);
      const cat = p.categoryId || p.category_id || p.category || p.brand || 'General';
      const catName = p.categoryName || p.category || p.brand || cat;

      return {
        ...p,
        id: String(p.id || p.sku || ''),
        sku: String(p.sku || ''),
        name: String(p.name || p.Item_Name || p.sku || ''),
        categoryId: String(cat),
        categoryName: String(catName),
        description: p.description || `${catName} | Unit: ${p.unit || 'NOS'}`,
        unit: p.unit || p.unit_of_measure || 'NOS',
        currentStock: stock,
        physicalStock: stock,
        reservedStock: resStock,
        availableStock: availStock,
        minimumStock: minStock,
        criticalStock: critStock,
        unitCost: cost,
        isActive: p.isActive !== undefined ? Boolean(p.isActive) : (p.is_active !== undefined ? Boolean(p.is_active) : true),
        status: p.status || (stock <= 0 ? (stock < 0 ? 'NEGATIVE' : 'OUT_OF_STOCK') : (stock <= critStock ? 'CRITICAL' : (stock <= minStock ? 'LOW' : 'HEALTHY'))),
        createdAt: p.createdAt || p.created_at || new Date().toISOString(),
        updatedAt: p.updatedAt || p.updated_at || new Date().toISOString(),
      };
    });

    return { products };
  },


  async getProductDetails(id: string): Promise<{
    product: Product;
    auditSummary: {
      initialStock: number;
      totalReceived: number;
      totalIssued: number;
      totalAdjustedPlus: number;
      totalAdjustedMinus: number;
      calculatedCurrentStock: number;
      actualCurrentStock: number;
    };
    transactions: StockTransaction[];
  }> {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) throw new Error('Failed to load product details');
    return res.json();
  },

  async createProduct(data: {
    sku: string;
    name: string;
    categoryId: string;
    description?: string;
    unit: string;
    initialStock?: number;
    minimumStock?: number;
    criticalStock?: number;
    unitCost?: number;
  }): Promise<{ success: boolean; product: Product }> {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create product');
    return result;
  },

  async updateProduct(
    id: string,
    data: Partial<{
      name: string;
      categoryId: string;
      description: string;
      unit: string;
      minimumStock: number;
      criticalStock: number;
      unitCost: number;
      is_active?: boolean;
      isActive?: boolean;
    }>
  ): Promise<{ success: boolean; product: Product }> {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update product');
    return result;
  },

  async toggleProductStatus(id: string): Promise<{ success: boolean; product: Product }> {
    const res = await fetch(`/api/products/${id}/toggle-status`, {
      method: 'PATCH',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update product status');
    return result;
  },

  // Stock Movements
  async recordStockIn(data: {
    productId?: string;
    quantity?: number;
    items?: Array<{ productId: string; quantity: number }>;
    supplier?: string;
    referenceNumber?: string;
    notes?: string;
    date?: string;
  }): Promise<{
    success: boolean;
    product: Product;
    transaction: StockTransaction;
    products?: Product[];
    transactions?: StockTransaction[];
    batchSummary?: {
      supplier: string;
      referenceNumber: string;
      date: string;
      totalItems: number;
      totalQuantity: number;
    };
  }> {
    const res = await fetch('/api/inventory/stock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || result.message || result.detail || 'Failed to record stock entry');
    return result;
  },

  async recordStockOut(data: {
    productId?: string;
    quantity?: number;
    items?: Array<{ productId: string; quantity: number }>;
    recipient?: string;
    reason?: string;
    referenceNumber?: string;
    notes?: string;
    date?: string;
  }): Promise<{
    success: boolean;
    product: Product;
    transaction: StockTransaction;
    products?: Product[];
    transactions?: StockTransaction[];
    batchSummary?: {
      recipient: string;
      referenceNumber: string;
      date: string;
      totalItems: number;
      totalQuantity: number;
    };
  }> {
    const res = await fetch('/api/inventory/stock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || result.message || result.detail || 'Failed to record stock dispatch');
    return result;
  },

  async recordCustomerReturn(data: {
    items: Array<{ productId: string; quantity: number; condition?: string }>;
    customer: string;
    referenceNumber?: string;
    reason?: string;
    restockAction?: 'RESTOCK_TO_INVENTORY' | 'QUARANTINE_DAMAGED';
    notes?: string;
    date?: string;
  }): Promise<{
    success: boolean;
    product: Product;
    transaction: StockTransaction;
    products?: Product[];
    transactions?: StockTransaction[];
    batchSummary?: {
      customer: string;
      referenceNumber: string;
      date: string;
      restockAction: string;
      totalItems: number;
      totalQuantity: number;
    };
  }> {
    const res = await fetch('/api/inventory/customer-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to record customer return');
    return result;
  },

  async recordStockAdjustment(data: {
    productId: string;
    actualStock: number;
    reason: string;
    notes?: string;
    referenceNumber?: string;
  }): Promise<{ success: boolean; product: Product; transaction: StockTransaction; variance: number }> {
    const payload = {
      product_id: data.productId,
      new_quantity: data.actualStock,
      reason: data.reason || 'Manual count adjustment',
      notes: data.notes,
      idempotency_key: data.referenceNumber,
    };
    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || result.detail || 'Failed to perform stock adjustment');
    return result;
  },

  // Restock & Reorder Planner
  async getRestockPlan(params?: {
    multiplier?: number;
    categoryId?: string;
    status?: string;
  }): Promise<import('../types').RestockPlanResponse> {
    const query = new URLSearchParams();
    if (params?.multiplier) query.set('multiplier', String(params.multiplier));
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.status) query.set('status', params.status);

    const res = await fetch(`/api/inventory/restock-plan?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load restock and reorder calculations');
    return res.json();
  },

  async bulkRestock(data: {
    items: Array<{ productId: string; quantity: number }>;
    supplier?: string;
    referenceNumber?: string;
    notes?: string;
    reason?: string;
  }): Promise<{ success: boolean; processedCount: number; products: Product[]; transactions: StockTransaction[] }> {
    const res = await fetch('/api/inventory/bulk-restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to process bulk restock');
    return result;
  },

  // Transactions
  async getTransactions(params?: {
    productId?: string;
    type?: string;
    search?: string;
    categoryId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<{ transactions: StockTransaction[] }> {
    const query = new URLSearchParams();
    if (params?.productId) query.set('productId', params.productId);
    if (params?.type) query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await fetch(`/api/transactions?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load transaction audit history');
    const data = await res.json();
    const rawList: any[] = Array.isArray(data)
      ? data
      : (Array.isArray(data?.transactions) ? data.transactions : []);

    const transactions: StockTransaction[] = rawList.map((t: any) => {
      const rawType = String(t.transactionType || t.transaction_type || t.Type || 'ADJUSTMENT').toUpperCase();
      let normType: any = rawType;
      const notesLower = String(t.notes || t.reason || '').toLowerCase();

      if (['INWARD', 'STOCK_IN'].includes(rawType)) normType = 'STOCK_IN';
      else if (['SALE', 'SALES', 'STOCK_OUT', 'OUTWARD', 'DISPATCH'].includes(rawType)) normType = 'STOCK_OUT';
      else if (['RETURN_IN', 'CUSTOMER_RETURN'].includes(rawType)) normType = 'CUSTOMER_RETURN';
      else if (['RETURN_OUT', 'SUPPLIER_RETURN'].includes(rawType)) normType = 'STOCK_OUT';
      else if (['INITIAL_STOCK'].includes(rawType)) normType = 'INITIAL_STOCK';
      else if (['ADJUSTMENT_INCREASE'].includes(rawType)) normType = 'ADJUSTMENT_INCREASE';
      else if (['ADJUSTMENT_DECREASE'].includes(rawType)) normType = 'ADJUSTMENT_DECREASE';
      else if (rawType === 'ADJUSTMENT') {
        if (
          notesLower.includes('delta: -') ||
          notesLower.includes('variance: -') ||
          notesLower.includes('decrease') ||
          notesLower.includes('damage') ||
          notesLower.includes('loss') ||
          notesLower.includes('shrinkage') ||
          notesLower.includes('theft') ||
          notesLower.includes('scrap')
        ) {
          normType = 'ADJUSTMENT_DECREASE';
        } else if (
          notesLower.includes('delta: +') ||
          notesLower.includes('variance: +') ||
          notesLower.includes('opening quantity') ||
          notesLower.includes('initial') ||
          notesLower.includes('imported') ||
          notesLower.includes('increase') ||
          notesLower.includes('surplus')
        ) {
          normType = 'ADJUSTMENT_INCREASE';
        } else {
          normType = 'ADJUSTMENT_INCREASE';
        }
      }

      const rawPrev = t.previousStock ?? t.previous_stock ?? t.previousQuantity ?? t.previous_quantity;
      const rawNew = t.newStock ?? t.new_stock ?? t.newQuantity ?? t.new_quantity;

      return {
        ...t,
        id: String(t.id || t['Txn ID'] || ''),
        productId: String(t.productId || t.product_id || t.SKU || ''),
        productName: String(t.productName || t.product_name || t['Item Name'] || ''),
        productSku: String(t.productSku || t.product_sku || t.SKU || ''),
        categoryName: String(t.categoryName || t.category || t.Category || 'General'),
        unit: String(t.unit || 'NOS'),
        transactionType: normType,
        rawTransactionType: rawType,
        quantity: Number(t.quantity ?? t.Quantity ?? 0),
        previousStock: rawPrev !== undefined && rawPrev !== null ? Number(rawPrev) : undefined,
        newStock: rawNew !== undefined && rawNew !== null ? Number(rawNew) : undefined,
        reason: String(t.reason || t.notes || t.Reference || ''),
        supplierOrRecipient: t.supplierOrRecipient || t.supplier_or_recipient || t['supplierOrRecipient'] || '',
        referenceNumber: t.referenceNumber || t.reference_number || t.Reference || '',
        createdByName: t.createdByName || t.created_by_name || 'Staff',
        createdAt: t.createdAt || t.created_at || t.Timestamp || new Date().toISOString(),
      };
    });

    return { transactions };
  },

  async getStockMovementSummary(params?: {
    startDate?: string;
    endDate?: string;
    granularity?: 'daily' | 'weekly' | 'monthly';
  }): Promise<{
    start_date: string;
    end_date: string;
    granularity: string;
    stock_in: number;
    stock_out: number;
    net_movement: number;
    opening_balance: number | string;
    closing_balance: number | string;
    timeline: Array<{
      date: string;
      date_iso?: string;
      stock_in: number;
      stock_out: number;
      net_movement: number;
    }>;
  }> {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.granularity) query.set('granularity', params.granularity);
    const qs = query.toString();
    const res = await fetch(`/api/transactions/movement-summary${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error('Failed to load stock movement summary');
    return res.json();
  },

  // Categories
  async getCategories(): Promise<{ categories: Category[] }> {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to load categories');
    const data = await res.json();
    const rawList: any[] = Array.isArray(data)
      ? data
      : (Array.isArray(data?.categories) ? data.categories : []);

    const categories: Category[] = rawList.map((c: any) => ({
      id: String(c.id || c.name || ''),
      name: String(c.name || c.id || ''),
      description: String(c.description || `${c.name || c.id} catalog category`),
      isActive: c.isActive !== undefined ? Boolean(c.isActive) : (c.is_active !== undefined ? Boolean(c.is_active) : true),
      createdAt: c.createdAt || c.created_at || new Date().toISOString(),
      updatedAt: c.updatedAt || c.updated_at || new Date().toISOString(),
    }));

    return { categories };
  },

  async createCategory(data: { name: string; description?: string }): Promise<{ success: boolean; category: Category }> {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create category');
    return result;
  },

  async updateCategory(
    id: string,
    data: { name: string; description?: string }
  ): Promise<{ success: boolean; category: Category }> {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update category');
    return result;
  },

  // Tally Integration
  async validateTallyExport(params?: {
    exportType?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ totalProductsReady: number; validationReport: PreExportValidationReport }> {
    const query = new URLSearchParams();
    if (params?.exportType) query.set('exportType', params.exportType);
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);

    const res = await fetch(`/api/tally/validate?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to perform Tally validation check');
    return res.json();
  },

  async executeTallyExport(data: {
    exportType: 'FULL' | 'INCREMENTAL' | 'CUSTOM_RANGE';
    exportFormat: 'JSON' | 'XML';
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    success: boolean;
    exportRecord: TallyExportRecord;
    fileContent: string;
    validationReport: PreExportValidationReport;
  }> {
    const res = await fetch('/api/tally/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Export generation failed');
    return result;
  },

  async getTallyHistory(): Promise<{ exports: TallyExportRecord[]; lastCheckpoint?: string }> {
    try {
      const res = await fetch('/api/tally/history');
      if (!res.ok) {
        return { exports: [], lastCheckpoint: undefined };
      }
      const data = await res.json();
      return {
        exports: Array.isArray(data?.exports) ? data.exports : [],
        lastCheckpoint: data?.lastCheckpoint,
      };
    } catch {
      return { exports: [], lastCheckpoint: undefined };
    }
  },

  // Tally Live Integration & Synchronization
  async getTallySyncStatus(): Promise<TallySyncStatusResponse> {
    const res = await fetch('/api/tally/sync/status');
    if (!res.ok) throw new Error('Failed to load Tally sync status');
    return res.json();
  },

  async testTallyConnection(data?: {
    serverUrl?: string;
    port?: number;
    companyName?: string;
  }): Promise<{
    connected: boolean;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    latencyMs: number;
    message: string;
    serverInfo?: any;
  }> {
    const res = await fetch('/api/tally/sync/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Connection test failed');
    return result;
  },

  async updateTallyConnection(data: Partial<TallyConnection>): Promise<{ success: boolean; connection: TallyConnection }> {
    const res = await fetch('/api/tally/sync/connection', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update Tally connection');
    return result;
  },

  async triggerTallySyncNow(): Promise<{ success: boolean; message: string; syncedAt: string }> {
    const res = await fetch('/api/tally/sync/now', { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to trigger sync');
    return result;
  },

  async getSyncEvents(params?: {
    status?: string;
    type?: string;
    search?: string;
    limit?: number;
  }): Promise<{ events: SyncEvent[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await fetch(`/api/tally/sync/events?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load sync events');
    return res.json();
  },

  async getSyncEventDetails(id: string): Promise<{ event: SyncEvent }> {
    const res = await fetch(`/api/tally/sync/events/${id}`);
    if (!res.ok) throw new Error('Failed to load sync event details');
    return res.json();
  },

  async retrySyncEvent(id: string): Promise<any> {
    const res = await fetch(`/api/tally/sync/events/${id}/retry`, { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Retry failed');
    return result;
  },

  async ignoreSyncEvent(id: string): Promise<any> {
    const res = await fetch(`/api/tally/sync/events/${id}/ignore`, { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to ignore event');
    return result;
  },

  async retryAllFailedSyncEvents(): Promise<{ total: number; retried: number; succeeded: number; failed: number }> {
    const res = await fetch('/api/tally/sync/events/retry-all-failed', { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to retry failed events');
    return result;
  },

  async getStockReservations(params?: {
    status?: string;
    search?: string;
  }): Promise<{ reservations: StockReservation[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);

    try {
      const res = await fetch(`/api/tally/sync/reservations?${query.toString()}`);
      if (!res.ok) {
        console.warn('Failed to load reservations:', res.status, res.statusText);
        return { reservations: [] };
      }
      const data = await res.json();
      return { reservations: Array.isArray(data?.reservations) ? data.reservations : [] };
    } catch (err) {
      console.warn('Error in getStockReservations:', err);
      return { reservations: [] };
    }
  },

  async releaseStockReservation(id: string): Promise<{ success: boolean; reservation: StockReservation }> {
    const res = await fetch(`/api/tally/sync/reservations/${id}/release`, { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to release reservation');
    return result;
  },

  async getProductMappings(params?: {
    status?: string;
    search?: string;
  }): Promise<{ mappings: TallyProductMapping[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`/api/tally/sync/mappings?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load product mappings');
    return res.json();
  },

  async saveProductMapping(data: {
    id?: string;
    productId: string;
    tallyStockItemId?: string;
    tallyStockItemName?: string;
    tallyAlias?: string;
  }): Promise<{ success: boolean; mapping: TallyProductMapping }> {
    const res = await fetch('/api/tally/sync/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save product mapping');
    return result;
  },

  async deleteProductMapping(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/tally/sync/mappings/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete mapping');
    return result;
  },

  async autoMapProducts(): Promise<{ success: boolean; matchedCount: number }> {
    const res = await fetch('/api/tally/sync/mappings/auto-map', { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Auto map failed');
    return result;
  },

  async getVoucherRules(): Promise<{ rules: VoucherMappingRule[] }> {
    const res = await fetch('/api/tally/sync/voucher-rules');
    if (!res.ok) throw new Error('Failed to load voucher rules');
    return res.json();
  },

  async updateVoucherRules(rules: VoucherMappingRule[]): Promise<{ success: boolean; rules: VoucherMappingRule[] }> {
    const res = await fetch('/api/tally/sync/voucher-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update voucher rules');
    return result;
  },

  async simulateTallyScenario(
    scenarioType: string,
    customParams?: any
  ): Promise<any> {
    const res = await fetch('/api/tally/sync/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioType, customParams }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || result.message || 'Simulation failed');
    return result;
  },

  // Comprehensive Tally Synchronization & Live Reports
  async getTallyCompany(): Promise<{ company: TallyCompany }> {
    const res = await fetch('/api/tally/company');
    if (!res.ok) throw new Error('Failed to load Tally company');
    return res.json();
  },

  async syncTallyCompany(): Promise<{ success: boolean; company: TallyCompany; message: string }> {
    const res = await fetch('/api/tally/sync/company', { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to sync company from Tally');
    return result;
  },

  async syncTallyInventory(options?: any): Promise<{
    success: boolean;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsSkipped: number;
    groupsSynced: number;
    unitsSynced: number;
    godownsSynced: number;
    message: string;
  }> {
    const res = await fetch('/api/tally/sync/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to sync inventory masters');
    return result;
  },

  async syncTallyStockTransactions(options?: any): Promise<any> {
    const res = await fetch('/api/tally/sync/stock-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to sync stock transactions');
    return result;
  },

  async syncTallySales(options?: any): Promise<any> {
    const res = await fetch('/api/tally/sync/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to sync sales from Tally');
    return result;
  },

  async syncTallyPurchases(options?: any): Promise<any> {
    const res = await fetch('/api/tally/sync/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to sync purchases from Tally');
    return result;
  },

  async syncTallyAccounting(options?: any): Promise<any> {
    const res = await fetch('/api/tally/sync/accounting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to sync accounting from Tally');
    return result;
  },

  async syncTallyFull(): Promise<any> {
    const res = await fetch('/api/tally/sync/full', { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Full sync failed');
    return result;
  },

  async getTallySyncHistory(): Promise<{ logs: SyncHistoryLog[] }> {
    const res = await fetch('/api/tally/sync/history');
    if (!res.ok) throw new Error('Failed to load sync history logs');
    return res.json();
  },

  async getTallyReportOverview(): Promise<TallyFinancialOverview> {
    const res = await fetch('/api/tally/reports/overview');
    if (!res.ok) throw new Error('Failed to load financial overview');
    return res.json();
  },

  async getTallyReportSalesByProduct(): Promise<{ report: Array<{ name: string; sku: string; unitsSold: number; totalRevenue: number; orderCount: number }> }> {
    const res = await fetch('/api/tally/reports/sales-by-product');
    if (!res.ok) throw new Error('Failed to load sales by product');
    return res.json();
  },

  async getTallyReportPurchasesBySupplier(): Promise<{ report: Array<{ supplierName: string; invoiceCount: number; totalPurchasedAmount: number; lastInvoiceDate?: string }> }> {
    const res = await fetch('/api/tally/reports/purchases-by-supplier');
    if (!res.ok) throw new Error('Failed to load purchases by supplier');
    return res.json();
  },

  async getTallyReportGodownStock(): Promise<{ godowns: TallyGodown[] }> {
    const res = await fetch('/api/tally/reports/godown-stock');
    if (!res.ok) throw new Error('Failed to load godown stock');
    return res.json();
  },

  async getTallyReportParties(type?: 'CUSTOMER' | 'SUPPLIER'): Promise<{ parties: TallyParty[] }> {
    const url = type ? `/api/tally/reports/parties?type=${type}` : '/api/tally/reports/parties';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load party report');
    return res.json();
  },

  // Settings
  async getSettings(): Promise<{ settings: AppSettings }> {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      return await res.json();
    } catch (err) {
      console.warn('api.getSettings fallback:', err);
      return {
        settings: {
          companyName: 'Nalka Metals Pvt Ltd',
          company_name: 'Nalka Metals Pvt Ltd',
          tallyCompanyName: 'Nalka Metals (2026-27)',
          tally_company_name: 'Nalka Metals (2026-27)',
          defaultCriticalThreshold: 5,
          default_critical_threshold: 5,
          defaultMinimumThreshold: 20,
          default_minimum_threshold: 20,
          defaultCriticalStock: 5,
          defaultMinimumStock: 20,
          tallyXmlGuidPrefix: 'NALKA-STOCK-',
          tally_xml_guid_prefix: 'NALKA-STOCK-',
          allow_negative_orders: false,
          allowNegativeOrders: false,
          lastExportCheckpoint: new Date().toISOString(),
          last_export_checkpoint: new Date().toISOString(),
        } as AppSettings,
      };
    }
  },

  async updateSettings(data: Partial<AppSettings>): Promise<{ success: boolean; settings: AppSettings }> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update settings');
    return result;
  },

  async setStockOverride(enabled: boolean): Promise<{
    success: boolean;
    allow_negative_orders: boolean;
    supaSynced: boolean;
    settings: AppSettings;
    message: string;
  }> {
    const res = await fetch('/api/settings/stock-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    let result: any = null;
    try {
      result = await res.json();
    } catch {
      result = {};
    }
    if (!res.ok) throw new Error(result?.error || result?.detail || 'Failed to update stock override');
    return result;
  },

  async resetDemoData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/settings/reset-demo-data', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset demo data');
    return res.json();
  },

  // Catalog Pricing & Master Management
  async updateCatalogPrices(updates: Array<{
    id?: string;
    sku?: string;
    unitCost?: number;
    minimumStock?: number;
    criticalStock?: number;
    unit?: string;
    name?: string;
  }>): Promise<{ success: boolean; count: number; products: Product[] }> {
    const res = await fetch('/api/settings/catalog-prices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update catalog prices');
    return result;
  },

  async applyBulkPriceAdjustment(params: {
    categoryId?: string;
    adjustmentType: 'percentage' | 'fixed';
    value: number;
    roundTo?: number;
    target?: 'unitCost' | 'minimumStock' | 'criticalStock';
  }): Promise<{ success: boolean; count: number }> {
    const res = await fetch('/api/settings/bulk-price-adjustment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to apply bulk adjustment');
    return result;
  },

  async importCatalogCsv(items: Array<any>): Promise<{
    success: boolean;
    updatedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    const res = await fetch('/api/settings/import-catalog-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to import catalog items');
    return result;
  },

  // ----------------------------------------------------
  // PENDING ORDERS & QUEUE ENGINE (SUPABASE / JSON)
  // ----------------------------------------------------

  async getPendingOrders(): Promise<{
    success: boolean;
    orders: import('../types').OrderPreview[];
    isLiveConnected: boolean;
    count: number;
  }> {
    const res = await fetch('/api/orders/pending');
    if (!res.ok) throw new Error('Failed to load pending orders queue');
    const data = await res.json();
    if (Array.isArray(data)) {
      return {
        success: true,
        orders: data,
        isLiveConnected: true,
        count: data.length,
      };
    }
    return data;
  },

  async importOrderJson(
    orderData: any,
    force: boolean = false
  ): Promise<{
    success: boolean;
    isDuplicate: boolean;
    order: import('../types').OrderPreview;
    warning?: string;
    message?: string;
  }> {
    const res = await fetch(`/api/orders/import-json?force=${force}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to import order JSON file');
    return result;
  },

  async confirmOrder(
    orderId: string,
    resolvedItems: Array<{
      itemName: string;
      productId: string;
      quantity: number;
      price?: number;
    }>,
    metadata?: any
  ): Promise<{
    success: boolean;
    processedOrder: import('../types').ProcessedOrder;
    affectedProducts: Product[];
  }> {
    const res = await fetch('/api/orders/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, resolvedItems, metadata }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to confirm order');
    return result;
  },

  async rejectOrder(
    orderId: string,
    source: 'supabase' | 'file' = 'file',
    reason?: string
  ): Promise<{ success: boolean }> {
    const res = await fetch('/api/orders/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, source, reason }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to reject order');
    return result;
  },

  async reopenOrder(orderId: string): Promise<{
    success: boolean;
    reopenedOrder: import('../types').OrderPreview;
    affectedProducts: Product[];
  }> {
    const res = await fetch('/api/orders/reopen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to reopen order');
    return result;
  },

  async rollbackAndRejectOrder(
    orderId: string,
    reason?: string
  ): Promise<{ success: boolean; affectedProducts: Product[]; }> {
    const res = await fetch('/api/orders/rollback-reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, reason }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to rollback and reject order');
    return result;
  },

  async updatePendingOrder(
    orderId: string,
    items: Array<{
      item_name: string;
      quantity: number;
      price?: number;
      category?: string;
    }>,
    metadata?: any
  ): Promise<{ success: boolean; updatedOrder: import('../types').OrderPreview }> {
    const res = await fetch('/api/orders/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, items, metadata }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update pending order');
    return result;
  },

  async getOrderHistory(): Promise<{
    success: boolean;
    orders: import('../types').ProcessedOrder[];
    items: import('../types').ProcessedOrderItem[];
  }> {
    const res = await fetch('/api/orders/history');
    if (!res.ok) throw new Error('Failed to load completed order history');
    return res.json();
  },

  async syncOrdersNow(): Promise<{
    success: boolean;
    connected: boolean;
    pendingCount: number;
    message: string;
  }> {
    const res = await fetch('/api/orders/sync-now', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to sync live orders');
    return res.json();
  },

  // ----------------------------------------------------
  // TALLY ACCOUNTANT IMPORT & WAREHOUSE RECONCILIATION
  // ----------------------------------------------------

  async parseTallyImport(params: {
    content: string;
    fileTypeHint?: string;
    fileName?: string;
  }): Promise<{ success: boolean; preview: import('../types').TallyImportPreview }> {
    const res = await fetch('/api/tally/import/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to parse Tally import file');
    return result;
  },

  async applyTallyImport(params: {
    items: import('../types').TallyReconciliationItem[];
    options: import('../types').TallyImportApplyOptions;
  }): Promise<{
    success: boolean;
    updatedCount: number;
    createdCount: number;
    discrepanciesResolved: number;
  }> {
    const res = await fetch('/api/tally/import/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to apply Tally import changes');
    return result;
  },

  // ----------------------------------------------------
  // BRAND COUPONS API (STORE MANAGER UPLOAD & AUDIT)
  // ----------------------------------------------------

  async getCoupons(params?: {
    search?: string;
    brand?: string;
    category?: string;
    series?: string;
  }): Promise<{ success: boolean; coupons: Coupon[]; stats: CouponStats }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.brand) query.set('brand', params.brand);
    if (params?.category) query.set('category', params.category);
    if (params?.series) query.set('series', params.series);

    const qs = query.toString();
    const res = await fetch(`/api/coupons${qs ? '?' + qs : ''}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load coupon records');
    }
    return res.json();
  },

  async createCoupon(data: {
    product_name: string;
    category: string;
    brand_name: string;
    series_name: string;
    coupon_amount: number;
    coupons_used: number;
    notes?: string;
  }): Promise<{ success: boolean; coupon: Coupon; message: string }> {
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save coupon');
    return result;
  },

  async updateCoupon(
    id: string,
    data: Partial<Coupon>
  ): Promise<{ success: boolean; coupon: Coupon; message: string }> {
    const res = await fetch(`/api/coupons/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update coupon');
    return result;
  },

  async deleteCoupon(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/coupons/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete coupon');
    return result;
  },

  async bulkUploadCoupons(
    items: any[],
    replaceExisting: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    importedCount: number;
    skippedErrorsCount: number;
    errors: any[];
  }> {
    const res = await fetch('/api/coupons/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, replaceExisting }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to upload coupon batch');
    return result;
  },

  async clearAllCoupons(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/coupons-all/clear', {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to clear coupons');
    return result;
  },
};

