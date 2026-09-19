import React, { useState } from 'react';
import {
  FileText,
  ShoppingBag,
  ShoppingCart,
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Building2,
} from 'lucide-react';
import { TallyVoucher } from '../../../types';
import { api } from '../../../lib/api';

interface VouchersSyncPanelProps {
  onRefresh: () => void;
}

export const VouchersSyncPanel: React.FC<VouchersSyncPanelProps> = ({ onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Demo / local voucher list
  const [vouchers, setVouchers] = useState<TallyVoucher[]>([
    {
      id: 'vch-101',
      tally_guid: 'vch-guid-101',
      voucher_number: 'INV-2026-088',
      voucher_type: 'Sales',
      normalized_type: 'SALES_INVOICE',
      date: new Date().toISOString().slice(0, 10),
      party_name: 'Godrej Properties Ltd',
      party_ledger: 'Godrej Properties Ltd',
      reference_number: 'SO-1024',
      total_amount: 52500,
      status: 'POSTED',
      source_godown: 'Main Central Godown',
      items: [
        { id: 'vi-1', voucher_id: 'vch-101', stock_item_name: 'Angle Valve 1/2" Brass Chrome', sku: 'BF-AV-01', quantity: 30, unit: 'PCS', rate: 350, amount: 10500 },
        { id: 'vi-2', voucher_id: 'vch-101', stock_item_name: 'CPVC Pipe 1" SDR-11 (3 Meter)', sku: 'PP-CPVC-01', quantity: 40, unit: 'PCS', rate: 450, amount: 18000 },
        { id: 'vi-3', voucher_id: 'vch-101', stock_item_name: 'Industrial Switch 16A Modular', sku: 'EA-IS-01', quantity: 100, unit: 'Pieces', rate: 110, amount: 11000 },
      ],
      created_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      id: 'vch-102',
      tally_guid: 'vch-guid-102',
      voucher_number: 'PUR-2026-052',
      voucher_type: 'Purchase',
      normalized_type: 'PURCHASE_INVOICE',
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      party_name: 'Jaquar & Company Pvt Ltd',
      party_ledger: 'Jaquar & Company Pvt Ltd',
      reference_number: 'PO-APEX-9921',
      supplier_invoice_number: 'JAQ/INV/9932',
      total_amount: 50000,
      status: 'POSTED',
      destination_godown: 'Main Central Godown',
      items: [
        { id: 'vi-4', voucher_id: 'vch-102', stock_item_name: 'Angle Valve 1/2" Brass Chrome', sku: 'BF-AV-01', quantity: 100, unit: 'PCS', rate: 290, amount: 29000 },
        { id: 'vi-5', voucher_id: 'vch-102', stock_item_name: 'Bib Cock Long Body Brass', sku: 'BF-BB-02', quantity: 50, unit: 'Pieces', rate: 420, amount: 21000 },
      ],
      created_at: new Date(Date.now() - 86400000).toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      id: 'vch-103',
      tally_guid: 'vch-guid-103',
      voucher_number: 'STK-TR-019',
      voucher_type: 'Stock Journal',
      normalized_type: 'STOCK_JOURNAL',
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      party_name: 'Internal Transfer',
      reference_number: 'TR-WH-04',
      total_amount: 10200,
      status: 'POSTED',
      source_godown: 'Main Central Godown',
      destination_godown: 'Warehouse B - Dispatch Depot',
      items: [
        { id: 'vi-6', voucher_id: 'vch-103', stock_item_name: 'UPVC Ball Valve 1.5" Threaded', sku: 'PP-UPVC-02', quantity: 20, unit: 'Pieces', rate: 510, amount: 10200 },
      ],
      created_at: new Date(Date.now() - 86400000).toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      id: 'vch-104',
      tally_guid: 'vch-guid-104',
      voucher_number: 'CN-2026-004',
      voucher_type: 'Credit Note',
      normalized_type: 'SALES_RETURN',
      date: new Date().toISOString().slice(0, 10),
      party_name: 'Godrej Properties Ltd',
      reference_number: 'RET-GD-02',
      total_amount: 4500,
      status: 'POSTED',
      source_godown: 'Main Central Godown',
      items: [
        { id: 'vi-7', voucher_id: 'vch-104', stock_item_name: 'CPVC Pipe 1" SDR-11 (3 Meter)', sku: 'PP-CPVC-01', quantity: 10, unit: 'PCS', rate: 450, amount: 4500 },
      ],
      created_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
  ]);

  const handleSyncVouchers = async (type: 'ALL' | 'SALES' | 'PURCHASES' | 'JOURNALS') => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      let res;
      if (type === 'SALES') res = await api.syncTallySales();
      else if (type === 'PURCHASES') res = await api.syncTallyPurchases();
      else if (type === 'JOURNALS') res = await api.syncTallyStockTransactions();
      else res = await api.syncTallySales();

      setSyncFeedback({ success: true, message: res.message || `Successfully synced ${type.toLowerCase()} from Tally` });
      onRefresh();
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback({ success: false, message: err.message || 'Voucher sync failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredVouchers = vouchers.filter((v) => {
    const matchesSearch =
      v.voucher_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.party_name && v.party_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.reference_number && v.reference_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      v.items.some((item) => item.stock_item_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'SALES' && (v.normalized_type === 'SALES_INVOICE' || v.normalized_type === 'SALES_ORDER')) ||
      (typeFilter === 'PURCHASES' && v.normalized_type === 'PURCHASE_INVOICE') ||
      (typeFilter === 'RETURNS' && (v.normalized_type === 'SALES_RETURN' || v.normalized_type === 'PURCHASE_RETURN')) ||
      (typeFilter === 'JOURNALS' && v.normalized_type === 'STOCK_JOURNAL');

    return matchesSearch && matchesType;
  });

  const getVoucherBadge = (type: string, normType: string) => {
    if (normType === 'SALES_INVOICE' || normType === 'SALES_ORDER') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <ArrowUpRight className="w-3 h-3" />
          <span>{type}</span>
        </span>
      );
    }
    if (normType === 'PURCHASE_INVOICE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <ArrowDownLeft className="w-3 h-3" />
          <span>{type}</span>
        </span>
      );
    }
    if (normType === 'SALES_RETURN' || normType === 'PURCHASE_RETURN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <RotateCcw className="w-3 h-3" />
          <span>{type}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
        <RefreshCw className="w-3 h-3" />
        <span>{type}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Multi-sync controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Tally Vouchers & Transaction Synchronization</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synchronize Sales Invoices, Purchase Bills, Debit/Credit Note Returns, and Inter-Godown Stock Transfer Journals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSyncVouchers('SALES')}
              disabled={isSyncing}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Sync Sales</span>
            </button>

            <button
              onClick={() => handleSyncVouchers('PURCHASES')}
              disabled={isSyncing}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Sync Purchases</span>
            </button>

            <button
              onClick={() => handleSyncVouchers('ALL')}
              disabled={isSyncing}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync All Vouchers</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {syncFeedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              syncFeedback.success
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            {syncFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Vouchers Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search voucher number, party, or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Voucher Types</option>
              <option value="SALES">Sales Invoices & Orders</option>
              <option value="PURCHASES">Purchase Invoices</option>
              <option value="RETURNS">Sales & Purchase Returns</option>
              <option value="JOURNALS">Stock Journals</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              <tr>
                <th className="w-10 py-3 px-3"></th>
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Party / Counterparty</th>
                <th className="py-3 px-4">Ref Number</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total Value</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredVouchers.map((v) => {
                const isExpanded = expandedVoucherId === v.id;
                return (
                  <React.Fragment key={v.id}>
                    <tr
                      onClick={() => setExpandedVoucherId(isExpanded ? null : v.id)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-slate-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {v.voucher_number}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">{v.date}</td>
                      <td className="py-3 px-4">{getVoucherBadge(v.voucher_type, v.normalized_type)}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{v.party_name || 'General Party'}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">{v.reference_number || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {v.items.length} line items
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        ₹{v.total_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          {v.status}
                        </span>
                      </td>
                    </tr>

                    {/* Expandable Line Items */}
                    {isExpanded && (
                      <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                        <td colSpan={9} className="p-4">
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                            <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                Line Item Inventory Allocation Breakdown
                              </span>
                              <span className="text-slate-400">Tally GUID: {v.tally_guid}</span>
                            </div>

                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                                  <th className="py-1.5 font-medium">Stock Item Name</th>
                                  <th className="py-1.5 font-medium">SKU</th>
                                  <th className="py-1.5 text-right font-medium">Quantity</th>
                                  <th className="py-1.5 text-center font-medium">Unit</th>
                                  <th className="py-1.5 text-right font-medium">Rate</th>
                                  <th className="py-1.5 text-right font-medium">Amount</th>
                                  <th className="py-1.5 text-right font-medium">Godown</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {v.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="py-2 font-medium text-slate-900 dark:text-slate-100">{item.stock_item_name}</td>
                                    <td className="py-2 font-mono text-slate-400">{item.sku || '—'}</td>
                                    <td className="py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{item.quantity}</td>
                                    <td className="py-2 text-center text-slate-500 dark:text-slate-400">{item.unit}</td>
                                    <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                      ₹{item.rate.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                                      ₹{item.amount.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-2 text-right text-slate-500 dark:text-slate-400 font-mono">
                                      {item.godown_name || 'Main Central Godown'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
