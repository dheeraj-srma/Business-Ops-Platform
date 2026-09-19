import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  FileText,
  ChevronRight,
  ArrowUpDown,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { SyncEvent, SyncEventStatus, ExternalTransactionType } from '../../../types';
import { SyncEventDetailModal } from './SyncEventDetailModal';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useDialog } from '../../../context/DialogContext';

interface TallyEventLedgerProps {
  events: SyncEvent[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const TallyEventLedger: React.FC<TallyEventLedgerProps> = ({
  events,
  isLoading,
  onRefresh,
}) => {
  const { showConfirm, showSuccess, showError } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

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

  const [selectedEvent, setSelectedEvent] = useState<SyncEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [retryingEventId, setRetryingEventId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Filtered list
  const filteredEvents = events.filter((e) => {
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && e.external_transaction_type !== typeFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchesId = e.external_transaction_id.toLowerCase().includes(q);
      const matchesParty = e.normalized_data?.party_name?.toLowerCase().includes(q);
      const matchesError = e.last_error?.toLowerCase().includes(q);
      if (!matchesId && !matchesParty && !matchesError) return false;
    }
    return true;
  });

  const failedCount = events.filter((e) => e.status === 'FAILED').length;

  const handleOpenDetail = (event: SyncEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  const handleRetry = async (id: string) => {
    setRetryingEventId(id);
    setActionFeedback(null);
    try {
      const res = await api.retrySyncEvent(id);
      if (res.success) {
        setActionFeedback(`Event ${res.event.external_transaction_id} synchronized successfully.`);
        if (selectedEvent?.id === id) {
          setSelectedEvent(res.event);
        }
      } else {
        setActionFeedback(`Retry failed: ${res.event?.last_error || 'Unknown error'}`);
      }
      onRefresh();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setRetryingEventId(null);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const handleIgnore = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Ignore Sync Event?',
      message:
        'Are you sure you want to mark this sync event as ignored? It will be excluded from automated retries.',
      confirmText: 'Yes, Ignore Event',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await api.ignoreSyncEvent(id);
      setIsDetailModalOpen(false);
      onRefresh();
      showSuccess({
        title: 'Event Ignored',
        message: 'The selected sync event was marked as IGNORED.',
      });
    } catch (err: any) {
      showError({
        title: 'Action Failed',
        message: `Failed to ignore sync event: ${err.message}`,
      });
    }
  };

  const handleRetryAllFailed = async () => {
    const failedCount = events.filter((e) => e.status === 'FAILED').length;
    const confirmed = await showConfirm({
      title: 'Retry All Failed Events?',
      message: `Are you sure you want to re-queue and retry all ${failedCount || 'queued'} failed sync events?`,
      confirmText: 'Retry Events',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    setIsRetryingAll(true);
    setActionFeedback(null);
    try {
      const res = await api.retryAllFailedSyncEvents();
      setActionFeedback(
        `Bulk Retry Complete: ${res.succeeded} succeeded, ${res.failed} failed out of ${res.total} queued events.`
      );
      onRefresh();
      showSuccess({
        title: 'Bulk Retry Complete',
        message: `${res.succeeded} succeeded, ${res.failed} failed out of ${res.total} queued events.`,
      });
    } catch (err: any) {
      setActionFeedback(`Bulk retry error: ${err.message}`);
      showError({
        title: 'Retry Failed',
        message: `Bulk retry error: ${err.message}`,
      });
    } finally {
      setIsRetryingAll(false);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Voucher #, Party Name, or Error Message..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Statuses ({events.length})</option>
              <option value="SYNCED">Synced</option>
              <option value="FAILED">Failed ({failedCount})</option>
              <option value="RETRYING">Retrying</option>
              <option value="PENDING">Pending</option>
              <option value="IGNORED">Ignored</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Voucher Types</option>
              <option value="SALES_ORDER">Sales Order</option>
              <option value="SALES_INVOICE">Sales Invoice</option>
              <option value="DELIVERY_NOTE">Delivery Note</option>
              <option value="PURCHASE_INVOICE">Purchase Invoice</option>
              <option value="PURCHASE_RETURN">Purchase Return</option>
              <option value="SALES_RETURN">Sales Return</option>
              <option value="STOCK_JOURNAL">Stock Journal</option>
            </select>

            {failedCount > 0 && (
              <button
                onClick={handleRetryAllFailed}
                disabled={isRetryingAll}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRetryingAll ? 'animate-spin' : ''}`} />
                {isRetryingAll ? 'Retrying Failed...' : `Retry All Failed (${failedCount})`}
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Event Ledger"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Action feedback toast banner */}
        {actionFeedback && (
          <div className="mt-3 p-2.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}
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

      {/* Events Table */}
      <div
        className={cn(
          'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs transition-all',
          isFullScreen
            ? 'fixed inset-2 sm:inset-3 md:inset-4 lg:inset-5 z-50 flex flex-col shadow-2xl border-slate-300 dark:border-slate-600 rounded-2xl animate-in zoom-in-95 duration-200'
            : ''
        )}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                Tally Synchronization Event Log
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
              </span>
              {isFullScreen && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5" />
                  <span>Full Screen Expanded</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
              Live incoming transactional XML payload events and state reconciliations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-tally-events-fullscreen"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs',
                isFullScreen
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
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
          <table className={cn('w-full text-left text-xs', isFullScreen ? 'min-w-full' : 'min-w-[840px]')}>
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="px-4 py-3 min-w-[200px]">Voucher # / Type</th>
                <th className="px-4 py-3 min-w-[180px]">Party Name</th>
                <th className="px-4 py-3 w-[150px] min-w-[150px]">Line Items / Qty</th>
                <th className="px-4 py-3 w-[140px] min-w-[140px]">Received Time</th>
                <th className="px-4 py-3 w-[120px] min-w-[120px]">Status</th>
                <th className="px-4 py-3 w-[120px] min-w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium text-slate-700 dark:text-slate-300">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    No synchronization events found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const isSynced = event.status === 'SYNCED';
                  const isFailed = event.status === 'FAILED';
                  const isRetrying = event.status === 'RETRYING' || event.status === 'PROCESSING';
                  const isIgnored = event.status === 'IGNORED';

                  const itemCount = event.normalized_data?.items?.length || 0;
                  const totalQty =
                    event.normalized_data?.items?.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0) ||
                    0;

                  return (
                    <tr key={event.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                      {/* Voucher ID & Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{event.external_transaction_id}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-semibold">
                            {event.external_transaction_type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            {event.payload_hash.slice(0, 8)}
                          </span>
                        </div>
                      </td>

                      {/* Party Name */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {event.normalized_data?.party_name || 'General / Stock Transfer'}
                        </span>
                        {event.normalized_data?.voucher_date && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            Date: {event.normalized_data.voucher_date}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{totalQty} units</span>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {itemCount} line item{itemCount !== 1 ? 's' : ''}
                        </div>
                      </td>

                      {/* Received Time */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        <div>{new Date(event.received_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(event.received_at).toLocaleTimeString()}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isSynced
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isFailed
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : isRetrying
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isSynced && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                          {isFailed && <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                          {isRetrying && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                          {isIgnored && <Ban className="w-3 h-3 text-slate-500 dark:text-slate-400" />}
                          <span>{event.status}</span>
                        </span>

                        {isFailed && event.last_error && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 max-w-xs truncate mt-0.5" title={event.last_error}>
                            {event.last_error}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isFailed && (
                            <button
                              onClick={() => handleRetry(event.id)}
                              disabled={retryingEventId === event.id}
                              title="Retry processing this voucher"
                              className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  retryingEventId === event.id ? 'animate-spin' : ''
                                }`}
                              />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenDetail(event)}
                            title="Inspect Details & Payload"
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Detail Modal */}
      <SyncEventDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        event={selectedEvent}
        onRetry={handleRetry}
        onIgnore={handleIgnore}
        isRetrying={Boolean(retryingEventId && selectedEvent?.id === retryingEventId)}
      />
    </div>
  );
};
