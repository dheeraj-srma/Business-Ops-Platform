import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Clock,
  FileDown,
  Trash2,
  Edit3,
  Search,
  CheckCircle2,
  XCircle,
  Boxes,
  Store,
  RefreshCw,
  Lock,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { generateOrderPDF } from '../utils/pdfGenerator';
import { downloadOrderAsJSON, type OrderPayload } from '../utils/buildOrder';
import type { PDFOrderData, PDFOrderItem } from '../types';
import { listOrders, getOrder, cancelOrder, updateOrder } from '../../../../shared/api/orders';

interface OrderItemRow {
  id?: number | string;
  order_id: string;
  sku: string;
  item_name: string;
  category: string;
  quantity: number;
  price: number;
  total_price: number;
  created_at?: string;
}

interface OrderHeaderRow {
  order_id: string;
  salesman_id: string;
  salesman_name: string;
  shop_name: string;
  city: string;
  state: string;
  location_id: string;
  status: string;
  item_count: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  items?: OrderItemRow[];
}

interface SalesmanOrdersPanelProps {
  salesmanId: string;
  salesmanName: string;
  showModal: (params: { type: 'success' | 'error' | 'warning' | 'info' | 'confirm'; title: string; message: string; details?: Array<{ label: string; value: string | number; highlight?: boolean }>; primaryButtonText?: string; secondaryButtonText?: string; onConfirm?: () => void }) => void;
}

export default function SalesmanOrdersPanel({
  salesmanId,
  salesmanName,
  showModal,
}: SalesmanOrdersPanelProps) {
  const [orders, setOrders] = useState<OrderHeaderRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'consignment' | 'item'>('consignment');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<OrderHeaderRow | null>(null);
  const [editItems, setEditItems] = useState<OrderItemRow[]>([]);
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Live timer tick for 15-minute countdowns
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch salesman orders from Supabase
  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Central Backend Read Attempt via listOrders API
      try {
        const apiRes = await listOrders({
          page: 1,
          page_size: 200,
          salesman_id: salesmanId || undefined,
        });

        if (apiRes && Array.isArray(apiRes.items)) {
          // Fetch details for each order header if line items missing
          const detailedOrders: OrderHeaderRow[] = await Promise.all(
            apiRes.items.map(async (header) => {
              try {
                const detail = await getOrder(header.order_id);
                return {
                  order_id: detail.order_id,
                  salesman_id: detail.salesman_id || salesmanId || 'SLS-001',
                  salesman_name: detail.salesman_name,
                  shop_name: detail.shop_name,
                  location_id: detail.location_id || '',
                  city: detail.city || '',
                  state: detail.state || '',
                  item_count: detail.item_count,
                  total_amount: detail.total_amount,
                  status: detail.status,
                  notes: detail.notes || '',
                  created_at: detail.created_at,
                  items: (detail.items || []).map((it) => ({
                    id: it.id,
                    order_id: it.order_id,
                    sku: it.sku || '',
                    item_name: it.item_name,
                    category: it.category,
                    quantity: it.quantity,
                    price: it.price,
                    total_price: it.total_price,
                  })),
                };
              } catch {
                return {
                  order_id: header.order_id,
                  salesman_id: header.salesman_id || salesmanId || 'SLS-001',
                  salesman_name: header.salesman_name,
                  shop_name: header.shop_name,
                  location_id: header.location_id || '',
                  city: header.city || '',
                  state: header.state || '',
                  item_count: header.item_count,
                  total_amount: header.total_amount,
                  status: header.status,
                  notes: header.notes || '',
                  created_at: header.created_at,
                  items: [],
                };
              }
            })
          );

          setOrders(detailedOrders);
          return;
        }
      } catch (centralErr) {
        console.warn('[SalesmanOrdersPanel] Central FastAPI order read fallback to direct Supabase:', centralErr);
      }

      // Fallback: Direct Supabase fetch
      const { data: orderHeaders, error: headerErr } = await supabase
        .from('pending_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (headerErr) throw headerErr;

      const filteredHeaders = (orderHeaders || []).filter((o) => {
        if (!salesmanId && !salesmanName) return true;
        const matchId = salesmanId && o.salesman_id?.toLowerCase() === salesmanId.toLowerCase();
        const matchName = salesmanName && o.salesman_name?.toLowerCase().includes(salesmanName.toLowerCase());
        return matchId || matchName || o.salesman_name === salesmanName;
      });

      const orderIds = filteredHeaders.map((o) => o.order_id);

      let allItems: OrderItemRow[] = [];
      if (orderIds.length > 0) {
        const { data: itemRows, error: itemErr } = await supabase
          .from('pending_order_items')
          .select('*')
          .in('order_id', orderIds);

        if (!itemErr && itemRows) {
          allItems = itemRows;
        }
      }

      const itemMap = new Map<string, OrderItemRow[]>();
      allItems.forEach((it) => {
        const arr = itemMap.get(it.order_id) || [];
        arr.push(it);
        itemMap.set(it.order_id, arr);
      });

      const combined: OrderHeaderRow[] = filteredHeaders.map((o) => ({
        ...o,
        items: itemMap.get(o.order_id) || [],
      }));

      setOrders(combined);
    } catch (err: any) {
      console.warn('[SalesmanOrdersPanel] Error fetching orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime updates on pending_orders and pending_order_items
    const channel = supabase
      .channel('salesman-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_orders' },
        () => fetchOrders(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_order_items' },
        () => fetchOrders(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salesmanId, salesmanName]);

  // Toggle Order Expand/Collapse
  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Helper: Grace Period Math (15 Mins = 900 Seconds)
  const getGracePeriodInfo = (createdAtIso: string, status: string) => {
    if (status && status !== 'Pending') {
      return { canModify: false, isExpired: true, secondsLeft: 0, text: 'Locked (Processed)' };
    }

    const createdTime = new Date(createdAtIso).getTime();
    const elapsedSeconds = Math.floor((nowTimestamp - createdTime) / 1000);
    const totalGraceSeconds = 15 * 60; // 15 minutes
    const secondsLeft = totalGraceSeconds - elapsedSeconds;

    if (secondsLeft <= 0) {
      return { canModify: false, isExpired: true, secondsLeft: 0, text: 'Grace Period Expired (Locked)' };
    }

    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      canModify: true,
      isExpired: false,
      secondsLeft,
      text: `${mins}m ${pad(secs)}s left to edit/cancel`,
    };
  };

  // Handle Cancel / Delete Order
  const handleDeleteOrder = (order: OrderHeaderRow) => {
    const grace = getGracePeriodInfo(order.created_at, order.status);
    if (!grace.canModify) {
      showModal({
        type: 'warning',
        title: 'Grace Period Expired',
        message: 'The 15-minute edit/cancellation window for this order has expired, or the order is already being processed by inventory management.',
      });
      return;
    }

    showModal({
      type: 'confirm',
      title: `Cancel Order ${order.order_id}?`,
      message: `Are you sure you want to cancel and delete this order for "${order.shop_name}"? This action will immediately release reserved stock balances back to availability.`,
      details: [
        { label: 'Order ID', value: order.order_id },
        { label: 'Customer', value: order.shop_name },
        { label: 'Total Amount', value: `Rs. ${order.total_amount.toLocaleString()}` },
        { label: 'Time Remaining', value: grace.text, highlight: true },
      ],
      primaryButtonText: 'Yes, Cancel Order',
      secondaryButtonText: 'Keep Order',
      onConfirm: async () => {
        try {
          // Central API Call
          await cancelOrder(order.order_id, 'Cancelled by salesman');
          setOrders((prev) => prev.filter((o) => o.order_id !== order.order_id));
          showModal({
            type: 'success',
            title: 'Order Cancelled',
            message: `Successfully cancelled order ${order.order_id}. Reserved stock balances have been updated.`,
          });
        } catch (err: any) {
          showModal({
            type: 'error',
            title: 'Cancellation Failed',
            message: err.message || 'Could not cancel order.',
          });
        }
      },
    });
  };

  // Open Edit Order Modal
  const handleOpenEdit = (order: OrderHeaderRow) => {
    const grace = getGracePeriodInfo(order.created_at, order.status);
    if (!grace.canModify) {
      showModal({
        type: 'warning',
        title: 'Grace Period Expired',
        message: 'The 15-minute edit/cancellation window for this order has expired.',
      });
      return;
    }

    setEditingOrder(order);
    setEditItems((order.items || []).map((it) => ({ ...it })));
    setEditNotes(order.notes || '');
  };

  // Save Edit Order Changes
  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    setSavingEdit(true);

    try {
      const validItems = editItems.filter((i) => Number(i.quantity) > 0);
      if (validItems.length === 0) {
        showModal({
          type: 'warning',
          title: 'Empty Order',
          message: 'An order must contain at least one item with quantity > 0. If you wish to delete the entire order, use Cancel Order instead.',
        });
        setSavingEdit(false);
        return;
      }

      // Central API Call
      const editPayload = {
        items: validItems.map((item) => ({
          sku: item.sku || item.item_name,
          item_name: item.item_name,
          category: item.category || 'General',
          quantity: Number(item.quantity),
          price: Number(item.price || 0),
        })),
        notes: editNotes.trim(),
      };

      const res = await updateOrder(editingOrder.order_id, editPayload);

      setEditingOrder(null);
      await fetchOrders(true);

      showModal({
        type: 'success',
        title: 'Order Updated',
        message: `Successfully updated order ${editingOrder.order_id}.`,
        details: [
          { label: 'Order ID', value: editingOrder.order_id },
          { label: 'Items Count', value: res.items_count },
          { label: 'Updated Total', value: `Rs. ${res.total_amount.toLocaleString()}`, highlight: true },
        ],
      });
    } catch (err: any) {
      showModal({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Failed to update order.',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Download PDF Invoice
  const handleDownloadPDF = (order: OrderHeaderRow) => {
    const pdfItems: PDFOrderItem[] = (order.items || []).map((it) => ({
      category: it.category,
      sku: it.sku,
      item_name: it.item_name,
      quantity: it.quantity,
      price: it.price,
      total_price: it.total_price || it.price * it.quantity,
    }));

    const pdfData: PDFOrderData = {
      order_id: order.order_id,
      timestamp: new Date(order.created_at).toLocaleString(),
      salesman_id: order.salesman_id,
      salesman_name: order.salesman_name,
      shop_name: order.shop_name,
      location_id: order.location_id,
      city: order.city,
      state: order.state,
      status: order.status,
      items: pdfItems,
    };

    generateOrderPDF(pdfData);
  };

  // Download JSON Payload
  const handleDownloadJSON = (order: OrderHeaderRow) => {
    const payload: OrderPayload = {
      order: {
        order_id: order.order_id,
        salesman_id: order.salesman_id,
        salesman_name: order.salesman_name,
        shop_name: order.shop_name,
        city: order.city,
        state: order.state,
        location_id: order.location_id,
        status: 'Pending',
        item_count: order.item_count,
        total_amount: order.total_amount,
        created_at: order.created_at,
      },
      items: (order.items || []).map((it) => ({
        order_id: order.order_id,
        sku: it.sku || it.item_name,
        item_name: it.item_name,
        category: it.category || 'General',
        quantity: it.quantity,
        price: it.price,
        total_price: it.total_price || it.price * it.quantity,
      })),
    };

    downloadOrderAsJSON(payload);
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.order_id.toLowerCase().includes(q) ||
        o.shop_name.toLowerCase().includes(q) ||
        (o.city && o.city.toLowerCase().includes(q)) ||
        (o.items && o.items.some((it) => it.item_name.toLowerCase().includes(q)))
    );
  }, [orders, searchQuery]);

  // Item Summary Aggregation (Group by Item SKU)
  const itemSummaryList = useMemo(() => {
    const map = new Map<
      string,
      {
        sku: string;
        item_name: string;
        category: string;
        totalQty: number;
        avgPrice: number;
        totalValuation: number;
        shops: Set<string>;
        ordersCount: number;
        lastOrderedAt: string;
      }
    >();

    filteredOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const key = it.item_name.trim().toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.totalQty += Number(it.quantity || 0);
          existing.totalValuation += Number(it.total_price || it.price * it.quantity || 0);
          existing.shops.add(o.shop_name);
          existing.ordersCount += 1;
          if (new Date(o.created_at) > new Date(existing.lastOrderedAt)) {
            existing.lastOrderedAt = o.created_at;
          }
        } else {
          map.set(key, {
            sku: it.sku || it.item_name,
            item_name: it.item_name,
            category: it.category || 'General',
            totalQty: Number(it.quantity || 0),
            avgPrice: Number(it.price || 0),
            totalValuation: Number(it.total_price || it.price * it.quantity || 0),
            shops: new Set([o.shop_name]),
            ordersCount: 1,
            lastOrderedAt: o.created_at,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
      {/* Sleek Minimal Header Toolbar */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                My Submitted Orders
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Representative: <span className="font-semibold text-slate-800 dark:text-slate-200">{salesmanName || 'All Salesmen'}</span>
              </p>
            </div>
          </div>

          {/* Quick Toolbar: Refresh & View Switcher */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer border border-slate-200 dark:border-slate-700/80 disabled:opacity-50"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
            </button>

            {/* View Mode Segment Switcher */}
            <div className="p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800/80 flex items-center gap-1 text-xs">
              <button
                onClick={() => setViewMode('consignment')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  viewMode === 'consignment'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>By Consignment ({orders.length})</span>
              </button>

              <button
                onClick={() => setViewMode('item')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  viewMode === 'item'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>By SKU ({itemSummaryList.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders by ID, Shop Name, City, or SKU..."
            className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Loading salesman order history...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Package className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 mb-1">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No orders matching "${searchQuery}". Try clearing your search filter.`
              : 'You have not submitted any orders yet. Placed orders will appear here with live tracking.'}
          </p>
        </div>
      ) : viewMode === 'consignment' ? (
        /* CONSIGNMENT / ORDER GROUPED VIEW */
        <div className="space-y-3.5">
          {filteredOrders.map((order) => {
            const isExpanded = !!expandedOrders[order.order_id];
            const grace = getGracePeriodInfo(order.created_at, order.status);

            const statusUpper = (order.status || '').toUpperCase();
            const isApproved = statusUpper === 'CONFIRMED' || statusUpper === 'APPROVED';
            const isRejected = statusUpper === 'REJECTED' || statusUpper.includes('REJECT');

            // Shorten Order ID display for mobile
            const shortOrderId = order.order_id.length > 20 
              ? `#...${order.order_id.slice(-8)}` 
              : order.order_id;

            const skuCount = order.item_count || order.items?.length || 0;

            return (
              <div
                key={order.order_id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
              >
                {/* Top Row: Shop Name & Amount */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                      {order.shop_name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span>{order.city ? `${order.city}, ${order.state}` : 'Direct Location'}</span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span>{new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="font-mono text-slate-400 dark:text-slate-500 text-[11px]" title={order.order_id}>{shortOrderId}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono block">
                      ₹{(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Status & Grace Period Badges */}
                <div className="flex items-center gap-2 flex-wrap mt-2.5">
                  {isApproved && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Approved</span>
                    </span>
                  )}
                  {isRejected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                      <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      <span>Rejected</span>
                    </span>
                  )}
                  {!isApproved && !isRejected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>Pending Review</span>
                    </span>
                  )}

                  {grace.canModify ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 animate-pulse">
                      <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>⏱️ {grace.text}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                      <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{grace.text}</span>
                    </span>
                  )}
                </div>

                {/* Clean Notes / Remarks Line */}
                {order.notes && (
                  <div className={`mt-2.5 px-3 py-2 rounded-xl text-xs ${
                    isRejected 
                      ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300' 
                      : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
                  }`}>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">{isRejected ? 'Remarks: ' : 'Note: '}</span>
                    <span>{order.notes}</span>
                  </div>
                )}

                {/* Footer Bar: SKUs Count & Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/60 flex-wrap gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{skuCount} {skuCount === 1 ? 'SKU' : 'SKUs'}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Edit Button */}
                    {grace.canModify && (
                      <button
                        onClick={() => handleOpenEdit(order)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Edit order"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}

                    {/* Cancel Button */}
                    {grace.canModify && (
                      <button
                        onClick={() => handleDeleteOrder(order)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Cancel order"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {/* PDF Invoice Download */}
                    <button
                      onClick={() => handleDownloadPDF(order)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
                      title="Download PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                    </button>

                    {/* JSON Payload Download */}
                    <button
                      onClick={() => handleDownloadJSON(order)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
                      title="Download JSON"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>

                    {/* Expand / Collapse Button */}
                    <button
                      onClick={() => toggleExpand(order.order_id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
                      title={isExpanded ? 'Hide Items' : 'View Items'}
                    >
                      <span>{isExpanded ? 'Hide' : 'Items'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />}
                    </button>
                  </div>
                </div>

                {/* Expandable Line Items Table */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/60 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Items ({order.items?.length || 0})
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                      <table className="w-full text-left text-xs min-w-[450px]">
                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2 px-3">SKU</th>
                            <th className="py-2 px-3">Item Name</th>
                            <th className="py-2 px-3 text-center">Qty</th>
                            <th className="py-2 px-3 text-right">Price</th>
                            <th className="py-2 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                          {(order.items || []).map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-100/80 dark:hover:bg-slate-900/40 transition-colors">
                              <td className="py-2 px-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                {item.sku || item.item_name}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{item.item_name}</td>
                              <td className="py-2 px-3 text-center font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                {item.quantity}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                ₹{(item.price || 0).toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                ₹{(item.total_price || item.price * item.quantity || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ITEM-WISE GROUPED SUMMARY VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>SKU Product Summary ({itemSummaryList.length} Unique Items Ordered)</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Aggregated across active consignments</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">SKU / Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Total Qty Ordered</th>
                  <th className="py-3 px-4 text-right">Avg Unit Price</th>
                  <th className="py-3 px-4 text-right">Total Valuation</th>
                  <th className="py-3 px-4">Customer Shops Ordering</th>
                  <th className="py-3 px-4 text-right">Last Ordered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                {itemSummaryList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold">
                      <div className="text-slate-900 dark:text-slate-100">{item.item_name}</div>
                      <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">{item.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{item.category}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-black border border-amber-200 dark:border-amber-500/20">
                        {item.totalQty}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                      Rs. {item.avgPrice.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                      Rs. {item.totalValuation.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Array.from(item.shops).map((shop, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          >
                            {shop}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(item.lastOrderedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Edit Order (15-Min Grace Window)
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">{editingOrder.order_id}</h3>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Customer: <strong className="text-slate-900 dark:text-slate-200">{editingOrder.shop_name}</strong>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Order Line Items
                </label>
                {editItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{item.item_name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Unit Price: Rs. {(item.price || 0).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setEditItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantity: val, total_price: val * (it.price || 0) } : it))
                          );
                        }}
                        className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-700 dark:text-amber-400 font-bold text-center focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Order Special Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Dispatch instructions, customer notes..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
