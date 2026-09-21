// Order App API Client Adapter for Central FastAPI Backend
const getEnvVar = (key: string): string => {
  const proc = (globalThis as any).process;
  if (proc && proc.env && proc.env[key]) {
    return proc.env[key] as string;
  }
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
      return (import.meta as any).env[key];
    }
  } catch {
    // import.meta unavailable in Next.js Edge / Webpack context
  }
  return '';
};

const API_BASE_URL = getEnvVar('NEXT_PUBLIC_API_URL') || getEnvVar('VITE_API_BASE_URL') || '/api';

export interface OrderItemPayload {
  sku: string;
  item_name?: string;
  category?: string;
  quantity: number;
  price?: number;
  total_price?: number;
}

export interface OrderCreatePayload {
  client_reference?: string;
  items: OrderItemPayload[];
  salesman_id?: string;
  salesman_name?: string;
  shop_name?: string;
  city?: string;
  state?: string;
  location_id?: string;
  notes?: string;
}

export const apiClient = {
  async getProducts() {
    const res = await fetch(`${API_BASE_URL}/products`);
    if (!res.ok) throw new Error('Failed to fetch products catalog');
    const data = await res.json();
    return data.products || data;
  },

  async createOrder(payload: OrderCreatePayload, token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/orders/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || result.detail || 'Failed to submit order');
    }
    return result;
  },

  async getPendingOrders() {
    const res = await fetch(`${API_BASE_URL}/orders/pending`);
    if (!res.ok) throw new Error('Failed to fetch pending orders');
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Login failed');
    }
    return data;
  },
};
