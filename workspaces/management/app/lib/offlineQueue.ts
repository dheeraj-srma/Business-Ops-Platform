'use client';

import { OfflineQueuedOrder } from '../types';

const DB_NAME = 'NalkaMetalsDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_orders';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in current environment'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'idempotency_key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nalka-queue-updated'));
  }
}

export async function enqueueOfflineOrder(
  orderData: Omit<OfflineQueuedOrder, 'created_at' | 'status' | 'retry_count'>
): Promise<OfflineQueuedOrder> {
  const db = await openDB();
  const queuedRecord: OfflineQueuedOrder = {
    ...orderData,
    created_at: new Date().toISOString(),
    status: 'queued',
    retry_count: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(queuedRecord);

    request.onsuccess = () => {
      notifyQueueChanged();
      resolve(queuedRecord);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getQueuedOrders(): Promise<OfflineQueuedOrder[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return [];
  }
}

export async function updateQueuedOrderStatus(
  idempotency_key: string,
  status: OfflineQueuedOrder['status'],
  error_message?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(idempotency_key);

    getReq.onsuccess = () => {
      const record: OfflineQueuedOrder = getReq.result;
      if (record) {
        record.status = status;
        record.retry_count = (record.retry_count || 0) + 1;
        if (error_message) record.error_message = error_message;
        store.put(record);
      }
      notifyQueueChanged();
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function removeQueuedOrder(idempotency_key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(idempotency_key);

    request.onsuccess = () => {
      notifyQueueChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const orders = await getQueuedOrders();
  const pendingOrders = orders.filter(o => o.status === 'queued' || o.status === 'failed');

  let syncedCount = 0;
  let failedCount = 0;

  for (const order of pendingOrders) {
    try {
      await updateQueuedOrderStatus(order.idempotency_key, 'syncing');

      const res = await fetch(`${API}/api/orders/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_reference: order.idempotency_key,
          salesman_id: order.salesman_id,
          salesman_name: order.salesman_name,
          shop_name: order.shop_name,
          city: order.city,
          state: order.state,
          location_id: order.location_id,
          items: order.items,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Server error syncing offline order');
      }

      await removeQueuedOrder(order.idempotency_key);
      syncedCount++;
    } catch (err: unknown) {
      console.error(`Failed to sync order ${order.idempotency_key}:`, err);
      const errorObj = err as { message?: string };
      await updateQueuedOrderStatus(order.idempotency_key, 'failed', errorObj.message || 'Sync failed');
      failedCount++;
    }
  }

  notifyQueueChanged();
  return { synced: syncedCount, failed: failedCount };
}
