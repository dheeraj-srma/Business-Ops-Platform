import { db, ProductRow, ExportRow, ExportItemRow } from '../db';
import { validateInventoryForTally, ValidationReport } from './tallyValidator';
import { mapToTallyStockItem, TallyStockItemModel } from './tallyMapper';
import { generateTallyXml } from './tallyXmlGenerator';
import { generateTallyJson } from './tallyJsonGenerator';

export interface ExportRequest {
  exportType: 'FULL' | 'INCREMENTAL' | 'CUSTOM_RANGE';
  exportFormat: 'JSON' | 'XML';
  dateFrom?: string;
  dateTo?: string;
  exportedBy: string;
}

export interface ExportResult {
  exportRecord: ExportRow;
  fileContent: string;
  validationReport: ValidationReport;
}

export class TallyExportService {
  public static validateCurrentInventory(
    exportType: 'FULL' | 'INCREMENTAL' | 'CUSTOM_RANGE' = 'FULL',
    dateFrom?: string,
    dateTo?: string
  ): { targetProducts: ProductRow[]; validationReport: ValidationReport } {
    const state = db.getState();
    let targetProducts = state.products.filter((p) => p.is_active);

    if (exportType === 'INCREMENTAL') {
      const checkpoint = state.settings.last_export_checkpoint;
      if (checkpoint) {
        const cpDate = new Date(checkpoint).getTime();
        targetProducts = targetProducts.filter((p) => {
          const prodUpdated = new Date(p.updated_at).getTime();
          return prodUpdated > cpDate;
        });
      }
    } else if (exportType === 'CUSTOM_RANGE') {
      if (dateFrom) {
        const fromTime = new Date(dateFrom).getTime();
        targetProducts = targetProducts.filter((p) => new Date(p.updated_at).getTime() >= fromTime);
      }
      if (dateTo) {
        const toTime = new Date(dateTo).getTime() + 86400000; // inclusive of end of day
        targetProducts = targetProducts.filter((p) => new Date(p.updated_at).getTime() <= toTime);
      }
    }

    const report = validateInventoryForTally(targetProducts, state.categories);
    return { targetProducts, validationReport: report };
  }

  public static async executeExport(req: ExportRequest): Promise<ExportResult> {
    return await db.transaction((state) => {
      const { targetProducts, validationReport } = this.validateCurrentInventory(
        req.exportType,
        req.dateFrom,
        req.dateTo
      );

      if (!validationReport.canProceed) {
        throw new Error(
          `Cannot generate Tally export: ${validationReport.errorCount} blocking validation errors detected.`
        );
      }

      if (targetProducts.length === 0) {
        throw new Error(
          req.exportType === 'INCREMENTAL'
            ? 'No inventory items have been modified since the last export checkpoint.'
            : 'No active products available to export matching the criteria.'
        );
      }

      const tallyItems: TallyStockItemModel[] = targetProducts.map((p) =>
        mapToTallyStockItem(p, state.categories, state.settings.tally_xml_guid_prefix)
      );

      const now = new Date();
      const timestampStr = now.toISOString().slice(0, 10);
      const ext = req.exportFormat === 'XML' ? 'xml' : 'json';
      const fileName = `Tally_Inventory_${req.exportType}_${timestampStr}_${Date.now().toString().slice(-4)}.${ext}`;

      let fileContent = '';
      if (req.exportFormat === 'XML') {
        fileContent = generateTallyXml(tallyItems, state.settings.tally_company_name);
      } else {
        fileContent = generateTallyJson(tallyItems, state.settings.tally_company_name);
      }

      const exportId = `EXP-${Date.now().toString().slice(-6)}`;
      const exportRecord: ExportRow = {
        id: exportId,
        export_type: req.exportType,
        export_format: req.exportFormat,
        product_count: targetProducts.length,
        date_from: req.dateFrom,
        date_to: req.dateTo,
        file_name: fileName,
        file_content: fileContent,
        status: 'COMPLETED',
        exported_by: req.exportedBy || 'Rajesh Sharma',
        created_at: now.toISOString(),
      };

      state.exports.unshift(exportRecord);

      // Create export items audit log
      for (const prod of targetProducts) {
        const itemRow: ExportItemRow = {
          id: `expitem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          export_id: exportId,
          product_id: prod.id,
          product_sku: prod.sku,
          product_name: prod.name,
          stock_quantity: prod.current_stock,
          product_updated_at: prod.updated_at,
        };
        state.export_items.push(itemRow);
      }

      // Update checkpoint if full or incremental export succeeded
      state.settings.last_export_checkpoint = now.toISOString();

      return {
        exportRecord,
        fileContent,
        validationReport,
      };
    });
  }
}
