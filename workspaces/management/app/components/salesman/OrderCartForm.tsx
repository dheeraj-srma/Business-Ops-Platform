'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  UserCheck,
  Building,
  Layers,
  Plus,
  RotateCcw,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import {
  InventoryItem,
  DealerRecord,
  LocationRecord,
  CartLineItem,
  CartCategoryBlock,
  PDFOrderData,
  PDFOrderItem,
  OfflineQueuedOrder,
} from '../../types';
import { exportOrderPDF } from './salesmanPortalExport';
import { enqueueOfflineOrder, getQueuedOrders, syncOfflineQueue } from '../../lib/offlineQueue';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface OrderCartFormProps {
  dealers: DealerRecord[];
  inventory: InventoryItem[];
  locations: LocationRecord[];
  loginSalesman: string;
  onOrderPlaced: () => void;
}

export default function OrderCartForm({
  dealers,
  inventory,
  locations,
  loginSalesman,
  onOrderPlaced,
}: OrderCartFormProps) {
  const [selectedSalesman, setSelectedSalesman] = useState(loginSalesman);
  const [selectedShop, setSelectedShop] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Offline queue state
  const [queuedOrders, setQueuedOrders] = useState<OfflineQueuedOrder[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form structure: category blocks holding items with immutable SKUs
  const [formStructure, setFormStructure] = useState<CartCategoryBlock[]>([
    { category: '', items: [{ sku: '', name: '', qty: 1 }] },
  ]);

  // Load offline queued orders on mount & listen to queue updates
  const loadQueuedOrders = useCallback(async () => {
    const list = await getQueuedOrders();
    setQueuedOrders(list);
  }, []);

  useEffect(() => {
    loadQueuedOrders();
    const handleQueueUpdate = () => loadQueuedOrders();
    window.addEventListener('nalka-queue-updated', handleQueueUpdate);
    window.addEventListener('online', handleQueueUpdate);
    return () => {
      window.removeEventListener('nalka-queue-updated', handleQueueUpdate);
      window.removeEventListener('online', handleQueueUpdate);
    };
  }, [loadQueuedOrders]);

  // Derived salesman list
  const salesmanList = useMemo(() => {
    const names = new Set<string>();
    dealers.forEach(d => {
      if (d['Salesman Name']) names.add(d['Salesman Name']);
    });
    return Array.from(names).sort();
  }, [dealers]);

  // Filtered shops based on selected salesman
  const availableShops = useMemo(() => {
    if (!selectedSalesman) return [];
    const shops = dealers
      .filter(d => d['Salesman Name'] === selectedSalesman && d['Shop Name'])
      .map(d => d['Shop Name'] as string);
    return Array.from(new Set(shops)).sort();
  }, [dealers, selectedSalesman]);

  // Set default shop when salesman changes
  useEffect(() => {
    if (availableShops.length > 0 && !availableShops.includes(selectedShop)) {
      setSelectedShop(availableShops[0]);
    }
  }, [availableShops, selectedShop]);

  // Authoritative Location Relationship Resolution
  const matchedDealer = useMemo(() => {
    return (
      dealers.find(d => d['Salesman Name'] === selectedSalesman && d['Shop Name'] === selectedShop) ||
      dealers.find(d => d['Salesman Name'] === selectedSalesman)
    );
  }, [dealers, selectedSalesman, selectedShop]);

  const explicitLocationId = matchedDealer?.['Location ID'] || matchedDealer?.location_id || matchedDealer?.locationId;

  const matchedLocation = useMemo(() => {
    if (explicitLocationId) {
      const loc = locations.find(l => (l['Location ID'] || l.location_id || l.id) === explicitLocationId);
      if (loc) return loc;
    }
    const dealerCity = matchedDealer?.City?.toLowerCase();
    const dealerState = matchedDealer?.State?.toLowerCase();

    return (
      locations.find(
        l =>
          (l.State || l.state)?.toLowerCase() === dealerState &&
          (l.City || l.city)?.toLowerCase() === dealerCity
      ) ||
      locations.find(l => (l.City || l.city)?.toLowerCase() === dealerCity) ||
      locations[0]
    );
  }, [locations, explicitLocationId, matchedDealer]);

  const stateVal = matchedLocation?.State || matchedLocation?.state || matchedDealer?.State || 'Main State';
  const cityVal = matchedLocation?.City || matchedLocation?.city || matchedDealer?.City || 'Main Depot';
  const matchedLocationId = matchedLocation?.['Location ID'] || matchedLocation?.location_id || matchedLocation?.id || 'LOC-MAIN';
  const salesmanIdVal = matchedDealer?.['Salesman ID'] || 'SLS-001';

  // Categories list
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach(i => {
      if (i.Category) cats.add(i.Category);
    });
    return Array.from(cats).sort();
  }, [inventory]);

  // Active cart selections map keyed by IMMUTABLE SKU: { [sku]: total_qty }
  const activeCartSelections = useMemo(() => {
    const dict: Record<string, number> = {};
    formStructure.forEach(block => {
      block.items.forEach(item => {
        if (item.sku && item.qty > 0) {
          dict[item.sku] = (dict[item.sku] || 0) + Number(item.qty);
        }
      });
    });
    return dict;
  }, [formStructure]);

  // Stock check error validation
  const stockCheckResults = useMemo(() => {
    let hasExceededError = false;
    const skuErrors: Record<string, string> = {};

    Object.entries(activeCartSelections).forEach(([sku, requestedQty]) => {
      const invItem = inventory.find(i => (i.SKU || i.sku) === sku);
      const availStock = invItem
        ? Number(invItem['Available Stock'] ?? invItem.availableStock ?? invItem['Current Stock'] ?? invItem.currentStock ?? 0)
        : 0;

      if (requestedQty > availStock) {
        hasExceededError = true;
        skuErrors[sku] = `Exceeds available stock (${availStock} left)`;
      }
    });

    return { hasExceededError, skuErrors };
  }, [activeCartSelections, inventory]);

  // Form Handlers
  const updateCategory = (blockIndex: number, category: string) => {
    setFormStructure(prev => {
      const next = [...prev];
      next[blockIndex] = {
        category,
        items: [{ sku: '', name: '', qty: 1 }],
      };
      return next;
    });
  };

  const updateProductBySku = (blockIndex: number, itemIndex: number, sku: string) => {
    const matchedInv = inventory.find(i => (i.SKU || i.sku) === sku);
    const name = matchedInv ? (matchedInv['Item Name'] || matchedInv.name || sku) : '';

    setFormStructure(prev => {
      const next = [...prev];
      const items = [...next[blockIndex].items];
      items[itemIndex] = { ...items[itemIndex], sku, name };
      next[blockIndex] = { ...next[blockIndex], items };
      return next;
    });
  };

  const updateQty = (blockIndex: number, itemIndex: number, qty: number) => {
    setFormStructure(prev => {
      const next = [...prev];
      const items = [...next[blockIndex].items];
      items[itemIndex] = { ...items[itemIndex], qty: Math.max(1, qty) };
      next[blockIndex] = { ...next[blockIndex], items };
      return next;
    });
  };

  const addItemToBlock = (blockIndex: number) => {
    setFormStructure(prev => {
      const next = [...prev];
      next[blockIndex].items.push({ sku: '', name: '', qty: 1 });
      return next;
    });
  };

  const addCategoryBlock = () => {
    setFormStructure(prev => [...prev, { category: '', items: [{ sku: '', name: '', qty: 1 }] }]);
  };

  const resetForm = () => {
    setFormStructure([{ category: '', items: [{ sku: '', name: '', qty: 1 }] }]);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Sync Offline Queue
  const handleSyncQueue = async () => {
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      if (result.synced > 0) {
        setSuccessMessage(`Successfully synced ${result.synced} offline order(s) to server!`);
        onOrderPlaced();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error syncing offline queue');
    } finally {
      setIsSyncing(false);
      loadQueuedOrders();
    }
  };

  // Submit Order (with Durable Offline Queue & Idempotency Key)
  const handlePlaceOrder = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedSalesman || !selectedShop) {
      setErrorMessage('Please select a valid Salesman and Shop Name.');
      return;
    }

    if (stockCheckResults.hasExceededError) {
      setErrorMessage('Cannot place order: One or more item quantities exceed available stock!');
      return;
    }

    const lineItems: PDFOrderItem[] = [];
    formStructure.forEach(block => {
      block.items.forEach(item => {
        if (item.sku && item.qty > 0) {
          const invItem = inventory.find(i => (i.SKU || i.sku) === item.sku);
          const price = Number(invItem?.Price) || 0;
          lineItems.push({
            category: block.category || invItem?.Category || 'General',
            sku: item.sku,
            item_name: item.name || invItem?.['Item Name'] || invItem?.name || item.sku,
            quantity: item.qty,
            price,
            total_price: price * item.qty,
          });
        }
      });
    });

    if (lineItems.length === 0) {
      setErrorMessage('Please add at least one valid product item with quantity > 0.');
      return;
    }

    // Generate unique client-side idempotency key (UUID)
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idempotent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    setSubmitting(true);

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      // Offline mode: Queue order in IndexedDB with idempotency key
      try {
        await enqueueOfflineOrder({
          idempotency_key: idempotencyKey,
          salesman_id: salesmanIdVal,
          salesman_name: selectedSalesman,
          shop_name: selectedShop,
          city: cityVal,
          state: stateVal,
          location_id: matchedLocationId,
          items: lineItems,
        });

        const fallbackOrderId = `OFFLINE-${idempotencyKey.slice(0, 8).toUpperCase()}`;
        setSuccessMessage(`Offline mode: Order ${fallbackOrderId} stored safely in IndexedDB queue! Will sync automatically when online.`);

        // Export PDF locally
        exportOrderPDF({
          order_id: fallbackOrderId,
          timestamp: new Date().toLocaleString(),
          salesman_id: salesmanIdVal,
          salesman_name: selectedSalesman,
          shop_name: selectedShop,
          location_id: matchedLocationId,
          city: cityVal,
          state: stateVal,
          status: 'Queued (Offline)',
          items: lineItems,
        });

        resetForm();
        loadQueuedOrders();
      } catch (err: any) {
        setErrorMessage(`Failed to queue order offline: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Online submission to backend
    try {
      const res = await fetch(`${API}/api/orders/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_reference: idempotencyKey,
          salesman_id: salesmanIdVal,
          salesman_name: selectedSalesman,
          shop_name: selectedShop,
          city: cityVal,
          state: stateVal,
          location_id: matchedLocationId,
          items: lineItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to place order on server.');
      }

      const responseData = await res.json();
      const orderId = responseData.order_id || `ORD-${Date.now()}`;
      const timestamp = responseData.timestamp || new Date().toLocaleString();

      setSuccessMessage(`Order ${orderId} placed successfully! Transmitted to Admin for approval.`);

      // Generate PDF Invoice
      exportOrderPDF({
        order_id: orderId,
        timestamp,
        salesman_id: salesmanIdVal,
        salesman_name: selectedSalesman,
        shop_name: selectedShop,
        location_id: matchedLocationId,
        city: cityVal,
        state: stateVal,
        status: 'Pending',
        items: lineItems,
      });

      onOrderPlaced();
      resetForm();
    } catch (err: any) {
      // Network failure during submit: Fallback to queueing offline safely
      console.warn('Online submit failed, enqueueing offline:', err);
      try {
        await enqueueOfflineOrder({
          idempotency_key: idempotencyKey,
          salesman_id: salesmanIdVal,
          salesman_name: selectedSalesman,
          shop_name: selectedShop,
          city: cityVal,
          state: stateVal,
          location_id: matchedLocationId,
          items: lineItems,
        });
        setSuccessMessage(`Network error encountered: Order saved to durable IndexedDB queue (Key: ${idempotencyKey.slice(0, 8)}).`);
        loadQueuedOrders();
        resetForm();
      } catch (qErr: any) {
        setErrorMessage(err.message || 'Error placing order.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <ShoppingCart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-100">Action Entry Sheet</h2>
        </div>

        {/* Offline Queue Badge & Sync Button */}
        {queuedOrders.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              {queuedOrders.length} Queued Offline
            </span>
            <button
              onClick={handleSyncQueue}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-indigo-600 dark:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Queue
            </button>
          </div>
        )}
      </div>

      {/* Success / Error Banners */}
      {successMessage && (
        <div className="bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-700/60 rounded-xl p-4 flex items-center gap-3 text-cyan-200 text-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-950/80 border border-rose-500/40 rounded-xl p-4 flex items-center gap-3 text-rose-200 text-sm animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Salesman & Customer Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Salesman
          </label>
          <select
            value={selectedSalesman}
            onChange={e => setSelectedSalesman(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:border-indigo-600 dark:border-indigo-500 focus:outline-none"
          >
            {salesmanList.length > 0 ? (
              salesmanList.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            ) : (
              <option value={loginSalesman}>{loginSalesman}</option>
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Shop Name
          </label>
          <select
            value={selectedShop}
            onChange={e => setSelectedShop(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:border-indigo-600 dark:border-indigo-500 focus:outline-none"
          >
            {availableShops.length > 0 ? (
              availableShops.map(shop => (
                <option key={shop} value={shop}>
                  {shop}
                </option>
              ))
            ) : (
              <>
                <option value="Mishra Trade Centre">Mishra Trade Centre</option>
                <option value="Apex Hardware Store">Apex Hardware Store</option>
                <option value="Direct Order">Direct Order</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Authoritative Dynamic Location Metadata Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Salesman ID</span>
          <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold">{salesmanIdVal}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Location ID</span>
          <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold">{matchedLocationId}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">State</span>
          <span className="text-slate-300 font-medium">{stateVal}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">City</span>
          <span className="text-slate-300 font-medium">{cityVal}</span>
        </div>
      </div>

      {/* Dynamic Category & Immutable Item Entry Blocks */}
      <div className="space-y-5 pt-2">
        {formStructure.map((block, bIdx) => {
          const categoryItems = block.category
            ? inventory.filter(i => i.Category === block.category)
            : inventory;

          return (
            <div key={bIdx} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Select Category Block {bIdx + 1}
                </label>
              </div>

              <select
                value={block.category}
                onChange={e => updateCategory(bIdx, e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:border-indigo-600 dark:border-indigo-500 focus:outline-none"
              >
                <option value="">-- Choose Product Category --</option>
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Items list in this category block */}
              <div className="space-y-3 pt-2">
                {block.items.map((item, iIdx) => {
                  const stockErr = stockCheckResults.skuErrors[item.sku];
                  const matchedInv = inventory.find(i => (i.SKU || i.sku) === item.sku);
                  const avail = matchedInv
                    ? Number(matchedInv['Available Stock'] ?? matchedInv.availableStock ?? matchedInv['Current Stock'] ?? matchedInv.currentStock ?? 0)
                    : 0;

                  return (
                    <div key={iIdx} className="space-y-1.5">
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-8 sm:col-span-9">
                          <select
                            value={item.sku}
                            onChange={e => updateProductBySku(bIdx, iIdx, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-600 dark:border-indigo-500 focus:outline-none"
                          >
                            <option value="">-- Select Product (by SKU) --</option>
                            {categoryItems.map(invItem => {
                              const itemSku = invItem.SKU || invItem.sku || '';
                              const itemName = invItem['Item Name'] || invItem.name || itemSku;
                              const currentStock = invItem['Current Stock'] ?? invItem.currentStock ?? 0;
                              return (
                                <option key={itemSku} value={itemSku}>
                                  [{itemSku}] {itemName} ({currentStock} in stock)
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="col-span-4 sm:col-span-3">
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={e => updateQty(bIdx, iIdx, parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-600 dark:border-indigo-500 focus:outline-none text-center font-mono"
                          />
                        </div>
                      </div>

                      {/* Stock Warning Indicators */}
                      {item.sku && (
                        <div className="text-[11px] px-1">
                          {stockErr ? (
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" />
                              Quantity exceeds available stock ({avail} remaining)!
                            </span>
                          ) : avail - item.qty <= 5 ? (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Stock near depletion ({avail} left)
                            </span>
                          ) : (
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Sufficient stock available ({avail} in warehouse)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {block.category && (
                <button
                  type="button"
                  onClick={() => addItemToBlock(bIdx)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1 pt-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Item to Category
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={addCategoryBlock}
          className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          + Add Category Block
        </button>

        <button
          type="button"
          onClick={resetForm}
          className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
          Reset Form
        </button>
      </div>

      <button
        type="button"
        onClick={handlePlaceOrder}
        disabled={submitting || stockCheckResults.hasExceededError}
        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {submitting ? (
          <span>Transmitting Order...</span>
        ) : (
          <>
            <FileDown className="w-4 h-4" />
            Place Order & Download PDF Invoice
          </>
        )}
      </button>
    </div>
  );
}
