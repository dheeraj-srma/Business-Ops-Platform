import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Sliders,
  RefreshCw,
  Info,
  ShieldCheck,
  Save,
  ArrowRight,
} from 'lucide-react';
import { VoucherMappingRule } from '../../../types';
import { api } from '../../../lib/api';

interface VoucherRulesPanelProps {
  rules: VoucherMappingRule[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const VoucherRulesPanel: React.FC<VoucherRulesPanelProps> = ({
  rules,
  isLoading,
  onRefresh,
}) => {
  const [localRules, setLocalRules] = useState<VoucherMappingRule[]>(rules);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Sync if props update
  React.useEffect(() => {
    setLocalRules(rules);
  }, [rules]);

  const handleToggle = (id: string) => {
    setLocalRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_enabled: !r.is_enabled } : r))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      await api.updateVoucherRules(localRules);
      setSaveFeedback('Voucher mapping rules saved successfully!');
      onRefresh();
    } catch (err: any) {
      setSaveFeedback(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveFeedback(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Tally Voucher Synchronization & Allocation Rules</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configure how each incoming Tally voucher automatically translates into inventory actions (Reservations, Direct Issues, Receipts, or Audit Adjustments).
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving Rules...' : 'Save Rule Changes'}</span>
          </button>
        </div>

        {saveFeedback && (
          <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{saveFeedback}</span>
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs divide-y divide-slate-100 dark:divide-slate-700/60">
        {localRules.map((rule) => {
          const actionBadgeColor =
            rule.inventory_action === 'RESERVE_STOCK'
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              : rule.inventory_action === 'INCREASE_STOCK'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';

          return (
            <div key={rule.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{rule.tally_voucher_type}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${actionBadgeColor}`}>
                    {rule.inventory_action.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rule.description}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.is_enabled}
                    onChange={() => handleToggle(rule.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 min-w-[55px]">
                  {rule.is_enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
