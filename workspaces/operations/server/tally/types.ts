export type ExternalTransactionType =
  | 'SALES_ORDER'
  | 'SALES_INVOICE'
  | 'DELIVERY_NOTE'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'SALES_RETURN'
  | 'STOCK_JOURNAL';

export type SyncEventStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SYNCED'
  | 'FAILED'
  | 'RETRYING'
  | 'IGNORED';

export type ReservationStatus =
  | 'ACTIVE'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'RELEASED';

export type InventoryActionType =
  | 'RESERVE_STOCK'
  | 'REDUCE_STOCK_FULFILL_RESERVATION'
  | 'REDUCE_STOCK_DIRECT'
  | 'INCREASE_STOCK'
  | 'DECREASE_STOCK';

export interface NormalizedItem {
  external_product_id?: string;
  product_sku?: string;
  product_name: string;
  alias?: string;
  quantity: number;
  rate?: number;
  unit?: string;
  amount?: number;
  discount?: number;
  billed_quantity?: number;
}

export interface NormalizedTallyTransaction {
  external_id: string; // e.g. 'SO-1024', 'INV-2041', 'PUR-044'
  guid?: string;
  voucher_number: string;
  voucher_type: string; // 'Sales Order', 'Sales Invoice', 'Delivery Note', 'Purchase', 'Sales Return', 'Purchase Return'
  normalized_type: ExternalTransactionType;
  action_type: InventoryActionType;
  party_name?: string; // Customer or Supplier
  date: string; // YYYY-MM-DD or ISO
  items: NormalizedItem[];
  reference_order_id?: string; // If invoice fulfills an earlier sales order
  narration?: string;
  is_cancelled?: boolean;
  is_modified?: boolean;
  source: 'TALLY';
  raw_payload?: string;
}

export interface SyncProcessResult {
  success: boolean;
  syncEventId: string;
  externalTransactionId: string;
  transactionType: ExternalTransactionType;
  status: SyncEventStatus;
  message: string;
  details?: {
    inventoryChanges?: Array<{
      productId: string;
      productSku: string;
      productName: string;
      previousStock: number;
      newStock: number;
      previousReserved: number;
      newReserved: number;
      availableStock: number;
    }>;
    reservationsCreatedOrUpdated?: Array<{
      id: string;
      productId: string;
      externalOrderId: string;
      reservedQty: number;
      fulfilledQty: number;
      releasedQty: number;
      status: ReservationStatus;
    }>;
    unmappedItems?: string[];
  };
  error?: string;
}
