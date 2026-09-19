import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, FileSpreadsheet, FileCode, ArrowRight, X, PackageCheck, Download } from 'lucide-react';
import { ExportableConsignment, exportConsignmentToExcel, exportConsignmentToJson } from '../../lib/transactionExport';

interface TransactionCompletionPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  consignment: ExportableConsignment | null;
  onViewInLedger?: () => void;
}

export const TransactionCompletionPromptModal: React.FC<TransactionCompletionPromptModalProps> = ({
  isOpen,
  onClose,
  consignment,
  onViewInLedger,
}) => {
  if (!isOpen || !consignment) return null;

  const totalQuantity = consignment.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const isStockIn = consignment.type === 'STOCK_IN';
  const isReturn = consignment.type === 'CUSTOMER_RETURN' || consignment.type === 'RETURN';
  const isStockOut = consignment.type === 'STOCK_OUT';

  const handleDownloadExcel = () => {
    exportConsignmentToExcel(consignment);
  };

  const handleDownloadJson = () => {
    exportConsignmentToJson(consignment);
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-lg shrink-0 ${
              isReturn
                ? 'bg-purple-600 shadow-purple-600/25'
                : isStockIn
                ? 'bg-emerald-500 shadow-emerald-500/25'
                : 'bg-rose-500 shadow-rose-500/25'
            }`}>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {isReturn ? 'Customer Return Recorded!' : isStockIn ? 'Stock Inward Complete!' : 'Stock Outward Complete!'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Physical inventory balances have been updated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Consignment Quick Summary Card */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 dark:text-slate-500 font-medium">Invoice / Ref:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {consignment.referenceNumber}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 dark:text-slate-500 font-medium">
                {consignment.partyRole || (isReturn ? 'Customer' : isStockIn ? 'Supplier' : 'Party')}:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 max-w-[200px] truncate text-right">
                {consignment.partyName}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 dark:text-slate-500 font-medium">
                {isReturn ? 'Total Returned:' : isStockIn ? 'Total Inwarded:' : 'Total Dispatched:'}
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {consignment.items.length} {consignment.items.length === 1 ? 'item' : 'items'}
                </span>
                <span
                  className={`font-mono font-black text-sm ${
                    isReturn
                      ? 'text-purple-600 dark:text-purple-400'
                      : isStockIn
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isStockOut ? '-' : '+'}{totalQuantity.toLocaleString('en-IN')} units
                </span>
              </div>
            </div>
          </div>

          {/* Export Prompt Action Box */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Download Transaction Audit Document:
            </span>

            <div className="grid grid-cols-2 gap-3">
              {/* Excel Download Button */}
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="p-3.5 rounded-2xl border-2 border-emerald-500/30 hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-all flex flex-col items-center justify-center gap-2 text-center group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Download Excel</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Spreadsheet (.xlsx)</span>
                </div>
              </button>

              {/* JSON Download Button */}
              <button
                type="button"
                onClick={handleDownloadJson}
                className="p-3.5 rounded-2xl border-2 border-indigo-500/30 hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-all flex flex-col items-center justify-center gap-2 text-center group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25 group-hover:scale-110 transition-transform">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Download JSON</span>
                  <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium">Raw Data (.json)</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {onViewInLedger ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewInLedger();
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View in Transaction Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
