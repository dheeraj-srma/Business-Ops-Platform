// shared/api/orders.ts
/**
 * Shared Orders Domain API Module (Order Reservation, Reads, & History)
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

// Phase 6A: Order Reads Interfaces

export interface OrderItem {
  id?: any;
  order_id: string;
  sku?: string;
  item_name: string;
  category?: string;
  quantity: number;
  price: number;
  total_price: number;
  created_at?: string;
}

export interface OrderSummary {
  order_id: string;
  salesman_id?: string;
  salesman_name: string;
  shop_name: string;
  location_id?: string;
  city?: string;
  state?: string;
  item_count: number;
  total_amount: number;
  status: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
}

export interface OrderListResponse {
  items: OrderSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ListOrdersParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  salesman_id?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: string;
}

export async function listOrders(params: ListOrdersParams = {}): Promise<OrderListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page.toString());
  if (params.page_size) query.append('page_size', params.page_size.toString());
  if (params.search) query.append('search', params.search);
  if (params.status) query.append('status', params.status);
  if (params.salesman_id) query.append('salesman_id', params.salesman_id);
  if (params.customer_id) query.append('customer_id', params.customer_id);
  if (params.date_from) query.append('date_from', params.date_from);
  if (params.date_to) query.append('date_to', params.date_to);
  if (params.sort_by) query.append('sort_by', params.sort_by);
  if (params.sort_dir) query.append('sort_dir', params.sort_dir);

  const url = `/api/orders${query.toString() ? `?${query.toString()}` : ''}`;
  return apiClient<OrderListResponse>(url);
}

export async function getOrder(orderId: string): Promise<OrderDetail> {
  return apiClient<OrderDetail>(`/api/orders/${encodeURIComponent(orderId)}`);
}

// Phase 6B: Order Workflow Mutations

export interface OrderEditPayload {
  items: Array<{
    sku: string;
    item_name?: string;
    category?: string;
    quantity: number;
    price?: number;
  }>;
  notes?: string;
}

export interface OrderEditResponse {
  status: string;
  order_id: string;
  items_count: number;
  total_amount: number;
  reservation_delta: number;
  timestamp: string;
}

export async function updateOrder(orderId: string, payload: OrderEditPayload): Promise<OrderEditResponse> {
  return apiClient<OrderEditResponse>(`/api/orders/${encodeURIComponent(orderId)}/update`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface OrderCancelResponse {
  status: string;
  order_id: string;
  released_reservation: number;
  timestamp: string;
}

export async function cancelOrder(orderId: string, reason?: string): Promise<OrderCancelResponse> {
  return apiClient<OrderCancelResponse>(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export interface OrderRejectResponse {
  status: string;
  order_id: string;
  released_reservation: number;
  timestamp: string;
}

export async function rejectOrder(orderId: string, reason?: string): Promise<OrderRejectResponse> {
  return apiClient<OrderRejectResponse>(`/api/orders/${encodeURIComponent(orderId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export interface OrderReopenResponse {
  status: string;
  order_id: string;
  recreated_reservation: number;
  timestamp: string;
}

export async function reopenOrder(orderId: string, reason?: string): Promise<OrderReopenResponse> {
  return apiClient<OrderReopenResponse>(`/api/orders/${encodeURIComponent(orderId)}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

