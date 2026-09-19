import { ExternalTransactionType } from '../types';

export class TallyNormalizer {
  /**
   * Classifies a Tally Voucher Type into normalized application transaction types
   */
  public static normalizeVoucherType(voucherType: string): {
    normalizedType: ExternalTransactionType;
    transactionDirection: 'STOCK_IN' | 'STOCK_OUT' | 'STOCK_TRANSFER' | 'STOCK_ADJUSTMENT' | 'SALE' | 'SALE_RETURN' | 'PURCHASE' | 'PURCHASE_RETURN';
    inventoryAction: 'RESERVE_STOCK' | 'REDUCE_STOCK_FULFILL_RESERVATION' | 'REDUCE_STOCK_DIRECT' | 'INCREASE_STOCK' | 'DECREASE_STOCK';
    isReturn: boolean;
  } {
    const v = (voucherType || '').toLowerCase().trim();

    if (v.includes('sales order') || v.includes('order')) {
      return {
        normalizedType: 'SALES_ORDER',
        transactionDirection: 'SALE',
        inventoryAction: 'RESERVE_STOCK',
        isReturn: false,
      };
    }

    if (v.includes('delivery note') || v.includes('dispatch') || v.includes('challan')) {
      return {
        normalizedType: 'DELIVERY_NOTE',
        transactionDirection: 'STOCK_OUT',
        inventoryAction: 'REDUCE_STOCK_FULFILL_RESERVATION',
        isReturn: false,
      };
    }

    if (v.includes('sales return') || v.includes('credit note')) {
      return {
        normalizedType: 'SALES_RETURN',
        transactionDirection: 'SALE_RETURN',
        inventoryAction: 'INCREASE_STOCK',
        isReturn: true,
      };
    }

    if (v.includes('purchase return') || v.includes('debit note')) {
      return {
        normalizedType: 'PURCHASE_RETURN',
        transactionDirection: 'PURCHASE_RETURN',
        inventoryAction: 'DECREASE_STOCK',
        isReturn: true,
      };
    }

    if (v.includes('purchase') || v.includes('receipt note') || v.includes('grn')) {
      return {
        normalizedType: 'PURCHASE_INVOICE',
        transactionDirection: 'PURCHASE',
        inventoryAction: 'INCREASE_STOCK',
        isReturn: false,
      };
    }

    if (v.includes('stock journal') || v.includes('transfer') || v.includes('inter-godown')) {
      return {
        normalizedType: 'STOCK_JOURNAL',
        transactionDirection: 'STOCK_TRANSFER',
        inventoryAction: 'INCREASE_STOCK',
        isReturn: false,
      };
    }

    // Default: Sales Invoice
    return {
      normalizedType: 'SALES_INVOICE',
      transactionDirection: 'SALE',
      inventoryAction: 'REDUCE_STOCK_FULFILL_RESERVATION',
      isReturn: false,
    };
  }

  /**
   * Determine Party Type from Ledger Parent Group
   */
  public static classifyParty(parentGroup: string): 'CUSTOMER' | 'SUPPLIER' {
    const p = (parentGroup || '').toLowerCase();
    if (p.includes('creditor') || p.includes('supplier') || p.includes('vendor')) {
      return 'SUPPLIER';
    }
    return 'CUSTOMER';
  }

  /**
   * Cleans and sanitizes strings
   */
  public static sanitizeString(val: any, fallback: string = ''): string {
    if (val === undefined || val === null) return fallback;
    return String(val).trim();
  }

  /**
   * Cleans and sanitizes numbers
   */
  public static sanitizeNumber(val: any, fallback: number = 0): number {
    if (val === undefined || val === null || val === '') return fallback;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
    return isNaN(n) ? fallback : n;
  }
}
