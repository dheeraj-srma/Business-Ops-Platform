import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderPayload } from '../types';
import { reserveOrder } from '@/shared/api/orders';

export interface QueuedOrder {
  order_id: string;
  payload: OrderPayload;
  queued_at: string;
  retry_count: number;
  last_error?: string;
}

const STORAGE_KEY = 'nalka_offline_order_queue';
const QUEUE_EVENT = 'nalka_offline_queue_updated';

/**
 * Retrieve all orders currently waiting in the offline queue.
 */
export function getOfflineQueue(): QueuedOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read offline order queue:', err);
    return [];
  }
}

/**
 * Save updated queue to localStorage and notify UI listeners.
 */
function persistQueue(queue: QueuedOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: { count: queue.length } }));
    }
  } catch (err) {
    console.error('Failed to persist offline order queue:', err);
  }
}

/**
 * Add an order to the local offline queue.
 */
export function enqueueOfflineOrder(payload: OrderPayload, initialError?: string): QueuedOrder {
  const queue = getOfflineQueue();
  const existingIdx = queue.findIndex(q => q.order_id === payload.order.order_id);

  const queuedOrder: QueuedOrder = {
    order_id: payload.order.order_id,
    payload,
    queued_at: new Date().toISOString(),
    retry_count: 0,
    last_error: initialError
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = queuedOrder;
  } else {
    queue.push(queuedOrder);
  }

  persistQueue(queue);
  return queuedOrder;
}

/**
 * Remove an order from the offline queue (e.g., after successful sync).
 */
export function removeOfflineOrder(orderId: string): void {
  const queue = getOfflineQueue().filter(q => q.order_id !== orderId);
  persistQueue(queue);
}

/**
 * Clear the entire offline queue.
 */
export function clearOfflineQueue(): void {
  persistQueue([]);
}

/**
 * Subscribe to offline queue changes.
 */
export function onOfflineQueueChange(callback: (queue: QueuedOrder[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    callback(getOfflineQueue());
  };

  window.addEventListener(QUEUE_EVENT, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) handler();
  });

  return () => {
    window.removeEventListener(QUEUE_EVENT, handler);
  };
}

/**
 * Sync all queued offline orders via central FastAPI reserveOrder endpoint.
 */
export async function syncOfflineQueue(supabase: SupabaseClient): Promise<{
  synced: number;
  failed: number;
  errors: Array<{ orderId: string; error: string; rejected_items?: any[] }>;
}> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  let synced = 0;
  let failed = 0;
  const errors: Array<{ orderId: string; error: string; rejected_items?: any[] }> = [];
  const remainingQueue: QueuedOrder[] = [];

  for (const item of queue) {
    try {
      const order = item.payload.order;
      const items = item.payload.items;

      let reserveSuccess = false;
      try {
        const reserveRes = await reserveOrder({
          order_id: order.order_id,
          client_reference: order.order_id,
          salesman_id: order.salesman_id,
          salesman_name: order.salesman_name,
          shop_name: order.shop_name,
          city: order.city,
          state: order.state,
          location_id: order.location_id,
          notes: '',
          items: items.map(i => ({
            item_name: i.item_name,
            quantity: i.quantity,
            sku: i.sku,
            category: i.category,
            price: i.price
          }))
        });

        if (reserveRes && (reserveRes.status === 'created' || reserveRes.status === 'already_processed')) {
          reserveSuccess = true;
          synced++;
        }
      } catch (err: any) {
        if (err && err.status_code === 409) {
          failed++;
          errors.push({
            orderId: order.order_id,
            error: err.message || 'Validation failed on server (insufficient stock)'
          });
          remainingQueue.push({
            ...item,
            retry_count: item.retry_count + 1,
            last_error: err.message || 'Server stock limit exceeded'
          });
          continue;
        }
        console.warn('Centralized reserveOrder call failed during offline queue sync, attempting fallback:', err);
      }

      if (!reserveSuccess) {
        const { error: headerErr } = await supabase.from('pending_orders').insert({
          order_id: order.order_id,
          salesman_id: order.salesman_id,
          salesman_name: order.salesman_name,
          shop_name: order.shop_name,
          location_id: order.location_id,
          city: order.city,
          state: order.state,
          item_count: order.item_count,
          total_amount: order.total_amount,
          status: 'Pending',
          notes: ''
        });

        if (headerErr) {
          throw headerErr;
        }

        const lineItemsToInsert = items.map(i => ({
          order_id: order.order_id,
          sku: i.sku,
          item_name: i.item_name,
          category: i.category,
          quantity: i.quantity,
          price: i.price,
          total_price: i.total_price
        }));

        const { error: itemsErr } = await supabase.from('pending_order_items').insert(lineItemsToInsert);

        if (itemsErr) {
          throw itemsErr;
        }

        synced++;
      }
    } catch (err: any) {
      failed++;
      errors.push({
        orderId: item.order_id,
        error: err?.message || 'Network submission error'
      });
      remainingQueue.push({
        ...item,
        retry_count: item.retry_count + 1,
        last_error: err?.message || 'Network submission error'
      });
    }
  }

  persistQueue(remainingQueue);
  return { synced, failed, errors };
}
