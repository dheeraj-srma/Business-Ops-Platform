// shared/api/inventory.ts
/**
 * Shared Inventory Domain API Module (Read-Only)
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
