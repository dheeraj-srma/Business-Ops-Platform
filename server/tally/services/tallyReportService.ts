import { db } from '../../db';

export class TallyReportService {
  /**
   * Get High-level Financial & Operational Overview
   */
  public getFinancialOverview() {
    const state = db.getState();

    let totalSales = 0;
    let totalPurchases = 0;
    let salesCount = 0;
    let purchaseCount = 0;
    let returnsCount = 0;

    for (const v of state.tally_vouchers) {
      if (v.status === 'CANCELLED') continue;
      if (v.normalized_type === 'SALES_INVOICE' || v.voucher_type.toLowerCase().includes('sales')) {
        totalSales += v.total_amount || 0;
        salesCount++;
      } else if (v.normalized_type === 'PURCHASE_INVOICE' || v.voucher_type.toLowerCase().includes('purchase')) {
        totalPurchases += v.total_amount || 0;
        purchaseCount++;
      } else if (v.normalized_type === 'SALES_RETURN' || v.normalized_type === 'PURCHASE_RETURN') {
        returnsCount++;
      }
    }

    let totalReceivables = 0;
    let totalPayables = 0;
    let cashBalance = 0;
    let bankBalance = 0;

    for (const led of state.tally_ledgers) {
      const p = led.parent_group.toLowerCase();
      if (p.includes('debtor') || p.includes('customer')) {
        totalReceivables += led.closing_balance || 0;
      } else if (p.includes('creditor') || p.includes('supplier')) {
        totalPayables += led.closing_balance || 0;
      } else if (p.includes('bank')) {
        bankBalance += led.closing_balance || 0;
      } else if (p.includes('cash')) {
        cashBalance += led.closing_balance || 0;
      }
    }

    let totalInventoryValue = 0;
    let totalUnits = 0;
    for (const prod of state.products) {
      if (!prod.is_active) continue;
      totalUnits += prod.current_stock;
      totalInventoryValue += prod.current_stock * (prod.unit_cost || 0);
    }

    const company = state.tally_companies[0] || {
      name: state.settings.tally_company_name,
      currency: 'INR (₹)',
    };

    return {
      company,
      metrics: {
        totalSales,
        totalPurchases,
        salesCount,
        purchaseCount,
        returnsCount,
        totalReceivables,
        totalPayables,
        cashBalance,
        bankBalance,
        totalInventoryValue,
        totalUnits,
        totalProducts: state.products.length,
        totalGodowns: state.tally_godowns.length,
        totalLedgers: state.tally_ledgers.length,
        totalParties: state.tally_parties.length,
      },
    };
  }

  /**
   * Product-level sales breakdown from synchronized vouchers
   */
  public getSalesByProduct() {
    const state = db.getState();
    const productSalesMap = new Map<string, { name: string; sku: string; unitsSold: number; totalRevenue: number; orderCount: number }>();

    for (const v of state.tally_vouchers) {
      if (v.status === 'CANCELLED' || v.normalized_type !== 'SALES_INVOICE') continue;

      for (const item of v.items || []) {
        const key = item.sku || item.stock_item_name;
        const existing = productSalesMap.get(key) || {
          name: item.stock_item_name,
          sku: item.sku || '',
          unitsSold: 0,
          totalRevenue: 0,
          orderCount: 0,
        };

        existing.unitsSold += item.quantity;
        existing.totalRevenue += item.amount;
        existing.orderCount += 1;
        productSalesMap.set(key, existing);
      }
    }

    const report = Array.from(productSalesMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    return { report };
  }

  /**
   * Supplier-level purchases breakdown
   */
  public getPurchasesBySupplier() {
    const state = db.getState();
    const supplierMap = new Map<string, { supplierName: string; invoiceCount: number; totalPurchasedAmount: number; lastInvoiceDate?: string }>();

    for (const v of state.tally_vouchers) {
      if (v.status === 'CANCELLED' || v.normalized_type !== 'PURCHASE_INVOICE') continue;
      const key = v.party_name || 'Direct Supplier';
      const existing = supplierMap.get(key) || {
        supplierName: key,
        invoiceCount: 0,
        totalPurchasedAmount: 0,
        lastInvoiceDate: v.date,
      };

      existing.invoiceCount += 1;
      existing.totalPurchasedAmount += v.total_amount;
      if (new Date(v.date) > new Date(existing.lastInvoiceDate || '1970-01-01')) {
        existing.lastInvoiceDate = v.date;
      }
      supplierMap.set(key, existing);
    }

    const report = Array.from(supplierMap.values()).sort((a, b) => b.totalPurchasedAmount - a.totalPurchasedAmount);
    return { report };
  }

  /**
   * Multi-Warehouse / Godown Stock Balances
   */
  public getGodownStockReport() {
    const state = db.getState();

    const godowns = state.tally_godowns.map((g) => {
      const stocks = state.tally_godown_stocks.filter((s) => s.godown_id === g.id);
      const totalUnits = stocks.reduce((sum, s) => sum + s.quantity, 0);
      const totalValue = stocks.reduce((sum, s) => sum + s.value, 0);

      return {
        ...g,
        itemCount: stocks.length,
        totalUnits,
        calculatedStockValue: totalValue > 0 ? totalValue : g.total_stock_value,
        stocks,
      };
    });

    return { godowns };
  }

  /**
   * Customer (Debtors) & Supplier (Creditors) Outstanding Balances
   */
  public getPartyReport(partyType?: 'CUSTOMER' | 'SUPPLIER') {
    const state = db.getState();
    let parties = [...state.tally_parties];

    if (partyType) {
      parties = parties.filter((p) => p.party_type === partyType);
    }

    parties.sort((a, b) => b.outstanding_amount - a.outstanding_amount);
    return { parties };
  }
}

export const tallyReportService = new TallyReportService();
