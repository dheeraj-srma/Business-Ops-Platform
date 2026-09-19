'use client';

import React, { useMemo } from 'react';
import { ShoppingCart, FileDown, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { OrderRecord } from '../../hooks/useRealtimeInventory';
import { downloadOrderInvoice } from './salesmanPortalExport';

interface OrderHistoryTrackerProps {
  submittedOrders: OrderRecord[];
  selectedSalesman: string;
  defaultShop: string;
  salesmanId: string;
  locationId: string;
  city: string;
  state: string;
}

export default function OrderHistoryTracker({
  submittedOrders,
  selectedSalesman,
  defaultShop,
  salesmanId,
  locationId,
  city,
  state,
}: OrderHistoryTrackerProps) {
  // Group submitted orders by Order ID
  const groupedOrders = useMemo(() => {
    const myOrders = submittedOrders.filter(
      o => !selectedSalesman || o['Salesman Name']?.toLowerCase() === selectedSalesman.toLowerCase()
    );

    const groups: Record<string, OrderRecord[]> = {};
    myOrders.forEach(o => {
      const id = o['Order ID'] || 'ORD-000';
      if (!groups[id]) groups[id] = [];
      groups[id].push(o);
    });

    return Object.entries(groups)
      .map(([orderId, items]) => {
        const first = items[0];
        const totalItems = items.reduce((acc, curr) => acc + (Number(curr.Quantity || curr.Qty) || 1), 0);
        return {
          order_id: orderId,
          timestamp: first.Timestamp || '',
          shop: first['Shop Name'] || defaultShop || 'Direct',
          status: first.Status || 'Pending',
          total_items: totalItems,
          items,
        };
      })
      .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))
      .slice(0, 10);
  }, [submittedOrders, selectedSalesman, defaultShop]);

  const handleDownload = (orderId: string) => {
    downloadOrderInvoice(
      orderId,
      submittedOrders,
      selectedSalesman,
      defaultShop,
      salesmanId,
      locationId,
      city,
      state
    );
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <ShoppingCart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">My Submitted Orders History</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Showing Latest {groupedOrders.length} Orders
        </span>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Order ID</th>
              <th className="py-3 px-4">Customer / Shop</th>
              <th className="py-3 px-4 text-center">Items Count</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {groupedOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  No orders placed yet for this salesman.
                </td>
              </tr>
            ) : (
              groupedOrders.map(group => {
                const statusStr = String(group.status).toLowerCase();
                let statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Clock className="w-3 h-3" />
                    Pending Approval
                  </span>
                );

                if (statusStr === 'approved' || statusStr === 'fulfilled') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                      <CheckCircle2 className="w-3 h-3" />
                      Approved
                    </span>
                  );
                } else if (statusStr === 'rejected' || statusStr === 'cancelled') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      <XCircle className="w-3 h-3" />
                      {group.status}
                    </span>
                  );
                }

                return (
                  <tr key={group.order_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700 dark:text-indigo-300">{group.order_id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{group.shop}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">{group.total_items}</td>
                    <td className="py-3 px-4 text-center">{statusBadge}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDownload(group.order_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:text-cyan-200 border border-slate-700 transition-all cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Download PDF
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
