import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  FileCode,
  Code,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Product, Category } from '../../types';
import { formatDate, formatCurrency, cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';
import Papa from 'papaparse';

interface DataExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredProducts: Product[];
  allProducts: Product[];
  categories: Category[];
  initialTab?: 'import' | 'export';
  onSuccess?: () => void;
  onNavigateToFullHub?: () => void;
}

export const DataExchangeModal: React.FC<DataExchangeModalProps> = ({
  isOpen,
  onClose,
  filteredProducts,
  allProducts,
  categories,
  initialTab = 'import',
  onSuccess,
  onNavigateToFullHub,
}) => {
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialTab);

  // EXPORT STATE
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  const [exportFormat, setExportFormat] = useState<'json' | 'excel' | 'csv' | 'xml'>('json');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // IMPORT STATE
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Category map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      if (c.id) map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  // Existing SKUs
  const existingSkuMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of allProducts) {
      if (p.sku) map.set(p.sku.toLowerCase().trim(), p);
    }
    return map;
  }, [allProducts]);

  const targetProducts = exportScope === 'filtered' ? filteredProducts : allProducts;

  if (!isOpen) return null;

  // ----------------------------------------------------
  // EXPORT HANDLER
  // ----------------------------------------------------
  const handleExecuteExport = () => {
    try {
      setIsExporting(true);
      const dateStr = new Date().toISOString().slice(0, 10);

      if (exportFormat === 'json') {
        const payload = {
          schemaVersion: '1.0',
          exportDate: new Date().toISOString(),
          source: 'Business Ops Stock Management',
          scope: exportScope,
          totalRecords: targetProducts.length,
          columns: ['sku', 'name', 'category', 'currentStock', 'unitCost', 'valuation', 'minimumStock', 'criticalStock', 'unit'],
          items: targetProducts.map((p) => ({
            id: p.id,
            sku: p.sku || '',
            name: p.name || '',
            category: categoryMap.get(p.categoryId || (p as any).category_id) || (p as any).category_name || '',
            currentStock: p.currentStock ?? (p as any).current_stock ?? 0,
            unitCost: p.unitCost ?? (p as any).unit_cost ?? 0,
            valuation: (p.currentStock ?? (p as any).current_stock ?? 0) * (p.unitCost ?? (p as any).unit_cost ?? 0),
            minimumStock: p.minimumStock ?? (p as any).minimum_stock ?? 0,
            criticalStock: p.criticalStock ?? (p as any).critical_stock ?? 0,
            unit: p.unit || 'pcs',
          })),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Inventory_Master_Export_${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportFormat === 'excel') {
        const xmlRows = targetProducts
          .map((p) => {
            const catName = categoryMap.get(p.categoryId || (p as any).category_id) || (p as any).category_name || '';
            const stock = p.currentStock ?? (p as any).current_stock ?? 0;
            const cost = p.unitCost ?? (p as any).unit_cost ?? 0;
            const val = stock * cost;
            const min = p.minimumStock ?? (p as any).minimum_stock ?? 0;
            return `<Row>
              <Cell><Data ss:Type="String">${(p.sku || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>
              <Cell><Data ss:Type="String">${(p.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>
              <Cell><Data ss:Type="String">${catName.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>
              <Cell><Data ss:Type="Number">${stock}</Data></Cell>
              <Cell><Data ss:Type="Number">${cost}</Data></Cell>
              <Cell><Data ss:Type="Number">${val}</Data></Cell>
              <Cell><Data ss:Type="Number">${min}</Data></Cell>
            </Row>`;
          })
          .join('\n');

        const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E293B" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="Inventory Catalog">
  <Table>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">SKU</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Item Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Current Stock</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Unit Cost (INR)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Valuation (INR)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Min Level</Data></Cell>
   </Row>
   ${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`;
        const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Inventory_Master_Export_${dateStr}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportFormat === 'csv') {
        const rows = [
          ['SKU', 'Item Name', 'Category', 'Current Stock', 'Unit Cost', 'Valuation', 'Min Level'],
          ...targetProducts.map((p) => [
            p.sku || '',
            p.name || '',
            categoryMap.get(p.categoryId || (p as any).category_id) || (p as any).category_name || '',
            String(p.currentStock ?? (p as any).current_stock ?? 0),
            String(p.unitCost ?? (p as any).unit_cost ?? 0),
            String((p.currentStock ?? 0) * (p.unitCost ?? 0)),
            String(p.minimumStock ?? 0),
          ]),
        ];
        const csvStr = Papa.unparse(rows);
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Inventory_Master_Export_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportFormat === 'xml') {
        // Tally XML envelope
        const xmlBody = targetProducts
          .map((p) => {
            const stock = p.currentStock ?? (p as any).current_stock ?? 0;
            const cost = p.unitCost ?? (p as any).unit_cost ?? 0;
            return `        <STOCKITEM NAME="${(p.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">
          <PARENT>${(categoryMap.get(p.categoryId || '') || 'Primary').replace(/&/g, '&amp;')}</PARENT>
          <BASEUNITS>${p.unit || 'Pieces'}</BASEUNITS>
          <CLOSINGBALANCE>${stock} ${p.unit || 'Pieces'}</CLOSINGBALANCE>
          <CLOSINGRATE>${cost}/${p.unit || 'Pieces'}</CLOSINGRATE>
          <CLOSINGVALUE>${stock * cost}</CLOSINGVALUE>
        </STOCKITEM>`;
          })
          .join('\n');

        const tallyXml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
${xmlBody}
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`;
        const blob = new Blob([tallyXml], { type: 'application/xml;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Tally_Inventory_Export_${dateStr}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      dialog.showSuccess({
        title: 'Export Generated',
        message: `Successfully generated and downloaded ${targetProducts.length} items as ${exportFormat.toUpperCase()}.`,
      });
    } catch (err: any) {
      dialog.showError({
        title: 'Export Failed',
        message: err.message || 'Failed to generate export file.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ----------------------------------------------------
  // IMPORT FILE PARSER
  // ----------------------------------------------------
  const handleProcessFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);
    setIsParsing(true);

    const isJson = file.name.endsWith('.json') || file.type.includes('json');
    const isXml = file.name.endsWith('.xml') || file.type.includes('xml');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';

        if (isJson) {
          const parsed = JSON.parse(text);
          let rawItems: any[] = [];
          if (Array.isArray(parsed)) {
            rawItems = parsed;
          } else if (parsed && Array.isArray(parsed.items)) {
            rawItems = parsed.items;
          } else if (parsed && Array.isArray(parsed.products)) {
            rawItems = parsed.products;
          } else {
            throw new Error('JSON file must contain an array or an object with an "items" array.');
          }

          const items = rawItems.map((it: any) => {
            const sku = String(it.sku || it.SKU || it.item_sku || it.code || '').trim();
            const name = String(it.name || it.productName || it.product_name || it.item || '').trim();
            const unitCost = Number(it.unitCost ?? it.unit_cost ?? it.cost ?? it.price ?? 0);
            const currentStock = Number(it.currentStock ?? it.current_stock ?? it.stock ?? it.quantity ?? 0);
            const minimumStock = Number(it.minimumStock ?? it.minimum_stock ?? it.min_stock ?? 0);
            const criticalStock = Number(it.criticalStock ?? it.critical_stock ?? 0);
            const unit = String(it.unit || 'pcs');

            const existing = sku ? existingSkuMap.get(sku.toLowerCase()) : undefined;

            return {
              sku,
              name: name || (existing ? existing.name : 'Unknown Item'),
              unitCost,
              currentStock,
              minimumStock,
              criticalStock,
              unit,
              isNew: !existing,
              existingProduct: existing,
            };
          });

          setParsedItems(items);
        } else if (isXml) {
          // Parse basic Tally XML Stock Items
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          const stockItemNodes = Array.from(xmlDoc.querySelectorAll('STOCKITEM'));

          if (stockItemNodes.length === 0) {
            throw new Error('No <STOCKITEM> nodes found in XML file.');
          }

          const items = stockItemNodes.map((node) => {
            const name = node.getAttribute('NAME') || node.querySelector('NAME')?.textContent || 'Unnamed Item';
            const sku = node.querySelector('SKU')?.textContent || name.slice(0, 16).replace(/\s+/g, '-').toUpperCase();
            const rateStr = node.querySelector('CLOSINGRATE')?.textContent || '0';
            const balStr = node.querySelector('CLOSINGBALANCE')?.textContent || '0';

            const unitCost = parseFloat(rateStr.replace(/[^0-9.-]/g, '')) || 0;
            const currentStock = parseFloat(balStr.replace(/[^0-9.-]/g, '')) || 0;

            const existing = sku ? existingSkuMap.get(sku.toLowerCase()) : undefined;

            return {
              sku,
              name: (existing ? existing.name : name) || 'Unknown Item',
              unitCost,
              currentStock,
              minimumStock: existing?.minimumStock || 10,
              criticalStock: existing?.criticalStock || 5,
              unit: 'pcs',
              isNew: !existing,
              existingProduct: existing,
            };
          });

          setParsedItems(items);
        } else {
          // Parse CSV
          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              try {
                const items = results.data.map((row: any) => {
                  const sku = String(row.sku || row.SKU || row['Item Code'] || '').trim();
                  const name = String(row.name || row.Name || row['Item Name'] || row.product_name || '').trim();
                  const unitCost = Number(row.unitCost || row.unit_cost || row.cost || row.rate || 0);
                  const currentStock = Number(row.currentStock || row.current_stock || row.stock || row.quantity || 0);
                  const minimumStock = Number(row.minimumStock || row.minimum_stock || row.min_stock || 0);
                  const criticalStock = Number(row.criticalStock || row.critical_stock || 0);
                  const unit = String(row.unit || 'pcs');

                  const existing = sku ? existingSkuMap.get(sku.toLowerCase()) : undefined;

                  return {
                    sku,
                    name: name || (existing ? existing.name : 'Unknown Item'),
                    unitCost,
                    currentStock,
                    minimumStock,
                    criticalStock,
                    unit,
                    isNew: !existing,
                    existingProduct: existing,
                  };
                });
                setParsedItems(items);
              } catch (err: any) {
                setErrorMsg('Failed to process CSV records: ' + err.message);
              }
            },
            error: (err: any) => {
              setErrorMsg('Failed to parse CSV file: ' + err.message);
            },
          });
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to read file.');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyImport = async () => {
    if (parsedItems.length === 0) return;
    setIsSubmitting(true);
    try {
      const itemsToUpdate = parsedItems.map((it) => ({
        sku: it.sku,
        unitCost: it.unitCost,
        minimumStock: it.minimumStock,
        criticalStock: it.criticalStock,
        unit: it.unit,
        name: it.name,
      }));

      await api.importCatalogCsv(itemsToUpdate);

      dialog.showSuccess({
        title: 'Data Exchange Import Successful',
        message: `Processed ${parsedItems.length} catalog record(s) into the system.`,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      dialog.showError({
        title: 'Import Failed',
        message: err.message || 'Failed to apply data exchange import.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Catalog Data Exchange
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  JSON • XML • XLS • CSV
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unified data exchange engine for importing and exporting master catalog records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Toggle */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'import'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                Import Data
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'export'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                Export Data
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'import' ? (
            /* ==================================================== */
            /* IMPORT SECTION                                       */
            /* ==================================================== */
            <div className="space-y-4">
              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleProcessFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-900/50'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.xml,.csv,application/json,text/csv,application/xml,text/xml"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-full text-indigo-600 dark:text-indigo-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Drag & Drop Data Exchange File or Click to Browse
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Supports JSON (<code className="text-indigo-600 font-mono">.json</code>), Tally XML (<code className="text-indigo-600 font-mono">.xml</code>), or CSV (<code className="text-indigo-600 font-mono">.csv</code>)
                    </p>
                  </div>
                  {fileName && (
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 mt-1">
                      Loaded: {fileName}
                    </span>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Preview Table */}
              {parsedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Preview: {parsedItems.length} Records Found
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {parsedItems.filter((i) => i.isNew).length} new SKUs, {parsedItems.filter((i) => !i.isNew).length} existing
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 text-slate-600 dark:text-slate-400">
                        <tr>
                          <th className="p-2">Status</th>
                          <th className="p-2">SKU</th>
                          <th className="p-2">Name</th>
                          <th className="p-2 text-right">Cost</th>
                          <th className="p-2 text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedItems.slice(0, 50).map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-2">
                              {it.isNew ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                  NEW
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                  UPDATE
                                </span>
                              )}
                            </td>
                            <td className="p-2 font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {it.sku || '—'}
                            </td>
                            <td className="p-2 truncate max-w-[200px] text-slate-700 dark:text-slate-300">
                              {it.name}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-800 dark:text-slate-200">
                              {formatCurrency(it.unitCost)}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-800 dark:text-slate-200">
                              {it.currentStock} {it.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedItems.length > 50 && (
                    <p className="text-[10px] text-slate-400 italic text-center">
                      Showing first 50 of {parsedItems.length} records.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ==================================================== */
            /* EXPORT SECTION                                       */
            /* ==================================================== */
            <div className="space-y-4">
              {/* Target Format Selector */}
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 block uppercase tracking-wider">
                  Target Data Format
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer',
                      exportFormat === 'json'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-xs">
                      <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>JSON Exchange</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      Standard structured JSON file.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('excel')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer',
                      exportFormat === 'excel'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Excel Workbook</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      Formatted .xls spreadsheet.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer',
                      exportFormat === 'csv'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>CSV Flat File</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      Standard comma-delimited table.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('xml')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer',
                      exportFormat === 'xml'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-xs">
                      <FileCode className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Tally XML</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      TallyPrime import envelope.
                    </p>
                  </button>
                </div>
              </div>

              {/* Export Scope */}
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 block uppercase tracking-wider">
                  Records Scope
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all',
                      exportScope === 'filtered'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    )}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={exportScope === 'filtered'}
                      onChange={() => setExportScope('filtered')}
                      className="text-indigo-600"
                    />
                    <span>Active Filtered Selection ({filteredProducts.length} items)</span>
                  </label>

                  <label
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all',
                      exportScope === 'all'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    )}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                      className="text-indigo-600"
                    />
                    <span>Entire Master Catalog ({allProducts.length} items)</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {onNavigateToFullHub && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToFullHub();
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Full Enterprise Data Exchange Hub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {activeTab === 'import' ? (
              <button
                type="button"
                onClick={handleApplyImport}
                disabled={parsedItems.length === 0 || isSubmitting}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Apply Import ({parsedItems.length})</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteExport}
                disabled={targetProducts.length === 0 || isExporting}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Generate & Export ({targetProducts.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
