import type { CartCategoryBlock, InventoryItem } from '../types';

export interface PendingOrderRecord {
  order_id: string;
  salesman_id: string;
  salesman_name: string;
  shop_name: string;
  city: string;
  state: string;
  location_id: string;
  status: 'Pending';
  item_count: number;
  total_amount: number;
  created_at: string;
}

export interface PendingOrderItemRecord {
  order_id: string;
  sku: string;
  item_name: string;
  category: string;
  quantity: number;
  price: number;
  total_price: number;
}

export interface OrderPayload {
  order: PendingOrderRecord;
  items: PendingOrderItemRecord[];
}

export interface SalesmanInfo {
  id: string;
  name: string;
}

export interface ShopLocationInfo {
  name: string;
  city: string;
  state: string;
  location_id: string;
}

/**
 * Generates a human-readable yet unique Order ID:
 * Format: ORD-{salesmanId}-{yyyymmddHHMMss}
 */
export function generateOrderId(salesmanId: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rawId = (salesmanId && salesmanId !== '--') ? salesmanId : 'DIRECT';
  const cleanSalesmanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `ORD-${cleanSalesmanId}-${timestamp}`;
}

export type CartInput = Array<{ name: string; qty: number | string; category?: string }> | CartCategoryBlock[];

/**
 * SINGLE source of truth for constructing an order payload.
 * Used by both Supabase insertion and offline JSON export.
 */
export function buildOrderPayload(
  cart: CartInput,
  salesman: SalesmanInfo,
  shopLocation: ShopLocationInfo,
  inventory: InventoryItem[]
): OrderPayload {
  const order_id = generateOrderId(salesman.id);
  const created_at = new Date().toISOString();

  const items: PendingOrderItemRecord[] = [];

  // Normalize cart items whether flat array or category blocks
  cart.forEach(entry => {
    if ('items' in entry && Array.isArray(entry.items)) {
      // Category block
      entry.items.forEach(cartItem => {
        if (cartItem.name && cartItem.qty > 0) {
          const invItem = inventory.find(i => i['Item Name'] === cartItem.name);
          const price = invItem ? Number(invItem.Price) || 0 : 0;
          const category = entry.category || invItem?.Category || 'Uncategorized';
          const sku = invItem ? invItem.SKU : cartItem.name;
          const qty = Number(cartItem.qty) || 0;
          const total_price = Number((price * qty).toFixed(2));

          items.push({
            order_id,
            sku,
            item_name: cartItem.name,
            category,
            quantity: qty,
            price,
            total_price
          });
        }
      });
    } else if ('name' in entry && entry.name && (Number(entry.qty) || 0) > 0) {
      // Flat item row
      const invItem = inventory.find(i => i['Item Name'] === entry.name);
      const price = invItem ? Number(invItem.Price) || 0 : 0;
      const category = entry.category || invItem?.Category || 'Uncategorized';
      const sku = invItem ? invItem.SKU : entry.name;
      const qty = Number(entry.qty) || 0;
      const total_price = Number((price * qty).toFixed(2));

      items.push({
        order_id,
        sku,
        item_name: entry.name,
        category,
        quantity: qty,
        price,
        total_price
      });
    }
  });

  const total_amount = Number(items.reduce((sum, item) => sum + item.total_price, 0).toFixed(2));

  const resolvedSalesmanId = (salesman.id && salesman.id !== '--') ? salesman.id : 'DIRECT';
  const resolvedSalesmanName = (salesman.name && salesman.name !== '--') ? salesman.name : 'Direct / House Account';

  const order: PendingOrderRecord = {
    order_id,
    salesman_id: resolvedSalesmanId,
    salesman_name: resolvedSalesmanName,
    shop_name: shopLocation.name || 'Direct',
    city: shopLocation.city || '',
    state: shopLocation.state || '',
    location_id: shopLocation.location_id || '',
    status: 'Pending',
    item_count: items.length,
    total_amount,
    created_at
  };

  return {
    order,
    items
  };
}

/**
 * Downloads the exact OrderPayload as a JSON file.
 */
export function downloadOrderAsJSON(payload: OrderPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${payload.order.order_id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
