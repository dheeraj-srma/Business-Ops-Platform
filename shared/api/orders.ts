// shared/api/orders.ts
/**
 * Shared Orders Domain API Module (Order Reservation & Placement)
 */

import { apiClient } from './client';

export interface OrderReservationItem {
  sku: string;
  item_name?: string;
  category?: string;
  quantity: number;
  price?: number;
}

export interface OrderReservationPayload {
  order_id?: string;
  client_reference?: string;
  salesman_id?: string;
  salesman_name?: string;
  shop_name: string;
  city?: string;
  state?: string;
  location_id?: string;
  notes?: string;
  items: OrderReservationItem[];
}

export interface OrderReservationResponse {
  status: string;
  order_id: string;
  client_reference?: string;
  items_count: number;
  total_amount: number;
  idempotent: boolean;
  timestamp: string;
}

export async function reserveOrder(payload: OrderReservationPayload): Promise<OrderReservationResponse> {
  return apiClient<OrderReservationResponse>('/api/orders/reserve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface OrderProcessResponse {
  status: string;
  order_id: string;
  previous_status: string;
  new_status: string;
  items_processed: number;
  stock_transactions?: string[];
  idempotent: boolean;
  timestamp: string;
}

export async function processOrder(orderId: string, notes?: string): Promise<OrderProcessResponse> {
  return apiClient<OrderProcessResponse>(`/api/orders/${orderId}/process`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}
