import { db, ProductRow, CategoryRow, StockTransactionRow, TallyProductMappingRow } from '../../db';
import { TallyResponseParser } from '../parsers/tallyResponseParser';
import { syncInventoryToSupabase } from '../../orderEngine';

export interface TallyReconciliationItem {
  id: string;
  itemName: string;
  sku?: string;
  categoryName?: string;
  unit: string;
  tallyStock: number;
  nalkaStock: number;
  stockVariance: number; // tallyStock - nalkaStock
  tallyRate: number;
  nalkaRate: number;
  rateVariance: number;
  tallyValue: number;
  nalkaValue: number;
  valueVariance: number;
  status: 'IN_SYNC' | 'STOCK_DISCREPANCY' | 'PRICE_CHANGE' | 'NEW_ITEM';
  matchedProductId?: string;
  selected: boolean;
}

export interface TallyImportPreview {
  fileType: 'XML' | 'CSV' | 'JSON';
  fileName?: string;
  summary: {
    totalItems: number;
    inSyncCount: number;
    discrepancyCount: number;
    newItemsCount: number;
    priceChangeCount: number;
    totalNalkaValuation: number;
    totalTallyValuation: number;
    netValuationDiff: number;
  };
  items: TallyReconciliationItem[];
}

export interface TallyImportApplyOptions {
  updateStock: boolean;
  updatePrices: boolean;
  createNewProducts: boolean;
  referenceNote?: string;
  selectedItemIds?: string[];
}

export class TallyImportService {
  /**
   * Parses raw file content (XML, CSV, JSON) and returns reconciliation preview
   */
  public static parseAndReconcile(
    rawContent: string,
    fileTypeHint?: string,
    fileName?: string
  ): TallyImportPreview {
    if (!rawContent || !rawContent.trim()) {
      throw new Error('Import file is empty.');
    }

    const trimmed = rawContent.trim();
    let detectedType: 'XML' | 'CSV' | 'JSON' = 'CSV';

    if (fileTypeHint === 'XML' || trimmed.startsWith('<')) {
      detectedType = 'XML';
    } else if (fileTypeHint === 'JSON' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      detectedType = 'JSON';
    } else {
      detectedType = 'CSV';
    }

    let parsedRows: Array<{
      itemName: string;
      sku?: string;
      category?: string;
      unit?: string;
      stock: number;
      rate: number;
      value?: number;
    }> = [];

    if (detectedType === 'XML') {
      const stockItems = TallyResponseParser.parseStockItemsResponse(trimmed);
      parsedRows = stockItems.map((item: any) => ({
        itemName: item.name || item.tally_stock_item_name || 'Unnamed Item',
        sku: item.sku || undefined,
        category: item.parent_group || item.category || 'General',
        unit: item.unit || item.base_units || 'Pieces',
        stock: Number(item.closing_balance) || Number(item.opening_balance) || 0,
        rate: Number(item.closing_rate) || Number(item.standard_cost) || 0,
        value: Number(item.closing_value) || 0,
      }));
    } else if (detectedType === 'JSON') {
      let data: any;
      try {
        data = JSON.parse(trimmed);
      } catch (e: any) {
        throw new Error(`Invalid JSON format: ${e.message}`);
      }

      const rawItems = Array.isArray(data)
        ? data
        : data.items || data.stock_items || data.products || data.data || [];

      parsedRows = rawItems.map((row: any) => ({
        itemName: row.itemName || row['Item Name'] || row.item_name || row.name || row.Particulars || 'Unnamed Item',
        sku: row.sku || row.SKU || row.item_code || undefined,
        category: row.category || row.Category || row.group || row.Group || 'General',
        unit: row.unit || row.Unit || 'Pieces',
        stock: Number(row.stock ?? row['Closing Balance'] ?? row.current_stock ?? row.quantity ?? row.Qty ?? 0),
        rate: Number(row.rate ?? row.Rate ?? row.price ?? row.unit_cost ?? row.Price ?? 0),
        value: Number(row.value ?? row.Amount ?? row.total_value ?? 0),
      }));
    } else {
      // CSV / TSV Parsing
      parsedRows = this.parseCsvContent(trimmed);
    }

    if (parsedRows.length === 0) {
      throw new Error('No valid stock items could be extracted from the uploaded file.');
    }

    // Reconcile with current Nalka state
    const dbState = db.getState();
    const existingProducts = dbState.products;

    const exactMap = new Map<string, ProductRow>();
    const normalizedMap = new Map<string, ProductRow>();

    for (const p of existingProducts) {
      exactMap.set(p.name.trim(), p);
      normalizedMap.set(p.name.trim().toLowerCase().replace(/\s+/g, ' '), p);
    }

    let inSyncCount = 0;
    let discrepancyCount = 0;
    let newItemsCount = 0;
    let priceChangeCount = 0;
    let totalNalkaValuation = 0;
    let totalTallyValuation = 0;

    const reconciliationItems: TallyReconciliationItem[] = parsedRows.map((row, idx) => {
      const cleanName = (row.itemName || '').trim();
      const normName = cleanName.toLowerCase().replace(/\s+/g, ' ');

      const matched = exactMap.get(cleanName) || normalizedMap.get(normName);

      const tallyStock = Math.round((Number(row.stock) || 0) * 100) / 100;
      const tallyRate = Math.round((Number(row.rate) || 0) * 100) / 100;
      const tallyVal = row.value ? Number(row.value) : Math.round(tallyStock * tallyRate * 100) / 100;

      const nalkaStock = matched ? matched.current_stock : 0;
      const nalkaRate = matched ? (matched.unit_cost || 0) : 0;
      const nalkaVal = Math.round(nalkaStock * nalkaRate * 100) / 100;

      const stockVariance = Math.round((tallyStock - nalkaStock) * 100) / 100;
      const rateVariance = Math.round((tallyRate - nalkaRate) * 100) / 100;
      const valueVariance = Math.round((tallyVal - nalkaVal) * 100) / 100;

      let status: 'IN_SYNC' | 'STOCK_DISCREPANCY' | 'PRICE_CHANGE' | 'NEW_ITEM' = 'IN_SYNC';

      if (!matched) {
        status = 'NEW_ITEM';
        newItemsCount++;
      } else if (stockVariance !== 0) {
        status = 'STOCK_DISCREPANCY';
        discrepancyCount++;
      } else if (rateVariance !== 0) {
        status = 'PRICE_CHANGE';
        priceChangeCount++;
      } else {
        inSyncCount++;
      }

      totalNalkaValuation += nalkaVal;
      totalTallyValuation += tallyVal;

      return {
        id: `tally-rec-${Date.now()}-${idx}`,
        itemName: cleanName,
        sku: row.sku || matched?.sku || `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`,
        categoryName: row.category || (matched ? matched.category_id : 'General'),
        unit: row.unit || matched?.unit || 'Pieces',
        tallyStock,
        nalkaStock,
        stockVariance,
        tallyRate,
        nalkaRate,
        rateVariance,
        tallyValue: tallyVal,
        nalkaValue: nalkaVal,
        valueVariance,
        status,
        matchedProductId: matched?.id,
        selected: status !== 'IN_SYNC', // Auto-select items with differences
      };
    });

    return {
      fileType: detectedType,
      fileName,
      summary: {
        totalItems: reconciliationItems.length,
        inSyncCount,
        discrepancyCount,
        newItemsCount,
        priceChangeCount,
        totalNalkaValuation: Math.round(totalNalkaValuation * 100) / 100,
        totalTallyValuation: Math.round(totalTallyValuation * 100) / 100,
        netValuationDiff: Math.round((totalTallyValuation - totalNalkaValuation) * 100) / 100,
      },
      items: reconciliationItems,
    };
  }

  /**
   * Helper to parse CSV/TSV data with flexible column header mapping
   */
  private static parseCsvContent(csvString: string): any[] {
    const lines = csvString.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Detect delimiter (comma, tab, semicolon)
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

    const parseRow = (line: string): string[] => {
      const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`, 'g');
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(line))) {
        matches.push((match[1] || match[2] || '').trim().replace(/""/g, '"'));
      }
      return matches;
    };

    const headers = parseRow(lines[0]).map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));

    // Find column indexes
    let nameIdx = headers.findIndex((h) => h.includes('item') || h.includes('particular') || h.includes('name') || h.includes('product') || h.includes('description'));
    let stockIdx = headers.findIndex((h) => h.includes('closing') || h.includes('stock') || h.includes('qty') || h.includes('quantity') || h.includes('balance'));
    let rateIdx = headers.findIndex((h) => h.includes('rate') || h.includes('price') || h.includes('cost') || h.includes('unitprice'));
    let valueIdx = headers.findIndex((h) => h.includes('value') || h.includes('amount') || h.includes('total'));
    let categoryIdx = headers.findIndex((h) => h.includes('category') || h.includes('group') || h.includes('parent'));
    let unitIdx = headers.findIndex((h) => h.includes('unit') || h.includes('uom'));
    let skuIdx = headers.findIndex((h) => h.includes('sku') || h.includes('code') || h.includes('partno'));

    if (nameIdx === -1) nameIdx = 0;
    if (stockIdx === -1) stockIdx = 1;

    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseRow(lines[i]);
      if (!cols[nameIdx] || cols[nameIdx].trim() === '') continue;

      // Skip header repetitions or total summary lines
      const rowName = cols[nameIdx].trim();
      if (rowName.toLowerCase().startsWith('total') || rowName.toLowerCase().startsWith('grand total')) continue;

      const cleanNum = (str: string | undefined): number => {
        if (!str) return 0;
        const cleaned = str.replace(/[^0-9.-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      };

      results.push({
        itemName: rowName,
        sku: skuIdx !== -1 && cols[skuIdx] ? cols[skuIdx].trim() : undefined,
        category: categoryIdx !== -1 && cols[categoryIdx] ? cols[categoryIdx].trim() : 'General',
        unit: unitIdx !== -1 && cols[unitIdx] ? cols[unitIdx].trim() : 'Pieces',
        stock: cleanNum(cols[stockIdx]),
        rate: rateIdx !== -1 ? cleanNum(cols[rateIdx]) : 0,
        value: valueIdx !== -1 ? cleanNum(cols[valueIdx]) : 0,
      });
    }

    return results;
  }

  /**
   * Applies the reconciled items to the local database, updates stock, creates audit records, and syncs Supabase
   */
  public static async applyImport(
    items: TallyReconciliationItem[],
    options: TallyImportApplyOptions,
    activeUser: { id: string; name: string }
  ): Promise<{
    success: boolean;
    updatedCount: number;
    createdCount: number;
    discrepanciesResolved: number;
  }> {
    if (!items || items.length === 0) {
      throw new Error('No items selected for import.');
    }

    const selectedItems = options.selectedItemIds
      ? items.filter((item) => options.selectedItemIds!.includes(item.id))
      : items;

    if (selectedItems.length === 0) {
      throw new Error('No items were selected to apply.');
    }

    let updatedCount = 0;
    let createdCount = 0;
    let discrepanciesResolved = 0;
    const affectedProducts: ProductRow[] = [];

    await db.transaction((dbState) => {
      const nowIso = new Date().toISOString();

      for (const item of selectedItems) {
        if (item.matchedProductId) {
          // Update Existing Product
          const prod = dbState.products.find((p) => p.id === item.matchedProductId);
          if (!prod) continue;

          let hasChanges = false;

          // 1. Update Physical Stock Discrepancy
          if (options.updateStock && item.stockVariance !== 0) {
            const prevStock = prod.current_stock;
            const newStock = item.tallyStock;
            const variance = item.stockVariance;

            prod.current_stock = newStock;
            prod.updated_at = nowIso;
            hasChanges = true;
            discrepanciesResolved++;

            // Create Stock Transaction Audit Log
            const txId = `tx-tally-rec-${Date.now()}-${updatedCount}`;
            const tx: StockTransactionRow = {
              id: txId,
              product_id: prod.id,
              transaction_type: variance > 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
              quantity: Math.abs(variance),
              previous_stock: prevStock,
              new_stock: newStock,
              reason: `Tally Reconciliation (${options.referenceNote || 'Accountant Coordination'})`,
              supplier_or_recipient: 'TallyPrime Ledger Sync',
              reference_number: `TLY-REC-${Date.now().toString().slice(-6)}`,
              notes: `System was ${prevStock}, Tally closing balance was ${newStock} (Variance: ${variance > 0 ? '+' : ''}${variance})`,
              source: 'TALLY',
              created_by_id: activeUser.id,
              created_by_name: activeUser.name,
              created_at: nowIso,
            };
            dbState.stock_transactions.unshift(tx);
          }

          // 2. Update Rate / Price
          if (options.updatePrices && item.tallyRate > 0 && item.tallyRate !== prod.unit_cost) {
            prod.unit_cost = item.tallyRate;
            prod.updated_at = nowIso;
            hasChanges = true;
          }

          if (hasChanges) {
            updatedCount++;
            affectedProducts.push(prod);
          }
        } else if (options.createNewProducts) {
          // Create New Catalog Product
          let cat = dbState.categories.find(
            (c) => c.name.toLowerCase() === (item.categoryName || 'General').toLowerCase()
          );

          if (!cat) {
            const catId = `cat-${Date.now()}-${createdCount}`;
            cat = {
              id: catId,
              name: item.categoryName || 'General',
              description: 'Imported from Tally Stock Group',
              is_active: true,
              created_at: nowIso,
              updated_at: nowIso,
            };
            dbState.categories.push(cat);
          }

          const newProdId = `prod-${Date.now()}-${createdCount}`;
          const newSku = item.sku || `SKU-${Date.now().toString().slice(-4)}-${createdCount + 1}`;
          const initialStock = options.updateStock ? item.tallyStock : 0;
          const unitRate = options.updatePrices ? item.tallyRate : 0;

          const newProd: ProductRow = {
            id: newProdId,
            sku: newSku,
            name: item.itemName,
            category_id: cat.id,
            description: `Imported from Tally (${item.categoryName || 'General'})`,
            unit: item.unit || 'Pieces',
            current_stock: initialStock,
            reserved_stock: 0,
            minimum_stock: 10,
            critical_stock: 5,
            unit_cost: unitRate,
            is_active: true,
            created_at: nowIso,
            updated_at: nowIso,
          };

          dbState.products.push(newProd);
          affectedProducts.push(newProd);
          createdCount++;

          if (initialStock > 0) {
            const tx: StockTransactionRow = {
              id: `tx-init-${Date.now()}-${createdCount}`,
              product_id: newProdId,
              transaction_type: 'INITIAL_STOCK',
              quantity: initialStock,
              previous_stock: 0,
              new_stock: initialStock,
              reason: 'Initial Tally Catalog Import',
              supplier_or_recipient: 'Tally Master Import',
              reference_number: `TLY-INIT-${Date.now().toString().slice(-6)}`,
              notes: 'Created from Tally accountant import',
              source: 'TALLY',
              created_by_id: activeUser.id,
              created_by_name: activeUser.name,
              created_at: nowIso,
            };
            dbState.stock_transactions.unshift(tx);
          }
        }
      }

      return true;
    });

    // Sync updated stock to Supabase
    if (affectedProducts.length > 0) {
      syncInventoryToSupabase(affectedProducts).catch((err) => {
        console.warn('[Tally Import] Failed to sync updated inventory to Supabase:', err);
      });
    }

    return {
      success: true,
      updatedCount,
      createdCount,
      discrepanciesResolved,
    };
  }
}
