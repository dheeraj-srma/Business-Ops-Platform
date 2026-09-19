import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { COUPON_CATALOG, COUPON_PRICE_MAP } from '../../types';
import { api } from '../../lib/api';

interface CouponUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedCouponRow {
  product_name: string;
  category: string;
  brand_name: string;
  series_name: string;
  coupon_amount: number;
  coupons_used: number;
  notes?: string;
  isValid: boolean;
  validationError?: string;
}

export const CouponUploadModal: React.FC<CouponUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCouponRow[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent =
      'Product Name,Item Category,Brand Name,Coupon Name,Coupon Amount in Rupees,Number of Coupons Used,Notes\n' +
      'Brass Bib Cock 15mm Premium,Taps, Cocks & Mixers,Nalka Metal,BL09,5,150,Standard loyalty coupon\n' +
      'Angle Valve Chrome Heavy,Valves & Cocks,Nalka Metal,BL10,10,80,Retailer scheme Q1\n' +
      'Concealed Stop Cock 20mm,Plumbing Solutions,Apex Precision,BL11,20,45,Contractor promo series\n' +
      'Sink Mixer Wall Mounted,Kitchen Fittings,Nalka Metal,BL12,50,30,Counter scratch coupon\n' +
      'Overhead Shower 8x8 Brass,Luxury Showers,Jaquar Allied,BL13,100,20,Installer loyalty\n' +
      'Thermostatic Diverter High-Flow,Luxury Bath,Nalka Metal,BL14,500,8,Premium series redemption\n' +
      'Sensor Basin Tap Automatic,Commercial,Apex Precision,BL15,1000,4,Commercial project voucher\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'brand_coupons_BL09_BL15_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVText = (text: string): ParsedCouponRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error('File must contain a header line and at least one data row.');
    }

    // Parse header
    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    
    // Quick CSV tokenizer handling basic quotes
    const tokenize = (line: string): string[] => {
      const tokens: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          tokens.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      tokens.push(current.trim());
      return tokens.map((t) => t.replace(/^["']|["']$/g, '').trim());
    };

    const headers = tokenize(lines[0]).map((h) => h.toLowerCase());

    const findCol = (keys: string[]): number => {
      return headers.findIndex((h) => keys.some((k) => h.includes(k)));
    };

    const prodIdx = findCol(['product', 'item name', 'item_name']);
    const catIdx = findCol(['category', 'item category', 'item_category']);
    const brandIdx = findCol(['brand', 'brand name', 'brand_name', 'company']);
    const seriesIdx = findCol(['series', 'series name', 'series_name', 'coupon series']);
    const amountIdx = findCol(['amount', 'coupon amount', 'rupees', 'price', 'value', 'rs']);
    const usedIdx = findCol(['used', 'coupons used', 'quantity', 'count', 'number of coupons']);
    const notesIdx = findCol(['note', 'notes', 'remarks', 'description']);

    if (prodIdx === -1 || amountIdx === -1 || usedIdx === -1) {
      throw new Error(
        'Could not map required headers. Please ensure headers include "Product Name", "Coupon Amount", and "Coupons Used". You can download the sample template.'
      );
    }

    const rows: ParsedCouponRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const tokens = tokenize(lines[i]);
      if (tokens.length <= 1 && tokens[0] === '') continue;

      const pName = tokens[prodIdx] || '';
      const cat = catIdx !== -1 ? tokens[catIdx] : 'General';
      const bName = brandIdx !== -1 ? tokens[brandIdx] : 'Nalka Metal';
      const sName = seriesIdx !== -1 ? tokens[seriesIdx] : 'BL09';
      const amtStr = tokens[amountIdx] || '';
      const usedStr = tokens[usedIdx] || '';
      const notes = notesIdx !== -1 ? tokens[notesIdx] : '';

      let amtNum = parseFloat(amtStr.replace(/[^0-9.]/g, ''));
      const upperSeries = sName.trim().toUpperCase();
      if ((isNaN(amtNum) || amtNum <= 0) && COUPON_PRICE_MAP[upperSeries] !== undefined) {
        amtNum = COUPON_PRICE_MAP[upperSeries];
      }

      const usedNum = parseInt(usedStr.replace(/[^0-9]/g, ''), 10);

      let isValid = true;
      let error = '';

      if (!pName) {
        isValid = false;
        error = 'Missing Product Name';
      } else if (!cat) {
        isValid = false;
        error = 'Missing Category';
      } else if (!bName) {
        isValid = false;
        error = 'Missing Brand Name';
      } else if (!sName) {
        isValid = false;
        error = 'Missing Series Name';
      } else if (isNaN(amtNum) || amtNum <= 0) {
        isValid = false;
        error = 'Invalid coupon amount in rupees';
      } else if (isNaN(usedNum) || usedNum < 0) {
        isValid = false;
        error = 'Invalid number of coupons used';
      }

      rows.push({
        product_name: pName,
        category: cat || 'General',
        brand_name: bName || 'Nalka Metal',
        series_name: sName || 'Standard Series',
        coupon_amount: isNaN(amtNum) ? 0 : amtNum,
        coupons_used: isNaN(usedNum) ? 0 : usedNum,
        notes,
        isValid,
        validationError: error,
      });
    }

    return rows;
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error('Selected file is empty.');
        }

        if (selectedFile.name.endsWith('.json')) {
          const json = JSON.parse(text);
          const list = Array.isArray(json) ? json : json.coupons || json.items || [];
          const rows: ParsedCouponRow[] = list.map((item: any, idx: number) => {
            const pName = item.product_name || item.productName || item['Product Name'] || '';
            const cat = item.category || item.itemCategory || item['Item Category'] || 'General';
            const bName = item.brand_name || item.brandName || item['Brand Name'] || 'Nalka Metal';
            const sName = item.series_name || item.seriesName || item['Coupon Name'] || item['Coupon Series Name'] || 'BL09';
            let amt = Number(item.coupon_amount ?? item.couponAmount ?? item['Coupon Amount'] ?? item['Price'] ?? 0);
            const upperSeries = sName.trim().toUpperCase();
            if ((!amt || isNaN(amt) || amt <= 0) && COUPON_PRICE_MAP[upperSeries] !== undefined) {
              amt = COUPON_PRICE_MAP[upperSeries];
            }
            const used = Number(item.coupons_used ?? item.couponsUsed ?? item['Coupons Used'] ?? 0);
            const notes = item.notes || '';

            const isValid = Boolean(pName && cat && bName && sName && amt > 0 && used >= 0);
            return {
              product_name: pName,
              category: cat,
              brand_name: bName,
              series_name: sName,
              coupon_amount: amt,
              coupons_used: used,
              notes,
              isValid,
              validationError: isValid ? undefined : 'Missing required field or invalid numeric values',
            };
          });
          setParsedRows(rows);
        } else {
          // CSV / TSV / TXT
          const rows = parseCSVText(text);
          setParsedRows(rows);
        }
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse file. Please verify formatting.');
        setParsedRows([]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);
  const totalDisbursed = validRows.reduce((acc, r) => acc + r.coupon_amount * r.coupons_used, 0);

  const handleUploadSubmit = async () => {
    if (validRows.length === 0) {
      setUploadError('No valid coupon rows available to import.');
      return;
    }

    try {
      setIsProcessing(true);
      setUploadError(null);
      await api.bulkUploadCoupons(validRows, replaceExisting);
      onSuccess();
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to submit coupon batch.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-purple-50/60 dark:from-indigo-950/40 dark:to-purple-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Upload Brand Coupon Data
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bulk upload CSV or JSON data of coupons redeemed across brand products
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Top Info & Template Download Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                Required fields: <strong>Product Name, Category, Brand Name, Series Name, Coupon Amount (₹), Coupons Used</strong>
              </span>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template
            </button>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40'
                : file
                ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.json"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                  file
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {file ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {file ? file.name : 'Click to browse or drag & drop coupon file here'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Supports .csv, .tsv, .txt, or .json files
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {uploadError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Upload Error:</span> {uploadError}
              </div>
            </div>
          )}

          {/* Parsing Results Summary */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                    Total Rows
                  </span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {parsedRows.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                    Valid Records
                  </span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {validRows.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">
                    Total Value
                  </span>
                  <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                    ₹{totalDisbursed.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {invalidRows.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>{invalidRows.length} row(s)</strong> have validation errors and will be skipped.
                  </span>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Brand</th>
                      <th className="px-3 py-2">Series</th>
                      <th className="px-3 py-2 text-right">Amount (₹)</th>
                      <th className="px-3 py-2 text-right">Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr
                        key={i}
                        className={
                          r.isValid
                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            : 'bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                        }
                      >
                        <td className="px-3 py-1.5">
                          {r.isValid ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              VALID
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                              INVALID
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                          {r.product_name || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.brand_name}</td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.series_name}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-slate-800 dark:text-slate-200">
                          ₹{r.coupon_amount}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">{r.coupons_used}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 10 && (
                  <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    ...and {parsedRows.length - 10} more rows
                  </div>
                )}
              </div>

              {/* Upload Mode Option */}
              <div className="pt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Replace existing coupon records with this uploaded file</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setParsedRows([]);
              setUploadError(null);
            }}
            disabled={!file}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear File
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUploadSubmit}
              disabled={validRows.length === 0 || isProcessing}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {isProcessing ? 'Importing Data...' : `Import ${validRows.length} Coupon Record(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
