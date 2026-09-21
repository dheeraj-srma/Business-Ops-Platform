import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Copy,
  Clock,
  History,
  ShieldCheck,
  Code,
  Sparkles,
  RefreshCw,
  Calendar,
  Layers,
  ArrowRight,
  FileCode,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Search,
  X,
} from 'lucide-react';
import {
  ExportType,
  ExportFormat,
  PreExportValidationReport,
  TallyExportRecord,
  Product,
  Category,
} from '../../types';
import { api } from '../../lib/api';
import { formatDate, formatShortDate, cn } from '../../lib/utils';
import confetti from 'canvas-confetti';

interface TallyExportViewProps {
  products?: Product[];
  categories?: Category[];
  onGoBack?: () => void;
}

export const TallyExportView: React.FC<TallyExportViewProps> = ({ products = [], categories = [], onGoBack }) => {
  const [exportType, setExportType] = useState<ExportType>('FULL');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('JSON');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [validationReport, setValidationReport] = useState<PreExportValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<{
    record: TallyExportRecord;
    content: string;
  } | null>(null);

  const [exportHistory, setExportHistory] = useState<TallyExportRecord[]>([]);
  const [lastCheckpoint, setLastCheckpoint] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'WARNING' | 'ERROR'>('ALL');

  const filteredIssues = useMemo(() => {
    if (!validationReport?.issues) return [];
    return validationReport.issues.filter((iss) => {
      if (auditFilter !== 'ALL' && iss.severity !== auditFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const name = (iss.productName || '').toLowerCase();
        const sku = (iss.productSku || '').toLowerCase();
        const issue = (iss.issue || '').toLowerCase();
        if (!name.includes(q) && !sku.includes(q) && !issue.includes(q)) return false;
      }
      return true;
    });
  }, [validationReport, auditFilter, auditSearch]);

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

  // Lock body scrolling when full screen is active
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  // Run validation check on criteria change
  const runValidation = async () => {
    try {
      setIsValidating(true);
      setErrorMsg(null);
      const res = await api.validateTallyExport({
        exportType,
        dateFrom: exportType === 'CUSTOM_RANGE' ? dateFrom : undefined,
        dateTo: exportType === 'CUSTOM_RANGE' ? dateTo : undefined,
      });
      setValidationReport(res.validationReport);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to validate inventory for Tally');
    } finally {
      setIsValidating(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.getTallyHistory();
      setExportHistory(res.exports);
      setLastCheckpoint(res.lastCheckpoint);
    } catch (err: any) {
      console.error('Failed to load export history', err);
    }
  };

  useEffect(() => {
    runValidation();
  }, [exportType, dateFrom, dateTo]);

  useEffect(() => {
    loadHistory();
  }, []);

  const handleGenerateExport = async () => {
    try {
      setIsExporting(true);
      setErrorMsg(null);

      // Client-side formatted Excel or CSV export
      if (exportFormat === 'EXCEL' || exportFormat === 'CSV') {
        const dateStr = new Date().toISOString().slice(0, 10);
        let content = '';
        let fileName = '';
        const exportProducts = products || [];

        if (exportFormat === 'EXCEL') {
          fileName = `Inventory_Master_Export_${dateStr}.xls`;
          const xmlHeader = `<?xml version="1.0"?>
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
   </Row>`;
          const xmlRows = exportProducts.map((p) => {
            const stock = p.currentStock ?? (p as any).current_stock ?? 0;
            const cost = p.unitCost ?? (p as any).unit_cost ?? 0;
            const val = stock * cost;
            const min = p.minimumStock ?? (p as any).min_stock ?? 0;
            return `   <Row>
    <Cell><Data ss:Type="String">${(p.sku || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>
    <Cell><Data ss:Type="String">${(p.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>
    <Cell><Data ss:Type="String">${(p.categoryName || (p as any).category_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>
    <Cell><Data ss:Type="Number">${stock}</Data></Cell>
    <Cell><Data ss:Type="Number">${cost}</Data></Cell>
    <Cell><Data ss:Type="Number">${val}</Data></Cell>
    <Cell><Data ss:Type="Number">${min}</Data></Cell>
   </Row>`;
          }).join('\n');
          content = `${xmlHeader}\n${xmlRows}\n  </Table>\n </Worksheet>\n</Workbook>`;
        } else {
          fileName = `Inventory_Master_Export_${dateStr}.csv`;
          const rows = [
            ['SKU', 'Item Name', 'Category', 'Current Stock', 'Unit Cost', 'Valuation', 'Min Level'],
            ...exportProducts.map((p) => {
              const stock = p.currentStock ?? (p as any).current_stock ?? 0;
              const cost = p.unitCost ?? (p as any).unit_cost ?? 0;
              return [
                p.sku || '',
                p.name || '',
                p.categoryName || (p as any).category_name || '',
                String(stock),
                String(cost),
                String(stock * cost),
                String(p.minimumStock ?? (p as any).min_stock ?? 0),
              ];
            }),
          ];
          content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        }

        const localRecord: any = {
          id: `exp_${Date.now()}`,
          exportType,
          exportFormat,
          fileName,
          productCount: exportProducts.length,
          totalItems: exportProducts.length,
          status: 'COMPLETED',
          exportedByName: 'System User',
          createdAt: new Date().toISOString(),
        };

        setGeneratedResult({
          record: localRecord,
          content,
        });

        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
          });
        } catch (e) {}
        return;
      }

      const res = await api.executeTallyExport({
        exportType,
        exportFormat,
        dateFrom: exportType === 'CUSTOM_RANGE' ? dateFrom : undefined,
        dateTo: exportType === 'CUSTOM_RANGE' ? dateTo : undefined,
      });

      setGeneratedResult({
        record: res.exportRecord,
        content: res.fileContent,
      });

      // Confetti feedback
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch (e) {}

      loadHistory();
    } catch (err: any) {
      setErrorMsg(err.message || 'Export generation failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadGenerated = () => {
    if (!generatedResult) return;
    const mimeType =
      exportFormat === 'XML'
        ? 'application/xml'
        : exportFormat === 'EXCEL'
        ? 'application/vnd.ms-excel'
        : exportFormat === 'CSV'
        ? 'text/csv'
        : 'application/json';
    const blob = new Blob([generatedResult.content], {
      type: mimeType,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedResult.record.fileName || (generatedResult.record as any).file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div id="tally-export-view" className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3 sm:gap-3.5">
          {onGoBack && (
            <button
              id="btn-tally-back"
              onClick={onGoBack}
              title="Go back to previous state"
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0 group"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Tally & TallyPrime Inventory Export Module
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
              Export validated stock masters, closing balances, categories (Stock Groups), and part numbers into standardized Tally XML or JSON structures.
            </p>
          </div>
        </div>

        {lastCheckpoint && (
          <div className="bg-slate-50 dark:bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Last Export Checkpoint:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{formatDate(lastCheckpoint)}</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Configuration & Pre-Export Validation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Export Configuration (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              1. Select Export Scope
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Choose full catalog or incremental modifications</p>
          </div>

          {/* Scope Radios */}
          <div className="space-y-2 text-xs">
            <label
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                exportType === 'FULL'
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-900 dark:text-slate-100'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
              )}
            >
              <input
                type="radio"
                name="exportType"
                value="FULL"
                checked={exportType === 'FULL'}
                onChange={() => setExportType('FULL')}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold block">Full Inventory Master Export</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Exports all active products with their current on-hand stock quantities and valuations.
                </span>
              </div>
            </label>

            <label
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                exportType === 'INCREMENTAL'
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-900 dark:text-slate-100'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
              )}
            >
              <input
                type="radio"
                name="exportType"
                value="INCREMENTAL"
                checked={exportType === 'INCREMENTAL'}
                onChange={() => setExportType('INCREMENTAL')}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold block">Incremental Export (Changes Since Last Sync)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Only exports items modified or transacted since the previous successful export checkpoint.
                </span>
              </div>
            </label>

            <label
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                exportType === 'CUSTOM_RANGE'
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-900 dark:text-slate-100'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
              )}
            >
              <input
                type="radio"
                name="exportType"
                value="CUSTOM_RANGE"
                checked={exportType === 'CUSTOM_RANGE'}
                onChange={() => setExportType('CUSTOM_RANGE')}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="w-full">
                <span className="font-bold block">Custom Date Range</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Export products updated within a specific period.
                </span>

                {exportType === 'CUSTOM_RANGE' && (
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">From:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">To:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Format Selection (JSON, XML, Excel, CSV) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/70">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
              2. Target Format & Integration Method
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setExportFormat('JSON')}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all cursor-pointer',
                  exportFormat === 'JSON'
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                )}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>JSON Payload</span>
                </div>
                <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  Standard structured schema for REST sync connectors and data exchanges.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('XML')}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all cursor-pointer',
                  exportFormat === 'XML'
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                )}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Tally XML</span>
                </div>
                <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  Compliant with TallyPrime & Tally.ERP 9 "Import of Data" master parser.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('EXCEL')}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all cursor-pointer',
                  exportFormat === 'EXCEL'
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                )}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Excel Workbook</span>
                </div>
                <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  Formatted spreadsheet (.xls) with valuations, categories, and stock numbers.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('CSV')}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all cursor-pointer',
                  exportFormat === 'CSV'
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                )}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>CSV Flat File</span>
                </div>
                <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  Universal comma-delimited export for ERP systems and database ingestion.
                </p>
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <div className="pt-2">
            <button
              id="btn-execute-tally-export"
              onClick={handleGenerateExport}
              disabled={isExporting || isValidating || (validationReport && !validationReport.canProceed) || (validationReport && validationReport.totalChecked === 0)}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating {exportFormat} File...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Generate & Export {exportFormat}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pre-Export Validation & Inspection Audit (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Pre-Export Data Integrity Audit
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Validates SKUs, units, categories, and stock balances before compilation
                </p>
              </div>
              <button
                onClick={runValidation}
                disabled={isValidating}
                className="text-xs text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={cn('w-3 h-3', isValidating && 'animate-spin')} />
                <span>Re-verify</span>
              </button>
            </div>

            {isValidating ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">Verifying records against Tally schema...</div>
            ) : validationReport ? (
              <div className="space-y-3">
                {/* Status Summary Banner */}
                <div
                  className={cn(
                    'p-3.5 rounded-lg border flex items-center justify-between text-xs',
                    validationReport.canProceed
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {validationReport.canProceed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold block">
                        {validationReport.totalChecked} Products Evaluated
                      </span>
                      <span className="text-[11px] opacity-90">
                        {validationReport.canProceed
                          ? 'All inventory items passed critical integrity checks.'
                          : 'Blocking errors detected. Please fix issues before export.'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setAuditFilter('ALL')}
                      className={cn(
                        'px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer',
                        auditFilter === 'ALL'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                      )}
                    >
                      All ({validationReport.issues.length})
                    </button>

                    <span className="px-2.5 py-1 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md font-semibold">
                      {validationReport.validCount} Valid
                    </span>

                    {validationReport.warningCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAuditFilter(auditFilter === 'WARNING' ? 'ALL' : 'WARNING')}
                        className={cn(
                          'px-2.5 py-1 rounded-md font-semibold border transition-all cursor-pointer',
                          auditFilter === 'WARNING'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        )}
                      >
                        {validationReport.warningCount} Warnings
                      </button>
                    )}

                    {validationReport.errorCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAuditFilter(auditFilter === 'ERROR' ? 'ALL' : 'ERROR')}
                        className={cn(
                          'px-2.5 py-1 rounded-md font-semibold border transition-all cursor-pointer',
                          auditFilter === 'ERROR'
                            ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40'
                        )}
                      >
                        {validationReport.errorCount} Errors
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Bar matching the screenshot */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search audit issues by SKU, product name, or issue description..."
                    className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs transition-all"
                  />
                  {auditSearch && (
                    <button
                      onClick={() => setAuditSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Itemized Issues List - Extended to fill bottom space */}
                <div className="max-h-[300px] overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-700/50 pr-1 custom-scrollbar">
                  {filteredIssues.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs flex items-center justify-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{validationReport.issues.length === 0 ? 'Zero validation errors or warnings. Ready for immediate export.' : 'No audit issues match your search filter.'}</span>
                    </div>
                  ) : (
                    filteredIssues.map((iss, i) => (
                      <div key={i} className="pt-2 flex items-start gap-2 text-xs">
                        {iss.severity === 'ERROR' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{iss.productName}</span>
                            {iss.productSku && (
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">[{iss.productSku}]</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">{iss.issue}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Generated Result Preview & Download Box */}
          {generatedResult && (
            <div className="p-4 bg-slate-900 dark:bg-slate-950 rounded-lg text-white space-y-3 border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono text-indigo-200 font-semibold truncate max-w-[240px]">
                    {generatedResult.record.fileName || (generatedResult.record as any).file_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <button
                    id="btn-download-export-file"
                    onClick={handleDownloadGenerated}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>

              {/* Code preview snippet */}
              <pre className="p-3 bg-slate-950 rounded-md text-[10px] font-mono text-slate-300 max-h-36 overflow-y-auto overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                {generatedResult.content.slice(0, 800)}
                {generatedResult.content.length > 800 ? '\n... [Remaining content included in download]' : ''}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Backdrop with Blur & Inactive Dimming */}
      {isFullScreen && (
        <div
          onClick={() => setIsFullScreen(false)}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-40 animate-in fade-in duration-200 cursor-pointer"
          title="Click backdrop to exit full screen"
          aria-hidden="true"
        />
      )}

      {/* Export History Ledger */}
      <div
        className={cn(
          'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden transition-all',
          isFullScreen
            ? 'fixed inset-2 sm:inset-3 md:inset-4 lg:inset-5 z-50 flex flex-col shadow-2xl border-slate-300 dark:border-slate-600 rounded-2xl animate-in zoom-in-95 duration-200'
            : ''
        )}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Tally Export History & Audit Checkpoints
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                {exportHistory.length} {exportHistory.length === 1 ? 'package' : 'packages'}
              </span>
              {isFullScreen && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5" />
                  <span>Full Screen Expanded</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Complete historical record of exported inventory packages</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-tally-export-fullscreen"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
                isFullScreen
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500 shadow-xs'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              )}
              title={isFullScreen ? 'Exit Full Screen (Esc)' : 'Expand table across whole screen width'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span>Exit Full Screen</span>
                  <span className="text-[10px] text-indigo-200 font-mono hidden sm:inline">(Esc)</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Full Screen</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className={cn('overflow-x-auto', isFullScreen ? 'flex-1 overflow-y-auto' : '')}>
          <table className={cn('w-full text-left text-xs border-collapse', isFullScreen ? 'min-w-full' : '')}>
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-semibold text-[11px] border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="py-2.5 px-4">Export ID</th>
                <th className="py-2.5 px-4">Export Date & Time</th>
                <th className="py-2.5 px-4">Scope</th>
                <th className="py-2.5 px-4">Format</th>
                <th className="py-2.5 px-4 text-right">Products Count</th>
                <th className="py-2.5 px-4">Generated File Name</th>
                <th className="py-2.5 px-4">Exported By</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {exportHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    No export history recorded yet.
                  </td>
                </tr>
              ) : (
                exportHistory.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {exp.id}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(exp.createdAt || (exp as any).created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-medium text-[11px]">
                        {exp.exportType || (exp as any).export_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                          (exp.exportFormat || (exp as any).export_format) === 'XML'
                            ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300'
                            : 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                        )}
                      >
                        {exp.exportFormat || (exp as any).export_format}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {exp.productCount || (exp as any).product_count} items
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                      {exp.fileName || (exp as any).file_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {exp.exportedByName || (exp as any).exported_by}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {exp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <a
                        href={`/api/tally/download/${exp.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-md text-[11px] font-semibold transition-all"
                        download
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
