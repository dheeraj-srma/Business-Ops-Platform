'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileSpreadsheet,
  FileCode,
  FileText,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ExportableConsignment,
  exportConsignmentToCsv,
  exportConsignmentToExcel,
  exportConsignmentToPdf,
  exportConsignmentToJson,
} from '../../lib/transactionExport';
import { cn } from '../../lib/utils';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  consignment: ExportableConsignment | null;
  onOpenProductDetail?: (productId: string) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  consignment,
  onOpenProductDetail,
}) => {
  if (!isOpen || !consignment) return null;

  const isStockIn = consignment.type === 'STOCK_IN';
  const isStockOut = consignment.type === 'STOCK_OUT';
  const totalQuantity = consignment.items.reduce((sum, it) => sum + (it.quantity || 0), 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] cursor-default animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center shadow-md shrink-0',
                isStockIn && 'bg-cyan-600 text-white shadow-cyan-600/20',
                isStockOut && 'bg-amber-600 text-white shadow-amber-600/20',
                !isStockIn && !isStockOut && 'bg-blue-600 text-white shadow-blue-600/20'
              )}
            >
              {isStockIn && <ArrowDownLeft className="w-5 h-5" />}
              {isStockOut && <ArrowUpRight className="w-5 h-5" />}
              {!isStockIn && !isStockOut && <SlidersHorizontal className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isStockIn ? 'Stock Inward Consignment' : isStockOut ? 'Outward Dispatch Note' : 'Stock Adjustment'}
                </h3>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                    isStockIn && 'bg-cyan-50 dark:bg-indigo-50 dark:bg-indigo-950/80 text-cyan-700 dark:text-indigo-700 dark:text-indigo-300 border border-cyan-200 dark:border-cyan-800',
                    isStockOut && 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
                    !isStockIn && !isStockOut && 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  )}
                >
                  {consignment.type.replace('_', ' ')}
                </span>
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {consignment.referenceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Audit record created on {new Date(consignment.date).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar: 4 Export Options */}
        <div className="px-5 sm:px-6 py-3 bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Export Document:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* CSV */}
            <button
              type="button"
              onClick={() => exportConsignmentToCsv(consignment)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              title="Download Comma Separated Values (.csv)"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>

            {/* Excel */}
            <button
              type="button"
              onClick={() => exportConsignmentToExcel(consignment)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-indigo-700 dark:text-indigo-300 border border-cyan-200 dark:border-cyan-800/80 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              title="Download Excel Spreadsheet (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-600 dark:text-indigo-600 dark:text-indigo-400" />
              <span>Excel (.xlsx)</span>
            </button>

            {/* PDF */}
            <button
              type="button"
              onClick={() => exportConsignmentToPdf(consignment)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              title="Download Printable PDF Note (.pdf)"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>PDF Note</span>
            </button>

            {/* JSON */}
            <button
              type="button"
              onClick={() => exportConsignmentToJson(consignment)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              title="Download Raw Data JSON (.json)"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-white dark:bg-slate-900">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {consignment.partyRole || (isStockIn ? 'Supplier / Vendor' : 'Customer / Salesman')}
              </span>
              <span className="font-bold text-sm text-slate-900 dark:text-white mt-1 block truncate">
                {consignment.partyName}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Logged By Staff
              </span>
              <span className="font-bold text-sm text-slate-900 dark:text-white mt-1 block">
                {consignment.loggedBy || 'Store Manager'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Total Volume Handled
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                  {consignment.items.length} {consignment.items.length === 1 ? 'item' : 'items'}
                </span>
                <span
                  className={cn(
                    'text-xs font-mono font-bold',
                    isStockIn ? 'text-cyan-600 dark:text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  ({isStockIn ? '+' : '-'}{totalQuantity.toLocaleString('en-IN')} units)
                </span>
              </div>
            </div>
          </div>

          {consignment.notes && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 mr-2">Remarks / Notes:</span>
              <span className="text-slate-600 dark:text-slate-400 italic">{consignment.notes}</span>
            </div>
          )}

          {/* Line Items Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Consignment Items ({consignment.items.length})
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Total Units: <strong className="text-slate-900 dark:text-white">{totalQuantity.toLocaleString('en-IN')}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100/60 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 w-10 text-center">#</th>
                    <th className="py-2.5 px-4">SKU / Code</th>
                    <th className="py-2.5 px-4">Product Name</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Prev Stock</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {consignment.items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {it.sku}
                      </td>
                      <td className="py-3 px-4">
                        <div
                          onClick={() => onOpenProductDetail && onOpenProductDetail(it.id)}
                          className={cn(
                            'font-semibold text-slate-900 dark:text-white',
                            onOpenProductDetail ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''
                          )}
                        >
                          {it.productName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {it.categoryName || 'General'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                        {it.previousStock !== undefined ? `${it.previousStock} ${it.unit}` : '-'}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 text-right font-mono font-black text-xs',
                          isStockIn ? 'text-cyan-600 dark:text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'
                        )}
                      >
                        {isStockIn ? '+' : '-'}{it.quantity} {it.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {it.newStock !== undefined ? `${it.newStock} ${it.unit}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
