import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Clock,
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { StockReservation, ReservationStatus } from '../../../types';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useDialog } from '../../../context/DialogContext';

interface StockReservationsPanelProps {
  reservations: StockReservation[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const StockReservationsPanel: React.FC<StockReservationsPanelProps> = ({
  reservations,
  isLoading,
  onRefresh,
}) => {
  const { showConfirm, showWarning } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
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

  const filteredReservations = reservations.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchProd = r.product_name.toLowerCase().includes(q) || r.product_sku.toLowerCase().includes(q);
      const matchOrder = r.external_order_id.toLowerCase().includes(q);
      const matchCust = r.customer_name?.toLowerCase().includes(q);
      if (!matchProd && !matchOrder && !matchCust) return false;
    }
    return true;
  });

  const activeCount = reservations.filter((r) => r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED').length;
  const totalReservedUnits = reservations
    .filter((r) => r.status === 'ACTIVE' || r.status === 'PARTIALLY_FULFILLED')
    .reduce((sum, r) => sum + (r.reserved_quantity - r.fulfilled_quantity), 0);

  const handleReleaseReservation = async (id: string, orderId: string) => {
    const confirmed = await showConfirm({
      title: 'Release Stock Reservation',
      message: `Are you sure you want to release the reserved stock for Order ${orderId}? This un-reserves the items and returns them to Available Stock.`,
      confirmText: 'Yes, Release Stock',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) {
      return;
    }

    setReleasingId(id);
    setActionFeedback(null);
    try {
      await api.releaseStockReservation(id);
      setActionFeedback(`Reservation for ${orderId} released successfully.`);
      onRefresh();
    } catch (err: any) {
      setActionFeedback(`Error releasing reservation: ${err.message}`);
    } finally {
      setReleasingId(null);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Active Reservations
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{activeCount} Orders</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Total Locked Stock
              </span>
              <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300">{totalReservedUnits.toLocaleString()} Units</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Inventory Formula
              </span>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Available = Physical - Reserved</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Product Name, SKU, Order ID, Customer..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="ACTIVE">Active & Partial ({activeCount})</option>
              <option value="ALL">All Reservations ({reservations.length})</option>
              <option value="FULFILLED">Fulfilled (Invoiced / Dispatched)</option>
              <option value="RELEASED">Released Manually</option>
              <option value="CANCELLED">Cancelled in Tally</option>
            </select>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Reservations"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {actionFeedback && (
          <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
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

      {/* Reservations Table */}
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
                Active Stock Allocations & Orders
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                {filteredReservations.length} {filteredReservations.length === 1 ? 'reservation' : 'reservations'}
              </span>
              {isFullScreen && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5" />
                  <span>Full Screen Expanded</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
              Hard-locked physical quantities preventing overselling during active sales order fulfillment
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-reservations-fullscreen"
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
          <table className={cn('w-full text-left text-xs', isFullScreen ? 'min-w-full' : 'min-w-[900px]')}>
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="px-4 py-3 min-w-[180px]">Order / Customer</th>
                <th className="px-4 py-3 min-w-[200px]">Product Name & SKU</th>
                <th className="px-4 py-3 w-[110px] min-w-[110px] text-right">Reserved Qty</th>
                <th className="px-4 py-3 w-[100px] min-w-[100px] text-right">Fulfilled</th>
                <th className="px-4 py-3 w-[130px] min-w-[130px] text-right">Remaining Locked</th>
                <th className="px-4 py-3 w-[130px] min-w-[130px]">Created Date</th>
                <th className="px-4 py-3 w-[120px] min-w-[120px]">Status</th>
                <th className="px-4 py-3 w-[120px] min-w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium text-slate-700 dark:text-slate-300">
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    No stock reservations match the current filter.
                  </td>
                </tr>
              ) : (
                filteredReservations.map((resv) => {
                  const unfulfilled = Math.max(0, resv.reserved_quantity - resv.fulfilled_quantity);
                  const isActive = resv.status === 'ACTIVE' || resv.status === 'PARTIALLY_FULFILLED';
                  const isFulfilled = resv.status === 'FULFILLED';
                  const isReleased = resv.status === 'RELEASED';

                  return (
                    <tr key={resv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                      {/* Order & Customer */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{resv.external_order_id}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{resv.customer_name || 'Direct Customer'}</div>
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 leading-snug">{resv.product_name}</div>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold whitespace-nowrap bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900/50 inline-block mt-0.5">
                          SKU: {resv.product_sku}
                        </span>
                      </td>

                      {/* Reserved Quantity */}
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {resv.reserved_quantity}
                      </td>

                      {/* Fulfilled Quantity */}
                      <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                        {resv.fulfilled_quantity}
                      </td>

                      {/* Remaining Locked */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-bold ${
                            unfulfilled > 0 ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {unfulfilled}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        <div>{new Date(resv.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(resv.created_at).toLocaleTimeString()}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isActive
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : isFulfilled
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isReleased
                              ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {isActive && <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                          {isFulfilled && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                          {isReleased && <Unlock className="w-3 h-3 text-slate-500 dark:text-slate-400" />}
                          <span>{resv.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {isActive && (
                          <button
                            onClick={() => handleReleaseReservation(resv.id, resv.external_order_id)}
                            disabled={releasingId === resv.id}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:text-white dark:hover:text-white bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 dark:hover:bg-rose-600 border border-rose-200 dark:border-rose-800 rounded-md transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>{releasingId === resv.id ? 'Releasing...' : 'Release'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
