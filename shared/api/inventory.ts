// shared/api/inventory.ts
/**
 * Shared Inventory Domain API Module (Read & Write Operations)
 */

import { apiClient } from './client';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  cost_price?: number;
  sale_price?: number;
  physical_stock: number;
  reserved_stock: number;
  available_stock: number;
  unit?: string;
  status: 'HEALTHY' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK' | 'NEGATIVE' | string;
  is_active?: boolean;
  updated_at?: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StockAdjustmentPayload {
  product_id: string;
  new_quantity: number;
  reason: string;
  location_id?: string;
  idempotency_key?: string;
}

export interface StockInPayload {
  product_id: string;
  quantity: number;
  unit_cost?: number;
  supplier_name?: string;
  reference_number?: string;
  notes?: string;
  idempotency_key?: string;
}

export interface StockMutationResponse {
  status: string;
  product_id: string;
  previous_quantity: number;
  new_quantity: number;
  available_quantity: number;
  transaction_id?: string;
  message?: string;
  timestamp: string;
}

export async function fetchInventoryList(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
}): Promise<InventoryListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.page_size) query.append('page_size', String(params.page_size));
  if (params?.search) query.append('search', params.search);
  if (params?.status) query.append('status', params.status);

  const queryString = query.toString();
  const endpoint = `/api/inventory${queryString ? `?${queryString}` : ''}`;
  return apiClient<InventoryListResponse>(endpoint);
}

export async function fetchInventoryByProductId(productId: string): Promise<InventoryItem> {
  return apiClient<InventoryItem>(`/api/inventory/${productId}`);
}

export async function adjustInventoryStock(payload: StockAdjustmentPayload): Promise<StockMutationResponse> {
  return apiClient<StockMutationResponse>('/api/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function recordStockIn(payload: StockInPayload): Promise<any> {
  return apiClient<any>('/api/inventory/stock-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface StockOutPayload {
  items?: Array<{ productId?: string; product_id?: string; sku?: string; quantity: number }>;
  product_id?: string;
  quantity?: number;
  recipient?: string;
  reason?: string;
  referenceNumber?: string;
  reference_number?: string;
  notes?: string;
  idempotencyKey?: string;
}

export async function recordStockOut(payload: StockOutPayload): Promise<any> {
  return apiClient<any>('/api/inventory/stock-out', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
