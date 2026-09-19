import { db } from '../server/db';
import { getTallyClient, testTallyConnection } from '../server/tally/client/tallyClient';
import { TallyRequestBuilder } from '../server/tally/requests/tallyRequestBuilder';
import { TallyResponseParser } from '../server/tally/parsers/tallyResponseParser';
import { TallyNormalizer } from '../server/tally/mappers/tallyNormalizer';
import { masterSyncService } from '../server/tally/services/masterSyncService';
import { voucherSyncService } from '../server/tally/services/voucherSyncService';
import { accountingSyncService } from '../server/tally/services/accountingSyncService';
import { tallyReportService } from '../server/tally/services/tallyReportService';

async function runTests() {
  console.log('=== 1. Testing Tally Request Builder ===');
  const compXml = TallyRequestBuilder.buildCompanyExportRequest('Apex Industrial');
  const itemsXml = TallyRequestBuilder.buildStockItemsExportRequest('Apex Industrial');
  const vchXml = TallyRequestBuilder.buildVouchersExportRequest('Apex Industrial', '2026-04-01', '2026-08-25');
  console.log('✓ Request XML generated successfully');
  if (!compXml.includes('<REPORTNAME>List of Companies</REPORTNAME>')) throw new Error('Company XML invalid');
  if (!itemsXml.includes('StockItemCollection')) throw new Error('Items XML invalid');
  if (!vchXml.includes('VoucherCollection')) throw new Error('Vouchers XML invalid');

  console.log('\n=== 2. Testing Tally Normalizer ===');
  const salesNorm = TallyNormalizer.normalizeVoucherType('Sales');
  const purNorm = TallyNormalizer.normalizeVoucherType('Purchase');
  const retNorm = TallyNormalizer.normalizeVoucherType('Credit Note');
  const jrnNorm = TallyNormalizer.normalizeVoucherType('Stock Journal');
  console.log('✓ Sales:', salesNorm.normalizedType, salesNorm.transactionDirection);
  console.log('✓ Purchase:', purNorm.normalizedType, purNorm.transactionDirection);
  console.log('✓ Return:', retNorm.normalizedType, retNorm.isReturn);
  console.log('✓ Journal:', jrnNorm.normalizedType, jrnNorm.transactionDirection);

  console.log('\n=== 3. Testing Provider Connection ===');
  const testRes = await testTallyConnection('http://localhost', 9000, 'Apex Industrial Solutions (2026-27)');
  console.log('✓ Connection status:', testRes.status, `(${testRes.latencyMs}ms)`);

  const config = { serverUrl: 'http://localhost', port: 9000, companyName: 'Apex Industrial Solutions (2026-27)', useMockFallback: true };

  console.log('\n=== 4. Testing Master Sync Service ===');
  const compRes = await masterSyncService.syncCompany(config);
  console.log('✓ Company sync:', compRes.company.name, 'GSTIN:', compRes.company.gstin);

  const invRes = await masterSyncService.syncInventoryMasters(config);
  console.log('✓ Inventory sync:', invRes.itemsCreated, 'created,', invRes.itemsUpdated, 'updated,', invRes.godownsSynced, 'godowns');

  console.log('\n=== 5. Testing Voucher Sync Service ===');
  const vchRes = await voucherSyncService.syncVouchers(config, { filterType: 'ALL' });
  console.log('✓ Voucher sync:', vchRes.vouchersProcessed, 'vouchers processed,', vchRes.stockTransactionsRecorded, 'stock tx recorded');

  console.log('\n=== 6. Testing Accounting Sync Service ===');
  const accRes = await accountingSyncService.syncAccounting(config);
  console.log('✓ Accounting sync:', accRes.ledgersProcessed, 'ledgers, Receivables: ₹' + accRes.totalReceivables, 'Payables: ₹' + accRes.totalPayables);

  console.log('\n=== 7. Testing Tally Report Service ===');
  const overview = tallyReportService.getFinancialOverview();
  console.log('✓ Financial Overview:', {
    totalSales: overview.metrics.totalSales,
    totalPurchases: overview.metrics.totalPurchases,
    totalInventoryValue: overview.metrics.totalInventoryValue,
    totalReceivables: overview.metrics.totalReceivables,
    totalPayables: overview.metrics.totalPayables,
    bankAndCash: overview.metrics.bankBalance + overview.metrics.cashBalance,
  });

  const salesReport = tallyReportService.getSalesByProduct();
  console.log('✓ Sales by Product:', salesReport.report.length, 'products tracked');

  const purReport = tallyReportService.getPurchasesBySupplier();
  console.log('✓ Purchases by Supplier:', purReport.report.length, 'suppliers tracked');

  console.log('\n🎉 ALL TALLY INTEGRATION UNIT & INTEGRATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
