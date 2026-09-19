export interface InventoryItem {
  SKU: string;
  'Item Name': string;
  Category: string;
  Brand?: string;
  Price: number;
  'Current Stock': number;
  'Total Stock'?: number;
  'Reserved Stock'?: number;
}


export interface DealerRecord {
  'Salesman Name': string;
  'Shop Name': string;
  'Salesman ID': string;
  State: string;
  City: string;
  'Location ID'?: string;
  'Customer Code'?: string;
  'Contact Person'?: string;
  Phone?: string;
  Address?: string;
}

export interface LocationRecord {
  'Location ID': string;
  State: string;
  City: string;
}

export interface OrderRecord {
  'Order ID': string;
  Timestamp: string;
  'Salesman ID': string;
  'Salesman Name': string;
  'Shop Name': string;
  Category: string;
  SKU: string;
  'Item Name': string;
  Quantity: number;
  Qty: number;
  City: string;
  State: string;
  'Location ID': string;
  Price: number;
  'Total Price': number;
  Status: 'Pending' | 'Approved' | 'Rejected';
}

export interface CartItem {
  name: string;
  qty: number;
}

export interface CartCategoryBlock {
  category: string;
  items: CartItem[];
}

export interface PDFOrderItem {
  category?: string;
  sku?: string;
  item_name: string;
  quantity: number;
  price: number;
  total_price: number;
}

export interface PDFOrderData {
  order_id: string;
  timestamp: string;
  salesman_id?: string;
  salesman_name: string;
  shop_name: string;
  location_id?: string;
  city?: string;
  state?: string;
  status?: string;
  items: PDFOrderItem[];
}

export interface PendingOrderRecord {
  order_id: string;
  salesman_id: string;
  salesman_name: string;
  shop_name: string;
  city: string;
  state: string;
  location_id: string;
  status: 'Pending';
  item_count: number;
  total_amount: number;
  created_at: string;
}

export interface PendingOrderItemRecord {
  order_id: string;
  sku: string;
  item_name: string;
  category: string;
  quantity: number;
  price: number;
  total_price: number;
}

export interface OrderPayload {
  order: PendingOrderRecord;
  items: PendingOrderItemRecord[];
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'salesman' | 'customer' | 'admin' | 'manager';
  salesman_id: string;
  salesman_name: string;
  shop_name?: string;
  customer_code?: string;
  phone?: string;
  is_active: boolean;
}


