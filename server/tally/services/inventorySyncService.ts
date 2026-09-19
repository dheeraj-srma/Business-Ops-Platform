import crypto from 'crypto';
import { db, StockTransactionRow, StockReservationRow, SyncEventRow, TallyProductMappingRow } from '../../db';
import { NormalizedTallyTransaction, SyncProcessResult, SyncEventStatus } from '../types';
import { matchTallyItemToProduct } from '../mappers/productMatcher';

export function calculatePayloadHash(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
}

export class InventorySyncService {
  /**
   * Process a normalized Tally transaction with ACID transaction and Idempotency guarantees.
   */
  public async processTransaction(
    tx: NormalizedTallyTransaction,
    connectionId: string = 'conn-tally-primary',
    existingEventId?: string
  ): Promise<SyncProcessResult> {
    const payloadHash = calculatePayloadHash({
      id: tx.external_id,
      type: tx.normalized_type,
      items: tx.items,
      cancelled: tx.is_cancelled,
      modified: tx.is_modified,
    });

    return db.transaction((state) => {
      // 1. Idempotency Check
      const duplicateEvent = state.sync_events.find(
        (e) =>
          e.external_transaction_id === tx.external_id &&
          e.external_transaction_type === tx.normalized_type &&
          e.payload_hash === payloadHash &&
          e.status === 'SYNCED' &&
          e.id !== existingEventId
      );

      if (duplicateEvent) {
        return {
          success: true,
          syncEventId: duplicateEvent.id,
          externalTransactionId: tx.external_id,
          transactionType: tx.normalized_type,
          status: 'SYNCED' as SyncEventStatus,
          message: `Idempotent: Transaction ${tx.external_id} (${tx.normalized_type}) already synchronized previously. No duplicate stock movement applied.`,
        };
      }

      // 2. Locate or create the sync event row
      let eventRow = existingEventId
        ? state.sync_events.find((e) => e.id === existingEventId)
        : undefined;

      const eventId = eventRow ? eventRow.id : `sync-ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      if (!eventRow) {
        eventRow = {
          id: eventId,
          connection_id: connectionId,
          source_system: 'TALLY',
          external_transaction_id: tx.external_id,
          external_transaction_type: tx.normalized_type,
          event_type: tx.is_cancelled ? 'CANCELLED' : tx.is_modified ? 'MODIFIED' : 'CREATED',
          payload_hash: payloadHash,
          status: 'PROCESSING',
          retry_count: 0,
          max_retries: 4,
          raw_payload: tx.raw_payload,
          normalized_data: tx,
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.sync_events.unshift(eventRow);
      } else {
        eventRow.status = 'PROCESSING';
        eventRow.updated_at = new Date().toISOString();
      }

      // 3. Handle Order Cancellation
      if (tx.is_cancelled || tx.normalized_type === 'SALES_ORDER' && tx.is_cancelled) {
        const activeReservations = state.stock_reservations.filter(
          (r) => r.external_order_id === tx.external_id && (r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED')
        );

        for (const res of activeReservations) {
          const product = state.products.find((p) => p.id === res.product_id);
          if (product) {
            const releaseQty = res.reserved_quantity - res.fulfilled_quantity;
            product.reserved_stock = Math.max(0, (product.reserved_stock || 0) - releaseQty);
            product.updated_at = new Date().toISOString();
          }
          res.status = 'CANCELLED';
          res.released_quantity = res.reserved_quantity - res.fulfilled_quantity;
          res.notes = `Cancelled via Tally voucher ${tx.voucher_number}`;
          res.updated_at = new Date().toISOString();
        }

        eventRow.status = 'SYNCED';
        eventRow.processed_at = new Date().toISOString();
        eventRow.last_error = undefined;

        return {
          success: true,
          syncEventId: eventId,
          externalTransactionId: tx.external_id,
          transactionType: tx.normalized_type,
          status: 'SYNCED',
          message: `Sales Order ${tx.external_id} was successfully CANCELLED. Released ${activeReservations.length} reservations.`,
        };
      }

      // 4. Validate and Match All Products First (Fail Fast)
      const matchedItems: Array<{
        item: typeof tx.items[0];
        product: typeof state.products[0];
        mapping?: typeof state.tally_product_mappings[0];
      }> = [];

      const unmappedItems: string[] = [];

      for (const item of tx.items) {
        const match = matchTallyItemToProduct(item, state.products, state.tally_product_mappings);
        if (!match.matched || !match.product) {
          unmappedItems.push(item.product_name || item.product_sku || 'Unknown Item');
          
          // Create or suggest mapping entry if not exists
          const existingMap = state.tally_product_mappings.find(
            (m) => m.tally_stock_item_name.toLowerCase() === (item.product_name || '').toLowerCase()
          );
          if (!existingMap) {
            state.tally_product_mappings.push({
              id: `map-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              product_id: '',
              product_sku: item.product_sku || '',
              product_name: '',
              tally_stock_item_id: item.external_product_id || `TALLY-${Date.now()}`,
              tally_stock_item_name: item.product_name,
              tally_alias: item.alias,
              mapping_status: 'UNMAPPED',
              auto_matched: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          matchedItems.push({
            item,
            product: match.product,
            mapping: match.mapping,
          });
        }
      }

      // If any item is unmapped, reject the batch safely
      if (unmappedItems.length > 0) {
        const errMsg = `Unmapped Tally product(s): ${unmappedItems.join(', ')}. Please map them in Product Mapping.`;
        eventRow.status = 'FAILED';
        eventRow.last_error = errMsg;
        eventRow.retry_count = (eventRow.retry_count || 0) + 1;
        eventRow.updated_at = new Date().toISOString();

        return {
          success: false,
          syncEventId: eventId,
          externalTransactionId: tx.external_id,
          transactionType: tx.normalized_type,
          status: 'FAILED',
          message: errMsg,
          details: { unmappedItems },
          error: errMsg,
        };
      }

      const inventoryChanges: Array<any> = [];
      const reservationsCreatedOrUpdated: Array<any> = [];

      // 5. Execute Action Based on Voucher Type
      if (tx.normalized_type === 'SALES_ORDER') {
        // SALES ORDER: Update/Create Reservations
        for (const { item, product } of matchedItems) {
          const prevReserved = product.reserved_stock || 0;
          const prevStock = product.current_stock;

          // Check if existing reservation exists for this order & product (Modification)
          let reservation = state.stock_reservations.find(
            (r) => r.external_order_id === tx.external_id && r.product_id === product.id
          );

          if (reservation) {
            const diff = item.quantity - reservation.reserved_quantity;
            reservation.reserved_quantity = item.quantity;
            reservation.customer_name = tx.party_name;
            reservation.status = item.quantity === 0 ? 'CANCELLED' : 'ACTIVE';
            reservation.updated_at = new Date().toISOString();

            product.reserved_stock = Math.max(0, prevReserved + diff);
          } else {
            // New Reservation
            reservation = {
              id: `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              product_id: product.id,
              product_sku: product.sku,
              product_name: product.name,
              source_transaction_id: eventId,
              external_order_id: tx.external_id,
              customer_name: tx.party_name,
              reserved_quantity: item.quantity,
              fulfilled_quantity: 0,
              released_quantity: 0,
              status: 'ACTIVE',
              notes: `Tally Sales Order ${tx.voucher_number} for ${tx.party_name || 'Customer'}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            state.stock_reservations.unshift(reservation);
            product.reserved_stock = prevReserved + item.quantity;
          }

          product.updated_at = new Date().toISOString();

          reservationsCreatedOrUpdated.push({
            id: reservation.id,
            productId: product.id,
            externalOrderId: tx.external_id,
            reservedQty: reservation.reserved_quantity,
            fulfilledQty: reservation.fulfilled_quantity,
            releasedQty: reservation.released_quantity,
            status: reservation.status,
          });

          inventoryChanges.push({
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            previousStock: prevStock,
            newStock: product.current_stock,
            previousReserved: prevReserved,
            newReserved: product.reserved_stock,
            availableStock: product.current_stock - (product.reserved_stock || 0),
          });
        }
      } else if (tx.normalized_type === 'SALES_INVOICE' || tx.normalized_type === 'DELIVERY_NOTE') {
        // SALES INVOICE / DISPATCH: Reduce Physical Stock and Fulfill Reservations
        for (const { item, product } of matchedItems) {
          const prevStock = product.current_stock;
          const prevReserved = product.reserved_stock || 0;
          const dispatchQty = item.quantity;

          // Check if there is an active reservation linked via reference_order_id or customer
          const activeRes = state.stock_reservations.find(
            (r) =>
              r.product_id === product.id &&
              (r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED') &&
              (tx.reference_order_id ? r.external_order_id === tx.reference_order_id : true)
          );

          let reservedToRelease = 0;
          if (activeRes) {
            const remainingToFulfill = activeRes.reserved_quantity - activeRes.fulfilled_quantity;
            const fulfillAmount = Math.min(dispatchQty, remainingToFulfill);
            activeRes.fulfilled_quantity += fulfillAmount;
            reservedToRelease = fulfillAmount;

            if (activeRes.fulfilled_quantity >= activeRes.reserved_quantity) {
              activeRes.status = 'FULFILLED';
            } else {
              activeRes.status = 'PARTIALLY_FULFILLED';
            }
            activeRes.updated_at = new Date().toISOString();

            reservationsCreatedOrUpdated.push({
              id: activeRes.id,
              productId: product.id,
              externalOrderId: activeRes.external_order_id,
              reservedQty: activeRes.reserved_quantity,
              fulfilledQty: activeRes.fulfilled_quantity,
              releasedQty: activeRes.released_quantity,
              status: activeRes.status,
            });
          }

          // Update product physical stock and release reserved stock
          const newPhysicalStock = prevStock - dispatchQty;
          product.current_stock = newPhysicalStock;
          product.reserved_stock = Math.max(0, prevReserved - reservedToRelease);
          product.updated_at = new Date().toISOString();

          // Create stock transaction record
          const txRow: StockTransactionRow = {
            id: `tx-tally-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            product_id: product.id,
            transaction_type: 'STOCK_OUT',
            quantity: dispatchQty,
            previous_stock: prevStock,
            new_stock: newPhysicalStock,
            reason: `Tally ${tx.voucher_type} (${tx.voucher_number})`,
            supplier_or_recipient: tx.party_name || 'Customer Dispatch',
            reference_number: tx.voucher_number,
            notes: `Auto-synchronized from TallyPrime. ${activeRes ? `Fulfilled reservation on ${activeRes.external_order_id}` : 'Direct invoice dispatch'}.`,
            source: 'TALLY',
            external_reference: tx.external_id,
            created_by_id: 'tally-engine',
            created_by_name: 'Tally Live Integration',
            created_at: new Date().toISOString(),
          };
          state.stock_transactions.unshift(txRow);

          inventoryChanges.push({
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            previousStock: prevStock,
            newStock: product.current_stock,
            previousReserved: prevReserved,
            newReserved: product.reserved_stock,
            availableStock: product.current_stock - (product.reserved_stock || 0),
          });
        }
      } else if (tx.normalized_type === 'PURCHASE_INVOICE') {
        // PURCHASE / GOODS RECEIPT: Increase Physical Stock
        for (const { item, product } of matchedItems) {
          const prevStock = product.current_stock;
          const prevReserved = product.reserved_stock || 0;
          const newStock = prevStock + item.quantity;

          product.current_stock = newStock;
          product.updated_at = new Date().toISOString();

          const txRow: StockTransactionRow = {
            id: `tx-tally-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            product_id: product.id,
            transaction_type: 'STOCK_IN',
            quantity: item.quantity,
            previous_stock: prevStock,
            new_stock: newStock,
            reason: `Tally Purchase Receipt (${tx.voucher_number})`,
            supplier_or_recipient: tx.party_name || 'Vendor Goods Receipt',
            reference_number: tx.voucher_number,
            notes: `Auto-synchronized from TallyPrime purchase invoice.`,
            source: 'TALLY',
            external_reference: tx.external_id,
            created_by_id: 'tally-engine',
            created_by_name: 'Tally Live Integration',
            created_at: new Date().toISOString(),
          };
          state.stock_transactions.unshift(txRow);

          inventoryChanges.push({
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            previousStock: prevStock,
            newStock: product.current_stock,
            previousReserved: prevReserved,
            newReserved: product.reserved_stock,
            availableStock: product.current_stock - (product.reserved_stock || 0),
          });
        }
      } else if (tx.normalized_type === 'SALES_RETURN') {
        // SALES RETURN: Customer Return Restores Physical Stock
        for (const { item, product } of matchedItems) {
          const prevStock = product.current_stock;
          const prevReserved = product.reserved_stock || 0;
          const newStock = prevStock + item.quantity;

          product.current_stock = newStock;
          product.updated_at = new Date().toISOString();

          const txRow: StockTransactionRow = {
            id: `tx-tally-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            product_id: product.id,
            transaction_type: 'STOCK_IN',
            quantity: item.quantity,
            previous_stock: prevStock,
            new_stock: newStock,
            reason: `Tally Credit Note / Sales Return (${tx.voucher_number})`,
            supplier_or_recipient: tx.party_name || 'Customer Return',
            reference_number: tx.voucher_number,
            notes: `Auto-synchronized from Tally Credit Note. Restored physical inventory.`,
            source: 'TALLY',
            external_reference: tx.external_id,
            created_by_id: 'tally-engine',
            created_by_name: 'Tally Live Integration',
            created_at: new Date().toISOString(),
          };
          state.stock_transactions.unshift(txRow);

          inventoryChanges.push({
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            previousStock: prevStock,
            newStock: product.current_stock,
            previousReserved: prevReserved,
            newReserved: product.reserved_stock,
            availableStock: product.current_stock - (product.reserved_stock || 0),
          });
        }
      } else if (tx.normalized_type === 'PURCHASE_RETURN') {
        // PURCHASE RETURN: Debit Note to Vendor Reduces Physical Stock
        for (const { item, product } of matchedItems) {
          const prevStock = product.current_stock;
          const prevReserved = product.reserved_stock || 0;
          const newStock = Math.max(0, prevStock - item.quantity);

          product.current_stock = newStock;
          product.updated_at = new Date().toISOString();

          const txRow: StockTransactionRow = {
            id: `tx-tally-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            product_id: product.id,
            transaction_type: 'STOCK_OUT',
            quantity: item.quantity,
            previous_stock: prevStock,
            new_stock: newStock,
            reason: `Tally Debit Note / Purchase Return (${tx.voucher_number})`,
            supplier_or_recipient: tx.party_name || 'Vendor Return',
            reference_number: tx.voucher_number,
            notes: `Auto-synchronized from Tally Debit Note. Returned goods to supplier.`,
            source: 'TALLY',
            external_reference: tx.external_id,
            created_by_id: 'tally-engine',
            created_by_name: 'Tally Live Integration',
            created_at: new Date().toISOString(),
          };
          state.stock_transactions.unshift(txRow);

          inventoryChanges.push({
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            previousStock: prevStock,
            newStock: product.current_stock,
            previousReserved: prevReserved,
            newReserved: product.reserved_stock,
            availableStock: product.current_stock - (product.reserved_stock || 0),
          });
        }
      } else {
        // Default / Stock Journal: Adjust Physical Stock
        for (const { item, product } of matchedItems) {
          const prevStock = product.current_stock;
          const prevReserved = product.reserved_stock || 0;
          const newStock = prevStock + item.quantity;

          product.current_stock = newStock;
          product.updated_at = new Date().toISOString();

          inventoryChanges.push({
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            previousStock: prevStock,
            newStock: product.current_stock,
            previousReserved: prevReserved,
            newReserved: product.reserved_stock,
            availableStock: product.current_stock - (product.reserved_stock || 0),
          });
        }
      }

      // 6. Update Connection Checkpoint & Sync Event Status
      eventRow.status = 'SYNCED';
      eventRow.processed_at = new Date().toISOString();
      eventRow.last_error = undefined;
      eventRow.updated_at = new Date().toISOString();

      const connection = state.tally_connections.find((c) => c.id === connectionId);
      if (connection) {
        connection.last_sync_at = new Date().toISOString();
        connection.connection_status = 'CONNECTED';
        connection.updated_at = new Date().toISOString();
      }

      let checkpoint = state.sync_checkpoints.find((c) => c.connection_id === connectionId);
      if (!checkpoint) {
        checkpoint = {
          id: `chk-${Date.now()}`,
          connection_id: connectionId,
          transaction_type: 'ALL',
          last_successful_sync: new Date().toISOString(),
          last_external_transaction_id: tx.external_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.sync_checkpoints.push(checkpoint);
      } else {
        checkpoint.last_successful_sync = new Date().toISOString();
        checkpoint.last_external_transaction_id = tx.external_id;
        checkpoint.updated_at = new Date().toISOString();
      }

      return {
        success: true,
        syncEventId: eventId,
        externalTransactionId: tx.external_id,
        transactionType: tx.normalized_type,
        status: 'SYNCED',
        message: `Successfully synchronized ${tx.voucher_type} (${tx.external_id}) from Tally.`,
        details: {
          inventoryChanges,
          reservationsCreatedOrUpdated,
        },
      };
    });
  }
}

export const inventorySyncService = new InventorySyncService();
