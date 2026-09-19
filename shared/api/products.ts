// shared/api/products.ts
/**
 * Shared Products Domain API Module
 */

import { apiClient } from './client';

export interface Product {
  id: string | number;
  sku: string;
  name: string;
  category?: string;
  price?: number;
  unit_price?: number;
  stock?: number;
  current_stock?: number;
  min_stock?: number;
  hsn_code?: string;
  unit?: string;
  status?: string;
  description?: string;
}

export interface ProductsResponse {
  products: Product[];
  count: number;
}

export interface ProductDetailResponse {
  product: Product;
  auditSummary?: {
    initialStock: number;
    calculatedCurrentStock: number;
    actualCurrentStock: number;
  };
  transactions?: any[];
}

export async function fetchProducts(params?: { search?: string; status?: string }): Promise<ProductsResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.status) query.append('status', params.status);
  
  const queryString = query.toString();
  const endpoint = `/api/products${queryString ? `?${queryString}` : ''}`;
  return apiClient<ProductsResponse>(endpoint);
}

export async function fetchProductById(productId: string): Promise<ProductDetailResponse> {
  return apiClient<ProductDetailResponse>(`/api/products/${productId}`);
}
