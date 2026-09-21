import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign,
  Search,
  SlidersHorizontal,
  Download,
  Upload,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Percent,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  X,
  FileSpreadsheet,
  FileCode,
  HelpCircle,
  Eye,
  Edit2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Product, Category, UserRole } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency, formatNumber, cn } from '../../lib/utils';
import { useDialog } from '../../context/DialogContext';

interface CatalogPriceManagerProps {
  products: Product[];
  categories: Category[];
  role: UserRole;
  onRefresh: () => void;
  onOpenProductDetail?: (productId: string) => void;
}

interface ModifiedProductRow {
  unitCost: number;
  minimumStock: number;
  criticalStock: number;
  unit: string;
  name: string;
}

type SortField = 'sku' | 'name' | 'category' | 'unitCost' | 'minStock' | 'critStock' | 'currentStock' | 'valuation';

export const CatalogPriceManager: React.FC<CatalogPriceManagerProps> = ({
  products,
  categories,
  role,
  onRefresh,
  onOpenProductDetail,
}) => {
  const { showSuccess, showError, showConfirm } = useDialog();
  const isManager = role === 'manager';

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceStatusFilter, setPriceStatusFilter] = useState<'all' | 'priced' | 'zero' | 'modified'>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // In-memory edit tracking: { [productId]: { unitCost, minimumStock, criticalStock, unit, name } }
  const [modifiedRows, setModifiedRows] = useState<Record<string, ModifiedProductRow>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  // Status & Notification feedback
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Full Screen
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isBulkAdjustmentOpen, setIsBulkAdjustmentOpen] = useState<boolean>(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState<boolean>(false);

  // Bulk Adjustment Form State
  const [bulkCategory, setBulkCategory] = useState<string>('all');
  const [bulkTarget, setBulkTarget] = useState<'unitCost' | 'minimumStock' | 'criticalStock'>('unitCost');
  const [bulkType, setBulkType] = useState<'percentage' | 'fixed'>('percentage');
  const [bulkValue, setBulkValue] = useState<string>('10');
  const [bulkRoundTo, setBulkRoundTo] = useState<number>(1);
  const [isApplyingBulk, setIsApplyingBulk] = useState<boolean>(false);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewItems, setCsvPreviewItems] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category Lookup Map
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, priceStatusFilter, sortField, sortDirection, pageSize]);

  // Handle ESC key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Clear modified row
  const clearModifiedRow = (id: string) => {
    setModifiedRows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Helper to get effective current value (modified or original)
  const getProductValues = (p: Product) => {
    const origCost = p.unitCost ?? (p as any).unit_cost ?? 0;
    const origMin = p.minimumStock ?? (p as any).minimum_stock ?? 0;
    const origCrit = p.criticalStock ?? (p as any).critical_stock ?? 0;
    const origUnit = p.unit || 'NOS';
    const origName = p.name || '';

    const mod = modifiedRows[p.id];
    return {
      unitCost: mod?.unitCost !== undefined ? mod.unitCost : origCost,
      minimumStock: mod?.minimumStock !== undefined ? mod.minimumStock : origMin,
      criticalStock: mod?.criticalStock !== undefined ? mod.criticalStock : origCrit,
      unit: mod?.unit !== undefined ? mod.unit : origUnit,
      name: mod?.name !== undefined ? mod.name : origName,
      isModified: !!mod,
      origCost,
      origMin,
      origCrit,
      origUnit,
      origName,
    };
  };

  // Update a field in modifiedRows
  const handleFieldChange = (
    p: Product,
    field: keyof ModifiedProductRow,
    value: string | number
  ) => {
    const current = getProductValues(p);
    let parsedVal: any = value;
    if (field === 'unitCost') {
      parsedVal = Math.max(0, parseFloat(String(value)) || 0);
    } else if (field === 'minimumStock' || field === 'criticalStock') {
      parsedVal = Math.max(0, parseInt(String(value)) || 0);
    }

    const updatedRow: ModifiedProductRow = {
      unitCost: field === 'unitCost' ? parsedVal : current.unitCost,
      minimumStock: field === 'minimumStock' ? parsedVal : current.minimumStock,
      criticalStock: field === 'criticalStock' ? parsedVal : current.criticalStock,
      unit: field === 'unit' ? String(value) : current.unit,
      name: field === 'name' ? String(value) : current.name,
    };

    const isSameAsOriginal =
      updatedRow.unitCost === current.origCost &&
      updatedRow.minimumStock === current.origMin &&
      updatedRow.criticalStock === current.origCrit &&
      updatedRow.unit === current.origUnit &&
      updatedRow.name === current.origName;

    setModifiedRows((prev) => {
      const next = { ...prev };
      if (isSameAsOriginal) {
        delete next[p.id];
      } else {
        next[p.id] = updatedRow;
      }
      return next;
    });
  };

  // Save a single product row
  const handleSaveSingleRow = async (p: Product) => {
    const mod = modifiedRows[p.id];
    if (!mod) return;

    try {
      setSavingRows((prev) => ({ ...prev, [p.id]: true }));
      await api.updateCatalogPrices([
        {
          id: p.id,
          sku: p.sku,
          unitCost: mod.unitCost,
          minimumStock: mod.minimumStock,
          criticalStock: mod.criticalStock,
          unit: mod.unit,
          name: mod.name,
        },
      ]);

      clearModifiedRow(p.id);
      setFeedbackMsg({
        type: 'success',
        text: `Updated "${p.name}" (SKU: ${p.sku}) successfully.`,
      });
      onRefresh();
      showSuccess({
        title: 'Price & Thresholds Updated',
        message: `Product "${p.name}" (SKU: ${p.sku}) parameters updated successfully.`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to save product price update',
      });
      showError({
        title: 'Price Update Failed',
        message: err.message || 'Failed to save product price update',
      });
    } finally {
      setSavingRows((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  // Save all modified rows in batch
  const handleSaveAllModified = async () => {
    const entries = Object.entries(modifiedRows) as [string, ModifiedProductRow][];
    if (entries.length === 0) return;

    const confirmed = await showConfirm({
      title: 'Save Batch Price Updates?',
      message: `Are you sure you want to commit changes to ${entries.length} modified product${entries.length > 1 ? 's' : ''}?`,
      confirmText: 'Save All Changes',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    try {
      setIsSavingAll(true);
      const updates = entries.map(([id, mod]) => ({
        id,
        unitCost: mod.unitCost,
        minimumStock: mod.minimumStock,
        criticalStock: mod.criticalStock,
        unit: mod.unit,
        name: mod.name,
      }));

      const res = await api.updateCatalogPrices(updates);
      setModifiedRows({});
      setFeedbackMsg({
        type: 'success',
        text: `Successfully updated ${res.count} products across the catalog!`,
      });
      onRefresh();
      showSuccess({
        title: 'Batch Updates Saved',
        message: `Successfully updated ${res.count} products across the catalog!`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to save batch updates',
      });
      showError({
        title: 'Batch Update Failed',
        message: err.message || 'Failed to save batch updates',
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  // Apply Bulk Adjustment (Markup / Discount / Fixed)
  const handleApplyBulkAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(bulkValue);
    if (isNaN(val)) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid numeric value.' });
      return;
    }

    try {
      setIsApplyingBulk(true);
      const res = await api.applyBulkPriceAdjustment({
        categoryId: bulkCategory === 'all' ? undefined : bulkCategory,
        target: bulkTarget,
        adjustmentType: bulkType,
        value: val,
        roundTo: bulkRoundTo,
      });

      setIsBulkAdjustmentOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: `Bulk adjustment applied successfully to ${res.count} products!`,
      });
      onRefresh();
      showSuccess({
        title: 'Bulk Adjustment Applied',
        message: `Successfully adjusted parameters for ${res.count} products.`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to apply bulk adjustment',
      });
      showError({
        title: 'Bulk Adjustment Failed',
        message: err.message || 'Failed to apply bulk adjustment',
      });
    } finally {
      setIsApplyingBulk(false);
    }
  };

  // Export current catalog pricing as CSV
  const handleExportCsv = () => {
    const headers = ['SKU', 'Product Name', 'Category', 'Unit', 'Unit Cost (INR)', 'Min Stock', 'Critical Stock', 'Current Stock', 'Total Valuation (INR)'];
    const rows = products.map((p) => {
      const vals = getProductValues(p);
      const stock = p.currentStock ?? (p as any).current_stock ?? 0;
      const catName = p.categoryName || categoryMap.get(p.categoryId || (p as any).category_id) || 'General';
      const val = Math.max(0, stock) * vals.unitCost;

      return [
        `"${p.sku}"`,
        `"${vals.name.replace(/"/g, '""')}"`,
        `"${catName.replace(/"/g, '""')}"`,
        `"${vals.unit}"`,
        vals.unitCost,
        vals.minimumStock,
        vals.criticalStock,
        stock,
        val.toFixed(2),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalog_pricing_master_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export current catalog pricing as structured JSON data exchange
  const handleExportJson = () => {
    const catalogData = {
      system: 'Apex Stock Management System',
      exportType: 'CATALOG_PRICING',
      schemaVersion: '2.0',
      exportedAt: new Date().toISOString(),
      itemCount: products.length,
      items: products.map((p) => {
        const vals = getProductValues(p);
        const stock = p.currentStock ?? (p as any).current_stock ?? 0;
        const catName = p.categoryName || categoryMap.get(p.categoryId || (p as any).category_id) || 'General';
        const val = Math.max(0, stock) * vals.unitCost;

        return {
          sku: p.sku,
          name: vals.name,
          category: catName,
          unit: vals.unit,
          unitCost: vals.unitCost,
          minimumStock: vals.minimumStock,
          criticalStock: vals.criticalStock,
          currentStock: stock,
          totalValuation: Number(val.toFixed(2)),
        };
      }),
    };

    const jsonContent = JSON.stringify(catalogData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `catalog_pricing_master_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV or JSON file for import
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || '';

        // Check if file is JSON Data Exchange
        if (file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
          let parsed: any;
          try {
            parsed = JSON.parse(text);
          } catch (jsonErr: any) {
            setCsvError('Invalid JSON format: ' + jsonErr.message);
            return;
          }

          const rawList = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.items)
            ? parsed.items
            : Array.isArray(parsed.products)
            ? parsed.products
            : [parsed];

          const parsedItems: any[] = [];
          for (const item of rawList) {
            const sku = (item.sku || item.SKU || item.code || item.Code || item.product_code || item.id || '').toString().trim();
            if (!sku) continue;

            const cost = item.unitCost ?? item.unit_cost ?? item.price ?? item.Price ?? item.cost ?? item.rate;
            const min = item.minimumStock ?? item.minimum_stock ?? item.minStock ?? item.min;
            const crit = item.criticalStock ?? item.critical_stock ?? item.critStock ?? item.crit;
            const unit = item.unit ?? item.Unit ?? item.uom;
            const name = item.name ?? item.Name ?? item.productName ?? item.itemName;

            parsedItems.push({
              sku,
              unitCost: cost !== undefined && cost !== '' && !isNaN(Number(cost)) ? Number(cost) : undefined,
              minimumStock: min !== undefined && min !== '' && !isNaN(Number(min)) ? Number(min) : undefined,
              criticalStock: crit !== undefined && crit !== '' && !isNaN(Number(crit)) ? Number(crit) : undefined,
              unit: unit ? String(unit).trim() : undefined,
              name: name ? String(name).trim() : undefined,
            });
          }

          if (parsedItems.length === 0) {
            setCsvError('No valid items with a "sku" property were found in the JSON file.');
            return;
          }

          setCsvPreviewItems(parsedItems);
          return;
        }

        // Parse standard CSV file
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setCsvError('The CSV file does not contain enough data rows.');
          return;
        }

        const headerLine = lines[0];
        const headers = headerLine
          .split(',')
          .map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

        const skuIdx = headers.findIndex((h) => h === 'sku' || h === 'code' || h === 'product code');
        const costIdx = headers.findIndex((h) => h.includes('cost') || h.includes('price') || h.includes('rate'));
        const minIdx = headers.findIndex((h) => h.includes('min') || h.includes('safety'));
        const critIdx = headers.findIndex((h) => h.includes('crit') || h.includes('urgent'));
        const unitIdx = headers.findIndex((h) => h === 'unit' || h === 'uom');
        const nameIdx = headers.findIndex((h) => h === 'product name' || h === 'name');

        if (skuIdx === -1) {
          setCsvError('Could not find a "SKU" or "Code" column in the uploaded CSV.');
          return;
        }

        const parsedItems: any[] = [];
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

          const sku = cols[skuIdx];
          if (!sku) continue;

          parsedItems.push({
            sku,
            unitCost: costIdx !== -1 ? cols[costIdx] : undefined,
            minimumStock: minIdx !== -1 ? cols[minIdx] : undefined,
            criticalStock: critIdx !== -1 ? cols[critIdx] : undefined,
            unit: unitIdx !== -1 ? cols[unitIdx] : undefined,
            name: nameIdx !== -1 ? cols[nameIdx] : undefined,
          });
        }

        setCsvPreviewItems(parsedItems);
      } catch (err: any) {
        setCsvError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Submit CSV Import
  const handleExecuteCsvImport = async () => {
    if (csvPreviewItems.length === 0) return;

    try {
      setIsImportingCsv(true);
      const res = await api.importCatalogCsv(csvPreviewItems);
      setIsCsvImportOpen(false);
      setCsvFile(null);
      setCsvPreviewItems([]);
      setFeedbackMsg({
        type: 'success',
        text: `CSV Import Complete! ${res.updatedCount} products updated successfully.${
          res.errors.length > 0 ? ` (${res.errors.length} skipped)` : ''
        }`,
      });
      onRefresh();
      showSuccess({
        title: 'CSV Catalog Import Complete',
        message: `Successfully imported updates for ${res.updatedCount} products.${
          res.errors.length > 0 ? ` (${res.errors.length} skipped)` : ''
        }`,
      });
    } catch (err: any) {
      setCsvError(err.message || 'Failed to import CSV catalog data');
      showError({
        title: 'CSV Import Failed',
        message: err.message || 'Failed to import CSV catalog data',
      });
    } finally {
      setIsImportingCsv(false);
    }
  };

  // Filtered & Sorted Catalog (Fast Memoized Filter)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const result = products.filter((p) => {
      const isActive = p.isActive ?? (p as any).is_active !== false;
      if (!isActive) return false;

      if (selectedCategory !== 'all') {
        const catId = p.categoryId || (p as any).category_id;
        if (catId !== selectedCategory) return false;
      }

      const mod = modifiedRows[p.id];
      const cost = mod?.unitCost !== undefined ? mod.unitCost : (p.unitCost ?? (p as any).unit_cost ?? 0);

      if (priceStatusFilter === 'priced') {
        if (cost <= 0) return false;
      } else if (priceStatusFilter === 'zero') {
        if (cost > 0) return false;
      } else if (priceStatusFilter === 'modified') {
        if (!mod) return false;
      }

      if (q) {
        const skuMatch = (p.sku || '').toLowerCase().includes(q);
        const name = mod?.name || p.name || '';
        const nameMatch = name.toLowerCase().includes(q);
        const catName = (p.categoryName || categoryMap.get(p.categoryId || (p as any).category_id) || '').toLowerCase();
        if (!skuMatch && !nameMatch && !catName.includes(q)) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      const aMod = modifiedRows[a.id];
      const bMod = modifiedRows[b.id];

      const aCost = aMod?.unitCost !== undefined ? aMod.unitCost : (a.unitCost ?? (a as any).unit_cost ?? 0);
      const bCost = bMod?.unitCost !== undefined ? bMod.unitCost : (b.unitCost ?? (b as any).unit_cost ?? 0);
      const aMin = aMod?.minimumStock !== undefined ? aMod.minimumStock : (a.minimumStock ?? (a as any).minimum_stock ?? 0);
      const bMin = bMod?.minimumStock !== undefined ? bMod.minimumStock : (b.minimumStock ?? (b as any).minimum_stock ?? 0);
      const aCrit = aMod?.criticalStock !== undefined ? aMod.criticalStock : (a.criticalStock ?? (a as any).critical_stock ?? 0);
      const bCrit = bMod?.criticalStock !== undefined ? bMod.criticalStock : (b.criticalStock ?? (b as any).critical_stock ?? 0);
      const aStock = a.currentStock ?? (a as any).current_stock ?? 0;
      const bStock = b.currentStock ?? (b as any).current_stock ?? 0;

      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortField) {
        case 'sku':
          aVal = (a.sku || '').toLowerCase();
          bVal = (b.sku || '').toLowerCase();
          break;
        case 'name':
          aVal = (aMod?.name || a.name || '').toLowerCase();
          bVal = (bMod?.name || b.name || '').toLowerCase();
          break;
        case 'category':
          aVal = (a.categoryName || categoryMap.get(a.categoryId || (a as any).category_id) || '').toLowerCase();
          bVal = (b.categoryName || categoryMap.get(b.categoryId || (b as any).category_id) || '').toLowerCase();
          break;
        case 'unitCost':
          aVal = aCost;
          bVal = bCost;
          break;
        case 'minStock':
          aVal = aMin;
          bVal = bMin;
          break;
        case 'critStock':
          aVal = aCrit;
          bVal = bCrit;
          break;
        case 'currentStock':
          aVal = aStock;
          bVal = bStock;
          break;
        case 'valuation':
          aVal = Math.max(0, aStock) * aCost;
          bVal = Math.max(0, bStock) * bCost;
          break;
        default:
          aVal = (aMod?.name || a.name || '').toLowerCase();
          bVal = (bMod?.name || b.name || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, selectedCategory, priceStatusFilter, searchQuery, sortField, sortDirection, modifiedRows, categoryMap]);

  // Pagination calculation
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredProducts.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProducts = useMemo(() => {
    if (pageSize === -1) return filteredProducts;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, safeCurrentPage, pageSize]);

  // Key Catalog Metrics
  const metrics = useMemo(() => {
    const totalCount = products.length;
    let totalValuation = 0;
    let zeroCostCount = 0;
    let sumUnitCost = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const mod = modifiedRows[p.id];
      const cost = mod?.unitCost !== undefined ? mod.unitCost : (p.unitCost ?? (p as any).unit_cost ?? 0);
      const stock = p.currentStock ?? (p as any).current_stock ?? 0;
      totalValuation += Math.max(0, stock) * cost;
      sumUnitCost += cost;
      if (cost <= 0) zeroCostCount++;
    }

    const avgCost = totalCount > 0 ? sumUnitCost / totalCount : 0;
    const modifiedCount = Object.keys(modifiedRows).length;

    return {
      totalCount,
      totalValuation,
      zeroCostCount,
      avgCost,
      modifiedCount,
    };
  }, [products, modifiedRows]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 inline ml-1" />
    );
  };

  // Render Table Component (Used in standard view and full-screen portal)
  const renderCatalogTable = (fullScreenMode: boolean) => (
    <div className={cn('flex flex-col bg-white dark:bg-slate-800 transition-colors', fullScreenMode ? 'h-full' : 'rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs overflow-hidden')}>
      {/* Table Toolbar inside Card */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU, product name, category..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={priceStatusFilter}
            onChange={(e) => setPriceStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer"
          >
            <option value="all">All Items ({products.length})</option>
            <option value="priced">Priced Items (&gt; ₹0)</option>
            <option value="zero">Zero Cost Items (₹0.00)</option>
            {metrics.modifiedCount > 0 && (
              <option value="modified">Unsaved Changes ({metrics.modifiedCount})</option>
            )}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {/* Bulk Price Adjustment Button */}
          {isManager && (
            <button
              type="button"
              id="btn-bulk-price-adjustment"
              onClick={() => setIsBulkAdjustmentOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Apply percentage markup/discount across category or catalog"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Bulk Adjust</span>
            </button>
          )}

          {/* Export JSON */}
          <button
            type="button"
            id="btn-export-pricing-json"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Download pricing catalog as JSON Data Exchange"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            id="btn-export-pricing-csv"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Download pricing catalog CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Import JSON / CSV */}
          {isManager && (
            <button
              type="button"
              id="btn-import-pricing-csv"
              onClick={() => setIsCsvImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Upload JSON or CSV to update product prices in bulk"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Import (JSON / CSV)</span>
            </button>
          )}

          {/* Full Screen Toggle */}
          <button
            type="button"
            id="btn-pricing-fullscreen"
            onClick={() => setIsFullScreen(!fullScreenMode)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
              fullScreenMode
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            )}
            title={fullScreenMode ? 'Exit Full Screen (Esc)' : 'Expand pricing manager to full screen'}
          >
            {fullScreenMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Full Screen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pricing Data Table */}
      <div className={cn('overflow-x-auto', fullScreenMode ? 'flex-1 overflow-y-auto' : 'max-h-[580px] overflow-y-auto')}>
        <table className="w-full text-left border-collapse min-w-[1080px]">
          <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-400 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100 dark:border-slate-700/70 sticky top-0 z-10 backdrop-blur-xs">
            <tr>
              <th
                onClick={() => handleSort('sku')}
                className="py-3 px-4 w-[145px] min-w-[145px] whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors group select-none"
              >
                SKU / Code {renderSortIcon('sku')}
              </th>
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 min-w-[220px] cursor-pointer hover:text-indigo-600 transition-colors group select-none"
              >
                Product Description {renderSortIcon('name')}
              </th>
              <th
                onClick={() => handleSort('category')}
                className="py-3 px-4 w-[130px] min-w-[130px] cursor-pointer hover:text-indigo-600 transition-colors group select-none"
              >
                Category {renderSortIcon('category')}
              </th>
              <th className="py-3 px-4 w-[90px] min-w-[90px]">Unit</th>
              <th
                onClick={() => handleSort('unitCost')}
                className="py-3 px-4 w-[140px] min-w-[140px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
              >
                Unit Cost (₹) {renderSortIcon('unitCost')}
              </th>
              <th
                onClick={() => handleSort('minStock')}
                className="py-3 px-4 w-[115px] min-w-[115px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
              >
                Min Stock {renderSortIcon('minStock')}
              </th>
              <th
                onClick={() => handleSort('critStock')}
                className="py-3 px-4 w-[115px] min-w-[115px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
              >
                Crit Stock {renderSortIcon('critStock')}
              </th>
              <th
                onClick={() => handleSort('currentStock')}
                className="py-3 px-4 w-[115px] min-w-[115px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
              >
                Stock Qty {renderSortIcon('currentStock')}
              </th>
              <th
                onClick={() => handleSort('valuation')}
                className="py-3 px-4 w-[130px] min-w-[130px] text-right cursor-pointer hover:text-indigo-600 transition-colors group select-none"
              >
                Valuation (₹) {renderSortIcon('valuation')}
              </th>
              <th className="py-3 px-4 w-[100px] min-w-[100px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">No products match your search or filter</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try clearing filters or search query to view all items.</p>
                </td>
              </tr>
            ) : (
              paginatedProducts.map((p) => {
                const vals = getProductValues(p);
                const stock = p.currentStock ?? (p as any).current_stock ?? 0;
                const totalValuation = Math.max(0, stock) * vals.unitCost;
                const isSavingThis = savingRows[p.id];
                const catName = p.categoryName || categoryMap.get(p.categoryId || (p as any).category_id) || 'General';

                return (
                  <tr
                    key={p.id}
                    className={cn(
                      'hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors group',
                      vals.isModified && 'bg-amber-50/40 dark:bg-amber-950/20'
                    )}
                  >
                    {/* SKU */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-md tracking-tight whitespace-nowrap inline-flex items-center shadow-2xs">
                        {p.sku}
                      </span>
                    </td>

                    {/* Product Name */}
                    <td className="py-3 px-4 min-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenProductDetail && onOpenProductDetail(p.id)}
                          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left cursor-pointer leading-snug truncate max-w-sm block"
                          title="Click to view product audit ledger"
                        >
                          {vals.name}
                        </button>
                        {vals.isModified && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Modified in this session" />
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-600">
                        {catName}
                      </span>
                    </td>

                    {/* Unit */}
                    <td className="py-3 px-4">
                      {isManager ? (
                        <input
                          type="text"
                          value={vals.unit}
                          onChange={(e) => handleFieldChange(p, 'unit', e.target.value)}
                          className="w-16 px-1.5 py-1 text-xs font-mono text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400 font-mono">{vals.unit}</span>
                      )}
                    </td>

                    {/* Unit Cost (₹) */}
                    <td className="py-3 px-4 text-right">
                      {isManager ? (
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-2 text-slate-400 text-[11px] font-mono select-none">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={vals.unitCost}
                            onChange={(e) => handleFieldChange(p, 'unitCost', e.target.value)}
                            className={cn(
                              'w-28 pl-5 pr-2 py-1 text-xs font-mono font-bold text-right border rounded focus:ring-1 focus:outline-hidden transition-all',
                              vals.isModified && vals.unitCost !== vals.origCost
                                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 focus:ring-amber-500'
                                : vals.unitCost === 0
                                ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 focus:ring-rose-500'
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-indigo-500'
                            )}
                          />
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(vals.unitCost)}
                        </span>
                      )}
                    </td>

                    {/* Min Stock */}
                    <td className="py-3 px-4 text-right">
                      {isManager ? (
                        <input
                          type="number"
                          min="0"
                          value={vals.minimumStock}
                          onChange={(e) => handleFieldChange(p, 'minimumStock', e.target.value)}
                          className={cn(
                            'w-20 px-2 py-1 text-xs font-mono text-right border rounded focus:ring-1 focus:outline-hidden transition-all',
                            vals.isModified && vals.minimumStock !== vals.origMin
                              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-indigo-500'
                          )}
                        />
                      ) : (
                        <span className="font-mono text-slate-600 dark:text-slate-400">{vals.minimumStock}</span>
                      )}
                    </td>

                    {/* Crit Stock */}
                    <td className="py-3 px-4 text-right">
                      {isManager ? (
                        <input
                          type="number"
                          min="0"
                          value={vals.criticalStock}
                          onChange={(e) => handleFieldChange(p, 'criticalStock', e.target.value)}
                          className={cn(
                            'w-20 px-2 py-1 text-xs font-mono text-right border rounded focus:ring-1 focus:outline-hidden transition-all',
                            vals.isModified && vals.criticalStock !== vals.origCrit
                              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-indigo-500'
                          )}
                        />
                      ) : (
                        <span className="font-mono text-slate-600 dark:text-slate-400">{vals.criticalStock}</span>
                      )}
                    </td>

                    {/* Stock Qty */}
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatNumber(stock)} <span className="text-[10px] text-slate-400">{vals.unit}</span>
                    </td>

                    {/* Valuation */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                      {formatCurrency(totalValuation)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {vals.isModified && isManager ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveSingleRow(p)}
                              disabled={isSavingThis}
                              className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-all cursor-pointer"
                              title="Save this row"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => clearModifiedRow(p.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all cursor-pointer"
                              title="Revert modifications"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenProductDetail && onOpenProductDetail(p.id)}
                            className="p-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-all cursor-pointer"
                            title="View Audit Ledger"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Summary Footer */}
      <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3 flex-wrap">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200">
              {filteredProducts.length === 0 ? 0 : pageSize === -1 ? 1 : (safeCurrentPage - 1) * pageSize + 1}
            </strong> to <strong className="text-slate-800 dark:text-slate-200">
              {pageSize === -1 ? filteredProducts.length : Math.min(safeCurrentPage * pageSize, filteredProducts.length)}
            </strong> of <strong className="text-slate-800 dark:text-slate-200">{filteredProducts.length}</strong> items
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={-1}>All ({filteredProducts.length})</option>
            </select>
          </div>
        </div>

        {/* Page Nav Buttons */}
        {pageSize !== -1 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              title="First Page"
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              title="Previous Page"
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              title="Next Page"
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              title="Last Page"
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {metrics.modifiedCount > 0 && isManager && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {metrics.modifiedCount} unsaved {metrics.modifiedCount === 1 ? 'row' : 'rows'}
            </span>
            <button
              type="button"
              onClick={handleSaveAllModified}
              disabled={isSavingAll}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingAll ? 'Saving...' : 'Save All Changes'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div id="catalog-price-manager" className="space-y-4 sm:space-y-5">
      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={cn(
            'p-3.5 rounded-xl border flex items-center justify-between gap-2 text-xs animate-in fade-in',
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          )}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Catalog SKUs</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {metrics.totalCount}
            </span>
            <span className="text-xs text-slate-400">products</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Catalog Value</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 truncate">
              {formatCurrency(metrics.totalValuation)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Unit Cost</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-indigo-700 dark:text-indigo-400 truncate">
              {formatCurrency(metrics.avgCost)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pricing Health</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            {metrics.zeroCostCount > 0 ? (
              <span className="text-base sm:text-lg font-bold font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {metrics.zeroCostCount} unpriced (₹0)
              </span>
            ) : (
              <span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                100% Priced
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Save Toolbar when changes are pending */}
      {metrics.modifiedCount > 0 && isManager && !isFullScreen && (
        <div className="p-3.5 bg-slate-900 dark:bg-slate-950 border border-slate-700 text-white rounded-xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <strong className="text-amber-300 font-semibold">{metrics.modifiedCount} product {metrics.modifiedCount === 1 ? 'change' : 'changes'}</strong>
            <span className="text-slate-400">pending commit to database.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModifiedRows({})}
              className="px-3 py-1 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={handleSaveAllModified}
              disabled={isSavingAll}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingAll ? 'Committing...' : 'Save All Changes'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Standard Embedded Table */}
      {renderCatalogTable(false)}

      {/* Full Screen View via React Portal */}
      {isFullScreen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4 overflow-hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer"
              onClick={() => setIsFullScreen(false)}
              aria-hidden="true"
              title="Click background to exit full screen"
            />
            <div className="relative z-10 w-full h-full max-w-full max-h-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {renderCatalogTable(true)}
            </div>
          </div>,
          document.body
        )}

      {/* Bulk Price Adjustment Modal */}
      {isBulkAdjustmentOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer transition-opacity"
              onClick={() => setIsBulkAdjustmentOpen(false)}
              aria-hidden="true"
              title="Click background to close"
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700 z-10 transition-colors">
              <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Percent className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                      Bulk Price & Parameter Adjustment
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Apply percentage markups, discounts, or threshold updates
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBulkAdjustmentOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyBulkAdjustment} className="p-6 space-y-4">
                {/* Target Scope */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Target Group
                  </label>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">Entire Catalog (All Categories)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Parameter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Parameter to Modify
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'unitCost', label: 'Unit Cost / Price' },
                      { id: 'minimumStock', label: 'Minimum Stock' },
                      { id: 'criticalStock', label: 'Critical Stock' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBulkTarget(opt.id as any)}
                        className={cn(
                          'p-2 rounded-lg text-xs font-semibold border text-center transition-all cursor-pointer',
                          bulkTarget === opt.id
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Adjustment Mode */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Adjustment Type & Value
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setBulkType('percentage')}
                      className={cn(
                        'p-2 rounded-lg text-xs font-semibold border text-center transition-all cursor-pointer',
                        bulkType === 'percentage'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      Percentage (% Markup / Discount)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkType('fixed')}
                      className={cn(
                        'p-2 rounded-lg text-xs font-semibold border text-center transition-all cursor-pointer',
                        bulkType === 'fixed'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      Fixed Amount ({bulkTarget === 'unitCost' ? '₹ Delta' : 'Units Delta'})
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      placeholder={bulkType === 'percentage' ? 'e.g. 10 for +10%, -5 for -5%' : 'e.g. 50 or -20'}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      {bulkType === 'percentage' ? '%' : bulkTarget === 'unitCost' ? '₹' : 'Units'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {bulkType === 'percentage'
                      ? 'Positive value increases prices (markup), negative decreases prices (discount).'
                      : 'Positive adds to current value, negative subtracts from current value.'}
                  </p>
                </div>

                {/* Rounding Option for Cost */}
                {bulkTarget === 'unitCost' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Rounding Rule
                    </label>
                    <select
                      value={bulkRoundTo}
                      onChange={(e) => setBulkRoundTo(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value={1}>Round to Nearest Integer (e.g. ₹125.00)</option>
                      <option value={0.5}>Round to Nearest ₹0.50 (e.g. ₹125.50)</option>
                      <option value={10}>Round to Nearest ₹10 (e.g. ₹130.00)</option>
                      <option value={0.01}>Keep Exact Decimal (e.g. ₹125.43)</option>
                    </select>
                  </div>
                )}

                {/* Submit Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkAdjustmentOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isApplyingBulk}
                    className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isApplyingBulk ? 'Applying Changes...' : 'Apply Bulk Update'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* CSV Import Modal */}
      {isCsvImportOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer transition-opacity"
              onClick={() => setIsCsvImportOpen(false)}
              aria-hidden="true"
              title="Click background to close"
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 z-10 transition-colors max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                      Import Catalog Pricing & Thresholds (JSON / CSV)
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Upload JSON data exchange file or CSV spreadsheet with SKU, Unit Cost, and Safety Levels
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCsvImportOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* File Upload Box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:border-indigo-400 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv,application/json,text/csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {csvFile ? csvFile.name : 'Click to browse or drop JSON or CSV data sheet'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Expected fields: SKU, Unit Cost (or Price), Min Stock, Critical Stock, Unit, Name
                  </p>
                </div>

                {csvError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{csvError}</span>
                  </div>
                )}

                {/* Parsed Preview Table */}
                {csvPreviewItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Parsed <strong>{csvPreviewItems.length}</strong> items from file:</span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Ready to import</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                          <tr>
                            <th className="py-2 px-3">SKU</th>
                            <th className="py-2 px-3 text-right">Unit Cost</th>
                            <th className="py-2 px-3 text-right">Min Stock</th>
                            <th className="py-2 px-3 text-right">Crit Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
                          {csvPreviewItems.slice(0, 15).map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                              <td className="py-1.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.sku}</td>
                              <td className="py-1.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                                {item.unitCost !== undefined ? `₹${item.unitCost}` : '—'}
                              </td>
                              <td className="py-1.5 px-3 text-right text-slate-600 dark:text-slate-300">
                                {item.minimumStock ?? '—'}
                              </td>
                              <td className="py-1.5 px-3 text-right text-slate-600 dark:text-slate-300">
                                {item.criticalStock ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvPreviewItems.length > 15 && (
                      <p className="text-[10px] text-slate-400 text-right">
                        Showing first 15 of {csvPreviewItems.length} rows...
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCsvImportOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCsvImport}
                  disabled={isImportingCsv || csvPreviewItems.length === 0}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isImportingCsv ? 'Importing Data...' : `Import ${csvPreviewItems.length} Items`}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
