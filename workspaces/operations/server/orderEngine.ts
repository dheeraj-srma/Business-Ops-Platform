import { db, ProductRow, StockTransactionRow, StockReservationRow, ProcessedOrderRow, ProcessedOrderItemRow } from './db';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { supabaseSyncService } from './supabaseSyncService';

export interface IncomingOrderItem {
  order_id?: string;
  sku?: string | null;
  item_name: string;
  category?: string;
  quantity: number;
  price?: number;
  total_price?: number;
}

export interface IncomingOrder {
  order: {
    order_id: string;
    salesman_id?: string;
    salesman_name: string;
    shop_name: string;
    city?: string;
    state?: string;
    location_id?: string;
    total_amount: number;
    created_at?: string;
    status?: string;
  };
  items: IncomingOrderItem[];
}

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

// In-memory queue cache for imported and live orders
class OrderQueueManager {
  private fileOrders: Map<string, OrderPreview> = new Map();

  public addFileOrder(preview: OrderPreview) {
    this.fileOrders.set(preview.order_id, preview);
  }

  public getFileOrders(): OrderPreview[] {
    return Array.from(this.fileOrders.values());
  }

  public removeFileOrder(orderId: string) {
    this.fileOrders.delete(orderId);
  }
}

export const orderQueue = new OrderQueueManager();

/**
 * Normalizes text for matching: lowercases, trims, collapses multiple spaces
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Task 2: Shared Order-Processing Pipeline
 * Validates, checks for duplicates, and matches item_name against local Product catalog.
 */
export async function processIncomingOrder(
  incoming: IncomingOrder,
  source: 'supabase' | 'file'
): Promise<OrderPreview> {
  if (!incoming || !incoming.order || !incoming.order.order_id) {
    throw new Error('Invalid order payload: Missing order_id.');
  }

  if (!Array.isArray(incoming.items) || incoming.items.length === 0) {
    throw new Error('Invalid order payload: Order contains no items.');
  }

  const orderId = incoming.order.order_id.trim();
  const dbState = db.getState();

  // Check duplicate against local completed order history
  const previousRecord = dbState.processed_orders.find((po) => po.order_id === orderId);
  const isDuplicate = !!previousRecord;
  const alreadyProcessedAt = previousRecord?.processed_at;

  // Build product lookup maps for active products
  const activeProducts = dbState.products.filter((p) => p.is_active);
  const exactMap = new Map<string, ProductRow>();
  const normalizedMap = new Map<string, ProductRow>();

  for (const prod of activeProducts) {
    exactMap.set(prod.name.trim(), prod);
    normalizedMap.set(normalizeText(prod.name), prod);
  }

  let hasUnmatchedItems = false;
  let hasStockExceeded = false;

  const previewItems: OrderPreviewItem[] = incoming.items.map((item) => {
    const rawName = (item.item_name || '').trim();
    const qty = Math.max(1, Number(item.quantity) || 1);
    const price = Number(item.price) || 0;
    const totalPrice = Number(item.total_price) || price * qty;

    let matchedProd: ProductRow | undefined = exactMap.get(rawName);
    let matchType: 'EXACT' | 'NORMALIZED' | 'MANUAL' | 'UNMATCHED' = 'UNMATCHED';

    if (matchedProd) {
      matchType = 'EXACT';
    } else {
      matchedProd = normalizedMap.get(normalizeText(rawName));
      if (matchedProd) {
        matchType = 'NORMALIZED';
      }
    }

    const isMatched = !!matchedProd;
    if (!isMatched) {
      hasUnmatchedItems = true;
    }

    const allowNegativeOrders = !!dbState.settings?.allow_negative_orders;
    const currentStock = matchedProd ? matchedProd.current_stock : 0;
    const hasSufficient = allowNegativeOrders || currentStock >= qty;
    if (isMatched && currentStock < qty && !allowNegativeOrders) {
      hasStockExceeded = true;
    }

    return {
      item_name: rawName,
      category: item.category || (matchedProd ? matchedProd.category_id : 'Uncategorized'),
      quantity: qty,
      price: price || (matchedProd ? matchedProd.unit_cost : 0),
      total_price: totalPrice,
      matched: isMatched,
      matchType: matchType,
      matchedProductId: matchedProd?.id,
      matchedProductSku: matchedProd?.sku,
      matchedProductName: matchedProd?.name,
      currentStock: currentStock,
      unit: matchedProd?.unit || 'Pieces',
      hasSufficientStock: hasSufficient,
    };
  });

  return {
    order_id: orderId,
    salesman_id: incoming.order.salesman_id,
    salesman_name: incoming.order.salesman_name || 'Sales Representative',
    shop_name: incoming.order.shop_name || 'Customer Store',
    city: incoming.order.city,
    state: incoming.order.state,
    location_id: incoming.order.location_id,
    total_amount: Number(incoming.order.total_amount) || 0,
    created_at: incoming.order.created_at || new Date().toISOString(),
    source: source,
    status: 'PENDING',
    isDuplicate,
    alreadyProcessedAt,
    hasUnmatchedItems,
    hasStockExceeded,
    items: previewItems,
  };
}

/**
 * Task 2 / Task 4: Confirm Order
 * Deducts stock, writes StockTransactionRow & StockReservationRow, saves permanent order history,
 * cleans up Supabase pending queue (if live), and syncs updated stock to Supabase inventory table.
 */
export async function confirmOrder(
  orderId: string,
  resolvedItems: Array<{
    itemName: string;
    productId: string;
    quantity: number;
    price?: number;
  }>,
  orderMetadata: {
    source: 'supabase' | 'file';
    salesmanName: string;
    salesmanId?: string;
    shopName: string;
    city?: string;
    state?: string;
    totalAmount?: number;
    created_at?: string;
    notes?: string;
  },
  activeUser: { id: string; name: string }
): Promise<{ success: boolean; processedOrder: ProcessedOrderRow; affectedProducts: ProductRow[] }> {
  if (!orderId || !resolvedItems || resolvedItems.length === 0) {
    throw new Error('Cannot confirm order: Missing order ID or items to process.');
  }

  // 1. Local Database Transaction (Stock-Out & Permanent History)
  const result = await db.transaction((dbState) => {
    const affectedProducts: ProductRow[] = [];
    const nowIso = new Date().toISOString();

    // Clear any previous processed items for this order to prevent duplicates
    dbState.processed_order_items = dbState.processed_order_items.filter((poi) => poi.order_id !== orderId);

    for (let idx = 0; idx < resolvedItems.length; idx++) {
      const item = resolvedItems[idx];
      const prod = dbState.products.find((p) => p.id === item.productId);

      if (!prod) {
        throw new Error(`Product with ID "${item.productId}" not found in catalog.`);
      }

      const qty = Math.max(1, Number(item.quantity) || 1);
      const previousStock = prod.current_stock;
      const newStock = previousStock - qty;

      // Update physical product stock
      prod.current_stock = newStock;
      prod.updated_at = nowIso;
      affectedProducts.push(prod);

      // Create Stock-Out transaction
      const txId = `tx-ord-${Date.now()}-${idx}`;
      const tx: StockTransactionRow = {
        id: txId,
        product_id: prod.id,
        transaction_type: 'STOCK_OUT',
        quantity: qty,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: `Sales Order (${orderId} - ${orderMetadata.shopName})`,
        supplier_or_recipient: `${orderMetadata.shopName}${orderMetadata.city ? ` (${orderMetadata.city})` : ''}`,
        reference_number: orderId,
        notes: `Salesman: ${orderMetadata.salesmanName}`,
        source: orderMetadata.source === 'supabase' ? 'TALLY' : 'IMPORT',
        external_reference: orderId,
        created_by_id: activeUser.id,
        created_by_name: activeUser.name,
        created_at: nowIso,
      };
      dbState.stock_transactions.unshift(tx);

      // Create Stock Reservation (Fulfilled)
      const resId = `res-ord-${Date.now()}-${idx}`;
      const res: StockReservationRow = {
        id: resId,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        source_transaction_id: txId,
        external_order_id: orderId,
        customer_name: orderMetadata.shopName,
        reserved_quantity: qty,
        fulfilled_quantity: qty,
        released_quantity: 0,
        status: 'FULFILLED',
        notes: `Processed order via ${orderMetadata.source.toUpperCase()}`,
        created_at: nowIso,
        updated_at: nowIso,
      };
      dbState.stock_reservations.unshift(res);

      // Save item in permanent local processed items history
      const poi: ProcessedOrderItemRow = {
        id: `poi-${Date.now()}-${idx}`,
        order_id: orderId,
        product_id: prod.id,
        sku: prod.sku,
        item_name: item.itemName,
        quantity: qty,
        price: item.price || prod.unit_cost,
        total_price: (item.price || prod.unit_cost) * qty,
        matched: true,
        stock_deducted: qty,
        created_at: nowIso,
      };
      dbState.processed_order_items.push(poi);
    }

    // Save master order in permanent local processed orders history (upsert to prevent duplicate rows)
    const processedOrder: ProcessedOrderRow = {
      id: `po-${Date.now()}`,
      order_id: orderId,
      salesman_id: orderMetadata.salesmanId,
      salesman_name: orderMetadata.salesmanName,
      shop_name: orderMetadata.shopName,
      city: orderMetadata.city,
      state: orderMetadata.state,
      total_amount: orderMetadata.totalAmount || 0,
      source: orderMetadata.source,
      status: 'CONFIRMED',
      processed_at: nowIso,
      processed_by_id: activeUser.id,
      processed_by_name: activeUser.name,
      items_count: resolvedItems.length,
      notes: orderMetadata.notes || '',
      created_at: orderMetadata.created_at || nowIso,
      updated_at: nowIso,
    };

    const existingIdx = dbState.processed_orders.findIndex((po) => po.order_id === orderId);
    if (existingIdx !== -1) {
      dbState.processed_orders[existingIdx] = processedOrder;
    } else {
      dbState.processed_orders.unshift(processedOrder);
    }
    // Remove any legacy duplicates for this order_id
    dbState.processed_orders = dbState.processed_orders.filter(
      (po, idx) => po.order_id !== orderId || idx === dbState.processed_orders.findIndex((p) => p.order_id === orderId)
    );

    return { processedOrder, affectedProducts };
  });

  // Always purge order from active in-memory queue
  orderQueue.removeFileOrder(orderId);

  // 2. If source was 'supabase': Update status to 'Approved' in Supabase pending_orders
  if (orderMetadata.source === 'supabase' && isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('pending_orders')
        .update({ status: 'Approved', updated_at: new Date().toISOString() })
        .eq('order_id', orderId);
    } catch (supaErr) {
      console.warn(`[Supabase] Failed to update completed order ${orderId} status in Supabase:`, supaErr);
    }
  }

  // 3. Task 6: Push updated stock to Supabase inventory table
  if (result.affectedProducts.length > 0) {
    try {
      await syncInventoryToSupabase(result.affectedProducts);
    } catch (err) {
      console.warn('[Supabase Sync] Failed to sync updated inventory after order confirmation:', err);
    }
  }

  return { success: true, ...result };
}

/**
 * Task 4: Reject Order
 */
export async function rejectOrder(
  orderId: string,
  source: 'supabase' | 'file',
  reason?: string,
  activeUser?: { id: string; name: string }
): Promise<{ success: boolean }> {
  if (!orderId) throw new Error('Missing order ID to reject.');

  const nowIso = new Date().toISOString();

  let salesmanName = 'Unknown';
  let salesmanId = '';
  let shopName = 'Unknown';
  let totalAmount = 0;
  let itemsCount = 0;
  let city = '';
  let state = '';
  let locationId = '';
  let lineItems: Array<{ sku: string; item_name: string; category?: string; quantity: number; price: number; total_price: number }> = [];

  // 1. Try fetching from file pending order queue
  const fileOrder = orderQueue.getFileOrders().find((o) => o.order_id === orderId);
  if (fileOrder) {
    salesmanId = fileOrder.salesman_id || salesmanId;
    salesmanName = fileOrder.salesman_name || salesmanName;
    shopName = fileOrder.shop_name || shopName;
    totalAmount = fileOrder.total_amount || totalAmount;
    itemsCount = fileOrder.items?.length || itemsCount;
    city = fileOrder.city || '';
    state = fileOrder.state || '';
    locationId = fileOrder.location_id || '';
    if (fileOrder.items) {
      lineItems = fileOrder.items.map((i) => ({
        sku: i.matchedProductSku || i.item_name,
        item_name: i.item_name,
        category: i.category || 'General',
        quantity: i.quantity,
        price: i.price,
        total_price: i.total_price || i.price * i.quantity,
      }));
    }
  }

  // 2. Fetch from Supabase pending_orders & pending_order_items to preserve full metadata
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: supaHeader } = await supabase
        .from('pending_orders')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (supaHeader) {
        salesmanId = supaHeader.salesman_id || salesmanId;
        salesmanName = supaHeader.salesman_name || salesmanName;
        shopName = supaHeader.shop_name || shopName;
        totalAmount = Number(supaHeader.total_amount) || totalAmount;
        itemsCount = Number(supaHeader.item_count) || itemsCount;
        city = supaHeader.city || city;
        state = supaHeader.state || state;
        locationId = supaHeader.location_id || locationId;

        const { data: supaItems } = await supabase
          .from('pending_order_items')
          .select('*')
          .eq('order_id', orderId);

        if (supaItems && supaItems.length > 0) {
          lineItems = supaItems.map((i: any) => ({
            sku: i.sku || i.item_name,
            item_name: i.item_name,
            category: i.category || 'General',
            quantity: Number(i.quantity),
            price: Number(i.price),
            total_price: Number(i.total_price || i.price * i.quantity),
          }));
          itemsCount = lineItems.length;
        }
      }
    } catch (err) {
      console.warn(`[Supabase] Could not fetch details for rejected order ${orderId}:`, err);
    }
  }

  // Record complete details in local transactional state
  await db.transaction((dbState) => {
    let existing = dbState.processed_orders.find((po) => po.order_id === orderId);
    if (!existing) {
      dbState.processed_orders.unshift({
        id: `po-rej-${Date.now()}`,
        order_id: orderId,
        salesman_id: salesmanId,
        salesman_name: salesmanName,
        shop_name: shopName,
        city: city,
        state: state,
        location_id: locationId,
        total_amount: totalAmount,
        source: source,
        status: 'REJECTED',
        processed_at: nowIso,
        processed_by_id: activeUser?.id || 'usr-1',
        processed_by_name: activeUser?.name || 'Manager',
        items_count: itemsCount,
        rejection_reason: reason || 'Rejected by Manager',
        created_at: nowIso,
        updated_at: nowIso,
      });
    } else {
      existing.status = 'REJECTED';
      existing.salesman_name = salesmanName !== 'Unknown' ? salesmanName : existing.salesman_name;
      existing.shop_name = shopName !== 'Unknown' ? shopName : existing.shop_name;
      existing.total_amount = totalAmount || existing.total_amount;
      existing.items_count = itemsCount || existing.items_count;
      existing.rejection_reason = reason || 'Rejected by Manager';
      existing.updated_at = nowIso;
    }

    // Persist line items into processed_order_items
    if (lineItems.length > 0) {
      dbState.processed_order_items = dbState.processed_order_items.filter((poi) => poi.order_id !== orderId);
      lineItems.forEach((it) => {
        dbState.processed_order_items.push({
          id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          order_id: orderId,
          sku: it.sku,
          item_name: it.item_name,
          category: it.category || 'General',
          quantity: it.quantity,
          price: it.price,
          total_price: it.total_price,
          matched: true,
          stock_deducted: 0,
          created_at: nowIso,
        });
      });
    }

    return true;
  });

  if (source === 'supabase' && isSupabaseConfigured() && supabase) {
    try {
      // Update pending_orders status to REJECTED in Supabase (preserve record for salesman portal)
      await supabase
        .from('pending_orders')
        .update({
          status: 'REJECTED',
          notes: reason ? `Rejected: ${reason}` : 'Rejected by Manager',
          updated_at: nowIso
        })
        .eq('order_id', orderId);
    } catch (err) {
      console.warn(`[Supabase] Failed to update rejected order ${orderId} status:`, err);
    }
  } else if (source === 'file') {
    orderQueue.removeFileOrder(orderId);
  }

  return { success: true };
}

/**
 * Task: Reopens a processed order (CONFIRMED or REJECTED) back to the active pending review queue.
 * If CONFIRMED, restores the deducted physical stock, cancels reservations, and records reverting Stock-In transactions.
 */
export async function reopenOrder(
  orderId: string,
  activeUser?: { id: string; name: string }
): Promise<{ success: boolean; reopenedOrder: OrderPreview; affectedProducts: ProductRow[] }> {
  if (!orderId) throw new Error('Missing order ID to reopen.');

  const nowIso = new Date().toISOString();
  let affectedProducts: ProductRow[] = [];
  let incomingToProcess: IncomingOrder | null = null;
  let orderSource: 'supabase' | 'file' = 'file';

  // 1. Self-healing for existing processed orders that have Unknown shop or missing items
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: supaHeader } = await supabase
        .from('pending_orders')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (supaHeader) {
        await db.transaction((dbState) => {
          const po = dbState.processed_orders.find((p) => p.order_id === orderId);
          if (po) {
            po.salesman_id = supaHeader.salesman_id || po.salesman_id;
            po.salesman_name = supaHeader.salesman_name && supaHeader.salesman_name !== 'Unknown' ? supaHeader.salesman_name : po.salesman_name;
            po.shop_name = supaHeader.shop_name && supaHeader.shop_name !== 'Unknown' ? supaHeader.shop_name : po.shop_name;
            po.city = supaHeader.city || po.city;
            po.state = supaHeader.state || po.state;
            po.location_id = supaHeader.location_id || po.location_id;
            po.total_amount = Number(supaHeader.total_amount) || po.total_amount;
            po.items_count = Number(supaHeader.item_count) || po.items_count;
          }
          return true;
        });

        const { data: supaItems } = await supabase
          .from('pending_order_items')
          .select('*')
          .eq('order_id', orderId);

        if (supaItems && supaItems.length > 0) {
          await db.transaction((dbState) => {
            const hasItems = dbState.processed_order_items.some((poi) => poi.order_id === orderId);
            if (!hasItems) {
              supaItems.forEach((i: any) => {
                dbState.processed_order_items.push({
                  id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  order_id: orderId,
                  sku: i.sku || i.item_name,
                  item_name: i.item_name,
                  category: i.category || 'General',
                  quantity: Number(i.quantity),
                  price: Number(i.price),
                  total_price: Number(i.total_price || i.price * i.quantity),
                  matched: true,
                  stock_deducted: 0,
                  created_at: nowIso,
                });
              });
            }
            return true;
          });
        }
      }
    } catch (supaErr) {
      console.warn(`[Reopen] Self-healing fetch for order ${orderId} failed:`, supaErr);
    }
  }

  await db.transaction((dbState) => {
    const poIndex = dbState.processed_orders.findIndex((po) => po.order_id === orderId);
    if (poIndex === -1) {
      throw new Error(`Processed order "${orderId}" not found in history.`);
    }

    const po = dbState.processed_orders[poIndex];
    orderSource = po.source || 'file';
    const items = dbState.processed_order_items.filter((poi) => poi.order_id === orderId);

    // If order was CONFIRMED, revert stock deductions
    if (po.status === 'CONFIRMED') {
      for (const item of items) {
        if (item.stock_deducted > 0 && item.product_id) {
          const prod = dbState.products.find((p) => p.id === item.product_id);
          if (prod) {
            const prevStock = prod.current_stock;
            const newStock = prevStock + item.stock_deducted;
            prod.current_stock = newStock;
            prod.updated_at = nowIso;
            affectedProducts.push(prod);

            // Create reverting Stock-In transaction
            const tx: StockTransactionRow = {
              id: `tx-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              product_id: prod.id,
              transaction_type: 'STOCK_IN',
              quantity: item.stock_deducted,
              previous_stock: prevStock,
              new_stock: newStock,
              reason: `Reverted Confirmation / Reopened Order (${orderId} - ${po.shop_name})`,
              supplier_or_recipient: `${po.shop_name}`,
              reference_number: orderId,
              notes: `Stock reverted by ${activeUser?.name || 'Manager'}`,
              source: 'MANUAL',
              created_by_id: activeUser?.id || 'usr-1',
              created_by_name: activeUser?.name || 'Manager',
              created_at: nowIso,
            };
            dbState.stock_transactions.unshift(tx);
          }
        }
      }

      // Cancel stock reservations
      dbState.stock_reservations.forEach((res) => {
        if (res.external_order_id === orderId) {
          res.status = 'CANCELLED';
          res.updated_at = nowIso;
        }
      });
    }

    // Build incoming order to re-queue
    incomingToProcess = {
      order: {
        order_id: po.order_id,
        salesman_id: po.salesman_id,
        salesman_name: po.salesman_name,
        shop_name: po.shop_name,
        city: po.city,
        state: po.state,
        location_id: po.location_id,
        total_amount: po.total_amount,
        created_at: po.created_at || nowIso,
        status: 'Pending',
      },
      items: items.length > 0
        ? items.map((i) => ({
            order_id: orderId,
            sku: i.sku,
            item_name: i.item_name,
            quantity: i.quantity,
            price: i.price,
            total_price: i.total_price,
          }))
        : [
            {
              order_id: orderId,
              item_name: 'Restored Order Items',
              quantity: 1,
              price: po.total_amount,
              total_price: po.total_amount,
            },
          ],
    };

    // Remove from processed orders and processed items so it's fresh in active queue
    dbState.processed_orders.splice(poIndex, 1);
    dbState.processed_order_items = dbState.processed_order_items.filter(
      (poi) => poi.order_id !== orderId
    );

    return true;
  });

  if (!incomingToProcess) {
    throw new Error('Failed to construct order payload for reopening.');
  }

  // Reprocess order into preview queue
  const preview = await processIncomingOrder(incomingToProcess, orderSource);
  orderQueue.addFileOrder(preview);

  // Update Supabase pending_orders status back to 'Pending'
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('pending_orders')
        .update({ status: 'Pending', notes: 'Reopened by Manager', updated_at: nowIso })
        .eq('order_id', orderId);
    } catch (err) {
      console.warn(`[Supabase] Failed to update reopened order ${orderId} status in Supabase:`, err);
    }
  }

  if (affectedProducts.length > 0) {
    syncInventoryToSupabase(affectedProducts).catch((err) => {
      console.warn('[Supabase Sync] Failed to sync reverted stock:', err);
    });
  }

  return {
    success: true,
    reopenedOrder: preview,
    affectedProducts,
  };
}

/**
 * Task: Rolls back stock deduction for a confirmed order and changes its status to REJECTED.
 */
export async function rollbackAndRejectOrder(
  orderId: string,
  reason?: string,
  activeUser?: { id: string; name: string }
): Promise<{ success: boolean; affectedProducts: ProductRow[] }> {
  if (!orderId) throw new Error('Missing order ID to rollback.');

  const nowIso = new Date().toISOString();
  let affectedProducts: ProductRow[] = [];

  await db.transaction((dbState) => {
    const po = dbState.processed_orders.find((p) => p.order_id === orderId);
    if (!po) {
      throw new Error(`Processed order "${orderId}" not found in history.`);
    }

    const items = dbState.processed_order_items.filter((poi) => poi.order_id === orderId);

    if (po.status === 'CONFIRMED') {
      for (const item of items) {
        if (item.stock_deducted > 0 && item.product_id) {
          const prod = dbState.products.find((p) => p.id === item.product_id);
          if (prod) {
            const prevStock = prod.current_stock;
            const newStock = prevStock + item.stock_deducted;
            prod.current_stock = newStock;
            prod.updated_at = nowIso;
            affectedProducts.push(prod);

            // Reverting Stock-In transaction
            const tx: StockTransactionRow = {
              id: `tx-rev-rej-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              product_id: prod.id,
              transaction_type: 'STOCK_IN',
              quantity: item.stock_deducted,
              previous_stock: prevStock,
              new_stock: newStock,
              reason: `Reverted & Rejected Order (${orderId} - ${po.shop_name})`,
              supplier_or_recipient: `${po.shop_name}`,
              reference_number: orderId,
              notes: `Order rejected by ${activeUser?.name || 'Manager'}. Reason: ${reason || 'Rejected after confirmation'}`,
              source: 'MANUAL',
              created_by_id: activeUser?.id || 'usr-1',
              created_by_name: activeUser?.name || 'Manager',
              created_at: nowIso,
            };
            dbState.stock_transactions.unshift(tx);
          }
        }
      }

      // Cancel reservations
      dbState.stock_reservations.forEach((res) => {
        if (res.external_order_id === orderId) {
          res.status = 'CANCELLED';
          res.updated_at = nowIso;
        }
      });
    }

    po.status = 'REJECTED';
    po.rejection_reason = reason || 'Rejected after confirmation';
    po.updated_at = nowIso;

    return true;
  });

  if (affectedProducts.length > 0) {
    syncInventoryToSupabase(affectedProducts).catch((err) => {
      console.warn('[Supabase Sync] Failed to sync reverted inventory:', err);
    });
  }

  return { success: true, affectedProducts };
}

/**
 * Task: Updates items/quantities for a pending order in the queue
 */
export async function updatePendingOrder(
  orderId: string,
  updatedItems: Array<{
    item_name: string;
    quantity: number;
    price?: number;
    category?: string;
  }>,
  updatedOrderMeta?: Partial<IncomingOrder['order']>
): Promise<{ success: boolean; updatedOrder: OrderPreview }> {
  const fileOrders = orderQueue.getFileOrders();
  const existing = fileOrders.find((o) => o.order_id === orderId);

  const totalAmount = updatedItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0
  );

  const incoming: IncomingOrder = {
    order: {
      order_id: orderId,
      salesman_id: updatedOrderMeta?.salesman_id || existing?.salesman_id,
      salesman_name: updatedOrderMeta?.salesman_name || existing?.salesman_name || 'Sales Representative',
      shop_name: updatedOrderMeta?.shop_name || existing?.shop_name || 'Customer Store',
      city: updatedOrderMeta?.city || existing?.city,
      state: updatedOrderMeta?.state || existing?.state,
      location_id: updatedOrderMeta?.location_id || existing?.location_id,
      total_amount: totalAmount,
      created_at: existing?.created_at || new Date().toISOString(),
      status: 'Pending',
    },
    items: updatedItems.map((i) => ({
      order_id: orderId,
      item_name: i.item_name,
      category: i.category,
      quantity: i.quantity,
      price: i.price || 0,
      total_price: (i.price || 0) * i.quantity,
    })),
  };

  const preview = await processIncomingOrder(incoming, existing?.source || 'file');
  orderQueue.addFileOrder(preview);

  return { success: true, updatedOrder: preview };
}

export async function syncInventoryToSupabase(products: ProductRow[]): Promise<{ updatedCount: number }> {
  return supabaseSyncService.syncStockToSupabase(products);
}
