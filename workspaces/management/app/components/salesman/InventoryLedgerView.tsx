'use client';

import React, { useState, useMemo } from 'react';
import { Package, Tag } from 'lucide-react';
import { InventoryItem } from '../../hooks/useRealtimeInventory';
import ProductSearchFilter from './ProductSearchFilter';

interface InventoryLedgerViewProps {
  inventory: InventoryItem[];
}

export default function InventoryLedgerView({ inventory }: InventoryLedgerViewProps) {
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('All');

  // Categories list
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach(i => {
      if (i.Category) cats.add(i.Category);
    });
    return Array.from(cats).sort();
  }, [inventory]);

  // Filtered inventory records
  const filteredLedger = useMemo(() => {
    return inventory.filter(item => {
      const itemName = item['Item Name'] || item.name || '';
      const itemSku = item.SKU || item.sku || '';
      const itemCat = item.Category || '';

      const matchSearch =
        !ledgerSearch ||
        itemName.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        itemSku.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        itemCat.toLowerCase().includes(ledgerSearch.toLowerCase());

      const matchCategory =
        ledgerCategoryFilter === 'All' || itemCat === ledgerCategoryFilter;

      return matchSearch && matchCategory;
    });
  }, [inventory, ledgerSearch, ledgerCategoryFilter]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-100">Live Master Inventory Ledger</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredLedger.length} SKUs Listed
          </span>
        </div>

        {/* Search & Filter Controls */}
        <div className="mt-4">
          <ProductSearchFilter
            searchQuery={ledgerSearch}
            onSearchChange={setLedgerSearch}
            selectedCategory={ledgerCategoryFilter}
            onCategoryChange={setLedgerCategoryFilter}
            categories={categoriesList}
          />
        </div>

        {/* Master Table */}
        <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden max-h-[520px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold sticky top-0 border-b border-slate-800 z-10">
              <tr>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Item Name</th>
                <th className="py-3 px-3 text-center">Current Stock</th>
                <th className="py-3 px-3 text-center">Available Stock</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No inventory records match filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((item, idx) => {
                  const sku = item.SKU || item.sku || `SKU-${idx}`;
                  const itemName = item['Item Name'] || item.name || 'Unnamed Product';
                  const category = item.Category || 'General';
                  const currentStock = Number(item['Current Stock'] ?? item.currentStock ?? 0);
                  const availStock = Number(item['Available Stock'] ?? item.availableStock ?? currentStock);

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                      In Stock
                    </span>
                  );

                  if (currentStock <= 0) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        Out of Stock
                      </span>
                    );
                  } else if (currentStock <= 5) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Critical ({currentStock})
                      </span>
                    );
                  }

                  return (
                    <tr key={sku + idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-indigo-700 dark:text-indigo-300 font-medium">{sku}</td>
                      <td className="py-2.5 px-3 text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-500" />
                        {category}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{itemName}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-300">{currentStock}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">{availStock}</td>
                      <td className="py-2.5 px-3 text-right">{statusBadge}</td>
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
}
