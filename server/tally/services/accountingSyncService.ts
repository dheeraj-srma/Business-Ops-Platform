import { db, TallyLedgerRow, TallyPartyRow, SyncHistoryLogRow } from '../../db';
import { getTallyClient } from '../client/tallyClient';
import { TallyConnectionConfig, TallyQueryOptions } from '../client/tallyProtocol';
import { TallyNormalizer } from '../mappers/tallyNormalizer';

export class AccountingSyncService {
  /**
   * Synchronize Ledgers, Customers (Sundry Debtors), Suppliers (Sundry Creditors), and Balances
   */
  public async syncAccounting(
    config: TallyConnectionConfig,
    _options?: TallyQueryOptions
  ): Promise<{
    success: boolean;
    ledgersProcessed: number;
    ledgersCreated: number;
    ledgersUpdated: number;
    customersSynced: number;
    suppliersSynced: number;
    totalReceivables: number;
    totalPayables: number;
    message: string;
  }> {
    const startTime = new Date().toISOString();
    const client = getTallyClient(config);
    const rawLedgers = await client.getLedgers(config);

    const result = await db.transaction((state) => {
      const now = new Date().toISOString();
      let ledgersCreated = 0;
      let ledgersUpdated = 0;
      let customersSynced = 0;
      let suppliersSynced = 0;
      let totalReceivables = 0;
      let totalPayables = 0;

      for (const led of rawLedgers) {
        let existingLed = state.tally_ledgers.find(
          (x) => x.name.toLowerCase() === led.name.toLowerCase() || (led.tally_guid && x.tally_guid === led.tally_guid)
        );

        const ledgerId = existingLed ? existingLed.id : `led-${Date.now()}-${Math.random().toString().slice(2, 6)}`;

        if (existingLed) {
          existingLed.parent_group = led.parent_group;
          existingLed.opening_balance = led.opening_balance;
          existingLed.closing_balance = led.closing_balance;
          existingLed.current_balance = led.current_balance || led.closing_balance;
          existingLed.balance_type = led.balance_type;
          existingLed.address = led.address || existingLed.address;
          existingLed.state = led.state || existingLed.state;
          existingLed.pincode = led.pincode || existingLed.pincode;
          existingLed.gstin = led.gstin || existingLed.gstin;
          existingLed.pan = led.pan || existingLed.pan;
          existingLed.phone = led.phone || existingLed.phone;
          existingLed.email = led.email || existingLed.email;
          existingLed.credit_period_days = led.credit_period_days || existingLed.credit_period_days;
          existingLed.last_synced_at = now;
          ledgersUpdated++;
        } else {
          const newLed: TallyLedgerRow = {
            id: ledgerId,
            tally_guid: led.tally_guid || `led-guid-${Date.now()}`,
            name: led.name,
            parent_group: led.parent_group,
            opening_balance: led.opening_balance,
            closing_balance: led.closing_balance,
            current_balance: led.current_balance || led.closing_balance,
            balance_type: led.balance_type,
            address: led.address,
            state: led.state,
            pincode: led.pincode,
            gstin: led.gstin,
            pan: led.pan,
            phone: led.phone,
            email: led.email,
            credit_period_days: led.credit_period_days,
            last_synced_at: now,
          };
          state.tally_ledgers.push(newLed);
          ledgersCreated++;
        }

        // Check if ledger is a Customer (Sundry Debtors) or Supplier (Sundry Creditors)
        const parentLower = (led.parent_group || '').toLowerCase();
        const isDebtor = parentLower.includes('debtor') || parentLower.includes('customer');
        const isCreditor = parentLower.includes('creditor') || parentLower.includes('supplier') || parentLower.includes('vendor');

        if (isDebtor || isCreditor) {
          const partyType = isDebtor ? 'CUSTOMER' : 'SUPPLIER';
          if (isDebtor) {
            customersSynced++;
            totalReceivables += led.closing_balance || 0;
          } else {
            suppliersSynced++;
            totalPayables += led.closing_balance || 0;
          }

          let existingParty = state.tally_parties.find(
            (p) => p.name.toLowerCase() === led.name.toLowerCase() || (led.tally_guid && p.tally_guid === led.tally_guid)
          );

          if (existingParty) {
            existingParty.party_type = partyType;
            existingParty.opening_balance = led.opening_balance;
            existingParty.closing_balance = led.closing_balance;
            existingParty.outstanding_amount = led.closing_balance;
            existingParty.balance_type = led.balance_type;
            existingParty.address = led.address || existingParty.address;
            existingParty.state = led.state || existingParty.state;
            existingParty.pincode = led.pincode || existingParty.pincode;
            existingParty.gstin = led.gstin || existingParty.gstin;
            existingParty.pan = led.pan || existingParty.pan;
            existingParty.phone = led.phone || existingParty.phone;
            existingParty.email = led.email || existingParty.email;
            existingParty.credit_period_days = led.credit_period_days || existingParty.credit_period_days;
            existingParty.last_synced_at = now;
          } else {
            state.tally_parties.push({
              id: `pty-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
              tally_guid: led.tally_guid || `pty-guid-${Date.now()}`,
              ledger_id: ledgerId,
              party_type: partyType,
              name: led.name,
              opening_balance: led.opening_balance,
              closing_balance: led.closing_balance,
              outstanding_amount: led.closing_balance,
              balance_type: led.balance_type,
              address: led.address,
              state: led.state,
              pincode: led.pincode,
              gstin: led.gstin,
              pan: led.pan,
              phone: led.phone,
              email: led.email,
              credit_period_days: led.credit_period_days,
              total_orders_count: 0,
              total_invoiced_value: 0,
              last_synced_at: now,
            });
          }
        }
      }

      // Log sync history
      const totalProcessed = rawLedgers.length;
      const log: SyncHistoryLogRow = {
        id: `synclog-${Date.now()}`,
        sync_type: 'ACCOUNTING',
        mode: 'FULL',
        company_name: state.settings.tally_company_name,
        started_at: startTime,
        completed_at: new Date().toISOString(),
        status: 'SUCCESS',
        records_processed: totalProcessed,
        records_created: ledgersCreated,
        records_updated: ledgersUpdated,
        records_skipped: 0,
        records_failed: 0,
        details: {
          ledgersCreated,
          ledgersUpdated,
          customersSynced,
          suppliersSynced,
          totalReceivables,
          totalPayables,
        },
      };
      state.sync_history_logs.unshift(log);

      return {
        ledgersProcessed: totalProcessed,
        ledgersCreated,
        ledgersUpdated,
        customersSynced,
        suppliersSynced,
        totalReceivables,
        totalPayables,
      };
    });

    return {
      success: true,
      ...result,
      message: `Accounting sync completed: ${result.ledgersProcessed} ledgers synchronized (${result.customersSynced} customers, ${result.suppliersSynced} suppliers).`,
    };
  }
}

export const accountingSyncService = new AccountingSyncService();
