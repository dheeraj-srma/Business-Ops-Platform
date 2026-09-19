import { db, SyncEventRow, TallyConnectionRow } from '../../db';
import { NormalizedTallyTransaction, SyncProcessResult } from '../types';
import { inventorySyncService } from './inventorySyncService';
import { parseTallyJsonPayload } from '../parsers/jsonParser';
import { parseTallyXmlEnvelope } from '../parsers/xmlParser';
import { testTallyConnection } from '../client/tallyClient';

export class TallySyncEngine {
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPollingActive: boolean = false;

  constructor() {
    this.startBackgroundWorker();
  }

  public startBackgroundWorker() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    // Periodic check every 15 seconds
    this.pollingTimer = setInterval(() => {
      this.runScheduledCheck().catch((err) => {
        console.error('Scheduled Tally sync error:', err);
      });
    }, 15000);
  }

  private async runScheduledCheck() {
    const state = db.getState();
    const activeConnection = state.tally_connections.find((c) => c.is_active && c.auto_sync);
    if (!activeConnection) return;

    // Check if interval elapsed
    const now = Date.now();
    const lastChecked = activeConnection.last_checked_at ? new Date(activeConnection.last_checked_at).getTime() : 0;
    const intervalMs = (activeConnection.sync_interval_seconds || 30) * 1000;

    if (now - lastChecked >= intervalMs) {
      activeConnection.last_checked_at = new Date().toISOString();
      try {
        const testRes = await testTallyConnection(
          activeConnection.server_url || 'http://localhost',
          activeConnection.port || 9000,
          activeConnection.company_name || 'Apex'
        );
        activeConnection.connection_status = testRes.status;
        if (!testRes.connected) {
          activeConnection.last_error = testRes.message;
        } else {
          activeConnection.last_error = undefined;
        }
      } catch (e: any) {
        activeConnection.connection_status = 'DISCONNECTED';
        activeConnection.last_error = e.message;
      }
    }
  }

  /**
   * Process raw input from Tally Webhook / Push API (JSON or XML)
   */
  public async ingestPayload(
    payload: any,
    contentType: 'JSON' | 'XML' = 'JSON',
    connectionId: string = 'conn-tally-primary'
  ): Promise<SyncProcessResult[]> {
    let normalizedTransactions: NormalizedTallyTransaction[] = [];

    if (contentType === 'XML' || typeof payload === 'string' && payload.trim().startsWith('<')) {
      normalizedTransactions = parseTallyXmlEnvelope(payload);
    } else {
      normalizedTransactions = parseTallyJsonPayload(payload);
    }

    if (normalizedTransactions.length === 0) {
      return [
        {
          success: false,
          syncEventId: `err-${Date.now()}`,
          externalTransactionId: 'UNKNOWN',
          transactionType: 'SALES_INVOICE',
          status: 'FAILED',
          message: 'No valid Tally voucher entries found in incoming payload.',
          error: 'Empty or invalid Tally payload structure.',
        },
      ];
    }

    const results: SyncProcessResult[] = [];
    for (const tx of normalizedTransactions) {
      const res = await inventorySyncService.processTransaction(tx, connectionId);
      results.push(res);
    }

    return results;
  }

  /**
   * Retry a single failed sync event
   */
  public async retryEvent(eventId: string): Promise<SyncProcessResult> {
    const state = db.getState();
    const event = state.sync_events.find((e) => e.id === eventId);
    if (!event) {
      throw new Error(`Sync event ${eventId} not found`);
    }

    if (!event.normalized_data) {
      throw new Error(`Sync event ${eventId} has no normalized payload for retry`);
    }

    return await inventorySyncService.processTransaction(
      event.normalized_data,
      event.connection_id || 'conn-tally-primary',
      event.id
    );
  }

  /**
   * Retry all failed events
   */
  public async retryAllFailed(): Promise<{ total: number; retried: number; succeeded: number; failed: number }> {
    const state = db.getState();
    const failedEvents = state.sync_events.filter((e) => e.status === 'FAILED');
    let succeeded = 0;
    let failed = 0;

    for (const ev of failedEvents) {
      try {
        const res = await this.retryEvent(ev.id);
        if (res.success) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return {
      total: failedEvents.length,
      retried: failedEvents.length,
      succeeded,
      failed,
    };
  }

  /**
   * Ignore a failed sync event
   */
  public async ignoreEvent(eventId: string): Promise<{ success: boolean; event: SyncEventRow }> {
    return db.transaction((state) => {
      const event = state.sync_events.find((e) => e.id === eventId);
      if (!event) throw new Error(`Sync event ${eventId} not found`);
      event.status = 'IGNORED';
      event.updated_at = new Date().toISOString();
      return { success: true, event };
    });
  }

  /**
   * Interactive Simulator: Generates realistic live Tally transactions
   */
  public async simulateScenario(
    scenarioType:
      | 'SCENARIO_1_SALES_ORDER'
      | 'SCENARIO_2_PARTIAL_DISPATCH'
      | 'SCENARIO_3_FULL_DISPATCH'
      | 'SCENARIO_4_DUPLICATE_SYNC'
      | 'SCENARIO_5_UNMAPPED_ITEM'
      | 'SCENARIO_6_PURCHASE_RECEIPT'
      | 'SCENARIO_7_ORDER_MODIFIED'
      | 'SCENARIO_8_ORDER_CANCELLED'
      | 'SCENARIO_9_SALES_RETURN'
      | 'SCENARIO_10_PURCHASE_RETURN',
    customParams?: any
  ): Promise<SyncProcessResult> {
    const nowStr = new Date().toISOString().slice(0, 10);
    const randId = Math.floor(1000 + Math.random() * 9000);

    let tx: NormalizedTallyTransaction;

    switch (scenarioType) {
      case 'SCENARIO_1_SALES_ORDER': {
        // Creates a new Sales Order, reserving stock for product (e.g. Angle Valve or Ball Valve)
        const orderNum = customParams?.orderNumber || `SO-TAL-${randId}`;
        tx = {
          external_id: orderNum,
          voucher_number: orderNum,
          voucher_type: 'Sales Order',
          normalized_type: 'SALES_ORDER',
          action_type: 'RESERVE_STOCK',
          party_name: customParams?.partyName || 'Shapoorji Pallonji EPC Ltd',
          date: nowStr,
          items: [
            {
              product_sku: customParams?.sku || 'BF-AV-01',
              product_name: customParams?.productName || 'Angle Valve 1/2" Brass Chrome',
              quantity: customParams?.quantity || 25,
              rate: 340,
              amount: (customParams?.quantity || 25) * 340,
              unit: 'PCS',
            },
          ],
          narration: 'Live simulation: Open Sales Order from TallyPrime requiring stock reservation.',
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_2_PARTIAL_DISPATCH': {
        // Dispatches 10 units out of a 25/30 unit order
        const orderRef = customParams?.orderRef || 'SO-1024';
        const invNum = `INV-DISP-${randId}`;
        tx = {
          external_id: invNum,
          voucher_number: invNum,
          voucher_type: 'Delivery Note',
          normalized_type: 'DELIVERY_NOTE',
          action_type: 'REDUCE_STOCK_FULFILL_RESERVATION',
          party_name: customParams?.partyName || 'Godrej Properties Ltd',
          date: nowStr,
          reference_order_id: orderRef,
          items: [
            {
              product_sku: customParams?.sku || 'BF-AV-01',
              product_name: customParams?.productName || 'Angle Valve 1/2" Brass Chrome',
              quantity: customParams?.quantity || 10,
              rate: 340,
              amount: (customParams?.quantity || 10) * 340,
              unit: 'PCS',
            },
          ],
          narration: `Partial dispatch against Sales Order ${orderRef}`,
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_3_FULL_DISPATCH': {
        // Full dispatch fulfilling remaining reservation
        const orderRef = customParams?.orderRef || 'SO-1024';
        const invNum = `INV-FULL-${randId}`;
        tx = {
          external_id: invNum,
          voucher_number: invNum,
          voucher_type: 'Sales Invoice',
          normalized_type: 'SALES_INVOICE',
          action_type: 'REDUCE_STOCK_FULFILL_RESERVATION',
          party_name: customParams?.partyName || 'Godrej Properties Ltd',
          date: nowStr,
          reference_order_id: orderRef,
          items: [
            {
              product_sku: customParams?.sku || 'BF-AV-01',
              product_name: customParams?.productName || 'Angle Valve 1/2" Brass Chrome',
              quantity: customParams?.quantity || 20,
              rate: 340,
              amount: (customParams?.quantity || 20) * 340,
              unit: 'PCS',
            },
          ],
          narration: `Complete fulfillment against Sales Order ${orderRef}`,
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_4_DUPLICATE_SYNC': {
        // Sends the exact already-synced transaction to demonstrate idempotency
        tx = {
          external_id: 'SO-1024',
          voucher_number: 'SO-1024',
          voucher_type: 'Sales Order',
          normalized_type: 'SALES_ORDER',
          action_type: 'RESERVE_STOCK',
          party_name: 'Godrej Properties Ltd',
          date: nowStr,
          items: [
            {
              product_sku: 'BF-AV-01',
              product_name: 'Angle Valve 1/2" Brass Chrome',
              quantity: 30,
              rate: 340,
              amount: 10200,
              unit: 'PCS',
            },
          ],
          narration: 'Duplicate payload test for idempotency check',
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_5_UNMAPPED_ITEM': {
        // Sends an item not yet in the master list to test unmapped error queue and auto-suggestion
        const invNum = `INV-NEW-${randId}`;
        tx = {
          external_id: invNum,
          voucher_number: invNum,
          voucher_type: 'Sales Invoice',
          normalized_type: 'SALES_INVOICE',
          action_type: 'REDUCE_STOCK_DIRECT',
          party_name: 'Larsen & Toubro Ltd',
          date: nowStr,
          items: [
            {
              product_name: `Industrial Flange Valve Stainless 316 (${randId})`,
              quantity: 5,
              rate: 1850,
              amount: 9250,
              unit: 'PCS',
            },
          ],
          narration: 'Simulation with unmapped Tally item to trigger mapping queue and alert.',
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_6_PURCHASE_RECEIPT': {
        // Supplier purchase receipt adding physical warehouse inventory
        const purNum = `PUR-REC-${randId}`;
        tx = {
          external_id: purNum,
          voucher_number: purNum,
          voucher_type: 'Purchase',
          normalized_type: 'PURCHASE_INVOICE',
          action_type: 'INCREASE_STOCK',
          party_name: customParams?.partyName || 'Astral Pipes Manufacturing Ltd',
          date: nowStr,
          items: [
            {
              product_sku: customParams?.sku || 'PP-CPVC-01',
              product_name: customParams?.productName || 'CPVC Pipe 1" SDR-11 (3 Meter)',
              quantity: customParams?.quantity || 40,
              rate: 420,
              amount: (customParams?.quantity || 40) * 420,
              unit: 'PCS',
            },
          ],
          narration: 'Goods received from supplier into physical inventory.',
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_7_ORDER_MODIFIED': {
        // Modifies an existing open sales order to a new quantity
        const orderNum = customParams?.orderRef || 'SO-1024';
        tx = {
          external_id: orderNum,
          voucher_number: orderNum,
          voucher_type: 'Sales Order',
          normalized_type: 'SALES_ORDER',
          action_type: 'RESERVE_STOCK',
          party_name: 'Godrej Properties Ltd',
          date: nowStr,
          is_modified: true,
          items: [
            {
              product_sku: 'BF-AV-01',
              product_name: 'Angle Valve 1/2" Brass Chrome',
              quantity: customParams?.newQuantity || 45,
              rate: 340,
              amount: (customParams?.newQuantity || 45) * 340,
              unit: 'PCS',
            },
          ],
          narration: `Modified sales order quantity from TallyPrime. Adjusted reservation delta.`,
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_8_ORDER_CANCELLED': {
        // Cancels an existing open sales order and releases reservations
        const orderNum = customParams?.orderRef || 'SO-1024';
        tx = {
          external_id: orderNum,
          voucher_number: orderNum,
          voucher_type: 'Sales Order',
          normalized_type: 'SALES_ORDER',
          action_type: 'RESERVE_STOCK',
          party_name: 'Godrej Properties Ltd',
          date: nowStr,
          is_cancelled: true,
          items: [
            {
              product_sku: 'BF-AV-01',
              product_name: 'Angle Valve 1/2" Brass Chrome',
              quantity: 0,
            },
          ],
          narration: `Cancelled sales order in TallyPrime. Releasing all held reservations.`,
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_9_SALES_RETURN': {
        // Customer return adds back physical stock
        const crNum = `CR-RET-${randId}`;
        tx = {
          external_id: crNum,
          voucher_number: crNum,
          voucher_type: 'Sales Return',
          normalized_type: 'SALES_RETURN',
          action_type: 'INCREASE_STOCK',
          party_name: 'Godrej Properties Ltd',
          date: nowStr,
          items: [
            {
              product_sku: 'BF-AV-01',
              product_name: 'Angle Valve 1/2" Brass Chrome',
              quantity: customParams?.quantity || 5,
              rate: 340,
              amount: (customParams?.quantity || 5) * 340,
              unit: 'PCS',
            },
          ],
          narration: 'Customer returned damaged packaging item back into stock.',
          source: 'TALLY',
        };
        break;
      }

      case 'SCENARIO_10_PURCHASE_RETURN': {
        // Return to vendor reduces physical stock
        const drNum = `DR-RET-${randId}`;
        tx = {
          external_id: drNum,
          voucher_number: drNum,
          voucher_type: 'Purchase Return',
          normalized_type: 'PURCHASE_RETURN',
          action_type: 'DECREASE_STOCK',
          party_name: 'Jaquar Industrial Vendor Ltd',
          date: nowStr,
          items: [
            {
              product_sku: 'PP-CPVC-01',
              product_name: 'CPVC Pipe 1" SDR-11 (3 Meter)',
              quantity: customParams?.quantity || 4,
              rate: 420,
              amount: (customParams?.quantity || 4) * 420,
              unit: 'PCS',
            },
          ],
          narration: 'Debit note returned defective goods back to vendor.',
          source: 'TALLY',
        };
        break;
      }

      default:
        throw new Error(`Unknown scenario type: ${scenarioType}`);
    }

    return await inventorySyncService.processTransaction(tx, 'conn-tally-primary');
  }
}

export const tallySyncEngine = new TallySyncEngine();
