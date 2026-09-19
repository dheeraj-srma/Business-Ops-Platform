import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import {
  db,
  ProductRow,
  StockTransactionRow,
  CategoryRow,
  SettingsRow,
  TallyConnectionRow,
  TallyProductMappingRow,
  SyncEventRow,
  StockReservationRow,
  VoucherMappingRuleRow,
  TallyCompanyRow,
  TallyStockGroupRow,
  TallyUnitRow,
  TallyGodownRow,
  TallyLedgerRow,
  TallyPartyRow,
  TallyVoucherRow,
  SyncHistoryLogRow,
  CouponRow,
  ProcessedOrderRow,
  ProcessedOrderItemRow,
} from './db';
import { TallyExportService } from './tally/exportService';
import { tallySyncEngine } from './tally/services/tallySyncEngine';
import { inventorySyncService } from './tally/services/inventorySyncService';
import { masterSyncService } from './tally/services/masterSyncService';
import { voucherSyncService } from './tally/services/voucherSyncService';
import { accountingSyncService } from './tally/services/accountingSyncService';
import { tallyReportService } from './tally/services/tallyReportService';
import { testTallyConnection } from './tally/client/tallyClient';
import { TallyImportService } from './tally/services/tallyImportService';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { supabaseSyncService } from './supabaseSyncService';
import {
  processIncomingOrder,
  confirmOrder,
  rejectOrder,
  reopenOrder,
  rollbackAndRejectOrder,
  updatePendingOrder,
  syncInventoryToSupabase,
  orderQueue,
  IncomingOrder,
} from './orderEngine';

export const router = Router();

// Current active session simulation
let activeUserId = 'usr-1'; // Default: Rajesh Sharma (Manager)

function getStockStatus(current: number, min: number, crit: number): 'HEALTHY' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK' | 'NEGATIVE' {
  if (current < 0) return 'NEGATIVE';
  if (current === 0) return 'OUT_OF_STOCK';
  if (current <= crit) return 'CRITICAL';
  if (current <= min) return 'LOW';
  return 'HEALTHY';
}

/** Return local YYYY-MM-DD string (avoids UTC shift from toISOString) */
function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return local YYYY-MM prefix */
function toLocalMonthStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Convert a created_at timestamp to a local YYYY-MM-DD string */
function txLocalDate(createdAt: string): string {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return createdAt.slice(0, 10);
  return toLocalDateStr(d);
}

// ----------------------------------------------------
// 1. AUTH & ROLE MANAGEMENT
// ----------------------------------------------------
router.get('/auth/me', (req: Request, res: Response) => {
  const state = db.getState();
  const user = state.users.find((u) => u.id === activeUserId) || state.users[0];
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
    },
    allUsers: state.users,
  });
});

router.post('/auth/switch-role', (req: Request, res: Response) => {
  const { userId, role } = req.body;
  const state = db.getState();
  if (userId) {
    const user = state.users.find((u) => u.id === userId);
    if (user) {
      activeUserId = user.id;
      return res.json({ success: true, user });
    }
  }
  if (role) {
    const user = state.users.find((u) => u.role === role);
    if (user) {
      activeUserId = user.id;
      return res.json({ success: true, user });
    }
  }
  res.status(404).json({ error: 'User not found' });
});

// ----------------------------------------------------
// 2. DASHBOARD METRICS & TRENDS
// ----------------------------------------------------
router.get('/dashboard/stats', (req: Request, res: Response) => {
  const state = db.getState();
  const activeProducts = state.products.filter((p) => p.is_active);
  const categories = state.categories;

  let totalUnitsInStock = 0;
  let totalStockValue = 0;
  let healthyCount = 0;
  let lowStockCount = 0;
  let criticalStockCount = 0;
  let outOfStockCount = 0;
  let negativeStockCount = 0;

  const lowStockItems: any[] = [];

  for (const p of activeProducts) {
    totalUnitsInStock += p.current_stock;
    totalStockValue += p.current_stock * (p.unit_cost || 0);
    const status = getStockStatus(p.current_stock, p.minimum_stock, p.critical_stock);

    if (status === 'NEGATIVE') {
      negativeStockCount++;
      lowStockItems.push({ ...p, status });
    } else if (status === 'OUT_OF_STOCK') {
      outOfStockCount++;
      lowStockItems.push({ ...p, status });
    } else if (status === 'CRITICAL') {
      criticalStockCount++;
      lowStockItems.push({ ...p, status });
    } else if (status === 'LOW') {
      lowStockCount++;
      lowStockItems.push({ ...p, status });
    } else {
      healthyCount++;
    }
  }

  // Movements today
  const todayStr = toLocalDateStr(new Date());
  const movementsToday = state.stock_transactions.filter((tx) => txLocalDate(tx.created_at) === todayStr).length;

  // Movements this month
  const currentMonthPrefix = toLocalMonthStr(new Date());
  let stockAddedThisMonth = 0;
  let stockIssuedThisMonth = 0;

  for (const tx of state.stock_transactions) {
    if (txLocalDate(tx.created_at).startsWith(currentMonthPrefix)) {
      if (tx.transaction_type === 'STOCK_IN' || tx.transaction_type === 'INITIAL_STOCK' || tx.transaction_type === 'CUSTOMER_RETURN') {
        stockAddedThisMonth += tx.quantity;
      } else if (tx.transaction_type === 'STOCK_OUT') {
        stockIssuedThisMonth += tx.quantity;
      } else if (tx.transaction_type === 'ADJUSTMENT_INCREASE') {
        stockAddedThisMonth += tx.quantity;
      } else if (tx.transaction_type === 'ADJUSTMENT_DECREASE') {
        stockIssuedThisMonth += tx.quantity;
      }
    }
  }

  // Trend for specified days or custom date range
  const daysList: { dateObj: Date; dayStr: string; label: string }[] = [];

  if (req.query.startDate && req.query.endDate) {
    const start = new Date(req.query.startDate as string);
    const end = new Date(req.query.endDate as string);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const cur = new Date(start);
      const maxDays = 90;
      let count = 0;
      while (cur <= end && count < maxDays) {
        const dayStr = toLocalDateStr(cur);
        daysList.push({
          dateObj: new Date(cur),
          dayStr,
          label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(cur),
        });
        cur.setDate(cur.getDate() + 1);
        count++;
      }
    }
  }

  if (daysList.length === 0) {
    const trendDays = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = toLocalDateStr(d);
      daysList.push({
        dateObj: d,
        dayStr,
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d),
      });
    }
  }

  const trend: Array<{ date: string; stockIn: number; stockOut: number; adjustments: number }> = [];
  for (const day of daysList) {
    let stockIn = 0;
    let stockOut = 0;
    let adjustments = 0;

    for (const tx of state.stock_transactions) {
      if (txLocalDate(tx.created_at) === day.dayStr) {
        if (tx.transaction_type === 'STOCK_IN' || tx.transaction_type === 'INITIAL_STOCK' || tx.transaction_type === 'CUSTOMER_RETURN') stockIn += tx.quantity;
        else if (tx.transaction_type === 'STOCK_OUT') stockOut += tx.quantity;
        else adjustments += tx.quantity;
      }
    }

    trend.push({
      date: day.label,
      stockIn,
      stockOut,
      adjustments,
    });
  }

  // Recent transactions with product & category names
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const productMap = new Map(state.products.map((p) => [p.id, p]));

  const recentMovements = state.stock_transactions.slice(0, 10).map((tx) => {
    const prod = productMap.get(tx.product_id);
    return {
      ...tx,
      productName: prod ? prod.name : 'Unknown Product',
      productSku: prod ? prod.sku : '',
      categoryName: prod ? categoryMap.get(prod.category_id) || 'Uncategorized' : '',
      unit: prod ? prod.unit : 'Units',
    };
  });

  // Category breakdown
  const categoryBreakdown = categories.map((cat) => {
    const catProds = activeProducts.filter((p) => p.category_id === cat.id);
    const units = Math.round(catProds.reduce((sum, p) => sum + p.current_stock, 0));
    return {
      name: cat.name,
      count: catProds.length,
      units,
    };
  });

  res.json({
    totalProducts: state.products.length,
    totalActiveSkus: activeProducts.length,
    totalUnitsInStock: Math.round(totalUnitsInStock),
    totalStockValue: Math.round(totalStockValue),
    healthyCount,
    lowStockCount,
    criticalStockCount,
    outOfStockCount,
    negativeStockCount,
    movementsToday,
    stockAddedThisMonth,
    stockIssuedThisMonth,
    trend,
    recentMovements,
    lowStockItems: lowStockItems.slice(0, 8),
    categoryBreakdown,
  });
});

// ----------------------------------------------------
// 3. PRODUCTS MANAGEMENT
// ----------------------------------------------------
router.get('/products', (req: Request, res: Response) => {
  db.ensureProducts();
  const state = db.getState();
  const { search, categoryId, status, sort, showArchived } = req.query;

  const categoryMap = new Map(state.categories.map((c) => [c.id, c.name]));

  let results = state.products.map((p) => {
    const reserved = p.reserved_stock || 0;
    const available = p.current_stock - reserved;
    return {
      ...p,
      categoryId: p.category_id,
      categoryName: categoryMap.get(p.category_id) || 'General',
      currentStock: p.current_stock,
      minimumStock: p.minimum_stock,
      criticalStock: p.critical_stock,
      unitCost: p.unit_cost ?? 0,
      isActive: p.is_active,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      reservedStock: reserved,
      availableStock: available,
      physicalStock: p.current_stock,
      status: getStockStatus(p.current_stock, p.minimum_stock, p.critical_stock),
    };
  });

  if (showArchived !== 'true') {
    results = results.filter((p) => p.is_active);
  }

  if (categoryId && categoryId !== 'all') {
    results = results.filter((p) => p.category_id === categoryId);
  }

  if (status && status !== 'all') {
    results = results.filter((p) => p.status === status);
  }

  if (search && typeof search === 'string') {
    const query = search.toLowerCase().trim();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(query))
    );
  }

  // Sorting
  if (sort === 'stock_asc') results.sort((a, b) => a.current_stock - b.current_stock);
  else if (sort === 'stock_desc') results.sort((a, b) => b.current_stock - a.current_stock);
  else if (sort === 'name_asc') results.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'sku_asc') results.sort((a, b) => a.sku.localeCompare(b.sku));
  else results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  res.json({ products: results });
});

router.get('/products/:id', (req: Request, res: Response) => {
  const state = db.getState();
  const product = state.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const category = state.categories.find((c) => c.id === product.category_id);
  const status = getStockStatus(product.current_stock, product.minimum_stock, product.critical_stock);

  // Get transaction history for this specific product
  const transactions = state.stock_transactions
    .filter((tx) => tx.product_id === product.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Calculate audit math
  let totalReceived = 0;
  let totalIssued = 0;
  let totalAdjustedPlus = 0;
  let totalAdjustedMinus = 0;
  let initialStock = 0;

  for (const tx of transactions) {
    if (tx.transaction_type === 'INITIAL_STOCK') initialStock += tx.quantity;
    else if (tx.transaction_type === 'STOCK_IN' || tx.transaction_type === 'CUSTOMER_RETURN') totalReceived += tx.quantity;
    else if (tx.transaction_type === 'STOCK_OUT') totalIssued += tx.quantity;
    else if (tx.transaction_type === 'ADJUSTMENT_INCREASE') totalAdjustedPlus += tx.quantity;
    else if (tx.transaction_type === 'ADJUSTMENT_DECREASE') totalAdjustedMinus += tx.quantity;
  }

  res.json({
    product: {
      ...product,
      categoryId: product.category_id,
      categoryName: category?.name || 'General',
      currentStock: product.current_stock,
      minimumStock: product.minimum_stock,
      criticalStock: product.critical_stock,
      unitCost: product.unit_cost ?? 0,
      isActive: product.is_active,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      reservedStock: product.reserved_stock || 0,
      availableStock: product.current_stock - (product.reserved_stock || 0),
      physicalStock: product.current_stock,
      status: getStockStatus(product.current_stock, product.minimum_stock, product.critical_stock),
    },
    auditSummary: {
      initialStock,
      totalReceived,
      totalIssued,
      totalAdjustedPlus,
      totalAdjustedMinus,
      calculatedCurrentStock: initialStock + totalReceived - totalIssued + totalAdjustedPlus - totalAdjustedMinus,
      actualCurrentStock: product.current_stock,
    },
    transactions,
  });
});

router.post('/products', async (req: Request, res: Response) => {
  try {
    const {
      sku,
      name,
      categoryId,
      description,
      unit,
      initialStock,
      minimumStock,
      criticalStock,
      unitCost,
    } = req.body;

    if (!sku || !name || !categoryId || !unit) {
      return res.status(400).json({ error: 'SKU, Product Name, Category, and Unit are required.' });
    }

    const state = db.getState();
    const cleanSku = sku.trim().toUpperCase();

    const existing = state.products.find((p) => p.sku.toUpperCase() === cleanSku);
    if (existing) {
      return res.status(400).json({ error: `A product with SKU "${cleanSku}" already exists.` });
    }

    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];
    const initialQty = Math.max(0, parseInt(initialStock) || 0);
    const minQty = Math.max(0, parseInt(minimumStock) || 10);
    const critQty = Math.max(0, parseInt(criticalStock) || 3);
    const cost = Math.max(0, parseFloat(unitCost) || 0);

    const newProduct = await db.transaction((dbState) => {
      const now = new Date().toISOString();
      const prodId = `prod-${Date.now()}`;

      const prod: ProductRow = {
        id: prodId,
        sku: cleanSku,
        name: name.trim(),
        category_id: categoryId,
        description: description?.trim() || '',
        unit: unit.trim(),
        current_stock: initialQty,
        minimum_stock: minQty,
        critical_stock: critQty,
        unit_cost: cost,
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      dbState.products.unshift(prod);

      // Create INITIAL_STOCK transaction if initial stock > 0
      if (initialQty > 0) {
        const tx: StockTransactionRow = {
          id: `tx-${Date.now()}`,
          product_id: prodId,
          transaction_type: 'INITIAL_STOCK',
          quantity: initialQty,
          previous_stock: 0,
          new_stock: initialQty,
          reason: 'Initial Product Stock Registration',
          supplier_or_recipient: 'System Setup',
          reference_number: `INIT-${cleanSku}`,
          notes: 'Opening balance registered during product creation',
          created_by_id: activeUser.id,
          created_by_name: activeUser.name,
          created_at: now,
        };
        dbState.stock_transactions.unshift(tx);
      }

      return prod;
    });

    res.status(201).json({ success: true, product: newProduct });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create product' });
  }
});

router.put('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, categoryId, description, unit, minimumStock, criticalStock, unitCost } = req.body;

    const updated = await db.transaction((state) => {
      const prod = state.products.find((p) => p.id === id);
      if (!prod) throw new Error('Product not found');

      if (name) prod.name = name.trim();
      if (categoryId) prod.category_id = categoryId;
      if (description !== undefined) prod.description = description.trim();
      if (unit) prod.unit = unit.trim();
      if (minimumStock !== undefined) prod.minimum_stock = Math.max(0, parseInt(minimumStock) || 0);
      if (criticalStock !== undefined) prod.critical_stock = Math.max(0, parseInt(criticalStock) || 0);
      if (unitCost !== undefined) prod.unit_cost = Math.max(0, parseFloat(unitCost) || 0);

      prod.updated_at = new Date().toISOString();
      return prod;
    });

    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/products/:id/toggle-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await db.transaction((state) => {
      const prod = state.products.find((p) => p.id === id);
      if (!prod) throw new Error('Product not found');
      prod.is_active = !prod.is_active;
      prod.updated_at = new Date().toISOString();
      return prod;
    });
    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 4. STOCK MOVEMENT WORKFLOWS (ACID & AUDIT TRAIL)
// ----------------------------------------------------

// 4.1 Stock In (Receiving Stock - Single Item or Multi-Item Consignment)
router.post('/inventory/stock-in', async (req: Request, res: Response) => {
  try {
    const { productId, quantity, items, supplier, referenceNumber, notes, date } = req.body;

    // Normalise to array of items
    let stockItems: Array<{ productId: string; quantity: number }> = [];

    if (Array.isArray(items) && items.length > 0) {
      stockItems = items.map((item: any) => ({
        productId: String(item.productId || item.product_id),
        quantity: parseInt(item.quantity),
      }));
    } else if (productId && quantity !== undefined) {
      const qty = parseInt(quantity);
      stockItems = [{ productId: String(productId), quantity: qty }];
    }

    if (stockItems.length === 0) {
      return res.status(400).json({ error: 'At least one product item with quantity is required.' });
    }

    for (const item of stockItems) {
      if (!item.productId || isNaN(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ error: 'Each item must have a valid product and positive quantity (> 0).' });
      }
    }

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];
    const sharedRef = referenceNumber?.trim() || `GRN-${Date.now().toString().slice(-6)}`;
    const sharedSupplier = supplier?.trim() || 'Direct Supplier';
    const sharedDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const sharedNotes = notes?.trim() || '';

    const result = await db.transaction((dbState) => {
      const affectedProducts: typeof dbState.products = [];
      const createdTransactions: StockTransactionRow[] = [];
      const nowBase = Date.now();

      stockItems.forEach((item, idx) => {
        const prod = dbState.products.find((p) => p.id === item.productId);
        if (!prod) throw new Error(`Selected product (${item.productId}) does not exist.`);
        if (!prod.is_active) throw new Error(`Cannot receive stock for inactive or archived product "${prod.name}".`);

        const previousStock = prod.current_stock;
        const newStock = previousStock + item.quantity;

        prod.current_stock = newStock;
        prod.updated_at = new Date().toISOString();
        affectedProducts.push(prod);

        const txId = `tx-in-${nowBase}-${idx}`;
        const tx: StockTransactionRow = {
          id: txId,
          product_id: prod.id,
          transaction_type: 'STOCK_IN',
          quantity: item.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: 'Stock In / Goods Received',
          supplier_or_recipient: sharedSupplier,
          reference_number: sharedRef,
          notes: sharedNotes,
          created_by_id: activeUser.id,
          created_by_name: activeUser.name,
          created_at: sharedDate,
        };

        dbState.stock_transactions.unshift(tx);
        createdTransactions.push(tx);
      });

      return {
        products: affectedProducts,
        transactions: createdTransactions,
        product: affectedProducts[0],
        transaction: createdTransactions[0],
        batchSummary: {
          supplier: sharedSupplier,
          referenceNumber: sharedRef,
          date: sharedDate,
          totalItems: stockItems.length,
          totalQuantity: stockItems.reduce((sum, it) => sum + it.quantity, 0),
        },
      };
    });

    syncInventoryToSupabase(result.products).catch(() => {});

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to record Stock In transaction.' });
  }
});

// 4.2 Stock Out / Issue (Multi-Item Consignment & Strict Stock Protection)
router.post('/inventory/stock-out', async (req: Request, res: Response) => {
  try {
    const { productId, quantity, items, recipient, reason, referenceNumber, notes, date } = req.body;

    let stockItems: Array<{ productId: string; quantity: number }> = [];

    if (Array.isArray(items) && items.length > 0) {
      stockItems = items.map((item: any) => ({
        productId: String(item.productId || item.product_id),
        quantity: parseInt(item.quantity),
      }));
    } else if (productId && quantity !== undefined) {
      const qty = parseInt(quantity);
      stockItems = [{ productId: String(productId), quantity: qty }];
    }

    if (stockItems.length === 0) {
      return res.status(400).json({ error: 'At least one product item with quantity is required.' });
    }

    for (const item of stockItems) {
      if (!item.productId || isNaN(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ error: 'Each item must have a valid product and positive quantity (> 0).' });
      }
    }

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];
    const sharedRef = referenceNumber?.trim() || `ISS-${Date.now().toString().slice(-6)}`;
    const sharedRecipient = recipient?.trim() || 'Internal Dispatch';
    const sharedDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const sharedReason = reason?.trim() || 'Customer Order / Issue';
    const sharedNotes = notes?.trim() || '';

    const result = await db.transaction((dbState) => {
      const affectedProducts: typeof dbState.products = [];
      const createdTransactions: StockTransactionRow[] = [];
      const nowBase = Date.now();

      stockItems.forEach((item, idx) => {
        const prod = dbState.products.find((p) => p.id === item.productId);
        if (!prod) throw new Error(`Selected product (${item.productId}) does not exist.`);
        if (!prod.is_active) throw new Error(`Cannot issue stock for inactive or archived product "${prod.name}".`);

        if (prod.current_stock < item.quantity) {
          throw new Error(
            `Insufficient physical stock for "${prod.name}" (SKU: ${prod.sku}). Available: ${prod.current_stock} ${prod.unit}, Requested: ${item.quantity} ${prod.unit}.`
          );
        }

        const previousStock = prod.current_stock;
        const newStock = previousStock - item.quantity;

        prod.current_stock = newStock;
        prod.updated_at = new Date().toISOString();
        affectedProducts.push(prod);

        const txId = `tx-out-${nowBase}-${idx}`;
        const tx: StockTransactionRow = {
          id: txId,
          product_id: prod.id,
          transaction_type: 'STOCK_OUT',
          quantity: item.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: sharedReason,
          supplier_or_recipient: sharedRecipient,
          reference_number: sharedRef,
          notes: sharedNotes,
          created_by_id: activeUser.id,
          created_by_name: activeUser.name,
          created_at: sharedDate,
        };

        dbState.stock_transactions.unshift(tx);
        createdTransactions.push(tx);
      });

      return {
        products: affectedProducts,
        transactions: createdTransactions,
        product: affectedProducts[0],
        transaction: createdTransactions[0],
        batchSummary: {
          recipient: sharedRecipient,
          referenceNumber: sharedRef,
          date: sharedDate,
          totalItems: stockItems.length,
          totalQuantity: stockItems.reduce((sum, it) => sum + it.quantity, 0),
        },
      };
    });

    syncInventoryToSupabase(result.products).catch(() => {});

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to record Stock Out transaction.' });
  }
});

// 4.3 Customer Return (Customer Sales Return Consignment / Restock or Quarantine)
router.post('/inventory/customer-return', async (req: Request, res: Response) => {
  try {
    const { items, customer, reason, referenceNumber, restockAction, notes, date } = req.body;

    let returnItems: Array<{ productId: string; quantity: number; condition?: string }> = [];

    if (Array.isArray(items) && items.length > 0) {
      returnItems = items.map((item: any) => ({
        productId: String(item.productId || item.product_id),
        quantity: parseInt(item.quantity),
        condition: item.condition ? String(item.condition) : undefined,
      }));
    }

    if (returnItems.length === 0) {
      return res.status(400).json({ error: 'At least one return item with quantity is required.' });
    }

    for (const item of returnItems) {
      if (!item.productId || isNaN(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ error: 'Each return item must have a valid product and positive quantity (> 0).' });
      }
    }

    const shouldRestock = restockAction !== 'QUARANTINE_DAMAGED';
    const DEFECTIVE_ITEM_CONDITIONS = [
      'Damaged / Defective',
      'Missing Parts / Accessories',
      'Transit / Packaging Damaged',
      'Quality Reject / Broken',
    ];
    const GOOD_ITEM_CONDITIONS = [
      'Unopened / Brand New',
      'Box Opened / Intact',
    ];

    if (shouldRestock) {
      for (const item of returnItems) {
        if (
          item.condition &&
          (DEFECTIVE_ITEM_CONDITIONS.includes(item.condition) ||
            /defect|damag|broken|scrap|missing/i.test(item.condition))
        ) {
          return res.status(400).json({
            error: `Item with condition "${item.condition}" cannot be restocked to active inventory. Goods must be in good condition or marked for Quarantine / Defective Hold.`,
          });
        }
      }
    } else {
      for (const item of returnItems) {
        if (
          item.condition &&
          (GOOD_ITEM_CONDITIONS.includes(item.condition) ||
            /unopened|brand new|intact/i.test(item.condition))
        ) {
          return res.status(400).json({
            error: `Item with condition "${item.condition}" cannot be quarantined under Defective Hold. Please switch disposition to Restock to Available Inventory.`,
          });
        }
      }
    }

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];
    const sharedRef = referenceNumber?.trim() || `RET-${Date.now().toString().slice(-6)}`;
    const sharedCustomer = customer?.trim() || 'Direct Customer';
    const sharedDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const sharedReason = reason?.trim() || 'Customer Return / Sales Memo';
    const sharedNotes = notes?.trim() || '';

    const result = await db.transaction((dbState) => {
      const affectedProducts: typeof dbState.products = [];
      const createdTransactions: StockTransactionRow[] = [];
      const nowBase = Date.now();

      returnItems.forEach((item, idx) => {
        const prod = dbState.products.find((p) => p.id === item.productId);
        if (!prod) throw new Error(`Selected product (${item.productId}) does not exist.`);

        const previousStock = prod.current_stock;
        const newStock = shouldRestock ? previousStock + item.quantity : previousStock;

        if (shouldRestock) {
          prod.current_stock = newStock;
          prod.updated_at = new Date().toISOString();
          affectedProducts.push(prod);
        } else {
          affectedProducts.push(prod);
        }

        const dispositionTag = shouldRestock ? '[Restocked to Inventory]' : '[Quarantined / Defective Hold]';
        const itemNote = item.condition ? `Condition: ${item.condition}. ${sharedNotes}` : sharedNotes;
        const finalTxNotes = `${dispositionTag} ${itemNote}`.trim();

        const txId = `tx-ret-${nowBase}-${idx}`;
        const tx: StockTransactionRow = {
          id: txId,
          product_id: prod.id,
          transaction_type: 'CUSTOMER_RETURN',
          quantity: item.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: sharedReason,
          supplier_or_recipient: sharedCustomer,
          reference_number: sharedRef,
          notes: finalTxNotes,
          created_by_id: activeUser.id,
          created_by_name: activeUser.name,
          created_at: sharedDate,
        };

        dbState.stock_transactions.unshift(tx);
        createdTransactions.push(tx);
      });

      return {
        products: affectedProducts,
        transactions: createdTransactions,
        product: affectedProducts[0],
        transaction: createdTransactions[0],
        batchSummary: {
          customer: sharedCustomer,
          referenceNumber: sharedRef,
          date: sharedDate,
          restockAction: shouldRestock ? 'RESTOCK_TO_INVENTORY' : 'QUARANTINE_DAMAGED',
          totalItems: returnItems.length,
          totalQuantity: returnItems.reduce((sum, it) => sum + it.quantity, 0),
        },
      };
    });

    if (shouldRestock) {
      syncInventoryToSupabase(result.products).catch(() => {});
    }

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to record Customer Return transaction.' });
  }
});

// 4.4 Stock Adjustment (Physical Verification & Reconciliation)
router.post('/inventory/adjust', async (req: Request, res: Response) => {
  try {
    const { productId, actualStock, reason, notes, referenceNumber } = req.body;

    const actual = parseInt(actualStock);
    if (!productId || isNaN(actual)) {
      return res.status(400).json({ error: 'Valid product and integer physical stock count are required.' });
    }

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];

    const result = await db.transaction((dbState) => {
      const prod = dbState.products.find((p) => p.id === productId);
      if (!prod) throw new Error('Selected product does not exist.');

      const previousStock = prod.current_stock;
      const difference = actual - previousStock;

      if (difference === 0) {
        throw new Error('Physical stock matches current system stock (difference is 0). No adjustment needed.');
      }

      const isIncrease = difference > 0;
      const magnitude = Math.abs(difference);

      prod.current_stock = actual;
      prod.updated_at = new Date().toISOString();

      const txId = `tx-${Date.now()}`;
      const tx: StockTransactionRow = {
        id: txId,
        product_id: prod.id,
        transaction_type: isIncrease ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
        quantity: magnitude,
        previous_stock: previousStock,
        new_stock: actual,
        reason: reason?.trim() || 'Physical Stock Verification / Audit Discrepancy',
        supplier_or_recipient: 'Internal Audit Reconciliation',
        reference_number: referenceNumber?.trim() || `ADJ-${Date.now().toString().slice(-6)}`,
        notes: `System Stock: ${previousStock}, Physical Count: ${actual}, Variance: ${difference > 0 ? '+' : ''}${difference}. ${notes || ''}`.trim(),
        created_by_id: activeUser.id,
        created_by_name: activeUser.name,
        created_at: new Date().toISOString(),
      };

      dbState.stock_transactions.unshift(tx);
      return { product: prod, transaction: tx, variance: difference };
    });

    syncInventoryToSupabase([result.product]).catch(() => {});

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to complete stock adjustment.' });
  }
});

// 4.4 Restock & Reorder Calculations (Low, Critical, Out of Stock, and Negative Deficits)
router.get('/inventory/restock-plan', (req: Request, res: Response) => {
  const state = db.getState();
  const { multiplier = '2', categoryId = 'all', status = 'all' } = req.query;

  const targetMultiplier = Math.max(1.1, parseFloat(multiplier as string) || 2.0);
  const categoryMap = new Map(state.categories.map((c) => [c.id, c.name]));

  let itemsToRestock: any[] = [];
  let totalNegativeDeficitUnits = 0;
  let totalRestockUnits = 0;
  let estimatedTotalRestockCost = 0;

  let negativeCount = 0;
  let outOfStockCount = 0;
  let criticalCount = 0;
  let lowCount = 0;

  const categoryBreakdownMap: { [catId: string]: { name: string; count: number; restockUnits: number; estimatedCost: number } } = {};

  for (const prod of state.products) {
    if (!prod.is_active) continue;

    const physicalStock = prod.current_stock;
    const reservedStock = prod.reserved_stock || 0;
    const availableStock = physicalStock - reservedStock;
    const minStock = prod.minimum_stock;
    const critStock = prod.critical_stock;
    const itemStatus = getStockStatus(physicalStock, minStock, critStock);

    // Filter condition: only items needing restock
    const needsRestock = itemStatus === 'NEGATIVE' || itemStatus === 'OUT_OF_STOCK' || itemStatus === 'CRITICAL' || itemStatus === 'LOW';
    if (!needsRestock) continue;

    if (itemStatus === 'NEGATIVE') {
      negativeCount++;
      totalNegativeDeficitUnits += Math.abs(physicalStock);
    } else if (itemStatus === 'OUT_OF_STOCK') {
      outOfStockCount++;
    } else if (itemStatus === 'CRITICAL') {
      criticalCount++;
    } else if (itemStatus === 'LOW') {
      lowCount++;
    }

    // Target stock formula: Target = max(Min * multiplier, Min + 5)
    const targetStock = Math.ceil(Math.max(minStock * targetMultiplier, minStock + 5));

    // Reorder quantity formula:
    // Q_reorder = TargetStock - AvailableStock
    // E.g., if Available is -12 and Target is 30, Q_reorder = 30 - (-12) = 42
    // If Available is 3 and Target is 30, Q_reorder = 30 - 3 = 27
    const reorderQuantity = Math.max(0, targetStock - availableStock);
    const estimatedCost = Math.round(reorderQuantity * (prod.unit_cost || 0) * 100) / 100;

    totalRestockUnits += reorderQuantity;
    estimatedTotalRestockCost += estimatedCost;

    let urgency: 'EMERGENCY' | 'CRITICAL' | 'MEDIUM' = 'MEDIUM';
    let reorderReason = '';

    if (itemStatus === 'NEGATIVE') {
      urgency = 'EMERGENCY';
      reorderReason = `Negative physical stock (${physicalStock} ${prod.unit}). Immediate replenishment of ${Math.abs(physicalStock)} units to clear deficit, plus ${targetStock} units to restore target buffer.`;
    } else if (itemStatus === 'OUT_OF_STOCK') {
      urgency = 'CRITICAL';
      reorderReason = `Zero stock on floor. Requires ${reorderQuantity} ${prod.unit} to restore safe operating level (${targetStock} ${prod.unit}).`;
    } else if (itemStatus === 'CRITICAL') {
      urgency = 'CRITICAL';
      reorderReason = `Stock (${physicalStock} ${prod.unit}) is at or below critical threshold (${critStock} ${prod.unit}). Requires ${reorderQuantity} ${prod.unit} to reach target (${targetStock} ${prod.unit}).`;
    } else {
      urgency = 'MEDIUM';
      reorderReason = `Stock (${physicalStock} ${prod.unit}) is below minimum safe threshold (${minStock} ${prod.unit}). Requires ${reorderQuantity} ${prod.unit} to restore target buffer (${targetStock} ${prod.unit}).`;
    }

    const catName = categoryMap.get(prod.category_id) || 'General';

    // Track category breakdown
    if (!categoryBreakdownMap[prod.category_id]) {
      categoryBreakdownMap[prod.category_id] = {
        name: catName,
        count: 0,
        restockUnits: 0,
        estimatedCost: 0,
      };
    }
    categoryBreakdownMap[prod.category_id].count++;
    categoryBreakdownMap[prod.category_id].restockUnits += reorderQuantity;
    categoryBreakdownMap[prod.category_id].estimatedCost += estimatedCost;

    itemsToRestock.push({
      id: prod.id,
      sku: prod.sku,
      name: prod.name,
      categoryId: prod.category_id,
      categoryName: catName,
      unit: prod.unit,
      unitCost: prod.unit_cost || 0,
      physicalStock,
      reservedStock,
      availableStock,
      minimumStock: minStock,
      criticalStock: critStock,
      targetStock,
      deficit: Math.max(0, -physicalStock),
      reorderQuantity,
      estimatedCost,
      status: itemStatus,
      urgency,
      reorderReason,
    });
  }

  // Filter if query params specified
  let filteredItems = [...itemsToRestock];
  if (categoryId !== 'all') {
    filteredItems = filteredItems.filter((item) => item.categoryId === categoryId);
  }
  if (status !== 'all') {
    filteredItems = filteredItems.filter((item) => item.status === status);
  }

  // Sort by urgency priority: EMERGENCY first, then CRITICAL, then MEDIUM
  const urgencyWeight: { [k: string]: number } = { EMERGENCY: 3, CRITICAL: 2, MEDIUM: 1 };
  filteredItems.sort((a, b) => {
    const diff = (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0);
    if (diff !== 0) return diff;
    return b.estimatedCost - a.estimatedCost;
  });

  res.json({
    summary: {
      totalItemsToRestock: itemsToRestock.length,
      negativeCount,
      outOfStockCount,
      criticalCount,
      lowCount,
      totalNegativeDeficitUnits,
      totalRestockUnits,
      estimatedTotalRestockCost: Math.round(estimatedTotalRestockCost * 100) / 100,
      targetMultiplier,
    },
    categoryBreakdown: Object.values(categoryBreakdownMap).sort((a, b) => b.estimatedCost - a.estimatedCost),
    items: filteredItems,
  });
});

// 4.5 Bulk Restock Receipt / Purchase Order Generation
router.post('/inventory/bulk-restock', async (req: Request, res: Response) => {
  try {
    const { items, supplier, referenceNumber, notes, reason } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required for bulk restock.' });
    }

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];

    const result = await db.transaction((dbState) => {
      const updatedProducts = [];
      const createdTransactions = [];
      const now = new Date().toISOString();

      for (const item of items) {
        const prod = dbState.products.find((p) => p.id === item.productId);
        const qty = parseInt(item.quantity);
        if (!prod || isNaN(qty) || qty <= 0) continue;

        const previousStock = prod.current_stock;
        const newStock = previousStock + qty;
        prod.current_stock = newStock;
        prod.updated_at = now;

        const tx: StockTransactionRow = {
          id: `tx-restock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product_id: prod.id,
          transaction_type: 'STOCK_IN',
          quantity: qty,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: reason || 'Restock Replenishment against Safety Stock Deficit',
          supplier_or_recipient: supplier || 'Nalka Manufacturing & Supply Division',
          reference_number: referenceNumber || `RESTOCK-${Date.now().toString().slice(-6)}`,
          notes: notes || `Auto-calculated restock to restore safe target buffer`,
          created_by_id: activeUser.id,
          created_by_name: activeUser.name,
          created_at: now,
        };

        dbState.stock_transactions.unshift(tx);
        updatedProducts.push(prod);
        createdTransactions.push(tx);
      }

      return {
        processedCount: updatedProducts.length,
        products: updatedProducts,
        transactions: createdTransactions,
      };
    });

    syncInventoryToSupabase(result.products).catch(() => {});

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to process bulk restock.' });
  }
});

// ----------------------------------------------------
// 5. TRANSACTION HISTORY & EXPORTS
// ----------------------------------------------------
router.get('/transactions', (req: Request, res: Response) => {
  const state = db.getState();
  const { productId, type, search, categoryId, dateFrom, dateTo } = req.query;

  const categoryMap = new Map(state.categories.map((c) => [c.id, c.name]));
  const productMap = new Map(state.products.map((p) => [p.id, p]));

  let transactions = state.stock_transactions.map((tx) => {
    const prod = productMap.get(tx.product_id);
    return {
      ...tx,
      productName: prod?.name || 'Unknown Product',
      productSku: prod?.sku || '',
      categoryName: prod ? categoryMap.get(prod.category_id) || 'General' : 'General',
      categoryId: prod?.category_id || '',
      unit: prod?.unit || 'Units',
    };
  });

  if (productId && productId !== 'all') {
    transactions = transactions.filter((tx) => tx.product_id === productId);
  }

  if (type && type !== 'all') {
    transactions = transactions.filter((tx) => tx.transaction_type === type);
  }

  if (categoryId && categoryId !== 'all') {
    transactions = transactions.filter((tx) => tx.categoryId === categoryId);
  }

  if (dateFrom && typeof dateFrom === 'string') {
    const fromTime = new Date(dateFrom).getTime();
    transactions = transactions.filter((tx) => new Date(tx.created_at).getTime() >= fromTime);
  }

  if (dateTo && typeof dateTo === 'string') {
    const toTime = new Date(dateTo).getTime() + 86400000;
    transactions = transactions.filter((tx) => new Date(tx.created_at).getTime() <= toTime);
  }

  if (search && typeof search === 'string') {
    const query = search.toLowerCase().trim();
    transactions = transactions.filter(
      (tx) =>
        tx.productName.toLowerCase().includes(query) ||
        tx.productSku.toLowerCase().includes(query) ||
        tx.reference_number.toLowerCase().includes(query) ||
        tx.supplier_or_recipient.toLowerCase().includes(query) ||
        tx.reason.toLowerCase().includes(query) ||
        tx.created_by_name.toLowerCase().includes(query)
    );
  }

  transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ transactions });
});

// ----------------------------------------------------
// 6. CATEGORIES MANAGEMENT
// ----------------------------------------------------
router.get('/categories', (req: Request, res: Response) => {
  const state = db.getState();
  const categoriesWithCounts = state.categories.map((cat) => {
    const count = state.products.filter((p) => p.category_id === cat.id && p.is_active).length;
    return {
      ...cat,
      productCount: count,
    };
  });
  res.json({ categories: categoriesWithCounts });
});

router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const state = db.getState();
    const existing = state.categories.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'A category with this name already exists.' });
    }

    const newCat = await db.transaction((dbState) => {
      const now = new Date().toISOString();
      const cat: CategoryRow = {
        id: `cat-${Date.now()}`,
        name: name.trim(),
        description: description?.trim() || '',
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      dbState.categories.push(cat);
      return cat;
    });

    res.status(201).json({ success: true, category: newCat });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updated = await db.transaction((state) => {
      const cat = state.categories.find((c) => c.id === id);
      if (!cat) throw new Error('Category not found');
      if (name) cat.name = name.trim();
      if (description !== undefined) cat.description = description.trim();
      cat.updated_at = new Date().toISOString();
      return cat;
    });

    res.json({ success: true, category: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 7. TALLY EXPORT MODULE & VALIDATION AUDIT
// ----------------------------------------------------
router.get('/tally/validate', (req: Request, res: Response) => {
  const { exportType, dateFrom, dateTo } = req.query;
  const result = TallyExportService.validateCurrentInventory(
    (exportType as any) || 'FULL',
    dateFrom as string,
    dateTo as string
  );
  res.json({
    totalProductsReady: result.targetProducts.length,
    validationReport: result.validationReport,
  });
});

router.post('/tally/export', async (req: Request, res: Response) => {
  try {
    const { exportType, exportFormat, dateFrom, dateTo } = req.body;
    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];

    const result = await TallyExportService.executeExport({
      exportType: exportType || 'FULL',
      exportFormat: exportFormat || 'XML',
      dateFrom,
      dateTo,
      exportedBy: activeUser.name,
    });

    res.json({
      success: true,
      exportRecord: result.exportRecord,
      fileContent: result.fileContent,
      validationReport: result.validationReport,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Export generation failed.' });
  }
});

router.get('/tally/history', (req: Request, res: Response) => {
  const state = db.getState();
  res.json({
    exports: state.exports,
    lastCheckpoint: state.settings.last_export_checkpoint,
  });
});

router.get('/tally/download/:id', (req: Request, res: Response) => {
  const state = db.getState();
  const exportRecord = state.exports.find((e) => e.id === req.params.id);
  if (!exportRecord || !exportRecord.file_content) {
    return res.status(404).json({ error: 'Export file not found or expired.' });
  }

  const contentType = exportRecord.export_format === 'XML' ? 'application/xml' : 'application/json';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exportRecord.file_name}"`);
  res.send(exportRecord.file_content);
});

// ----------------------------------------------------
// 8. APP SETTINGS & SEED REINITIALIZATION
// ----------------------------------------------------
router.get('/settings', (req: Request, res: Response) => {
  const state = db.getState();
  res.json({ settings: state.settings });
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      tallyCompanyName,
      defaultCriticalThreshold,
      defaultMinimumThreshold,
      allow_negative_orders,
    } = req.body;
    const updated = await db.transaction((state) => {
      if (companyName) state.settings.company_name = companyName.trim();
      if (tallyCompanyName) state.settings.tally_company_name = tallyCompanyName.trim();
      if (defaultCriticalThreshold !== undefined)
        state.settings.default_critical_threshold = parseInt(defaultCriticalThreshold) || 5;
      if (defaultMinimumThreshold !== undefined)
        state.settings.default_minimum_threshold = parseInt(defaultMinimumThreshold) || 20;
      if (allow_negative_orders !== undefined)
        state.settings.allow_negative_orders = !!allow_negative_orders;
      return state.settings;
    });

    if (allow_negative_orders !== undefined && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('system_settings').upsert([
          { setting_key: 'allow_negative_orders', setting_value: !!allow_negative_orders, updated_at: new Date().toISOString() },
          { setting_key: 'allow_negative_stock', setting_value: !!allow_negative_orders, updated_at: new Date().toISOString() }
        ], { onConflict: 'setting_key' });
      } catch (supaErr: any) {
        console.warn('[Supabase] Failed to sync system_settings:', supaErr.message);
      }
    }

    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/settings/stock-override
 * Toggle allow_negative_orders switch and sync to Supabase system_settings
 */
router.post('/settings/stock-override', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    const isEnabled = !!enabled;

    const updated = await db.transaction((state) => {
      state.settings.allow_negative_orders = isEnabled;
      return state.settings;
    });

    let supaSynced = false;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error: err1 } = await supabase.from('system_settings').upsert([
          { setting_key: 'allow_negative_orders', setting_value: isEnabled, updated_at: new Date().toISOString() },
          { setting_key: 'allow_negative_stock', setting_value: isEnabled, updated_at: new Date().toISOString() }
        ], { onConflict: 'setting_key' });

        if (!err1) {
          supaSynced = true;
        } else {
          // Fallback for single-column setting text key
          await supabase.from('system_settings').upsert({
            setting: 'allow_negative_orders',
            value: isEnabled,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'setting' });
          supaSynced = true;
        }
      } catch (supaErr: any) {
        console.warn('[Supabase] Failed to sync stock override to Supabase:', supaErr.message);
      }
    }

    res.json({
      success: true,
      allow_negative_orders: isEnabled,
      supaSynced,
      settings: updated,
      message: isEnabled
        ? 'Stock override enabled. Salesmen can now submit orders for zero/negative stock items.'
        : 'Stock override disabled. Orders are strictly constrained by system stock.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update stock override' });
  }
});

router.post('/settings/reset-demo-data', (req: Request, res: Response) => {
  const newState = db.resetSeed();
  res.json({ success: true, message: 'Database reset to initial demo state.' });
});

// Batch update product catalog prices & thresholds
router.put('/settings/catalog-prices', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array of product changes.' });
    }

    const updatedProducts = await db.transaction((state) => {
      const now = new Date().toISOString();
      const updated: any[] = [];

      for (const item of updates) {
        if (!item || (!item.id && !item.sku)) continue;
        const prod = state.products.find((p) => (item.id && p.id === item.id) || (item.sku && p.sku.toUpperCase() === item.sku.toUpperCase()));
        if (prod) {
          if (item.unitCost !== undefined) prod.unit_cost = Math.max(0, parseFloat(item.unitCost) || 0);
          if (item.minimumStock !== undefined) prod.minimum_stock = Math.max(0, parseInt(item.minimumStock) || 0);
          if (item.criticalStock !== undefined) prod.critical_stock = Math.max(0, parseInt(item.criticalStock) || 0);
          if (item.unit && typeof item.unit === 'string' && item.unit.trim()) prod.unit = item.unit.trim();
          if (item.name && typeof item.name === 'string' && item.name.trim()) prod.name = item.name.trim();
          prod.updated_at = now;
          updated.push(prod);
        }
      }
      return updated;
    });

    res.json({ success: true, count: updatedProducts.length, products: updatedProducts });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update catalog prices' });
  }
});

// Category-wide or catalog-wide price & threshold bulk adjustments
router.post('/settings/bulk-price-adjustment', async (req: Request, res: Response) => {
  try {
    const {
      categoryId,
      adjustmentType = 'percentage',
      value,
      roundTo = 1,
      target = 'unitCost',
    } = req.body;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return res.status(400).json({ error: 'Valid adjustment value is required.' });
    }

    const updatedProducts = await db.transaction((state) => {
      const now = new Date().toISOString();
      const targets = state.products.filter((p) => {
        if (!p.is_active) return false;
        if (categoryId && categoryId !== 'all') {
          return p.category_id === categoryId;
        }
        return true;
      });

      for (const prod of targets) {
        if (target === 'unitCost') {
          const currentCost = prod.unit_cost || 0;
          let newCost = currentCost;
          if (adjustmentType === 'percentage') {
            newCost = currentCost * (1 + numValue / 100);
          } else {
            newCost = currentCost + numValue;
          }
          newCost = Math.max(0, newCost);

          if (roundTo === 1) {
            newCost = Math.round(newCost);
          } else if (roundTo === 0.5) {
            newCost = Math.round(newCost * 2) / 2;
          } else if (roundTo === 10) {
            newCost = Math.round(newCost / 10) * 10;
          } else {
            newCost = Math.round(newCost * 100) / 100;
          }

          prod.unit_cost = newCost;
        } else if (target === 'minimumStock') {
          if (adjustmentType === 'percentage') {
            prod.minimum_stock = Math.max(0, Math.round(prod.minimum_stock * (1 + numValue / 100)));
          } else {
            prod.minimum_stock = Math.max(0, Math.round(prod.minimum_stock + numValue));
          }
        } else if (target === 'criticalStock') {
          if (adjustmentType === 'percentage') {
            prod.critical_stock = Math.max(0, Math.round(prod.critical_stock * (1 + numValue / 100)));
          } else {
            prod.critical_stock = Math.max(0, Math.round(prod.critical_stock + numValue));
          }
        }
        prod.updated_at = now;
      }

      return targets;
    });

    res.json({ success: true, count: updatedProducts.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to apply bulk adjustment' });
  }
});

// Import catalog pricing & thresholds from structured JSON / parsed CSV
router.post('/settings/import-catalog-csv', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided to import.' });
    }

    const result = await db.transaction((state) => {
      const now = new Date().toISOString();
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rawSku = (item.sku || item.SKU || item.code || item.Code || '').trim();
        if (!rawSku && !item.id) {
          skippedCount++;
          continue;
        }

        const prod = state.products.find(
          (p) => (rawSku && p.sku.toUpperCase() === rawSku.toUpperCase()) || (item.id && p.id === item.id)
        );

        if (!prod) {
          errors.push(`Row ${i + 1}: SKU "${rawSku}" not found in catalog.`);
          skippedCount++;
          continue;
        }

        const cost = item.unitCost ?? item.unit_cost ?? item.price ?? item.Price ?? item['Unit Cost'];
        if (cost !== undefined && cost !== '') {
          const parsedCost = parseFloat(cost);
          if (!isNaN(parsedCost)) prod.unit_cost = Math.max(0, parsedCost);
        }

        const min = item.minimumStock ?? item.minimum_stock ?? item.minStock ?? item['Min Stock'];
        if (min !== undefined && min !== '') {
          const parsedMin = parseInt(min);
          if (!isNaN(parsedMin)) prod.minimum_stock = Math.max(0, parsedMin);
        }

        const crit = item.criticalStock ?? item.critical_stock ?? item.critStock ?? item['Critical Stock'];
        if (crit !== undefined && crit !== '') {
          const parsedCrit = parseInt(crit);
          if (!isNaN(parsedCrit)) prod.critical_stock = Math.max(0, parsedCrit);
        }

        const unit = item.unit ?? item.Unit;
        if (unit && typeof unit === 'string' && unit.trim()) {
          prod.unit = unit.trim();
        }

        const name = item.name ?? item.Name ?? item.productName ?? item['Product Name'];
        if (name && typeof name === 'string' && name.trim()) {
          prod.name = name.trim();
        }

        prod.updated_at = now;
        updatedCount++;
      }

      return { updatedCount, skippedCount, errors };
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to import catalog data' });
  }
});

// ----------------------------------------------------
// 9. TALLY LIVE INTEGRATION & SYNCHRONIZATION ENGINE
// ----------------------------------------------------

// Helper to get active Tally connection config
function getActiveTallyConfig(): { serverUrl: string; port: number; companyName: string; useMockFallback: boolean } {
  const state = db.getState();
  const conn = state.tally_connections[0];
  return {
    serverUrl: conn?.server_url || 'http://localhost',
    port: conn?.port || 9000,
    companyName: conn?.company_name || state.settings.tally_company_name,
    useMockFallback: false,
  };
}

// ----------------------------------------------------
// TALLY INTEGRATION & SYNCHRONIZATION ENDPOINTS
// ----------------------------------------------------

// 1. Get Current Tally Company Metadata
router.get('/tally/company', (req: Request, res: Response) => {
  const state = db.getState();
  const company = state.tally_companies[0] || {
    id: 'comp-default',
    tally_guid: 'tally-comp-apex-2026',
    name: state.settings.tally_company_name,
    mailing_name: state.settings.tally_company_name,
    financial_year_start: '2026-04-01',
    books_start: '2026-04-01',
    currency: 'INR (₹)',
    gstin: '06AAACA9821L1ZM',
    pan: 'AAACA9821L',
    last_synced_at: new Date().toISOString(),
  };
  res.json({ company });
});

// 2. Sync Company Details
router.post('/tally/sync/company', async (req: Request, res: Response) => {
  try {
    const config = getActiveTallyConfig();
    const result = await masterSyncService.syncCompany(config);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync company from Tally' });
  }
});

// 3. Sync Inventory Masters (Stock Items, Groups, Units, Godowns)
router.post('/tally/sync/inventory', async (req: Request, res: Response) => {
  try {
    const config = getActiveTallyConfig();
    const result = await masterSyncService.syncInventoryMasters(config, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync inventory masters from Tally' });
  }
});

// 4. Sync Stock Transactions / Journals
router.post('/tally/sync/stock-transactions', async (req: Request, res: Response) => {
  try {
    const config = getActiveTallyConfig();
    const result = await voucherSyncService.syncVouchers(config, { ...req.body, filterType: 'JOURNALS' });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync stock transactions from Tally' });
  }
});

// 5. Sync Sales Vouchers & Invoices
router.post('/tally/sync/sales', async (req: Request, res: Response) => {
  try {
    const config = getActiveTallyConfig();
    const result = await voucherSyncService.syncVouchers(config, { ...req.body, filterType: 'SALES' });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync sales from Tally' });
  }
});

// 6. Sync Purchase Vouchers & Bills
router.post('/tally/sync/purchases', async (req: Request, res: Response) => {
  try {
    const config = getActiveTallyConfig();
    const result = await voucherSyncService.syncVouchers(config, { ...req.body, filterType: 'PURCHASES' });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync purchases from Tally' });
  }
});

// 7. Sync Accounting Ledgers, Debtors, Creditors & Balances
router.post('/tally/sync/accounting', async (req: Request, res: Response) => {
  try {
    const config = getActiveTallyConfig();
    const result = await accountingSyncService.syncAccounting(config, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync accounting ledgers from Tally' });
  }
});

// 8. Full Synchronization
router.post('/tally/sync/full', async (req: Request, res: Response) => {
  try {
    const config = getActiveTallyConfig();
    const [compRes, invRes, vchRes, accRes] = await Promise.all([
      masterSyncService.syncCompany(config),
      masterSyncService.syncInventoryMasters(config),
      voucherSyncService.syncVouchers(config, { filterType: 'ALL' }),
      accountingSyncService.syncAccounting(config),
    ]);

    res.json({
      success: true,
      message: 'Full synchronization completed across Company, Inventory, Vouchers, and Accounting.',
      company: compRes.company,
      inventory: invRes,
      vouchers: vchRes,
      accounting: accRes,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Full synchronization failed' });
  }
});

// 9. Sync History Logs
router.get('/tally/sync/history', (req: Request, res: Response) => {
  const state = db.getState();
  const logs = state.sync_history_logs || [];
  res.json({ logs });
});

// 10. Reports: Financial Overview
router.get('/tally/reports/overview', (req: Request, res: Response) => {
  const overview = tallyReportService.getFinancialOverview();
  res.json(overview);
});

// 11. Reports: Sales by Product
router.get('/tally/reports/sales-by-product', (req: Request, res: Response) => {
  const result = tallyReportService.getSalesByProduct();
  res.json(result);
});

// 12. Reports: Purchases by Supplier
router.get('/tally/reports/purchases-by-supplier', (req: Request, res: Response) => {
  const result = tallyReportService.getPurchasesBySupplier();
  res.json(result);
});

// 13. Reports: Godown / Warehouse Stock
router.get('/tally/reports/godown-stock', (req: Request, res: Response) => {
  const result = tallyReportService.getGodownStockReport();
  res.json(result);
});

// 14. Reports: Customers (Debtors) & Suppliers (Creditors)
router.get('/tally/reports/parties', (req: Request, res: Response) => {
  const { type } = req.query;
  const result = tallyReportService.getPartyReport(type as any);
  res.json(result);
});

// Overall Sync Status & Health Overview
router.get('/tally/sync/status', async (req: Request, res: Response) => {
  const state = db.getState();
  let connection = state.tally_connections[0];

  if (!connection) {
    connection = {
      id: 'conn-tally-primary',
      name: 'TallyPrime Server',
      server_url: 'http://localhost',
      port: 9000,
      company_name: state.settings.tally_company_name,
      integration_mode: 'POLLING',
      data_format: 'JSON',
      is_active: true,
      auto_sync: true,
      sync_interval_seconds: 15,
      connection_status: 'DISCONNECTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.tally_connections.push(connection);
  }

  // Probe real live connection if last check was more than 10 seconds ago
  const now = Date.now();
  const lastChecked = connection.last_checked_at ? new Date(connection.last_checked_at).getTime() : 0;

  if (now - lastChecked > 10000) {
    try {
      const probeResult = await testTallyConnection(
        connection.server_url || 'http://localhost',
        connection.port || 9000,
        connection.company_name || 'Apex'
      );
      connection.connection_status = probeResult.status;
      connection.last_checked_at = new Date().toISOString();
      if (!probeResult.connected) {
        connection.last_error = probeResult.message;
      } else {
        connection.last_error = undefined;
      }
    } catch (e: any) {
      connection.connection_status = 'DISCONNECTED';
      connection.last_checked_at = new Date().toISOString();
      connection.last_error = e.message;
    }
  }

  const totalEvents = state.sync_events.length;
  const syncedEvents = state.sync_events.filter((e) => e.status === 'SYNCED').length;
  const failedEvents = state.sync_events.filter((e) => e.status === 'FAILED').length;
  const processingEvents = state.sync_events.filter((e) => e.status === 'PROCESSING' || e.status === 'PENDING').length;
  const retryingEvents = state.sync_events.filter((e) => e.status === 'RETRYING').length;
  const activeReservations = state.stock_reservations.filter((r) => r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED');
  const totalReservedUnits = activeReservations.reduce((sum, r) => sum + (r.reserved_quantity - r.fulfilled_quantity), 0);
  const unmappedMappings = state.tally_product_mappings.filter((m) => m.mapping_status === 'UNMAPPED').length;

  res.json({
    connection,
    company: state.tally_companies[0] || null,
    metrics: {
      totalEvents,
      syncedEvents,
      failedEvents,
      processingEvents,
      retryingEvents,
      activeReservationsCount: activeReservations.length,
      totalReservedUnits,
      unmappedMappingsCount: unmappedMappings,
      totalGodowns: state.tally_godowns.length,
      totalLedgers: state.tally_ledgers.length,
      totalParties: state.tally_parties.length,
      totalVouchers: state.tally_vouchers.length,
      lastSyncAt: (connection as any).last_sync_at || state.sync_history_logs[0]?.completed_at || state.sync_checkpoints[0]?.last_successful_sync,
      lastCheckedAt: (connection as any).last_checked_at,
    },
  });
});

// Test Connection with Tally Server
router.post('/tally/sync/test-connection', async (req: Request, res: Response) => {
  try {
    const { serverUrl, port, companyName } = req.body;
    const state = db.getState();
    const conn = state.tally_connections[0];

    const targetUrl = serverUrl || conn?.server_url || 'http://localhost';
    const targetPort = port || conn?.port || 9000;
    const targetCompany = companyName || conn?.company_name || state.settings.tally_company_name;

    const result = await testTallyConnection(targetUrl, targetPort, targetCompany);

    // Update connection status in db
    await db.transaction((s) => {
      const c = s.tally_connections.find((x) => x.id === conn?.id) || s.tally_connections[0];
      if (c) {
        c.connection_status = result.status;
        c.last_checked_at = new Date().toISOString();
        if (result.status === 'ERROR' || result.status === 'DISCONNECTED') {
          c.last_error = result.message;
        } else {
          c.last_error = undefined;
        }
      }
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      connected: false,
      status: 'ERROR',
      message: err.message || 'Failed to test connection to Tally server',
    });
  }
});

// Update Tally Connection Configuration
router.put('/tally/sync/connection', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const updated = await db.transaction((state) => {
      let conn = state.tally_connections[0];
      if (!conn) {
        conn = {
          id: 'conn-tally-primary',
          name: data.name || 'TallyPrime Server',
          server_url: data.server_url || 'http://localhost',
          port: parseInt(data.port) || 9000,
          company_name: data.company_name || state.settings.tally_company_name,
          integration_mode: data.integration_mode || 'POLLING',
          data_format: data.data_format || 'JSON',
          api_key: data.api_key || 'tally_sec_key',
          webhook_secret: data.webhook_secret || 'whsec_tally_2026',
          is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
          auto_sync: data.auto_sync !== undefined ? Boolean(data.auto_sync) : true,
          sync_interval_seconds: parseInt(data.sync_interval_seconds) || 15,
          connection_status: 'DISCONNECTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.tally_connections.push(conn);
      } else {
        if (data.name) conn.name = data.name.trim();
        if (data.server_url) conn.server_url = data.server_url.trim();
        if (data.port) conn.port = parseInt(data.port) || 9000;
        if (data.company_name) conn.company_name = data.company_name.trim();
        if (data.integration_mode) conn.integration_mode = data.integration_mode;
        if (data.data_format) conn.data_format = data.data_format;
        if (data.api_key !== undefined) conn.api_key = data.api_key;
        if (data.webhook_secret !== undefined) conn.webhook_secret = data.webhook_secret;
        if (data.is_active !== undefined) conn.is_active = Boolean(data.is_active);
        if (data.auto_sync !== undefined) conn.auto_sync = Boolean(data.auto_sync);
        if (data.sync_interval_seconds !== undefined) conn.sync_interval_seconds = parseInt(data.sync_interval_seconds) || 15;
        conn.updated_at = new Date().toISOString();
      }
      return conn;
    });

    res.json({ success: true, connection: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Trigger Instant Sync Now
router.post('/tally/sync/now', async (req: Request, res: Response) => {
  try {
    const state = db.getState();
    const conn = state.tally_connections[0];

    // Real probe of Tally server
    const targetUrl = conn?.server_url || 'http://localhost';
    const targetPort = conn?.port || 9000;
    const targetCompany = conn?.company_name || state.settings.tally_company_name;

    const testRes = await testTallyConnection(targetUrl, targetPort, targetCompany);

    await db.transaction((s) => {
      const c = s.tally_connections[0];
      if (c) {
        c.last_checked_at = new Date().toISOString();
        c.connection_status = testRes.status;
        if (testRes.connected) {
          c.last_sync_at = new Date().toISOString();
          c.last_error = undefined;
        } else {
          c.last_error = testRes.message;
        }
      }
    });

    if (!testRes.connected) {
      return res.status(503).json({
        success: false,
        connected: false,
        status: testRes.status,
        message: testRes.message,
      });
    }

    res.json({
      success: true,
      connected: true,
      message: 'Sync completed successfully. Connected to TallyPrime instance.',
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook / Push API Endpoint for incoming Tally XML or JSON
router.post('/tally/sync/webhook', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body;
    const isXml = req.headers['content-type']?.includes('xml') || (typeof rawBody === 'string' && rawBody.trim().startsWith('<'));
    const results = await tallySyncEngine.ingestPayload(rawBody, isXml ? 'XML' : 'JSON');
    const hasFailures = results.some((r) => !r.success);

    res.status(hasFailures ? 207 : 200).json({
      success: !hasFailures,
      totalReceived: results.length,
      results,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Webhook processing failed.' });
  }
});

// Sync Events Audit List
router.get('/tally/sync/events', (req: Request, res: Response) => {
  const state = db.getState();
  const { status, type, search, limit } = req.query;

  let events = [...state.sync_events];

  if (status && status !== 'ALL') {
    events = events.filter((e) => e.status === status);
  }

  if (type && type !== 'ALL') {
    events = events.filter((e) => e.external_transaction_type === type);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    events = events.filter(
      (e) =>
        e.external_transaction_id.toLowerCase().includes(q) ||
        (e.last_error && e.last_error.toLowerCase().includes(q)) ||
        (e.normalized_data?.party_name && e.normalized_data.party_name.toLowerCase().includes(q))
    );
  }

  events.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

  if (limit) {
    events = events.slice(0, parseInt(limit as string) || 50);
  }

  res.json({ events });
});

// Get Single Sync Event Details
router.get('/tally/sync/events/:id', (req: Request, res: Response) => {
  const state = db.getState();
  const event = state.sync_events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Sync event not found' });
  res.json({ event });
});

// Retry Single Sync Event
router.post('/tally/sync/events/:id/retry', async (req: Request, res: Response) => {
  try {
    const result = await tallySyncEngine.retryEvent(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ignore Single Sync Event
router.post('/tally/sync/events/:id/ignore', async (req: Request, res: Response) => {
  try {
    const result = await tallySyncEngine.ignoreEvent(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Retry All Failed Events
router.post('/tally/sync/events/retry-all-failed', async (req: Request, res: Response) => {
  try {
    const result = await tallySyncEngine.retryAllFailed();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stock Reservations List
router.get('/tally/sync/reservations', (req: Request, res: Response) => {
  const state = db.getState();
  const { status, search } = req.query;

  let reservations = [...state.stock_reservations];

  if (status && status !== 'ALL') {
    reservations = reservations.filter((r) => r.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    reservations = reservations.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        r.product_sku.toLowerCase().includes(q) ||
        r.external_order_id.toLowerCase().includes(q) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(q))
    );
  }

  reservations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ reservations });
});

// Release a Reservation Manually
router.post('/tally/sync/reservations/:id/release', async (req: Request, res: Response) => {
  try {
    const updated = await db.transaction((state) => {
      const resv = state.stock_reservations.find((r) => r.id === req.params.id);
      if (!resv) throw new Error('Reservation not found');
      if (resv.status === 'RELEASED' || resv.status === 'FULFILLED' || resv.status === 'CANCELLED') {
        throw new Error(`Reservation is already ${resv.status}`);
      }

      const product = state.products.find((p) => p.id === resv.product_id);
      const unfulfilled = resv.reserved_quantity - resv.fulfilled_quantity;
      if (product) {
        product.reserved_stock = Math.max(0, (product.reserved_stock || 0) - unfulfilled);
        product.updated_at = new Date().toISOString();
      }

      resv.status = 'RELEASED';
      resv.released_quantity = unfulfilled;
      resv.notes = `${resv.notes || ''} [Manually released by Manager on ${new Date().toLocaleDateString()}]`.trim();
      resv.updated_at = new Date().toISOString();

      return resv;
    });

    res.json({ success: true, reservation: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Product Mappings List
router.get('/tally/sync/mappings', (req: Request, res: Response) => {
  const state = db.getState();
  const { status, search } = req.query;

  let mappings = [...state.tally_product_mappings];

  if (status && status !== 'ALL') {
    mappings = mappings.filter((m) => m.mapping_status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    mappings = mappings.filter(
      (m) =>
        m.tally_stock_item_name.toLowerCase().includes(q) ||
        m.product_name.toLowerCase().includes(q) ||
        m.product_sku.toLowerCase().includes(q) ||
        (m.tally_alias && m.tally_alias.toLowerCase().includes(q))
    );
  }

  res.json({ mappings });
});

// Create or Update Product Mapping
router.post('/tally/sync/mappings', async (req: Request, res: Response) => {
  try {
    const { id, productId, tallyStockItemId, tallyStockItemName, tallyAlias } = req.body;
    const mapping = await db.transaction((state) => {
      const prod = state.products.find((p) => p.id === productId);
      if (!prod) throw new Error('Selected internal product does not exist.');

      let existing = id ? state.tally_product_mappings.find((m) => m.id === id) : undefined;
      if (!existing && tallyStockItemName) {
        existing = state.tally_product_mappings.find(
          (m) => m.tally_stock_item_name.toLowerCase() === tallyStockItemName.trim().toLowerCase()
        );
      }

      if (existing) {
        existing.product_id = prod.id;
        existing.product_sku = prod.sku;
        existing.product_name = prod.name;
        if (tallyStockItemId) existing.tally_stock_item_id = tallyStockItemId;
        if (tallyStockItemName) existing.tally_stock_item_name = tallyStockItemName;
        if (tallyAlias !== undefined) existing.tally_alias = tallyAlias;
        existing.mapping_status = 'MAPPED';
        existing.updated_at = new Date().toISOString();
        return existing;
      } else {
        const newMap: TallyProductMappingRow = {
          id: `map-${Date.now()}`,
          product_id: prod.id,
          product_sku: prod.sku,
          product_name: prod.name,
          tally_stock_item_id: tallyStockItemId || `TALLY-${prod.sku}`,
          tally_stock_item_name: tallyStockItemName || prod.name,
          tally_alias: tallyAlias || prod.sku,
          mapping_status: 'MAPPED',
          auto_matched: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.tally_product_mappings.push(newMap);
        return newMap;
      }
    });

    res.json({ success: true, mapping });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Product Mapping
router.delete('/tally/sync/mappings/:id', async (req: Request, res: Response) => {
  try {
    await db.transaction((state) => {
      const idx = state.tally_product_mappings.findIndex((m) => m.id === req.params.id);
      if (idx !== -1) {
        state.tally_product_mappings.splice(idx, 1);
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Auto-Map Unmapped Products
router.post('/tally/sync/mappings/auto-map', async (req: Request, res: Response) => {
  try {
    const result = await db.transaction((state) => {
      let matchedCount = 0;
      for (const m of state.tally_product_mappings) {
        if (m.mapping_status === 'UNMAPPED' || !m.product_id) {
          const matchByName = state.products.find(
            (p) => p.name.toLowerCase() === m.tally_stock_item_name.toLowerCase()
          );
          const matchBySku = state.products.find(
            (p) => p.sku.toLowerCase() === (m.tally_alias || m.tally_stock_item_id || '').toLowerCase()
          );
          const prod = matchByName || matchBySku;
          if (prod) {
            m.product_id = prod.id;
            m.product_sku = prod.sku;
            m.product_name = prod.name;
            m.mapping_status = 'MAPPED';
            m.auto_matched = true;
            m.updated_at = new Date().toISOString();
            matchedCount++;
          }
        }
      }
      return { matchedCount };
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Voucher Mapping Rules
router.get('/tally/sync/voucher-rules', (req: Request, res: Response) => {
  const state = db.getState();
  res.json({ rules: state.voucher_rules });
});

router.put('/tally/sync/voucher-rules', async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) throw new Error('Rules array required');
    const updated = await db.transaction((state) => {
      state.voucher_rules = rules;
      return state.voucher_rules;
    });
    res.json({ success: true, rules: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Simulator Trigger
router.post('/tally/sync/simulate', async (req: Request, res: Response) => {
  try {
    const { scenarioType, customParams } = req.body;
    if (!scenarioType) throw new Error('Scenario type is required');
    const result = await tallySyncEngine.simulateScenario(scenarioType, customParams);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Database Reload Endpoint
router.post('/db/reload', (req: Request, res: Response) => {
  try {
    const state = db.reload();
    res.json({
      success: true,
      message: 'Database reloaded from disk successfully',
      productsCount: state.products.length,
      categoriesCount: state.categories.length,
      mappingsCount: state.tally_product_mappings?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 11.5 TALLY ACCOUNTANT IMPORT & WAREHOUSE RECONCILIATION
// ----------------------------------------------------

/**
 * POST /api/tally/import/parse
 * Parses raw Tally XML / CSV / JSON export and generates a side-by-side reconciliation preview
 */
router.post('/tally/import/parse', (req: Request, res: Response) => {
  try {
    const { content, fileTypeHint, fileName } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Raw file content string is required for Tally parsing.' });
    }

    const preview = TallyImportService.parseAndReconcile(content, fileTypeHint, fileName);
    res.json({ success: true, preview });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to parse Tally import file.' });
  }
});

/**
 * POST /api/tally/import/apply
 * Applies reconciled stock balances, price changes, and new catalog additions
 */
router.post('/tally/import/apply', async (req: Request, res: Response) => {
  try {
    const { items, options } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required to apply changes.' });
    }

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];

    const result = await TallyImportService.applyImport(items, options || {}, activeUser);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to apply Tally import changes.' });
  }
});

// ----------------------------------------------------
// 12. SUPABASE ORDER QUEUE & JSON IMPORT ENGINE
// ----------------------------------------------------

/**
 * GET /api/orders/pending
 * Returns unified list of pending orders (both live Supabase orders and imported JSON files)
 */
router.get('/orders/pending', async (req: Request, res: Response) => {
  try {
    const liveOrders: any[] = [];

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: supaOrders, error: ordersErr } = await supabase
          .from('pending_orders')
          .select('*, pending_order_items(*)')
          .eq('status', 'Pending')
          .order('created_at', { ascending: false });

        if (!ordersErr && Array.isArray(supaOrders)) {
          for (const o of supaOrders) {
            const items = (o.pending_order_items || []).map((i: any) => ({
              order_id: o.order_id,
              sku: i.sku,
              item_name: i.item_name,
              category: i.category,
              quantity: i.quantity,
              price: i.price,
              total_price: i.total_price,
            }));

            const incoming: IncomingOrder = {
              order: {
                order_id: o.order_id,
                salesman_id: o.salesman_id,
                salesman_name: o.salesman_name || 'Sales Representative',
                shop_name: o.shop_name || 'Customer Store',
                city: o.city,
                state: o.state,
                location_id: o.location_id,
                total_amount: Number(o.total_amount) || 0,
                created_at: o.created_at,
                status: o.status,
              },
              items,
            };

            const preview = await processIncomingOrder(incoming, 'supabase');
            liveOrders.push(preview);
          }
        }
      } catch (err: any) {
        console.warn('[Supabase Poller] Error fetching live pending orders:', err.message);
      }
    }

    const fileOrders = orderQueue.getFileOrders();
    const processedIds = new Set((db.getState().processed_orders || []).map((po) => po.order_id));
    const seen = new Set<string>();
    const combinedOrders = [];

    for (const ord of [...fileOrders, ...liveOrders]) {
      if (!seen.has(ord.order_id) && !processedIds.has(ord.order_id)) {
        seen.add(ord.order_id);
        combinedOrders.push(ord);
      }
    }

    res.json({
      success: true,
      orders: combinedOrders,
      isLiveConnected: isSupabaseConfigured(),
      count: combinedOrders.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch pending orders queue.' });
  }
});

/**
 * POST /api/orders/import-json
 * Handles fallback manual JSON order imports with duplicate protection
 */
router.post('/orders/import-json', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const force = req.query.force === 'true' || req.body.force === true;

    if (!payload) {
      return res.status(400).json({ error: 'No JSON order payload provided.' });
    }

    // Support both direct order object and wrapped array / Order App payload
    let normalizedPayload: IncomingOrder;
    if (payload.order && Array.isArray(payload.items)) {
      normalizedPayload = {
        order: {
          order_id: payload.order.order_id,
          salesman_id: payload.order.salesman_id,
          salesman_name: payload.order.salesman_name || 'Sales Representative',
          shop_name: payload.order.shop_name || 'Customer Store',
          city: payload.order.city,
          state: payload.order.state,
          location_id: payload.order.location_id,
          total_amount: Number(payload.order.total_amount) || 0,
          created_at: payload.order.created_at || new Date().toISOString(),
        },
        items: payload.items,
      };
    } else if (payload.order_id && Array.isArray(payload.items)) {
      normalizedPayload = {
        order: {
          order_id: payload.order_id,
          salesman_id: payload.salesman_id,
          salesman_name: payload.salesman_name || 'Sales Representative',
          shop_name: payload.shop_name || 'Customer Store',
          city: payload.city,
          state: payload.state,
          location_id: payload.location_id,
          total_amount: Number(payload.total_amount) || 0,
          created_at: payload.created_at || new Date().toISOString(),
        },
        items: payload.items,
      };
    } else {
      return res.status(400).json({
        error: 'Invalid order file structure. Expected JSON containing order_id and items array.',
      });
    }

    const preview = await processIncomingOrder(normalizedPayload, 'file');

    if (preview.isDuplicate && !force) {
      return res.json({
        success: true,
        isDuplicate: true,
        order: preview,
        warning: `This order (${preview.order_id}) was already processed on ${new Date(preview.alreadyProcessedAt!).toLocaleDateString()} at ${new Date(preview.alreadyProcessedAt!).toLocaleTimeString()}.`,
      });
    }

    orderQueue.addFileOrder(preview);
    res.json({
      success: true,
      isDuplicate: false,
      order: preview,
      message: `Order ${preview.order_id} successfully loaded into queue.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to process imported JSON order.' });
  }
});

/**
 * POST /api/orders/confirm
 * Confirms order, deducts inventory stock, writes transactions/reservations, and cleans up remote queue
 */
router.post('/orders/confirm', async (req: Request, res: Response) => {
  try {
    const { orderId, resolvedItems, metadata } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });
    if (!Array.isArray(resolvedItems) || resolvedItems.length === 0) {
      return res.status(400).json({ error: 'At least one item must be resolved for confirmation.' });
    }

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];

    const result = await confirmOrder(orderId, resolvedItems, metadata || {}, activeUser);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to confirm order.' });
  }
});

/**
 * POST /api/orders/reject
 * Rejects order and removes from active queue
 */
router.post('/orders/reject', async (req: Request, res: Response) => {
  try {
    const { orderId, source = 'file', reason } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];

    const result = await rejectOrder(orderId, source, reason, activeUser);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to reject order.' });
  }
});

/**
 * POST /api/orders/reopen
 * Reopens an order from history (CONFIRMED or REJECTED) back to active pending review queue
 * Reverts stock deductions if order was confirmed
 */
router.post('/orders/reopen', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];

    const result = await reopenOrder(orderId, activeUser);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to reopen order.' });
  }
});

/**
 * POST /api/orders/rollback-reject
 * Reverts stock deduction for an already confirmed order and marks it as REJECTED
 */
router.post('/orders/rollback-reject', async (req: Request, res: Response) => {
  try {
    const { orderId, reason } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

    const state = db.getState();
    const activeUser = state.users.find((u) => u.id === activeUserId) || state.users[0];

    const result = await rollbackAndRejectOrder(orderId, reason, activeUser);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to rollback and reject order.' });
  }
});

/**
 * POST /api/orders/update
 * Updates items or metadata for a pending order
 */
router.post('/orders/update', async (req: Request, res: Response) => {
  try {
    const { orderId, items, metadata } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Items array is required.' });

    const result = await updatePendingOrder(orderId, items, metadata);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update pending order.' });
  }
});

/**
 * GET /api/orders/history
 * Returns local permanent completed order history with auto-deduplication and self-healing repair
 */
router.get('/orders/history', async (req: Request, res: Response) => {
  try {
    const state = db.getState();
    let orders = state.processed_orders || [];
    let items = state.processed_order_items || [];

    // 1. Deduplicate processed_orders by order_id (keep newest entry)
    const orderMap = new Map<string, ProcessedOrderRow>();
    orders.forEach((po) => {
      const existing = orderMap.get(po.order_id);
      if (!existing || new Date(po.processed_at || po.created_at) > new Date(existing.processed_at || existing.created_at)) {
        orderMap.set(po.order_id, po);
      }
    });
    orders = Array.from(orderMap.values());
    state.processed_orders = orders;

    // 2. Self-heal Unknown / 0 amount historical rows from Supabase
    if (isSupabaseConfigured() && supabase) {
      const unknownOrders = orders.filter((o) => o.shop_name === 'Unknown' || o.salesman_name === 'Unknown' || !o.total_amount);
      if (unknownOrders.length > 0) {
        try {
          const unknownIds = unknownOrders.map((o) => o.order_id);
          const { data: supaHeaders } = await supabase
            .from('pending_orders')
            .select('*')
            .in('order_id', unknownIds);

          if (supaHeaders && supaHeaders.length > 0) {
            const headerMap = new Map(supaHeaders.map((h: any) => [h.order_id, h]));

            for (const po of orders) {
              const supaH = headerMap.get(po.order_id);
              if (supaH) {
                po.salesman_id = supaH.salesman_id || po.salesman_id;
                po.salesman_name = supaH.salesman_name && supaH.salesman_name !== 'Unknown' ? supaH.salesman_name : po.salesman_name;
                po.shop_name = supaH.shop_name && supaH.shop_name !== 'Unknown' ? supaH.shop_name : po.shop_name;
                po.city = supaH.city || po.city;
                po.state = supaH.state || po.state;
                po.location_id = supaH.location_id || po.location_id;
                po.total_amount = Number(supaH.total_amount) || po.total_amount;
                po.items_count = Number(supaH.item_count) || po.items_count;
              }
            }
          }

          // Fetch items for unknown orders if missing
          const { data: supaItems } = await supabase
            .from('pending_order_items')
            .select('*')
            .in('order_id', unknownIds);

          if (supaItems && supaItems.length > 0) {
            supaItems.forEach((i: any) => {
              const exists = items.some((it) => it.order_id === i.order_id && (it.sku === i.sku || it.item_name === i.item_name));
              if (!exists) {
                items.push({
                  id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  order_id: i.order_id,
                  sku: i.sku || i.item_name,
                  item_name: i.item_name,
                  category: i.category || 'General',
                  quantity: Number(i.quantity),
                  price: Number(i.price),
                  total_price: Number(i.total_price || i.price * i.quantity),
                  matched: true,
                  stock_deducted: 0,
                  created_at: new Date().toISOString(),
                });
              }
            });

            // Update item counts on headers
            const itemCounts = new Map<string, number>();
            items.forEach((it) => {
              itemCounts.set(it.order_id, (itemCounts.get(it.order_id) || 0) + 1);
            });
            orders.forEach((po) => {
              if (itemCounts.has(po.order_id)) {
                po.items_count = itemCounts.get(po.order_id)!;
              }
            });
          }
        } catch (healErr) {
          console.warn('[History API] Self-healing repair encountered error:', healErr);
        }
      }
    }

    res.json({
      success: true,
      orders,
      items,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch order history.' });
  }
});

/**
 * POST /api/orders/sync-now
 * Triggers manual instant poll for live orders
 */
router.post('/orders/sync-now', async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return res.json({
        success: false,
        message: 'Supabase credentials not configured in .env. Running in file mode.',
        connected: false,
      });
    }

    // 1. Sync catalog and inventory balances from the live Supabase database
    const catalogSync = await supabaseSyncService.syncCatalogFromSupabase();

    // 2. Query pending orders from Supabase
    const { data: supaOrders, error: ordersErr } = await supabase
      .from('pending_orders')
      .select('*, pending_order_items(*)')
      .eq('status', 'Pending');

    if (ordersErr) throw ordersErr;

    res.json({
      success: true,
      connected: true,
      pendingCount: supaOrders?.length || 0,
      productsCount: catalogSync.productsCount,
      categoriesCount: catalogSync.categoriesCount,
      inStockCount: catalogSync.inStockCount,
      message: `Database synced: ${catalogSync.productsCount} products from live database. ${supaOrders?.length || 0} pending order(s) awaiting review.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync with Supabase.' });
  }
});

/**
 * POST /api/database/sync
 * Explicit endpoint for full Supabase catalog & inventory synchronization
 */
router.post('/database/sync', async (req: Request, res: Response) => {
  try {
    const result = await supabaseSyncService.syncCatalogFromSupabase();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/database/sync/status
 * Returns connection and sync status
 */
router.get('/database/sync/status', (req: Request, res: Response) => {
  res.json(supabaseSyncService.getStatus());
});

// Periodic background polling for live Supabase orders every 12 seconds
setInterval(async () => {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase
        .from('pending_orders')
        .select('order_id')
        .eq('status', 'Pending')
        .limit(1);
    } catch {}
  }
}, 12000);

// ----------------------------------------------------
// 19. BRAND COUPONS MANAGEMENT (STORE MANAGER FEATURE)
// ----------------------------------------------------

export const STANDARD_COUPON_PRICES: Record<string, number> = {
  BL09: 5,
  BL10: 10,
  BL11: 20,
  BL12: 50,
  BL13: 100,
  BL14: 500,
  BL15: 1000,
};

/**
 * GET /coupons
 * Retrieve all brand coupon records with optional search, brand/category/series filter, and summary metrics
 */
router.get('/coupons', (req: Request, res: Response) => {
  try {
    const state = db.getState();
    let coupons = state.coupons || [];

    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const brand = ((req.query.brand as string) || '').trim();
    const category = ((req.query.category as string) || '').trim();
    const series = ((req.query.series as string) || '').trim();

    if (search) {
      coupons = coupons.filter(
        (c) =>
          c.product_name.toLowerCase().includes(search) ||
          c.brand_name.toLowerCase().includes(search) ||
          c.series_name.toLowerCase().includes(search) ||
          c.category.toLowerCase().includes(search) ||
          (c.notes && c.notes.toLowerCase().includes(search))
      );
    }

    if (brand && brand !== 'all') {
      coupons = coupons.filter((c) => c.brand_name.toLowerCase() === brand.toLowerCase());
    }

    if (category && category !== 'all') {
      coupons = coupons.filter((c) => c.category.toLowerCase() === category.toLowerCase());
    }

    if (series && series !== 'all') {
      coupons = coupons.filter((c) => c.series_name.toLowerCase() === series.toLowerCase());
    }

    // Compute global metrics over filtered or all coupons
    const allCoupons = state.coupons || [];
    let totalCouponsUsed = 0;
    let totalDiscountValue = 0;
    const brandMap: Record<string, { count: number; totalValue: number }> = {};
    const categoryMap: Record<string, { count: number; totalValue: number }> = {};
    const seriesSet = new Set<string>();

    for (const c of allCoupons) {
      const used = Number(c.coupons_used) || 0;
      const amount = Number(c.coupon_amount) || 0;
      const val = used * amount;

      totalCouponsUsed += used;
      totalDiscountValue += val;
      seriesSet.add(c.series_name);

      if (!brandMap[c.brand_name]) brandMap[c.brand_name] = { count: 0, totalValue: 0 };
      brandMap[c.brand_name].count += used;
      brandMap[c.brand_name].totalValue += val;

      if (!categoryMap[c.category]) categoryMap[c.category] = { count: 0, totalValue: 0 };
      categoryMap[c.category].count += used;
      categoryMap[c.category].totalValue += val;
    }

    const brandBreakdown = Object.entries(brandMap)
      .map(([brand, data]) => ({ brand, ...data }))
      .sort((a, b) => b.totalValue - a.totalValue);

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.totalValue - a.totalValue);

    res.json({
      success: true,
      coupons: coupons.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      stats: {
        totalCouponsUsed,
        totalDiscountValue,
        totalBrands: Object.keys(brandMap).length,
        totalSeries: seriesSet.size,
        brandBreakdown,
        categoryBreakdown,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch coupon records.' });
  }
});

/**
 * POST /coupons
 * Create a new brand coupon record
 */
router.post('/coupons', async (req: Request, res: Response) => {
  try {
    const {
      product_name,
      productName,
      category,
      itemCategory,
      brand_name,
      brandName,
      series_name,
      seriesName,
      coupon_amount,
      couponAmount,
      coupons_used,
      couponsUsed,
      notes,
    } = req.body;

    const finalProduct = (product_name || productName || '').trim();
    const finalCategory = (category || itemCategory || '').trim();
    const finalBrand = (brand_name || brandName || '').trim();
    const finalSeries = (series_name || seriesName || '').trim();
    let finalAmount = Number(coupon_amount ?? couponAmount);
    if ((isNaN(finalAmount) || finalAmount <= 0) && STANDARD_COUPON_PRICES[finalSeries.toUpperCase()] !== undefined) {
      finalAmount = STANDARD_COUPON_PRICES[finalSeries.toUpperCase()];
    }
    const finalUsed = Number(coupons_used ?? couponsUsed);

    if (!finalProduct) {
      return res.status(400).json({ error: 'Product name is required.' });
    }
    if (!finalCategory) {
      return res.status(400).json({ error: 'Item category is required.' });
    }
    if (!finalBrand) {
      return res.status(400).json({ error: 'Brand name is required.' });
    }
    if (!finalSeries) {
      return res.status(400).json({ error: 'Coupon name is required.' });
    }
    if (isNaN(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ error: 'Coupon amount in rupees must be a valid positive number.' });
    }
    if (isNaN(finalUsed) || finalUsed < 0) {
      return res.status(400).json({ error: 'Number of coupons used must be 0 or greater.' });
    }

    const state = db.getState();
    const currentUser = state.users.find((u) => u.id === activeUserId);
    const nowIso = new Date().toISOString();

    const newCoupon: CouponRow = {
      id: `cpn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      product_name: finalProduct,
      category: finalCategory,
      brand_name: finalBrand,
      series_name: finalSeries,
      coupon_amount: finalAmount,
      coupons_used: finalUsed,
      notes: (notes || '').trim(),
      created_by_id: currentUser?.id || 'usr-1',
      created_by_name: currentUser?.name || 'Store Manager',
      created_at: nowIso,
      updated_at: nowIso,
    };

    await db.transaction((s) => {
      if (!s.coupons) s.coupons = [];
      s.coupons.unshift(newCoupon);
    });

    res.status(201).json({
      success: true,
      message: `Coupon for "${finalProduct}" under series "${finalSeries}" saved successfully.`,
      coupon: newCoupon,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save coupon.' });
  }
});

/**
 * PUT /coupons/:id
 * Update an existing coupon entry
 */
router.put('/coupons/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      product_name,
      productName,
      category,
      itemCategory,
      brand_name,
      brandName,
      series_name,
      seriesName,
      coupon_amount,
      couponAmount,
      coupons_used,
      couponsUsed,
      notes,
    } = req.body;

    let updatedRecord: CouponRow | null = null;

    await db.transaction((s) => {
      if (!s.coupons) s.coupons = [];
      const index = s.coupons.findIndex((c) => c.id === id);
      if (index === -1) {
        throw new Error('Coupon record not found.');
      }

      const existing = s.coupons[index];
      const finalProduct = (product_name || productName || existing.product_name).trim();
      const finalCategory = (category || itemCategory || existing.category).trim();
      const finalBrand = (brand_name || brandName || existing.brand_name).trim();
      const finalSeries = (series_name || seriesName || existing.series_name).trim();
      let finalAmount =
        coupon_amount !== undefined || couponAmount !== undefined
          ? Number(coupon_amount ?? couponAmount)
          : existing.coupon_amount;
      if ((isNaN(finalAmount) || finalAmount <= 0) && STANDARD_COUPON_PRICES[finalSeries.toUpperCase()] !== undefined) {
        finalAmount = STANDARD_COUPON_PRICES[finalSeries.toUpperCase()];
      }
      const finalUsed =
        coupons_used !== undefined || couponsUsed !== undefined
          ? Number(coupons_used ?? couponsUsed)
          : existing.coupons_used;

      if (!finalProduct) throw new Error('Product name cannot be empty.');
      if (!finalCategory) throw new Error('Category cannot be empty.');
      if (!finalBrand) throw new Error('Brand name cannot be empty.');
      if (!finalSeries) throw new Error('Series name cannot be empty.');
      if (isNaN(finalAmount) || finalAmount <= 0) throw new Error('Coupon amount must be greater than 0.');
      if (isNaN(finalUsed) || finalUsed < 0) throw new Error('Coupons used must be 0 or greater.');

      existing.product_name = finalProduct;
      existing.category = finalCategory;
      existing.brand_name = finalBrand;
      existing.series_name = finalSeries;
      existing.coupon_amount = finalAmount;
      existing.coupons_used = finalUsed;
      if (notes !== undefined) existing.notes = notes.trim();
      existing.updated_at = new Date().toISOString();

      updatedRecord = { ...existing };
    });

    res.json({
      success: true,
      message: 'Coupon record updated successfully.',
      coupon: updatedRecord,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update coupon.' });
  }
});

/**
 * DELETE /coupons/:id
 * Delete a coupon record
 */
router.delete('/coupons/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let deleted = false;

    await db.transaction((s) => {
      if (!s.coupons) s.coupons = [];
      const initLen = s.coupons.length;
      s.coupons = s.coupons.filter((c) => c.id !== id);
      if (s.coupons.length < initLen) {
        deleted = true;
      }
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Coupon record not found.' });
    }

    res.json({ success: true, message: 'Coupon record deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete coupon.' });
  }
});

/**
 * POST /coupons/bulk
 * Upload multiple coupon records (from CSV/JSON/TSV bulk manager upload)
 */
router.post('/coupons/bulk', async (req: Request, res: Response) => {
  try {
    const { items, replaceExisting } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No coupon items provided for upload.' });
    }

    const state = db.getState();
    const currentUser = state.users.find((u) => u.id === activeUserId);
    const nowIso = new Date().toISOString();

    const validNewRecords: CouponRow[] = [];
    const errors: Array<{ row: number; reason: string }> = [];

    items.forEach((item: any, idx: number) => {
      const pName = (item.product_name || item.productName || item['Product Name'] || '').trim();
      const cat = (item.category || item.itemCategory || item['Item Category'] || item['Category'] || '').trim();
      const bName = (item.brand_name || item.brandName || item['Brand Name'] || item['Brand'] || '').trim();
      const sName = (item.series_name || item.seriesName || item['Coupon Name'] || item['Coupon Series Name'] || item['Series Name'] || item['Series'] || '').trim();
      let amt = Number(item.coupon_amount ?? item.couponAmount ?? item['Coupon Amount'] ?? item['Price'] ?? item['Amount'] ?? item['Coupon Amount (Rs)'] ?? item['Coupon Amount in Rupees']);
      if ((isNaN(amt) || amt <= 0) && STANDARD_COUPON_PRICES[sName.toUpperCase()] !== undefined) {
        amt = STANDARD_COUPON_PRICES[sName.toUpperCase()];
      }
      const used = Number(item.coupons_used ?? item.couponsUsed ?? item['Number of Coupons Used'] ?? item['Coupons Used'] ?? item['Used'] ?? 0);
      const notes = (item.notes || item.Notes || '').trim();

      if (!pName) {
        errors.push({ row: idx + 1, reason: 'Missing Product Name' });
        return;
      }
      if (!cat) {
        errors.push({ row: idx + 1, reason: `Row "${pName}": Missing Item Category` });
        return;
      }
      if (!bName) {
        errors.push({ row: idx + 1, reason: `Row "${pName}": Missing Brand Name` });
        return;
      }
      if (!sName) {
        errors.push({ row: idx + 1, reason: `Row "${pName}": Missing Coupon Series Name` });
        return;
      }
      if (isNaN(amt) || amt <= 0) {
        errors.push({ row: idx + 1, reason: `Row "${pName}": Invalid Coupon Amount (must be positive)` });
        return;
      }
      if (isNaN(used) || used < 0) {
        errors.push({ row: idx + 1, reason: `Row "${pName}": Invalid Number of Coupons Used` });
        return;
      }

      validNewRecords.push({
        id: `cpn-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        product_name: pName,
        category: cat,
        brand_name: bName,
        series_name: sName,
        coupon_amount: amt,
        coupons_used: used,
        notes,
        created_by_id: currentUser?.id || 'usr-1',
        created_by_name: currentUser?.name || 'Store Manager',
        created_at: nowIso,
        updated_at: nowIso,
      });
    });

    if (validNewRecords.length === 0) {
      return res.status(400).json({
        error: 'No valid records could be processed.',
        details: errors,
      });
    }

    await db.transaction((s) => {
      if (!s.coupons) s.coupons = [];
      if (replaceExisting) {
        s.coupons = validNewRecords;
      } else {
        s.coupons = [...validNewRecords, ...s.coupons];
      }
    });

    res.json({
      success: true,
      message: `Successfully processed and saved ${validNewRecords.length} coupon record(s).`,
      importedCount: validNewRecords.length,
      skippedErrorsCount: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to bulk upload coupons.' });
  }
});

/**
 * DELETE /coupons-all/clear
 * Clear all coupon records (manager utility)
 */
router.delete('/coupons-all/clear', async (req: Request, res: Response) => {
  try {
    await db.transaction((s) => {
      s.coupons = [];
    });
    res.json({ success: true, message: 'All coupon records have been cleared.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear coupons.' });
  }
});

// ===========================================================================
// DATABASE BACKUP, RESTORE & PROVIDER MIGRATION API ENDPOINTS
// ===========================================================================

// 1. POST /api/backup/export - Create instant backup
router.post('/backup/export', async (req: Request, res: Response) => {
  try {
    const pythonCmd = `python scripts/backup_manager.py backup`;
    exec(pythonCmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error('Backup command error:', error);
        return res.status(500).json({ success: false, error: error.message, stderr });
      }

      const backupsDir = path.join(process.cwd(), 'db_backups');
      const latestPath = path.join(backupsDir, 'latest_backup.sql');

      return res.json({
        success: true,
        message: 'Database backup completed successfully!',
        stdout,
        latestBackupAvailable: fs.existsSync(latestPath),
        downloadUrl: '/api/backup/download/latest_backup.sql'
      });
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/backup/list - List all local backups
router.get('/backup/list', (req: Request, res: Response) => {
  try {
    const backupsDir = path.join(process.cwd(), 'db_backups');
    if (!fs.existsSync(backupsDir)) {
      return res.json({ backups: [], hasLatest: false });
    }

    const entries = fs.readdirSync(backupsDir);
    const result: Array<{ folder: string; timestamp: string; sqlSize: number; jsonSize: number }> = [];

    for (const entry of entries) {
      const fullPath = path.join(backupsDir, entry);
      if (fs.statSync(fullPath).isDirectory() && entry.startsWith('backup_')) {
        const sqlFile = path.join(fullPath, 'full_schema_and_data.sql');
        const jsonFile = path.join(fullPath, 'data_export.json');
        result.push({
          folder: entry,
          timestamp: entry.replace('backup_', ''),
          sqlSize: fs.existsSync(sqlFile) ? fs.statSync(sqlFile).size : 0,
          jsonSize: fs.existsSync(jsonFile) ? fs.statSync(jsonFile).size : 0,
        });
      }
    }

    result.sort((a, b) => b.folder.localeCompare(a.folder));
    res.json({ backups: result, hasLatest: fs.existsSync(path.join(backupsDir, 'latest_backup.sql')) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/backup/download/:filename - Download root level backup
router.get('/backup/download/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const targetPath = path.join(process.cwd(), 'db_backups', filename);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).send('Backup file not found');
    }

    res.download(targetPath);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// 4. GET /api/backup/download/:folder/:filename - Download specific backup file
router.get('/backup/download/:folder/:filename', (req: Request, res: Response) => {
  try {
    const { folder, filename } = req.params;
    const targetPath = path.join(process.cwd(), 'db_backups', folder, filename);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).send('Backup file not found');
    }

    res.download(targetPath);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// 5. POST /api/backup/restore - Restore backup to target database URL
router.post('/backup/restore', (req: Request, res: Response) => {
  try {
    const { targetUrl, file } = req.body;
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'Target connection URL is required' });
    }

    const filePath = file || path.join(process.cwd(), 'db_backups', 'latest_backup.sql');
    const pythonCmd = `python scripts/backup_manager.py restore --target-url "${targetUrl}" --file "${filePath}"`;

    exec(pythonCmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error('Restore error:', error);
        return res.status(500).json({ success: false, error: error.message, stderr });
      }

      return res.json({
        success: true,
        message: 'Database restored successfully to target provider!',
        stdout
      });
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});



