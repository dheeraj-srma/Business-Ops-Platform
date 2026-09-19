import { db, TallyVoucherRow, TallyVoucherItemRow, StockTransactionRow, SyncHistoryLogRow } from '../../db';
import { getTallyClient } from '../client/tallyClient';
import { TallyConnectionConfig, TallyQueryOptions } from '../client/tallyProtocol';
import { TallyNormalizer } from '../mappers/tallyNormalizer';

export class VoucherSyncService {
  /**
   * Synchronize all voucher types (Sales, Purchases, Returns, Journals) from Tally
   */
  public async syncVouchers(
    config: TallyConnectionConfig,
    options?: TallyQueryOptions & { filterType?: 'SALES' | 'PURCHASES' | 'JOURNALS' | 'RETURNS' | 'ALL' }
  ): Promise<{
    success: boolean;
    vouchersProcessed: number;
    vouchersCreated: number;
    vouchersUpdated: number;
    vouchersSkipped: number;
    stockTransactionsRecorded: number;
    message: string;
  }> {
    const startTime = new Date().toISOString();
    const client = getTallyClient(config);
    const rawVouchers = await client.getVouchers(config, options);

    const filter = options?.filterType || 'ALL';

    const result = await db.transaction((state) => {
      const now = new Date().toISOString();
      const activeUser = state.users[0];
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let txRecordedCount = 0;

      for (const v of rawVouchers) {
        const { normalizedType, transactionDirection, inventoryAction, isReturn } = TallyNormalizer.normalizeVoucherType(v.voucher_type);

        // Apply filter if specified
        if (filter === 'SALES' && normalizedType !== 'SALES_INVOICE' && normalizedType !== 'SALES_ORDER') continue;
        if (filter === 'PURCHASES' && normalizedType !== 'PURCHASE_INVOICE') continue;
        if (filter === 'RETURNS' && !isReturn) continue;
        if (filter === 'JOURNALS' && normalizedType !== 'STOCK_JOURNAL') continue;

        // Check if voucher already exists in tally_vouchers
        let existingVch = state.tally_vouchers.find(
          (x) => x.voucher_number === v.voucher_number || (v.tally_guid && x.tally_guid === v.tally_guid)
        );

        const voucherId = existingVch ? existingVch.id : `vch-${Date.now()}-${Math.random().toString().slice(2, 6)}`;

        const voucherItems: TallyVoucherItemRow[] = (v.items || []).map((item: any, idx: number) => ({
          id: `vchi-${Date.now()}-${idx}-${Math.random().toString().slice(2, 5)}`,
          voucher_id: voucherId,
          stock_item_name: item.stock_item_name,
          sku: item.sku,
          quantity: item.quantity,
          unit: item.unit || 'PCS',
          rate: item.rate || 0,
          discount_percentage: item.discount_percentage || 0,
          tax_percentage: item.tax_percentage || 18,
          amount: item.amount || (item.quantity * item.rate),
          godown_name: item.godown_name,
          batch_name: item.batch_name,
        }));

        if (existingVch) {
          existingVch.voucher_type = v.voucher_type;
          existingVch.date = v.date;
          existingVch.party_name = v.party_name;
          existingVch.party_ledger = v.party_ledger;
          existingVch.reference_number = v.reference_number;
          existingVch.narration = v.narration;
          existingVch.total_amount = v.total_amount;
          existingVch.status = v.status || 'POSTED';
          existingVch.items = voucherItems;
          existingVch.last_synced_at = now;
          updatedCount++;
        } else {
          const newVch: TallyVoucherRow = {
            id: voucherId,
            tally_guid: v.tally_guid || `vch-guid-${Date.now()}`,
            voucher_number: v.voucher_number,
            voucher_type: v.voucher_type,
            normalized_type: normalizedType,
            date: v.date,
            party_name: v.party_name,
            party_ledger: v.party_ledger,
            reference_number: v.reference_number,
            narration: v.narration,
            total_amount: v.total_amount,
            status: v.status || 'POSTED',
            source_godown: v.source_godown,
            destination_godown: v.destination_godown,
            items: voucherItems,
            created_at: now,
            last_synced_at: now,
          };
          state.tally_vouchers.unshift(newVch);
          createdCount++;

          // Apply inventory movements for newly synced posted vouchers
          if (v.status !== 'CANCELLED') {
            for (const item of voucherItems) {
              // Locate matching product
              const product = state.products.find(
                (p) =>
                  (item.sku && p.sku.toUpperCase() === item.sku.toUpperCase()) ||
                  p.name.toLowerCase() === item.stock_item_name.toLowerCase()
              );

              if (product) {
                const prevStock = product.current_stock;
                let newStock = prevStock;

                // Handle Stock In vs Out based on normalized direction
                if (transactionDirection === 'SALE' || transactionDirection === 'STOCK_OUT' || transactionDirection === 'PURCHASE_RETURN') {
                  newStock = prevStock - item.quantity;
                  product.current_stock = newStock;
                  product.updated_at = now;

                  const tx: StockTransactionRow = {
                    id: `tx-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
                    product_id: product.id,
                    transaction_type: 'STOCK_OUT',
                    quantity: item.quantity,
                    previous_stock: prevStock,
                    new_stock: newStock,
                    reason: `Tally ${v.voucher_type}: ${v.voucher_number}`,
                    supplier_or_recipient: v.party_name || 'Customer Issue',
                    reference_number: v.voucher_number,
                    notes: v.narration || '',
                    source: 'TALLY',
                    external_reference: v.voucher_number,
                    created_by_id: activeUser.id,
                    created_by_name: activeUser.name,
                    created_at: v.date ? new Date(v.date).toISOString() : now,
                  };
                  state.stock_transactions.unshift(tx);
                  txRecordedCount++;
                } else if (transactionDirection === 'PURCHASE' || transactionDirection === 'STOCK_IN' || transactionDirection === 'SALE_RETURN') {
                  newStock = prevStock + item.quantity;
                  product.current_stock = newStock;
                  product.updated_at = now;

                  const tx: StockTransactionRow = {
                    id: `tx-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
                    product_id: product.id,
                    transaction_type: 'STOCK_IN',
                    quantity: item.quantity,
                    previous_stock: prevStock,
                    new_stock: newStock,
                    reason: `Tally ${v.voucher_type}: ${v.voucher_number}`,
                    supplier_or_recipient: v.party_name || 'Supplier Receipt',
                    reference_number: v.voucher_number,
                    notes: v.narration || '',
                    source: 'TALLY',
                    external_reference: v.voucher_number,
                    created_by_id: activeUser.id,
                    created_by_name: activeUser.name,
                    created_at: v.date ? new Date(v.date).toISOString() : now,
                  };
                  state.stock_transactions.unshift(tx);
                  txRecordedCount++;
                }
              }
            }
          }
        }
      }

      // Log sync history
      const totalProcessed = rawVouchers.length;
      const logType = filter === 'SALES' ? 'SALES' : filter === 'PURCHASES' ? 'PURCHASES' : 'STOCK_TRANSACTIONS';
      const log: SyncHistoryLogRow = {
        id: `synclog-${Date.now()}`,
        sync_type: logType as any,
        mode: 'FULL',
        company_name: state.settings.tally_company_name,
        started_at: startTime,
        completed_at: new Date().toISOString(),
        status: 'SUCCESS',
        records_processed: totalProcessed,
        records_created: createdCount,
        records_updated: updatedCount,
        records_skipped: skippedCount,
        records_failed: 0,
        details: { filter, createdCount, updatedCount, txRecordedCount },
      };
      state.sync_history_logs.unshift(log);

      return {
        vouchersProcessed: totalProcessed,
        vouchersCreated: createdCount,
        vouchersUpdated: updatedCount,
        vouchersSkipped: skippedCount,
        stockTransactionsRecorded: txRecordedCount,
      };
    });

    return {
      success: true,
      ...result,
      message: `Voucher synchronization completed: ${result.vouchersCreated} created, ${result.vouchersUpdated} updated, ${result.stockTransactionsRecorded} stock movements posted.`,
    };
  }
}

export const voucherSyncService = new VoucherSyncService();
