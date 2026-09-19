import React, { useState } from 'react';
import {
  Boxes,
  Layers,
  Warehouse,
  Scale,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Product, TallyStockGroup, TallyUnit, TallyGodown } from '../../../types';
import { api } from '../../../lib/api';

interface InventoryMastersPanelProps {
  products: Product[];
  onRefresh: () => void;
}

export const InventoryMastersPanel: React.FC<InventoryMastersPanelProps> = ({ products, onRefresh }) => {
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'groups' | 'units' | 'godowns'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Derive unique stock groups from products
  const stockGroups = Array.from(new Set(products.map((p) => p.stock_group || p.category_name || 'General'))).filter(Boolean);
  const godowns = [
    { id: 'gdn-1', name: 'Main Central Godown', address: 'Warehouse Block A, Sector 18, Gurgaon', is_primary: true, itemCount: 24, totalValue: 385000 },
    { id: 'gdn-2', name: 'Warehouse B - Dispatch Depot', address: 'Transport Nagar, Delhi Bypass', is_primary: false, itemCount: 12, totalValue: 145000 },
  ];
  const units = [
    { symbol: 'PCS', formalName: 'Pieces', decimalPlaces: 0, count: products.filter((p) => p.unit?.toLowerCase().includes('pc') || p.unit?.toLowerCase().includes('piece')).length },
    { symbol: 'MTR', formalName: 'Meters', decimalPlaces: 2, count: products.filter((p) => p.unit?.toLowerCase().includes('mtr') || p.unit?.toLowerCase().includes('meter')).length },
    { symbol: 'KGS', formalName: 'Kilograms', decimalPlaces: 2, count: products.filter((p) => p.unit?.toLowerCase().includes('kg')).length },
    { symbol: 'NOS', formalName: 'Numbers', decimalPlaces: 0, count: products.filter((p) => p.unit?.toLowerCase().includes('no')).length },
    { symbol: 'BOX', formalName: 'Boxes (100 Pcs)', decimalPlaces: 0, count: products.filter((p) => p.unit?.toLowerCase().includes('box')).length },
  ];

  const handleSyncInventory = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await api.syncTallyInventory();
      setSyncFeedback({ success: true, message: res.message });
      onRefresh();
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback({ success: false, message: err.message || 'Failed to synchronize inventory masters' });
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.stock_group && p.stock_group.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGroup = selectedGroup === 'ALL' || (p.stock_group || p.category_name) === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const totalInventoryValue = products.reduce((sum, p) => sum + p.current_stock * (p.unit_cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Trigger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Tally Inventory Masters Synchronization</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synchronize Stock Items, Stock Groups, Units of Measurement, and Multi-Godown Warehouse locations from TallyPrime.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncInventory}
              disabled={isSyncing}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing Masters...' : 'Sync Masters from Tally'}</span>
            </button>
          </div>
        </div>

        {/* Sync Toast Feedback */}
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

        {/* Metric Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Stock Items</span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{products.length}</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Stock Groups</span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{stockGroups.length}</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Active Godowns</span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{godowns.length}</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Stock Value</span>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              ₹{totalInventoryValue.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveSubTab('items')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'items'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Stock Items ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('groups')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'groups'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Stock Groups ({stockGroups.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('units')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'units'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Units of Measure ({units.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('godowns')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'godowns'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Warehouse className="w-3.5 h-3.5" />
          <span>Godowns / Warehouses ({godowns.length})</span>
        </button>
      </div>

      {/* Sub Tab 1: Stock Items Table */}
      {activeSubTab === 'items' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search stock item by name, SKU, or group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Group:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Stock Groups</option>
                {stockGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Item Name / SKU</th>
                  <th className="py-3 px-4">Stock Group</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-right">Standard Cost</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-right">Physical Stock</th>
                  <th className="py-3 px-4 text-right">Stock Value</th>
                  <th className="py-3 px-4 text-center">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredProducts.map((p) => {
                  const stockValue = p.current_stock * (p.unit_cost || 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.sku}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {p.stock_group || p.category_name || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600 dark:text-slate-400">{p.unit || 'PCS'}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        ₹{(p.unit_cost || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100 font-semibold">
                        ₹{((p as any).standard_selling_price || Math.round((p.unit_cost || 100) * 1.25)).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-semibold font-mono ${
                            p.current_stock <= 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : p.current_stock <= (p.critical_stock || 5)
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {p.current_stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                        ₹{stockValue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {(p as any).valuation_method || 'Avg Cost'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab 2: Stock Groups */}
      {activeSubTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stockGroups.map((g) => {
            const count = products.filter((p) => (p.stock_group || p.category_name) === g).length;
            const val = products
              .filter((p) => (p.stock_group || p.category_name) === g)
              .reduce((sum, p) => sum + p.current_stock * (p.unit_cost || 0), 0);

            return (
              <div key={g} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                    Active
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-3">{g}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Tally Parent: Primary &gt; {g}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{count} Items</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">₹{val.toLocaleString('en-IN')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub Tab 3: Units of Measure */}
      {activeSubTab === 'units' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((u) => (
            <div key={u.symbol} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  {u.symbol}
                </span>
                <span className="text-xs text-slate-400">Decimals: {u.decimalPlaces}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-3">{u.formalName}</h3>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                Assigned across <strong className="text-slate-900 dark:text-slate-100">{u.count}</strong> catalog products
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sub Tab 4: Godowns */}
      {activeSubTab === 'godowns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {godowns.map((g) => (
            <div key={g.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{g.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{g.address}</p>
                </div>
                {g.is_primary && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full">
                    Primary
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Stock Items Stored</span>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">{g.itemCount}</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Warehouse Valuation</span>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ₹{g.totalValue.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
