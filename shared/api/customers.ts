// shared/api/customers.ts
/**
 * Shared Customers Domain API Module
 */

import { apiClient } from './client';

export interface Customer {
  id: string | number;
  name: string;
  dealer_name?: string;
  gstin?: string;
  phone?: string;
  state?: string;
  city?: string;
  credit_limit?: number;
  salesman_id?: string;
  address?: string;
  status?: string;
}

export interface CustomersResponse {
  customers: Customer[];
  count: number;
}

export async function fetchCustomers(params?: { search?: string; limit?: number; offset?: number }): Promise<CustomersResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.offset) query.append('offset', String(params.offset));

  const queryString = query.toString();
  const endpoint = `/api/customers${queryString ? `?${queryString}` : ''}`;
  return apiClient<CustomersResponse>(endpoint);
}
