import React, { useState } from 'react';
import {
  ArrowUpDown,
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  ArrowLeft,
  CheckCircle2,
  Layers,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Code,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Product, Category } from '../../types';
import { TallyImportPanel } from '../tally/sync/TallyImportPanel';
import { TallyExportView } from '../tally/TallyExportView';
import { cn } from '../../lib/utils';

interface DataExchangeViewProps {
  products: Product[];
  categories: Category[];
  initialMode?: 'import' | 'export';
  onRefreshAll?: () => void;
  onGoBack?: () => void;
}

export const DataExchangeView: React.FC<DataExchangeViewProps> = ({
  products,
  categories,
  initialMode = 'import',
  onRefreshAll,
  onGoBack,
}) => {
  const [activeMode, setActiveMode] = useState<'import' | 'export'>(initialMode);

  return (
    <div id="data-exchange-view" className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Top Hub Banner & Header */}
      <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          {onGoBack && (
            <button
              onClick={onGoBack}
              className="p-2 -ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400">
            <ArrowUpDown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Data Exchange Hub
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-mono">
                JSON • XML • EXCEL • CSV
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Bi-directional catalog data exchange, reconciliation, and TallyPrime synchronization.
            </p>
          </div>
        </div>

        {/* Global Hub Mode Segment Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 self-stretch md:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode('import')}
            className={cn(
              'flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer',
              activeMode === 'import'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import Catalog</span>
            <span className="px-1.5 py-0.2 text-[9px] rounded font-mono bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
              IN
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('export')}
            className={cn(
              'flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer',
              activeMode === 'export'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <Download className="w-4 h-4" />
            <span>Export Catalog</span>
            <span className="px-1.5 py-0.2 text-[9px] rounded font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
              OUT
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full">
        {activeMode === 'import' ? (
          <div className="space-y-4">
            {/* Previously Designed Import Module */}
            <TallyImportPanel
              products={products}
              onRefreshAll={onRefreshAll}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Enhanced Export Module with JSON, XML, Excel, CSV */}
            <TallyExportView
              products={products}
              categories={categories}
              onGoBack={undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
};
