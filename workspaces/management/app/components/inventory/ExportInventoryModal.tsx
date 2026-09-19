'use client';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  X,
  Download,
  CheckSquare,
  Square,
  RotateCcw,
  Check,
  Layers,
} from 'lucide-react';
import { Product, Category } from '../../types';
import { cn, formatDate } from '../../lib/utils';

export interface ColumnDefinition {
  id: string;
  label: string;
  description: string;
  defaultSelected: boolean;
  getValue: (p: Product, categoryName: string) => string | number;
}

export const EXPORT_COLUMNS: ColumnDefinition[] = [
  {
    id: 'sku',
    label: 'SKU / Item Code',
    description: 'Unique product stock keeping unit',
    defaultSelected: true,
    getValue: (p) => p.sku || '',
  },
  {
    id: 'name',
    label: 'Item Name',
    description: 'Full product or catalog description',
    defaultSelected: true,
    getValue: (p) => p.name || '',
  },
  {
    id: 'category',
    label: 'Category',
    description: 'Assigned category or group name',
    defaultSelected: true,
    getValue: (p, catName) => catName || '-',
  },
  {
    id: 'currentStock',
    label: 'Current Stock',
    description: 'Live physical on-hand quantity',
    defaultSelected: true,
    getValue: (p) => p.currentStock ?? (p as any).current_stock ?? 0,
  },
  {
    id: 'unit',
    label: 'Unit (UOM)',
    description: 'Unit of measurement (Pieces, Kg, etc.)',
    defaultSelected: true,
    getValue: (p) => p.unit || 'Pieces',
  },
  {
    id: 'unitCost',
    label: 'Current Price / Unit Cost',
    description: 'Purchase or standard unit valuation (₹)',
    defaultSelected: true,
    getValue: (p) => p.unitCost ?? (p as any).unit_cost ?? 0,
  },
  {
    id: 'totalValuation',
    label: 'Total Valuation',
    description: 'Inventory value (Stock × Unit Price)',
    defaultSelected: true,
    getValue: (p) => {
      const stock = p.currentStock ?? (p as any).current_stock ?? 0;
      const cost = p.unitCost ?? (p as any).unit_cost ?? 0;
      return Math.round(stock * cost * 100) / 100;
    },
  },
  {
    id: 'minimumStock',
    label: 'Minimum Stock (Safety)',
    description: 'Reorder safety stock buffer',
    defaultSelected: true,
    getValue: (p) => p.minimumStock ?? (p as any).minimum_stock ?? 0,
  },
  {
    id: 'criticalStock',
    label: 'Critical Stock Threshold',
    description: 'Emergency danger level',
    defaultSelected: false,
    getValue: (p) => p.criticalStock ?? (p as any).critical_stock ?? 0,
  },
  {
    id: 'status',
    label: 'Inventory Status',
    description: 'Health label (In Stock, Low Stock, etc.)',
    defaultSelected: true,
    getValue: (p) => {
      const stock = p.currentStock ?? (p as any).current_stock ?? 0;
      const min = p.minimumStock ?? (p as any).minimum_stock ?? 15;
      const crit = p.criticalStock ?? (p as any).critical_stock ?? 5;
      if (stock <= 0) return 'Out of Stock';
      if (stock <= crit) return 'Critical Stock';
      if (stock <= min) return 'Low Stock';
      return 'In Stock';
    },
  },
  {
    id: 'description',
    label: 'Item Description / Specs',
    description: 'Detailed specifications and notes',
    defaultSelected: false,
    getValue: (p) => p.description || '',
  },
  {
    id: 'updatedAt',
    label: 'Last Updated Date',
    description: 'Timestamp of last recorded modification',
    defaultSelected: false,
    getValue: (p) => {
      const raw = p.updatedAt || (p as any).updated_at;
      return raw ? formatDate(raw) : '-';
    },
  },
];

interface ExportInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredProducts: Product[];
  allProducts: Product[];
  categories: Category[];
  onExportSuccess: (count: number, columnCount: number) => void;
}

export const ExportInventoryModal: React.FC<ExportInventoryModalProps> = ({
  isOpen,
  onClose,
  filteredProducts,
  allProducts,
  categories,
  onExportSuccess,
}) => {
  // Initialize default selected columns
  const [selectedColIds, setSelectedColIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    EXPORT_COLUMNS.forEach((col) => {
      initial[col.id] = col.defaultSelected;
    });
    return initial;
  });

  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const categoryMap = new Map<string, string>();
  categories.forEach((c) => categoryMap.set(c.id, c.name));

  const targetProducts = exportScope === 'filtered' ? filteredProducts : allProducts;
  const activeColumnCount = Object.values(selectedColIds).filter(Boolean).length;

  const handleToggleColumn = (colId: string) => {
    setSelectedColIds((prev) => ({
      ...prev,
      [colId]: !prev[colId],
    }));
  };

  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    EXPORT_COLUMNS.forEach((c) => {
      next[c.id] = true;
    });
    setSelectedColIds(next);
  };

  const handleDeselectAll = () => {
    const next: Record<string, boolean> = {};
    EXPORT_COLUMNS.forEach((c) => {
      next[c.id] = false;
    });
    setSelectedColIds(next);
  };

  const handleResetDefaults = () => {
    const next: Record<string, boolean> = {};
    EXPORT_COLUMNS.forEach((c) => {
      next[c.id] = c.defaultSelected;
    });
    setSelectedColIds(next);
  };

  // Generate and download Excel / CSV file
  const handleExport = () => {
    if (activeColumnCount === 0) return;
    if (targetProducts.length === 0) return;

    setIsExporting(true);

    try {
      const activeColumns = EXPORT_COLUMNS.filter((c) => selectedColIds[c.id]);
      const dateStr = new Date().toISOString().slice(0, 10);

      if (exportFormat === 'excel') {
        // Excel SpreadsheetML (XML) - fully formatted native Excel workbook
        const xmlRows = targetProducts
          .map((p) => {
            const catName =
              categoryMap.get(p.categoryId || (p as any).category_id) ||
              (p as any).category_name ||
              '';
            const cells = activeColumns
              .map((col) => {
                const val = col.getValue(p, catName);
                const isNum = typeof val === 'number';
                return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${String(
                  val
                )
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')}</Data></Cell>`;
              })
              .join('');
            return `<Row>${cells}</Row>`;
          })
          .join('\n');

        const xmlHeaderCells = activeColumns
          .map(
            (col) =>
              `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${col.label
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</Data></Cell>`
          )
          .join('');

        const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Inventory Catalog">
  <Table>
   <Row>${xmlHeaderCells}</Row>
   ${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([excelXml], {
          type: 'application/vnd.ms-excel;charset=utf-8;',
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Inventory_Master_Export_${dateStr}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // CSV format with UTF-8 BOM
        const headers = activeColumns.map((c) => `"${c.label.replace(/"/g, '""')}"`);
        const rows = targetProducts.map((p) => {
          const catName =
            categoryMap.get(p.categoryId || (p as any).category_id) ||
            (p as any).category_name ||
            '';
          return activeColumns
            .map((col) => {
              const val = col.getValue(p, catName);
              return typeof val === 'number'
                ? val
                : `"${String(val).replace(/"/g, '""')}"`;
            })
            .join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], {
          type: 'text/csv;charset=utf-8;',
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Inventory_Master_Export_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      onClose();
      onExportSuccess(targetProducts.length, activeColumnCount);
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-inventory-title"
    >
      {/* Light & Clean Backdrop Blur */}
      <div
        className="fixed inset-0 bg-slate-900/30 dark:bg-black/50 backdrop-blur-xs cursor-pointer transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        title="Click outside to cancel"
      />

      {/* Clean, Simple & Minimal Dialog Box */}
      <div
        id="modal-export-inventory"
        className={cn(
          'relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl',
          'border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 overflow-hidden z-10',
          'text-slate-900 dark:text-slate-100 transition-all duration-150',
          'animate-in zoom-in-95 fade-in duration-150 max-h-[92vh] flex flex-col'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-50 dark:bg-indigo-50 dark:bg-indigo-950/40 text-cyan-600 dark:text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="export-inventory-title"
                className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-tight"
              >
                Export Inventory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select columns and options to export as spreadsheet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-colors cursor-pointer -mr-1 -mt-1"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-0.5">
          {/* Export Scope Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Record Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportScope('filtered')}
                className={cn(
                  'p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs flex flex-col gap-0.5',
                  exportScope === 'filtered'
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                )}
              >
                <span className="font-semibold">Current Filtered View</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {filteredProducts.length} items currently visible
                </span>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={cn(
                  'p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs flex flex-col gap-0.5',
                  exportScope === 'all'
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                )}
              >
                <span className="font-semibold">All Catalog Products</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {allProducts.length} total products in database
                </span>
              </button>
            </div>
          </div>

          {/* Column Checkboxes Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Select Columns ({activeColumnCount}/{EXPORT_COLUMNS.length})
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  All
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-1.5 py-0.5 text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                >
                  None
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-1.5 py-0.5 text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Checkbox Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
              {EXPORT_COLUMNS.map((col) => {
                const isSelected = !!selectedColIds[col.id];
                return (
                  <label
                    key={col.id}
                    onClick={() => handleToggleColumn(col.id)}
                    className={cn(
                      'flex items-start gap-2.5 p-2 rounded-lg transition-all cursor-pointer select-none text-xs',
                      isSelected
                        ? 'bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs'
                        : 'hover:bg-white/60 dark:hover:bg-slate-800/40 border border-transparent text-slate-500 dark:text-slate-400'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded mt-0.5 flex items-center justify-center transition-colors shrink-0',
                        isSelected
                          ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                          : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100 leading-tight">
                        {col.label}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {col.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* File Format Options */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              File Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                onClick={() => setExportFormat('excel')}
                className={cn(
                  'flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-xs',
                  exportFormat === 'excel'
                    ? 'border-cyan-600 dark:border-indigo-600 dark:border-indigo-500 bg-cyan-50/50 dark:bg-cyan-950/30 text-cyan-800 dark:text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <div
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                    exportFormat === 'excel'
                      ? 'border-cyan-600 dark:border-indigo-600 dark:border-indigo-500 bg-cyan-600 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  )}
                >
                  {exportFormat === 'excel' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <span className="font-semibold block">Excel Sheet (.xls)</span>
                  <span className="text-[10px] text-slate-400 block">Formattable spreadsheet</span>
                </div>
              </label>

              <label
                onClick={() => setExportFormat('csv')}
                className={cn(
                  'flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-xs',
                  exportFormat === 'csv'
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 font-medium'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <div
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                    exportFormat === 'csv'
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  )}
                >
                  {exportFormat === 'csv' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <span className="font-semibold block">CSV File (.csv)</span>
                  <span className="text-[10px] text-slate-400 block">Universal comma-separated</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {targetProducts.length} items • {activeColumnCount} columns
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              id="btn-confirm-export"
              onClick={handleExport}
              disabled={activeColumnCount === 0 || targetProducts.length === 0 || isExporting}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer shadow-2xs',
                activeColumnCount > 0 && targetProducts.length > 0
                  ? 'bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              )}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {exportFormat === 'excel' ? 'Excel' : 'CSV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
