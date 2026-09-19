import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { TallyProductMapping, Product } from '../../../types';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useDialog } from '../../../context/DialogContext';

interface ProductMappingPanelProps {
  mappings: TallyProductMapping[];
  products: Product[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const ProductMappingPanel: React.FC<ProductMappingPanelProps> = ({
  mappings,
  products,
  isLoading,
  onRefresh,
}) => {
  const { showWarning, showConfirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<TallyProductMapping | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [tallyItemName, setTallyItemName] = useState('');
  const [tallyAlias, setTallyAlias] = useState('');
  const [tallyItemId, setTallyItemId] = useState('');

  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const filteredMappings = mappings.filter((m) => {
    if (statusFilter !== 'ALL' && m.mapping_status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTally = m.tally_stock_item_name.toLowerCase().includes(q);
      const matchProd = m.product_name.toLowerCase().includes(q) || m.product_sku.toLowerCase().includes(q);
      const matchAlias = m.tally_alias?.toLowerCase().includes(q);
      if (!matchTally && !matchProd && !matchAlias) return false;
    }
    return true;
  });

  const unmappedCount = mappings.filter((m) => m.mapping_status === 'UNMAPPED').length;
  const mappedCount = mappings.filter((m) => m.mapping_status === 'MAPPED').length;

  const handleOpenAdd = () => {
    setEditingMapping(null);
    setSelectedProductId(products[0]?.id || '');
    setTallyItemName('');
    setTallyAlias('');
    setTallyItemId('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: TallyProductMapping) => {
    setEditingMapping(m);
    setSelectedProductId(m.product_id || products[0]?.id || '');
    setTallyItemName(m.tally_stock_item_name);
    setTallyAlias(m.tally_alias || '');
    setTallyItemId(m.tally_stock_item_id || '');
    setIsModalOpen(true);
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !tallyItemName.trim()) {
      showWarning({
        title: 'Missing Mapping Information',
        message: 'Please select an internal product and provide the Tally Stock Item Name before saving.',
      });
      return;
    }

    setIsSaving(true);
    setActionFeedback(null);
    try {
      await api.saveProductMapping({
        id: editingMapping?.id,
        productId: selectedProductId,
        tallyStockItemId: tallyItemId.trim() || undefined,
        tallyStockItemName: tallyItemName.trim(),
        tallyAlias: tallyAlias.trim() || undefined,
      });
      setActionFeedback(`Mapping for "${tallyItemName}" saved successfully.`);
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setActionFeedback(`Error saving mapping: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Product Mapping',
      message: `Are you sure you want to delete the mapping for "${name}"? This removes automatic synchronization for this item.`,
      confirmText: 'Yes, Delete Mapping',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await api.deleteProductMapping(id);
      setActionFeedback(`Mapping for "${name}" removed.`);
      onRefresh();
    } catch (err: any) {
      showWarning({
        title: 'Delete Failed',
        message: `Error deleting mapping: ${err.message}`,
      });
    }
  };

  const handleAutoMap = async () => {
    setIsAutoMapping(true);
    setActionFeedback(null);
    try {
      const res = await api.autoMapProducts();
      setActionFeedback(`Auto-Mapping Complete: Matched ${res.matchedCount} unmapped items.`);
      onRefresh();
    } catch (err: any) {
      setActionFeedback(`Auto-mapping failed: ${err.message}`);
    } finally {
      setIsAutoMapping(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Tally Name, SKU, Internal Product..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Mappings ({mappings.length})</option>
              <option value="MAPPED">Mapped ({mappedCount})</option>
              <option value="UNMAPPED">Unmapped ({unmappedCount})</option>
            </select>

            <button
              onClick={handleAutoMap}
              disabled={isAutoMapping}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAutoMapping ? 'animate-spin' : 'text-indigo-600 dark:text-indigo-400'}`} />
              {isAutoMapping ? 'Auto-Matching...' : 'Auto-Map Unmapped'}
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Mapping</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Mappings"
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

      {/* Mappings Table */}
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
                Product SKU & Tally Master Links
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                {filteredMappings.length} {filteredMappings.length === 1 ? 'mapping' : 'mappings'}
              </span>
              {isFullScreen && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5" />
                  <span>Full Screen Expanded</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
              Two-way translation rules mapping external Tally Stock Item names and aliases to internal SKUs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-mappings-fullscreen"
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
          <table className={cn('w-full text-left text-xs', isFullScreen ? 'min-w-full' : 'min-w-[750px]')}>
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="px-4 py-3">Tally Stock Item Name</th>
                <th className="px-4 py-3">Tally Alias / ID</th>
                <th className="px-4 py-3">Internal Product Name & SKU</th>
                <th className="px-4 py-3">Mapping Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium text-slate-700 dark:text-slate-300">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    No product mappings found.
                  </td>
                </tr>
              ) : (
                filteredMappings.map((m) => {
                  const isMapped = m.mapping_status === 'MAPPED';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                      {/* Tally Item Name */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{m.tally_stock_item_name}</div>
                      </td>

                      {/* Tally Alias */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {m.tally_alias || m.tally_stock_item_id || '—'}
                      </td>

                      {/* Internal Product */}
                      <td className="px-4 py-3">
                        {isMapped ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">{m.product_name}</div>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold whitespace-nowrap bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900/50 inline-block mt-0.5">
                              SKU: {m.product_sku}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">Not assigned</span>
                        )}
                      </td>

                      {/* Mapping Mode */}
                      <td className="px-4 py-3">
                        <span className="text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-medium">
                          {m.auto_matched ? 'Auto Matched' : 'Manual Rule'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isMapped
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {isMapped ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          )}
                          <span>{m.mapping_status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            title="Edit Mapping"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.tally_stock_item_name)}
                            title="Delete Mapping"
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit Mapping Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{editingMapping ? 'Edit Product Mapping' : 'Add Tally Product Mapping'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMapping} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tally Stock Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={tallyItemName}
                  onChange={(e) => setTallyItemName(e.target.value)}
                  placeholder="e.g. Hex Bolt SS-304 M8x40"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tally Alias / Item Part Number
                </label>
                <input
                  type="text"
                  value={tallyAlias}
                  onChange={(e) => setTallyAlias(e.target.value)}
                  placeholder="e.g. BOLT-SS-M8-40"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Internal Inventory Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku}) — Stock: {p.currentStock} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
