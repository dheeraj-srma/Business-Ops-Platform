// shared/api/returns.ts
/**
 * Shared Returns Domain API Module (Customer Returns & Inventory Restocking)
 */

import { apiClient } from './client';

export interface ReturnCreatePayload {
  customer_name: string;
  location?: string;
  item_name: string;
  category?: string;
  price: number;
  quantity: number;
  condition: string; // "Good", "Good Return", "Bad", "Defective", "Defective Return"
  reason: string;
  sku?: string;
  order_id?: string;
  client_reference?: string;
}

export interface ReturnResponse {
  status: string;
  return_id: string;
  client_reference?: string;
  restocked: boolean;
  previous_quantity?: number;
  new_quantity?: number;
  available_quantity?: number;
  idempotent: boolean;
  timestamp: string;
}

export interface ReturnRecord {
  'Return ID'?: string;
  return_id?: string;
  'Customer Name'?: string;
  customer_name?: string;
  Location?: string;
  location_name?: string;
  SKU?: string;
  sku?: string;
  'Item Name'?: string;
  item_name?: string;
  Category?: string;
  category?: string;
  Price?: number;
  price?: number;
  Quantity?: number;
  quantity?: number;
  Condition?: string;
  condition?: string;
  Reason?: string;
  reason?: string;
  Status?: string;
  status?: string;
  Timestamp?: string;
  created_at?: string;
}

export async function createReturn(payload: ReturnCreatePayload): Promise<ReturnResponse> {
  return apiClient<ReturnResponse>('/api/returns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getReturns(): Promise<ReturnRecord[]> {
  return apiClient<ReturnRecord[]>('/api/returns');
}
