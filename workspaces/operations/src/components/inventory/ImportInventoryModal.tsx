import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  FileCode,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  PackagePlus,
  RefreshCw,
} from 'lucide-react';
import { Product, Category } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';

export interface ParsedInventoryItem {
  sku: string;
  name?: string;
  category?: string;
  currentStock?: number;
  unitCost?: number;
  minimumStock?: number;
  criticalStock?: number;
  unit?: string;
  description?: string;
  isExisting: boolean;
}

interface ImportInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  onImportSuccess: () => void;
}

export const ImportInventoryModal: React.FC<ImportInventoryModalProps> = ({
  isOpen,
  onClose,
  products,
  categories,
  onImportSuccess,
}) => {
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileFormat, setFileFormat] = useState<'JSON' | 'CSV' | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Import options
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [createNewItems, setCreateNewItems] = useState<boolean>(true);

  if (!isOpen) return null;

  const existingSkuMap = new Map<string, Product>();
  products.forEach((p) => {
    if (p.sku) existingSkuMap.set(p.sku.toUpperCase().trim(), p);
  });

  const categoryNameMap = new Map<string, string>();
  categories.forEach((c) => {
    categoryNameMap.set(c.name.toLowerCase().trim(), c.id);
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg(null);
    setParsedItems([]);

    const isJson = selectedFile.name.toLowerCase().endsWith('.json');
    const isCsv = selectedFile.name.toLowerCase().endsWith('.csv') || selectedFile.name.toLowerCase().endsWith('.txt');

    setFileFormat(isJson ? 'JSON' : 'CSV');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || '';

        if (isJson || text.trim().startsWith('{') || text.trim().startsWith('[')) {
          parseJsonContent(text);
        } else if (isCsv) {
          parseCsvContent(text);
        } else {
          // Fallback: try JSON then CSV
          try {
            parseJsonContent(text);
          } catch {
            parseCsvContent(text);
          }
        }
      } catch (err: any) {
        setErrorMsg('Failed to read file: ' + err.message);
      }
    };
    reader.readAsText(selectedFile);
  };

  const parseJsonContent = (text: string) => {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e: any) {
      setErrorMsg('Invalid JSON format: ' + e.message);
      return;
    }

    const rawList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed.products)
      ? parsed.products
      : [parsed];

    if (!rawList || rawList.length === 0) {
      setErrorMsg('No items found in JSON data exchange file.');
      return;
    }

    const items: ParsedInventoryItem[] = [];
    for (const it of rawList) {
      const sku = (it.sku || it.SKU || it.code || it.Code || it.product_code || it.id || '').toString().trim();
      if (!sku) continue;

      const isExisting = existingSkuMap.has(sku.toUpperCase());
      const stock = it.currentStock ?? it.current_stock ?? it.stock ?? it.quantity ?? it.Quantity;
      const cost = it.unitCost ?? it.unit_cost ?? it.price ?? it.Price ?? it.cost ?? it.rate;
      const min = it.minimumStock ?? it.minimum_stock ?? it.minStock ?? it.min;
      const crit = it.criticalStock ?? it.critical_stock ?? it.critStock ?? it.crit;
      const unit = it.unit ?? it.Unit ?? it.uom ?? 'Pieces';
      const name = it.name ?? it.Name ?? it.productName ?? it.itemName;
      const category = it.category ?? it.Category ?? it.categoryName;
      const description = it.description ?? it.Description;

      items.push({
        sku,
        name: name ? String(name).trim() : undefined,
        category: category ? String(category).trim() : undefined,
        currentStock: stock !== undefined && stock !== '' && !isNaN(Number(stock)) ? Number(stock) : undefined,
        unitCost: cost !== undefined && cost !== '' && !isNaN(Number(cost)) ? Number(cost) : undefined,
        minimumStock: min !== undefined && min !== '' && !isNaN(Number(min)) ? Number(min) : undefined,
        criticalStock: crit !== undefined && crit !== '' && !isNaN(Number(crit)) ? Number(crit) : undefined,
        unit: unit ? String(unit).trim() : 'Pieces',
        description: description ? String(description).trim() : undefined,
        isExisting,
      });
    }

    if (items.length === 0) {
      setErrorMsg('No valid items with a "sku" property found in the JSON file.');
      return;
    }

    setParsedItems(items);
  };

  const parseCsvContent = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setErrorMsg('The CSV file does not contain enough data rows.');
      return;
    }

    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    const skuIdx = headers.findIndex((h) => h === 'sku' || h === 'code' || h === 'product code' || h === 'item code');
    const nameIdx = headers.findIndex((h) => h === 'product name' || h === 'name' || h === 'item name');
    const catIdx = headers.findIndex((h) => h === 'category' || h === 'group');
    const costIdx = headers.findIndex((h) => h.includes('cost') || h.includes('price') || h.includes('rate'));
    const stockIdx = headers.findIndex((h) => h === 'current stock' || h === 'stock' || h === 'quantity' || h === 'qty');
    const minIdx = headers.findIndex((h) => h.includes('min') || h.includes('safety'));
    const critIdx = headers.findIndex((h) => h.includes('crit') || h.includes('urgent'));
    const unitIdx = headers.findIndex((h) => h === 'unit' || h === 'uom');

    if (skuIdx === -1) {
      setErrorMsg('Could not find a "SKU" or "Code" column in the uploaded CSV.');
      return;
    }

    const items: ParsedInventoryItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      const cols: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let c = 0; c < row.length; c++) {
        const char = row[c];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim().replace(/^["']|["']$/g, ''));

      const sku = cols[skuIdx]?.trim();
      if (!sku) continue;

      const isExisting = existingSkuMap.has(sku.toUpperCase());
      const name = nameIdx !== -1 ? cols[nameIdx] : undefined;
      const category = catIdx !== -1 ? cols[catIdx] : undefined;
      const costStr = costIdx !== -1 ? cols[costIdx] : undefined;
      const stockStr = stockIdx !== -1 ? cols[stockIdx] : undefined;
      const minStr = minIdx !== -1 ? cols[minIdx] : undefined;
      const critStr = critIdx !== -1 ? cols[critIdx] : undefined;
      const unit = unitIdx !== -1 ? cols[unitIdx] : 'Pieces';

      items.push({
        sku,
        name: name ? name.trim() : undefined,
        category: category ? category.trim() : undefined,
        currentStock: stockStr && !isNaN(Number(stockStr)) ? Number(stockStr) : undefined,
        unitCost: costStr && !isNaN(Number(costStr)) ? Number(costStr) : undefined,
        minimumStock: minStr && !isNaN(Number(minStr)) ? Number(minStr) : undefined,
        criticalStock: critStr && !isNaN(Number(critStr)) ? Number(critStr) : undefined,
        unit: unit ? unit.trim() : 'Pieces',
        isExisting,
      });
    }

    if (items.length === 0) {
      setErrorMsg('No valid rows with a SKU were parsed from CSV.');
      return;
    }

    setParsedItems(items);
  };

  const handleExecuteImport = async () => {
    if (parsedItems.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const itemsToUpdate = parsedItems.filter((it) => it.isExisting && updateExisting);
      const itemsToCreate = parsedItems.filter((it) => !it.isExisting && createNewItems);

      let updatedCount = 0;
      let createdCount = 0;

      // 1. Bulk update existing items
      if (itemsToUpdate.length > 0) {
        const payload = itemsToUpdate.map((it) => ({
          sku: it.sku,
          name: it.name,
          unitCost: it.unitCost,
          minimumStock: it.minimumStock,
          criticalStock: it.criticalStock,
          unit: it.unit,
        }));
        const res = await api.importCatalogCsv(payload);
        updatedCount = res.updatedCount || itemsToUpdate.length;
      }

      // 2. Create new items if enabled
      if (itemsToCreate.length > 0) {
        const defaultCatId = categories[0]?.id || 'cat-general';
        for (const it of itemsToCreate) {
          try {
            const matchedCatId = it.category
              ? categoryNameMap.get(it.category.toLowerCase().trim()) || defaultCatId
              : defaultCatId;

            await api.createProduct({
              sku: it.sku,
              name: it.name || it.sku,
              categoryId: matchedCatId,
              description: it.description || 'Imported via Data Exchange',
              unit: it.unit || 'Pieces',
              initialStock: it.currentStock ?? 0,
              minimumStock: it.minimumStock ?? 15,
              criticalStock: it.criticalStock ?? 5,
              unitCost: it.unitCost ?? 0,
            });
            createdCount++;
          } catch {
            // continue with remaining items
          }
        }
      }

      dialog.showSuccess({
        title: 'Inventory Data Exchange Completed',
        message: `Successfully processed ${parsedItems.length} items (${updatedCount} updated, ${createdCount} newly created).`,
      });

      onImportSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply inventory import.');
    } finally {
      setIsProcessing(false);
    }
  };

  const newItemsCount = parsedItems.filter((i) => !i.isExisting).length;
  const existingItemsCount = parsedItems.filter((i) => i.isExisting).length;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-200">
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        title="Click background to close"
      />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 z-10 transition-colors max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                Import Inventory Catalog (JSON / CSV Data Exchange)
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Batch import stock quantities, safety thresholds, catalog pricing, and new SKUs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Upload Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:border-indigo-400 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 text-center cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileCode className="w-6 h-6 text-amber-500" />
              <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {file ? file.name : 'Click to select or drag & drop JSON / CSV inventory file'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Accepts JSON Data Exchange (<code className="text-indigo-600 dark:text-indigo-400 font-mono">.json</code>) or CSV (<code className="text-indigo-600 dark:text-indigo-400 font-mono">.csv</code>)
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Import Settings Checkboxes */}
          {parsedItems.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Import Scope Options
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Update existing items ({existingItemsCount})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createNewItems}
                    onChange={(e) => setCreateNewItems(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Create new products ({newItemsCount})</span>
                </label>
              </div>
            </div>
          )}

          {/* Parsed Items Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  Parsed <strong>{parsedItems.length}</strong> items from {fileFormat || 'file'}:
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Ready to apply
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3 text-right">Unit Cost</th>
                      <th className="py-2 px-3 text-right">Stock</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
                    {parsedItems.slice(0, 30).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                        <td className="py-1.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.sku}</td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 font-sans truncate max-w-[160px]">
                          {item.name || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                          {item.unitCost !== undefined ? formatCurrency(item.unitCost) : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-700 dark:text-slate-300">
                          {item.currentStock !== undefined ? item.currentStock : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          {item.isExisting ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                              Update
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedItems.length > 30 && (
                <p className="text-[10px] text-slate-400 text-center">
                  Showing first 30 of {parsedItems.length} rows
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {parsedItems.length > 0 ? `${parsedItems.length} items ready` : 'No file selected'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="btn-confirm-import-inventory"
              onClick={handleExecuteImport}
              disabled={parsedItems.length === 0 || isProcessing}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Apply Import ({parsedItems.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
