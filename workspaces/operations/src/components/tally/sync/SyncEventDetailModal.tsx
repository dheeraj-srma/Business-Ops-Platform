import React from 'react';
import { X, CheckCircle, AlertCircle, RefreshCw, Clock, ArrowRight, ShieldCheck, FileText, Ban } from 'lucide-react';
import { SyncEvent } from '../../../types';

interface SyncEventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SyncEvent | null;
  onRetry?: (id: string) => void;
  onIgnore?: (id: string) => void;
  isRetrying?: boolean;
}

export const SyncEventDetailModal: React.FC<SyncEventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  onRetry,
  onIgnore,
  isRetrying = false,
}) => {
  if (!isOpen || !event) return null;

  const isFailed = event.status === 'FAILED';
  const isSynced = event.status === 'SYNCED';
  const isRetryingStatus = event.status === 'RETRYING' || event.status === 'PROCESSING';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                isSynced
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : isFailed
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Tally Voucher: {event.external_transaction_id}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isSynced
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : isFailed
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {event.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Type: <span className="font-semibold text-slate-700 dark:text-slate-300">{event.external_transaction_type.replace('_', ' ')}</span> &bull; Action: <span className="font-semibold text-slate-700 dark:text-slate-300">{event.event_type}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Status & Failure Banner if any */}
          {event.last_error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-900 dark:text-rose-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Synchronization Error</h4>
                  <p className="mt-0.5 font-mono text-[11px] text-rose-800 dark:text-rose-300">{event.last_error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Key Event Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 dark:bg-slate-900/50 p-3.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Received At</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold">{new Date(event.received_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Processed At</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold">
                {event.processed_at ? new Date(event.processed_at).toLocaleString() : 'Pending'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Retry Count</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold">{event.retry_count} / {event.max_retries}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Payload Hash (Idempotent)</span>
              <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate block" title={event.payload_hash}>
                {event.payload_hash.slice(0, 12)}...
              </span>
            </div>
          </div>

          {/* Normalized Items / Allocation Table */}
          {event.normalized_data && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Voucher Line Items ({event.normalized_data.items?.length || 0})</span>
                {event.normalized_data.party_name && (
                  <span className="text-slate-500 dark:text-slate-400 font-normal normal-case">
                    Party: <strong className="text-slate-800 dark:text-slate-200">{event.normalized_data.party_name}</strong>
                  </span>
                )}
              </h4>

              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-900/60 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2">Tally Stock Item</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Unit Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium text-slate-800 dark:text-slate-200">
                    {event.normalized_data.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.item_name}</div>
                          {item.item_id && <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">ID: {item.item_id}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                          {item.quantity} {item.unit || 'Units'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-400">
                          ₹{Number(item.rate || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                          ₹{Number(item.amount || (item.quantity * item.rate) || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Raw Payload Inspector */}
          {event.raw_payload && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Raw Tally XML / JSON Payload
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {event.raw_payload.startsWith('<') ? 'XML Envelope' : 'JSON'}
                </span>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed border border-slate-800">
                {event.raw_payload}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {isFailed && onIgnore && (
              <button
                onClick={() => onIgnore(event.id)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Ignore Event
              </button>
            )}

            {isFailed && onRetry && (
              <button
                onClick={() => onRetry(event.id)}
                disabled={isRetrying}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Retry Synchronization'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
