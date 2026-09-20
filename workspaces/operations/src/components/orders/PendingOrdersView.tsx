import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Inbox,
  ShoppingBag,
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Radio,
  Search,
  ChevronRight,
  Store,
  User,
  MapPin,
  Calendar,
  Layers,
  ArrowUpDown,
  History,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  Info,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  FileDown,
  RotateCcw,
  Plus,
  Minus,
  Trash2,
  Clock,
  Edit3,
  Lock,
  Printer,
  Zap,
} from 'lucide-react';
import { OrderPreview, OrderPreviewItem, ProcessedOrder, ProcessedOrderItem, Product } from '../../types';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';
import { cn } from '../../lib/utils';
import { generateOrderPDF, PDFOrderExportData } from '../../utils/orderPdfGenerator';

interface PendingOrdersViewProps {
  products: Product[];
  onRefreshProducts?: () => void;
  onGoBack?: () => void;
}

// 15-Minute Grace Window Duration
const GRACE_WINDOW_MS = 15 * 60 * 1000;

export const PendingOrdersView: React.FC<PendingOrdersViewProps> = ({
  products,
  onRefreshProducts,
  onGoBack,
}) => {
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View States
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history'>('pending');
  const [pendingOrders, setPendingOrders] = useState<OrderPreview[]>([]);
  const [orderHistory, setOrderHistory] = useState<ProcessedOrder[]>([]);
  const [historyItems, setHistoryItems] = useState<ProcessedOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);

  // Time state for live countdown re-renders
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'supabase' | 'file'>('all');
  const [issueFilter, setIssueFilter] = useState<'all' | 'unmatched' | 'stock_issue' | 'ready'>('all');

  // Selected Order for Review Modal / Drawer
  const [selectedOrder, setSelectedOrder] = useState<OrderPreview | null>(null);
  const [itemMappings, setItemMappings] = useState<Record<string, string>>({}); // itemName -> productId
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Adding new product in review drawer (searchable combobox)
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>('');
  const [addProductSearchQuery, setAddProductSearchQuery] = useState<string>('');
  const [isAddProductOpen, setIsAddProductOpen] = useState<boolean>(false);
  const addProductRef = useRef<HTMLDivElement>(null);

  // Close add product dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addProductRef.current && !addProductRef.current.contains(e.target as Node)) {
        setIsAddProductOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products for searchable Add Item combobox
  const filteredCatalogProducts = useMemo(() => {
    const q = addProductSearchQuery.trim().toLowerCase();
    if (!q) {
      return products.slice(0, 30);
    }
    return products
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku ? p.sku.toLowerCase().includes(q) : false;
        const catMatch = p.category_id ? p.category_id.toLowerCase().includes(q) : false;
        return nameMatch || skuMatch || catMatch;
      })
      .slice(0, 40);
  }, [products, addProductSearchQuery]);

  const handleSelectAddProduct = (prod: Product) => {
    setSelectedAddProductId(prod.id);
    setAddProductSearchQuery(prod.name);
    setIsAddProductOpen(false);
  };

  // Calculate if the currently selected review order contains items placed under stock override
  const selectedOrderOverrideStats = useMemo(() => {
    if (!selectedOrder) return { hasOverride: false, zeroStockCount: 0, deficitCount: 0 };
    let zeroStockCount = 0;
    let deficitCount = 0;

    for (const item of selectedOrder.items) {
      const selectedProdId = itemMappings[item.item_name] || item.matchedProductId;
      const mappedProd = products.find((p) => p.id === selectedProdId);
      const currentStock = mappedProd ? mappedProd.currentStock : item.currentStock;
      const numericQty = Number(item.quantity) || 0;

      if (currentStock <= 0) {
        zeroStockCount++;
      } else if (currentStock < numericQty) {
        deficitCount++;
      }
    }

    return {
      hasOverride: zeroStockCount > 0 || deficitCount > 0,
      zeroStockCount,
      deficitCount,
    };
  }, [selectedOrder, itemMappings, products]);

  // Load Pending Orders & History
  const fetchOrders = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.getPendingOrders().catch((e) => {
          console.warn('Pending orders fetch notice:', e);
          return { success: false, orders: [], isLiveConnected: false, count: 0 };
        }),
        api.getOrderHistory().catch((e) => {
          console.warn('Order history fetch notice:', e);
          return { success: false, orders: [], items: [] };
        }),
      ]);
      setPendingOrders(pendingRes?.orders || []);
      setIsLiveConnected(Boolean(pendingRes?.isLiveConnected));
      setOrderHistory(historyRes?.orders || []);
      setHistoryItems(historyRes?.items || []);
    } catch (err: any) {
      console.warn('Error loading orders:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Auto-poll orders every 15 seconds
    const interval = setInterval(() => fetchOrders(true), 15000);
    // Timer tick every 10 seconds for live grace window countdowns
    const timerInterval = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, []);

  // Helper: Calculate Grace Period Status (15 Minutes)
  const getGracePeriodInfo = (processedAt?: string) => {
    if (!processedAt) return { isActive: false, remainingMin: 0, text: 'Locked' };
    const processedTime = new Date(processedAt).getTime();
    const diff = currentTime - processedTime;
    if (diff > GRACE_WINDOW_MS || diff < 0) {
      return { isActive: false, remainingMin: 0, text: 'Grace Window Closed (>15m)' };
    }
    const remainingMin = Math.max(1, Math.ceil((GRACE_WINDOW_MS - diff) / (60 * 1000)));
    return {
      isActive: true,
      remainingMin: remainingMin,
      text: `${remainingMin}m left to edit/reject`,
    };
  };

  // Utility: Export Confirmed or Processed Order as JSON
  const exportOrderAsJSON = (order: OrderPreview | ProcessedOrder) => {
    const isPreview = (order as OrderPreview).items !== undefined;
    const items = isPreview
      ? (order as OrderPreview).items.map((i) => ({
          item_name: i.item_name,
          category: i.category,
          quantity: i.quantity,
          price: i.price,
          total_price: i.total_price,
          matched_sku: i.matchedProductSku || i.item_name,
          matched_product_id: itemMappings[i.item_name] || i.matchedProductId,
        }))
      : historyItems
          .filter((i) => i.order_id === order.order_id)
          .map((i) => ({
            item_name: i.item_name,
            category: i.category,
            quantity: i.quantity,
            price: i.price,
            total_price: i.total_price,
            sku: i.sku,
            product_id: i.product_id,
          }));

    const payload = {
      order_id: order.order_id,
      salesman_name: order.salesman_name,
      salesman_id: order.salesman_id,
      shop_name: order.shop_name,
      city: order.city,
      state: order.state,
      location_id: order.location_id,
      total_amount: order.total_amount,
      status: (order as any).status || 'CONFIRMED',
      processed_at: (order as any).processed_at || new Date().toISOString(),
      processed_by: (order as any).processed_by_name || 'Warehouse Manager',
      exported_at: new Date().toISOString(),
      items_count: items.length,
      items: items,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Order_${order.order_id}_${(order.shop_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Utility: Export Order as Official PDF Invoice (Matching Order App styling)
  const exportOrderAsPDF = (order: OrderPreview | ProcessedOrder) => {
    const isPreview = (order as OrderPreview).items !== undefined;
    const items = isPreview
      ? (order as OrderPreview).items.map((i) => ({
          category: i.category || 'General',
          item_name: i.item_name,
          sku: i.matchedProductSku || i.item_name,
          quantity: i.quantity,
          price: i.price,
          total_price: i.total_price,
        }))
      : historyItems
          .filter((i) => i.order_id === order.order_id)
          .map((i) => ({
            category: i.category || 'General',
            item_name: i.item_name,
            sku: i.sku || '-',
            quantity: i.quantity,
            price: i.price,
            total_price: i.total_price,
          }));

    const pdfData: PDFOrderExportData = {
      order_id: order.order_id,
      timestamp: (order as any).processed_at
        ? new Date((order as any).processed_at).toLocaleString()
        : (order as any).created_at
        ? new Date((order as any).created_at).toLocaleString()
        : new Date().toLocaleString(),
      salesman_name: order.salesman_name,
      salesman_id: order.salesman_id,
      shop_name: order.shop_name,
      city: order.city,
      state: order.state,
      location_id: order.location_id,
      status: (order as any).status || 'CONFIRMED',
      processed_by: (order as any).processed_by_name || 'Warehouse Manager',
      items:
        items.length > 0
          ? items
          : [
              {
                category: 'General',
                item_name: 'Order Line Item',
                quantity: 1,
                price: order.total_amount,
                total_price: order.total_amount,
              },
            ],
    };

    generateOrderPDF(pdfData);
  };

  // Sync Live Orders button
  const handleSyncLive = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncOrdersNow();
      await fetchOrders(true);
      if (res.connected) {
        dialog.showSuccess({
          title: 'Live Queue Synced',
          message: res.message,
        });
      } else {
        dialog.showInfo({
          title: 'Supabase Offline Mode',
          message: 'Supabase connection is unconfigured or offline. You can still import order files seamlessly using the JSON Import button.',
        });
      }
    } catch (err: any) {
      dialog.showError({
        title: 'Sync Failed',
        message: err.message || 'Failed to sync with Supabase order queue.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle JSON file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so selecting same file triggers change
    e.target.value = '';

    try {
      const text = await file.text();
      let parsedData: any;
      try {
        parsedData = JSON.parse(text);
      } catch (parseErr) {
        dialog.showError({
          title: 'Invalid File Format',
          message: 'The selected file is not a valid JSON document.',
        });
        return;
      }

      // First attempt import
      const result = await api.importOrderJson(parsedData, false);

      if (result.isDuplicate) {
        // Show duplicate confirmation modal
        dialog.showWarning({
          title: 'Duplicate Order Detected',
          message: `${result.warning}\n\nDo you want to force import this order anyway for re-processing?`,
          confirmText: 'Force Import',
          onConfirm: async () => {
            try {
              const forceResult = await api.importOrderJson(parsedData, true);
              await fetchOrders(true);
              handleReviewOrder(forceResult.order);
              dialog.showSuccess({
                title: 'Order Imported',
                message: `Order ${forceResult.order.order_id} has been added to the pending review queue.`,
              });
            } catch (err: any) {
              dialog.showError({
                title: 'Import Failed',
                message: err.message,
              });
            }
          },
        });
        return;
      }

      // Success
      await fetchOrders(true);
      handleReviewOrder(result.order);
      dialog.showSuccess({
        title: 'Order Imported Successfully',
        message: `Order ${result.order.order_id} (${result.order.shop_name}) loaded into the queue with ${result.order.items.length} item(s).`,
      });
    } catch (err: any) {
      dialog.showError({
        title: 'Import Error',
        message: err.message || 'Failed to parse and import order JSON file.',
      });
    }
  };

  // Open review drawer for an order
  const handleReviewOrder = (order: OrderPreview) => {
    setSelectedOrder(order);
    // Initialize mapping state for items
    const initialMappings: Record<string, string> = {};
    for (const item of order.items) {
      if (item.matched && item.matchedProductId) {
        initialMappings[item.item_name] = item.matchedProductId;
      }
    }
    setItemMappings(initialMappings);
    setSelectedAddProductId('');
  };

  // Change product mapping for an item
  const handleMapProduct = (itemName: string, productId: string) => {
    setItemMappings((prev) => ({
      ...prev,
      [itemName]: productId,
    }));
  };

  // Dynamic Item Quantity Update inside Review Drawer (supports direct typing and backspacing)
  const handleUpdateItemQty = (itemName: string, newQty: number | string) => {
    if (!selectedOrder) return;
    if (newQty === '') {
      setSelectedOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.item_name === itemName ? { ...i, quantity: '' as any } : i
          ),
        };
      });
      return;
    }

    const parsed = typeof newQty === 'number' ? newQty : parseInt(String(newQty).replace(/\D/g, ''), 10);
    if (isNaN(parsed)) return;
    const qty = Math.max(1, parsed);

    setSelectedOrder((prev) => {
      if (!prev) return prev;
      const updatedItems = prev.items.map((i) =>
        i.item_name === itemName
          ? {
              ...i,
              quantity: qty,
              total_price: Number((i.price * qty).toFixed(2)),
            }
          : i
      );
      const newTotal = Number(
        updatedItems.reduce((sum, item) => sum + (item.total_price || 0), 0).toFixed(2)
      );
      const hasDeficit = updatedItems.some((i) => {
        const prodId = itemMappings[i.item_name] || i.matchedProductId;
        const prod = products.find((p) => p.id === prodId);
        const stock = prod ? prod.currentStock : i.currentStock;
        return stock < (Number(i.quantity) || 0);
      });

      return {
        ...prev,
        items: updatedItems,
        total_amount: newTotal,
        hasStockExceeded: hasDeficit,
      };
    });
  };

  const handleBlurItemQty = (itemName: string) => {
    if (!selectedOrder) return;
    const item = selectedOrder.items.find((i) => i.item_name === itemName);
    if (!item || !item.quantity || Number(item.quantity) < 1) {
      handleUpdateItemQty(itemName, 1);
    }
  };

  // Dynamic Item Removal inside Review Drawer
  const handleRemoveOrderItem = (itemName: string) => {
    if (!selectedOrder) return;
    if (selectedOrder.items.length <= 1) {
      dialog.showWarning({
        title: 'Cannot Delete Last Item',
        message: 'An order must contain at least one item. If you wish to dismiss this order, please click Reject Order.',
      });
      return;
    }

    setSelectedOrder((prev) => {
      if (!prev) return prev;
      const updatedItems = prev.items.filter((i) => i.item_name !== itemName);
      const newTotal = updatedItems.reduce((sum, item) => sum + item.total_price, 0);
      const hasUnmatched = updatedItems.some(
        (i) => !itemMappings[i.item_name] && (!i.matched || !i.matchedProductId)
      );
      const hasDeficit = updatedItems.some((i) => {
        const prodId = itemMappings[i.item_name] || i.matchedProductId;
        const prod = products.find((p) => p.id === prodId);
        const stock = prod ? prod.currentStock : i.currentStock;
        return stock < i.quantity;
      });

      return {
        ...prev,
        items: updatedItems,
        total_amount: newTotal,
        hasUnmatchedItems: hasUnmatched,
        hasStockExceeded: hasDeficit,
      };
    });
  };

  // Dynamic Item Addition from Catalog into Review Drawer
  const handleAddProductToOrder = () => {
    if (!selectedAddProductId || !selectedOrder) return;
    const prod = products.find((p) => p.id === selectedAddProductId);
    if (!prod) return;

    const existingIdx = selectedOrder.items.findIndex((i) => i.item_name === prod.name);
    if (existingIdx >= 0) {
      handleUpdateItemQty(prod.name, (Number(selectedOrder.items[existingIdx].quantity) || 0) + 1);
      setSelectedAddProductId('');
      setAddProductSearchQuery('');
      setIsAddProductOpen(false);
      return;
    }

    const newItem: OrderPreviewItem = {
      item_name: prod.name,
      category: prod.category_id || 'Hardware',
      quantity: 1,
      price: prod.unit_cost || 0,
      total_price: prod.unit_cost || 0,
      matched: true,
      matchType: 'MANUAL',
      matchedProductId: prod.id,
      matchedProductSku: prod.sku,
      matchedProductName: prod.name,
      currentStock: prod.currentStock,
      unit: prod.unit || 'Pieces',
      hasSufficientStock: prod.currentStock >= 1,
    };

    setItemMappings((prev) => ({ ...prev, [prod.name]: prod.id }));

    setSelectedOrder((prev) => {
      if (!prev) return prev;
      const updatedItems = [...prev.items, newItem];
      const newTotal = updatedItems.reduce((sum, item) => sum + item.total_price, 0);
      return {
        ...prev,
        items: updatedItems,
        total_amount: newTotal,
      };
    });

    setSelectedAddProductId('');
    setAddProductSearchQuery('');
    setIsAddProductOpen(false);
  };

  // Execute Order Confirmation & Stock Deduction
  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;

    // Check if any items are unmapped
    const unmapped = selectedOrder.items.filter(
      (item) => !itemMappings[item.item_name] && (!item.matched || !item.matchedProductId)
    );

    if (unmapped.length > 0) {
      dialog.showWarning({
        title: 'Unmatched Items Found',
        message: `There are ${unmapped.length} item(s) that have not been mapped to a product in the catalog. Please map all items before confirming stock deduction.`,
      });
      return;
    }

    // Build resolved items payload
    const resolvedItems = selectedOrder.items.map((item) => {
      const prodId = itemMappings[item.item_name] || item.matchedProductId!;
      return {
        itemName: item.item_name,
        productId: prodId,
        quantity: item.quantity,
        price: item.price,
      };
    });

    // Check for stock deficit warnings
    const deficitItems = selectedOrder.items.filter((item) => {
      const prodId = itemMappings[item.item_name] || item.matchedProductId!;
      const prod = products.find((p) => p.id === prodId);
      const stock = prod ? prod.currentStock : item.currentStock;
      return stock < item.quantity;
    });

    const executeConfirmation = async () => {
      setIsConfirming(true);
      const orderCopy = { ...selectedOrder };
      try {
        const res = await api.confirmOrder(
          selectedOrder.order_id,
          resolvedItems,
          {
            source: selectedOrder.source,
            salesmanName: selectedOrder.salesman_name,
            salesmanId: selectedOrder.salesman_id,
            shopName: selectedOrder.shop_name,
            city: selectedOrder.city,
            state: selectedOrder.state,
            totalAmount: selectedOrder.total_amount,
            created_at: selectedOrder.created_at,
          }
        );

        setSelectedOrder(null);
        if (onRefreshProducts) onRefreshProducts();
        await fetchOrders(true);

        // Prompt manager with both PDF & JSON export options
        dialog.showConfirm({
          title: 'Order Confirmed & Stock Deducted',
          message: `Order ${orderCopy.order_id} for "${orderCopy.shop_name}" has been approved (${res.affectedProducts.length} product(s) stock deducted).\n\nYou have a 15-minute grace window to edit or reject this order if needed.\n\nChoose an export format to download:`,
          confirmText: 'Download Official PDF Invoice',
          cancelText: 'Download JSON File',
          onConfirm: () => {
            exportOrderAsPDF(orderCopy);
          },
          onCancel: () => {
            exportOrderAsJSON(orderCopy);
          },
        });
      } catch (err: any) {
        dialog.showError({
          title: 'Confirmation Failed',
          message: err.message || 'Failed to process order confirmation and stock deduction.',
        });
      } finally {
        setIsConfirming(false);
      }
    };

    if (deficitItems.length > 0) {
      dialog.showWarning({
        title: 'Insufficient Stock Warning',
        message: `${deficitItems.length} item(s) have ordered quantities that exceed current physical stock. Confirming will result in negative or low stock balances. Proceed anyway?`,
        confirmText: 'Confirm Anyway',
        onConfirm: executeConfirmation,
      });
    } else {
      executeConfirmation();
    }
  };

  // Reject Order from Active Queue
  const handleRejectOrder = (order: OrderPreview) => {
    dialog.showConfirm({
      title: 'Reject Order?',
      message: `Are you sure you want to reject Order ${order.order_id} (${order.shop_name})? This will move the order to Rejected status. You can reopen it at any time within the 15-minute grace window.`,
      confirmText: 'Reject Order',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api.rejectOrder(order.order_id, order.source, 'Rejected by inventory manager');
          dialog.showInfo({
            title: 'Order Rejected',
            message: `Order ${order.order_id} was rejected. You can reopen and accept it within 15 minutes from the Processed History tab.`,
          });
          if (selectedOrder?.order_id === order.order_id) {
            setSelectedOrder(null);
          }
          await fetchOrders(true);
        } catch (err: any) {
          dialog.showError({
            title: 'Rejection Failed',
            message: err.message || 'Failed to reject order.',
          });
        }
      },
    });
  };

  // Reopen Order from History (CONFIRMED -> revert stock & re-queue, REJECTED -> re-queue)
  const handleReopenOrder = (order: ProcessedOrder) => {
    const grace = getGracePeriodInfo(order.processed_at);
    if (!grace.isActive) {
      dialog.showWarning({
        title: 'Grace Window Expired',
        message: `The 15-minute grace window for Order ${order.order_id} has closed. This order has been permanently audited and cannot be modified.`,
      });
      return;
    }

    const isConfirmed = order.status === 'CONFIRMED';
    dialog.showConfirm({
      title: isConfirmed ? 'Reopen & Edit Order?' : 'Reopen & Accept Order?',
      message: isConfirmed
        ? `Reopening Order ${order.order_id} (${order.shop_name}) will restore previously deducted physical stock and place the order back in the Active Review Queue where you can edit quantities, items, or re-confirm.\n\n⏱️ Grace Window: ${grace.remainingMin} minute(s) remaining.\n\nProceed with reopening?`
        : `Reopening Order ${order.order_id} (${order.shop_name}) will move it back to the Active Review Queue for confirmation.\n\n⏱️ Grace Window: ${grace.remainingMin} minute(s) remaining.\n\nProceed with reopening?`,
      confirmText: isConfirmed ? 'Reopen & Restore Stock' : 'Reopen Order',
      onConfirm: async () => {
        try {
          const res = await api.reopenOrder(order.order_id);
          if (onRefreshProducts) onRefreshProducts();
          await fetchOrders(true);
          setActiveSubTab('pending');
          handleReviewOrder(res.reopenedOrder);
          dialog.showSuccess({
            title: 'Order Reopened in Active Queue',
            message: isConfirmed
              ? `Order ${order.order_id} reopened. Physical stock restored for ${res.affectedProducts.length} product(s). You can now edit items and re-confirm.`
              : `Order ${order.order_id} moved back to active review queue.`,
          });
        } catch (err: any) {
          dialog.showError({
            title: 'Reopen Failed',
            message: err.message || 'Failed to reopen order.',
          });
        }
      },
    });
  };

  // Rollback and Reject an already Confirmed Order
  const handleRollbackAndReject = (order: ProcessedOrder) => {
    const grace = getGracePeriodInfo(order.processed_at);
    if (!grace.isActive) {
      dialog.showWarning({
        title: 'Grace Window Expired',
        message: `The 15-minute grace window for Order ${order.order_id} has closed. This order has been finalized and cannot be modified.`,
      });
      return;
    }

    dialog.showConfirm({
      title: 'Reject & Revert Stock?',
      message: `Are you sure you want to reject Order ${order.order_id} (${order.shop_name})? This will revert the physical stock deduction back into inventory and mark this order as Rejected.\n\n⏱️ Grace Window: ${grace.remainingMin} minute(s) remaining.`,
      confirmText: 'Reject & Revert Stock',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await api.rollbackAndRejectOrder(order.order_id, 'Rejected during 15-minute grace window');
          if (onRefreshProducts) onRefreshProducts();
          await fetchOrders(true);
          dialog.showInfo({
            title: 'Order Rejected & Stock Restored',
            message: `Order ${order.order_id} is now Rejected. Physical stock restored for ${res.affectedProducts.length} product(s).`,
          });
        } catch (err: any) {
          dialog.showError({
            title: 'Rollback Failed',
            message: err.message || 'Failed to rollback and reject order.',
          });
        }
      },
    });
  };

  // Most recent processed order for quick grace window banner
  const mostRecentProcessed = useMemo(() => {
    if (orderHistory.length === 0) return null;
    return orderHistory[0];
  }, [orderHistory]);

  const recentGraceInfo = mostRecentProcessed ? getGracePeriodInfo(mostRecentProcessed.processed_at) : null;

  // Filtered Pending Orders
  const filteredPendingOrders = useMemo(() => {
    return pendingOrders.filter((order) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = order.order_id.toLowerCase().includes(query);
        const matchesShop = order.shop_name.toLowerCase().includes(query);
        const matchesSalesman = order.salesman_name.toLowerCase().includes(query);
        const matchesCity = order.city?.toLowerCase().includes(query);
        if (!matchesId && !matchesShop && !matchesSalesman && !matchesCity) return false;
      }

      // Source filter
      if (sourceFilter !== 'all' && order.source !== sourceFilter) return false;

      // Issue filter
      if (issueFilter === 'unmatched' && !order.hasUnmatchedItems) return false;
      if (issueFilter === 'stock_issue' && !order.hasStockExceeded) return false;
      if (issueFilter === 'ready' && (order.hasUnmatchedItems || order.hasStockExceeded)) return false;

      return true;
    });
  }, [pendingOrders, searchQuery, sourceFilter, issueFilter]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Hidden JSON file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Pending Orders Queue
                </h1>
                {pendingOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                    {pendingOrders.length} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review and approve orders with 15-minute grace window editing, PDF invoices, JSON export, and stock deduction.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Supabase Connection Status Badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border',
              isLiveConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
            )}
            title={isLiveConnected ? 'Supabase Live Connected' : 'Supabase Not Configured (File Mode Active)'}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              )}
            />
            <span>{isLiveConnected ? 'Supabase Live' : 'Offline / File Mode'}</span>
          </div>

          {/* Sync Live Button */}
          <button
            onClick={handleSyncLive}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin text-indigo-600')} />
            <span>Sync Live</span>
          </button>

          {/* Import JSON File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Order File (.json)</span>
          </button>
        </div>
      </div>

      {/* Grace Window Quick Banner (shows live 15m countdown for most recent action) */}
      {mostRecentProcessed && (
        <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl p-3.5 px-4.5 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Last Order: <strong className="font-mono text-cyan-700 dark:text-cyan-300 font-bold">{mostRecentProcessed.order_id}</strong> ({mostRecentProcessed.shop_name})
                </span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                  mostRecentProcessed.status === 'CONFIRMED' || mostRecentProcessed.status === 'Accepted'
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                )}>
                  {mostRecentProcessed.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Processed {new Date(mostRecentProcessed.processed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>&bull;</span>
                {recentGraceInfo?.isActive ? (
                  <span className="text-amber-600 dark:text-amber-300 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500 dark:text-amber-400 animate-pulse" />
                    15m Grace Window: {recentGraceInfo.text}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    Grace window closed (Audit locked)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800">
            {/* Export PDF Button (Available only for Accepted / Confirmed orders) */}
            <button
              onClick={() => exportOrderAsPDF(mostRecentProcessed)}
              disabled={mostRecentProcessed.status !== 'CONFIRMED' && mostRecentProcessed.status !== 'Accepted'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900 disabled:opacity-40 disabled:cursor-not-allowed text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700/60 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
              title={
                mostRecentProcessed.status === 'CONFIRMED' || mostRecentProcessed.status === 'Accepted'
                  ? 'Download Official Confirmation PDF'
                  : 'PDF invoice is restricted to accepted/confirmed orders'
              }
            >
              <Printer className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <span>Official PDF</span>
            </button>

            {/* Export JSON Button (Available only for Accepted / Confirmed orders) */}
            <button
              onClick={() => exportOrderAsJSON(mostRecentProcessed)}
              disabled={mostRecentProcessed.status !== 'CONFIRMED' && mostRecentProcessed.status !== 'Accepted'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
              title={
                mostRecentProcessed.status === 'CONFIRMED' || mostRecentProcessed.status === 'Accepted'
                  ? 'Download Official JSON Payload'
                  : 'JSON payload is restricted to accepted/confirmed orders'
              }
            >
              <FileDown className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              <span>JSON</span>
            </button>

            {/* Reopen & Reject actions within 15-min window */}
            {mostRecentProcessed.status === 'CONFIRMED' ? (
              <>
                <button
                  onClick={() => handleReopenOrder(mostRecentProcessed)}
                  disabled={!recentGraceInfo?.isActive}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
                  title={recentGraceInfo?.isActive ? 'Reopen order to edit items & restore stock' : 'Grace window closed (>15m)'}
                >
                  <RotateCcw className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Reopen / Edit</span>
                </button>
                <button
                  onClick={() => handleRollbackAndReject(mostRecentProcessed)}
                  disabled={!recentGraceInfo?.isActive}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
                  title={recentGraceInfo?.isActive ? 'Reject order & restore stock' : 'Grace window closed (>15m)'}
                >
                  <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  <span>Reject</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleReopenOrder(mostRecentProcessed)}
                disabled={!recentGraceInfo?.isActive}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
                title={recentGraceInfo?.isActive ? 'Reopen and accept order' : 'Grace window closed (>15m)'}
              >
                <RotateCcw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Reopen & Accept</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs Navigation (Pending vs History) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveSubTab('pending')}
            className={cn(
              'pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 cursor-pointer',
              activeSubTab === 'pending'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            )}
          >
            <Inbox className="w-4 h-4" />
            <span>Active Queue</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[11px]',
                activeSubTab === 'pending'
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              )}
            >
              {pendingOrders.length}
            </span>
            {activeSubTab === 'pending' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={cn(
              'pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 cursor-pointer',
              activeSubTab === 'history'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            )}
          >
            <History className="w-4 h-4" />
            <span>Processed Order History</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[11px]',
                activeSubTab === 'history'
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              )}
            >
              {orderHistory.length}
            </span>
            {activeSubTab === 'history' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: ACTIVE PENDING QUEUE */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order ID, Shop Name, Salesman, City..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {/* Source Filter */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setSourceFilter('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer',
                    sourceFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  )}
                >
                  All Sources
                </button>
                <button
                  onClick={() => setSourceFilter('supabase')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer',
                    sourceFilter === 'supabase'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  )}
                >
                  <Radio className="w-3 h-3" />
                  <span>Live</span>
                </button>
                <button
                  onClick={() => setSourceFilter('file')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer',
                    sourceFilter === 'file'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  )}
                >
                  <FileText className="w-3 h-3" />
                  <span>Imported</span>
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={issueFilter}
                onChange={(e) => setIssueFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Statuses</option>
                <option value="ready">Ready to Confirm</option>
                <option value="unmatched">Unmatched Items</option>
                <option value="stock_issue">Stock Exceeded</option>
              </select>
            </div>
          </div>

          {/* Orders List View */}
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs font-medium">Checking pending orders queue...</span>
            </div>
          ) : filteredPendingOrders.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Queue is All Caught Up!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                No orders waiting for review right now. Live salesman submissions will appear here automatically, or you can import an offline order JSON file.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Order JSON File</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredPendingOrders.map((order) => {
                const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);

                return (
                  <div
                    key={order.order_id}
                    className={cn(
                      'p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/80 border transition-all duration-200 hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4',
                      order.hasUnmatchedItems
                        ? 'border-amber-200 dark:border-amber-800/50'
                        : order.hasStockExceeded
                        ? 'border-rose-200 dark:border-rose-800/50'
                        : 'border-slate-200/80 dark:border-slate-700/60'
                    )}
                  >
                    {/* Order Details Left */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 font-mono font-bold text-xs">
                        #{order.order_id.slice(-4)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {order.order_id}
                          </span>

                          {/* Source Badge */}
                          {order.source === 'supabase' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              <Radio className="w-2.5 h-2.5 animate-pulse" />
                              <span>Live Supabase</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                              <FileText className="w-2.5 h-2.5" />
                              <span>Imported JSON</span>
                            </span>
                          )}

                          {/* Issues Flags */}
                          {order.items.some((item) => (item.currentStock ?? 0) <= 0) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/70 shadow-2xs">
                              <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                              <span>0-Stock Override</span>
                            </span>
                          )}

                          {order.hasUnmatchedItems && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Needs Mapping</span>
                            </span>
                          )}

                          {order.hasStockExceeded && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>Stock Deficit</span>
                            </span>
                          )}

                          {!order.hasUnmatchedItems && !order.hasStockExceeded && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              <Check className="w-2.5 h-2.5" />
                              <span>Ready</span>
                            </span>
                          )}
                        </div>

                        {/* Store & Salesman Info */}
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                            <Store className="w-3.5 h-3.5 text-indigo-500" />
                            {order.shop_name}
                          </span>

                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {order.salesman_name}
                          </span>

                          {(order.city || order.state) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {[order.city, order.state].filter(Boolean).join(', ')}
                            </span>
                          )}

                          <span className="flex items-center gap-1 text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(order.created_at).toLocaleDateString()} at{' '}
                            {new Date(order.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Order Metrics & Actions Right */}
                    <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-700/60">
                      <div className="text-left md:text-right">
                        <div className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                          ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {order.items.length} item(s) • {totalQty} units
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Quick PDF Button (Disabled until confirmed) */}
                        <button
                          type="button"
                          disabled={true}
                          title="Official PDF Invoice is available once order is confirmed"
                          className="p-2 text-slate-400 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Quick JSON Button (Disabled until confirmed) */}
                        <button
                          type="button"
                          disabled={true}
                          title="Order JSON is available once order is confirmed"
                          className="p-2 text-slate-400 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>

                        {/* Reject Button */}
                        <button
                          type="button"
                          onClick={() => handleRejectOrder(order)}
                          title="Reject / Dismiss Order"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        {/* Review & Confirm Button */}
                        <button
                          type="button"
                          onClick={() => handleReviewOrder(order)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          <span>Review & Confirm</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: COMPLETED ORDER HISTORY */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {orderHistory.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
              <History className="w-8 h-8 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No Processed Orders Yet
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                When you review and confirm pending orders, they will be archived locally here as permanent audit history. You can reopen or reject them within the 15-minute grace window.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Customer Shop</th>
                      <th className="py-3 px-4">Salesman</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Processed Date</th>
                      <th className="py-3 px-4">Grace Window (15m)</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-right">Exports & Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {orderHistory.map((po) => {
                      const isConfirmed = po.status === 'CONFIRMED';
                      const grace = getGracePeriodInfo(po.processed_at);

                      return (
                        <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {po.order_id}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                            {po.shop_name}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {po.salesman_name}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                                isConfirmed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                              )}
                            >
                              {po.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(po.processed_at).toLocaleString()}
                          </td>

                          {/* Grace Period Countdown Badge */}
                          <td className="py-3 px-4">
                            {grace.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 animate-pulse">
                                <Clock className="w-2.5 h-2.5 text-amber-500" />
                                <span>{grace.text}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                <Lock className="w-2.5 h-2.5 text-slate-400" />
                                <span>Closed (&gt;15m)</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center font-medium text-slate-700 dark:text-slate-300">
                            {po.items_count}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                            ₹{po.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Export PDF invoice (Only available for Accepted / Confirmed orders) */}
                              <button
                                type="button"
                                onClick={() => exportOrderAsPDF(po)}
                                disabled={!isConfirmed}
                                title={
                                  isConfirmed
                                    ? 'Download Official PDF Invoice'
                                    : 'PDF invoice is disabled for rejected / non-confirmed orders'
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Printer className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                                <span>PDF</span>
                              </button>

                              {/* Export JSON button (Only available for Accepted / Confirmed orders) */}
                              <button
                                type="button"
                                onClick={() => exportOrderAsJSON(po)}
                                disabled={!isConfirmed}
                                title={
                                  isConfirmed
                                    ? 'Export Order JSON File'
                                    : 'JSON export is disabled for rejected / non-confirmed orders'
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <FileDown className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                                <span>JSON</span>
                              </button>

                              {/* Reopen / Edit / Accept Action (Active within 15 min) */}
                              <button
                                type="button"
                                onClick={() => handleReopenOrder(po)}
                                disabled={!grace.isActive}
                                title={
                                  grace.isActive
                                    ? isConfirmed
                                      ? 'Reopen order to edit items & restore stock'
                                      : 'Reopen and accept order'
                                    : 'Grace window closed (>15 minutes since processing)'
                                }
                                className={cn(
                                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed',
                                  isConfirmed
                                    ? 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                                    : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                )}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{isConfirmed ? 'Reopen & Edit' : 'Reopen & Accept'}</span>
                              </button>

                              {/* Reject action for Confirmed orders (Active within 15 min) */}
                              {isConfirmed && (
                                <button
                                  type="button"
                                  onClick={() => handleRollbackAndReject(po)}
                                  disabled={!grace.isActive}
                                  title={
                                    grace.isActive
                                      ? 'Reject order and revert stock deduction'
                                      : 'Grace window closed (>15 minutes since processing)'
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* REVIEW & EDITING MODAL / DRAWER */}
      {/* ========================================================== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                    Order {selectedOrder.order_id}
                  </h2>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                      selectedOrder.source === 'supabase'
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                        : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                    )}
                  >
                    {selectedOrder.source === 'supabase' ? 'Live Queue' : 'Imported File'}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                    Editable Order Draft
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Store: {selectedOrder.shop_name}
                  </span>
                  <span>Salesman: {selectedOrder.salesman_name}</span>
                  {(selectedOrder.city || selectedOrder.state) && (
                    <span>Location: {[selectedOrder.city, selectedOrder.state].filter(Boolean).join(', ')}</span>
                  )}
                  <span>Created: {new Date(selectedOrder.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={true}
                  title="Official PDF Invoice is generated once order is confirmed"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-50/40 dark:bg-cyan-950/30 text-cyan-700/50 dark:text-cyan-300/50 border border-cyan-200/40 dark:border-cyan-800/30 text-xs font-semibold cursor-not-allowed opacity-50"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-600/50 dark:text-cyan-400/50" />
                  <span>Official PDF</span>
                </button>

                <button
                  type="button"
                  disabled={true}
                  title="Order JSON is generated once order is confirmed"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100/40 dark:bg-slate-800/30 text-slate-700/50 dark:text-slate-200/50 text-xs font-semibold cursor-not-allowed opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5 text-indigo-600/50 dark:text-indigo-400/50" />
                  <span>JSON</span>
                </button>

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Manager Override Reminder Banner */}
            {selectedOrderOverrideStats.hasOverride && (
              <div className="bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-300/60 dark:border-amber-700/60 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shrink-0 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-amber-800 dark:text-amber-300">
                      Stock Override Reminder:
                    </span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">
                      {selectedOrderOverrideStats.zeroStockCount > 0 && (
                        <strong className="text-amber-700 dark:text-amber-300 font-semibold">
                          {selectedOrderOverrideStats.zeroStockCount} item(s) ordered with 0 physical stock
                        </strong>
                      )}
                      {selectedOrderOverrideStats.zeroStockCount > 0 && selectedOrderOverrideStats.deficitCount > 0 && ' and '}
                      {selectedOrderOverrideStats.deficitCount > 0 && (
                        <strong className="text-amber-700 dark:text-amber-300 font-semibold">
                          {selectedOrderOverrideStats.deficitCount} item(s) exceeding available inventory
                        </strong>
                      )}{' '}
                      under active manager override.
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 whitespace-nowrap shrink-0 shadow-2xs">
                  ⚡ Override Active
                </span>
              </div>
            )}

            {/* Modal Body: Items Reconciliation & Editable Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Order Items & Inventory Matching ({selectedOrder.items.length})
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Adjust quantities, remove line items, or add new catalog products before confirmation.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3.5 text-left min-w-[380px]">Product Description</th>
                        <th className="py-2.5 px-3 text-center w-28 shrink-0">Quantity</th>
                        <th className="py-2.5 px-3 text-center w-20 shrink-0">Stock</th>
                        <th className="py-2.5 px-3 text-center w-24 shrink-0">Status</th>
                        <th className="py-2.5 px-3 text-right w-24 shrink-0">Unit Price</th>
                        <th className="py-2.5 px-3 text-right w-24 shrink-0">Subtotal</th>
                        <th className="py-2.5 px-2 text-center w-10 shrink-0"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedOrder.items.map((item, idx) => {
                        const selectedProdId = itemMappings[item.item_name] || item.matchedProductId;
                        const mappedProd = products.find((p) => p.id === selectedProdId);
                        const currentStock = mappedProd ? mappedProd.currentStock : item.currentStock;
                        const numericQty = Number(item.quantity) || 0;
                        const isSufficient = currentStock >= numericQty;
                        const isUnmatched = !selectedProdId;
                        const isZeroStock = currentStock <= 0;
                        const isDeficit = currentStock < numericQty;

                        return (
                          <tr
                            key={idx}
                            className={cn(
                              'hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors',
                              isUnmatched ? 'bg-amber-50/20 dark:bg-amber-950/20' : ''
                            )}
                          >
                            {/* Product Details */}
                            <td className="py-2 px-3.5 align-middle">
                              {isUnmatched ? (
                                <div className="flex items-center justify-between gap-3 min-w-0">
                                  {/* Left: Item name & category directly below */}
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                                        {item.item_name}
                                      </span>
                                      {isZeroStock ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 shadow-2xs shrink-0" title="Item was ordered with 0 physical stock under stock override">
                                          <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                          Override (0 Stock)
                                        </span>
                                      ) : isDeficit ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs shrink-0" title="Item quantity exceeds physical available stock under override">
                                          <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                          Override (Deficit)
                                        </span>
                                      ) : null}
                                    </div>
                                    {item.category && (
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        {item.category}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right: Unmatched badge & Catalog select dropdown at same height */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 whitespace-nowrap">
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                                      Unmapped
                                    </span>
                                    <select
                                      value=""
                                      onChange={(e) => handleMapProduct(item.item_name, e.target.value)}
                                      className="text-xs px-2 py-1 bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-700/80 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer max-w-[200px] truncate"
                                    >
                                      <option value="">Map to Catalog Product...</option>
                                      {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name} (Stock: {p.currentStock})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3 min-w-0">
                                  {/* Left: Item name & category directly below */}
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                                        {item.item_name}
                                      </span>
                                      {isZeroStock ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 shadow-2xs shrink-0" title="Item was ordered with 0 physical stock under stock override">
                                          <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                          Override (0 Stock)
                                        </span>
                                      ) : isDeficit ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs shrink-0" title="Item quantity exceeds physical available stock under override">
                                          <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                          Override (Deficit)
                                        </span>
                                      ) : null}
                                    </div>
                                    {item.category && (
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        {item.category}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right: SKU in a single horizontal line & Dropdown at same height */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/70">
                                      SKU: {mappedProd?.sku || item.matchedProductSku || 'Matched'}
                                    </span>
                                    <select
                                      value={selectedProdId}
                                      onChange={(e) => handleMapProduct(item.item_name, e.target.value)}
                                      className="text-xs px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[180px] truncate shadow-2xs"
                                      title="Remap Product"
                                    >
                                      {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Quantity Stepper */}
                            <td className="py-2 px-3 text-center align-middle whitespace-nowrap">
                              <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg overflow-hidden shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(item.item_name, (Number(item.quantity) || 1) - 1)}
                                  title="Decrease quantity"
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer active:scale-95"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.quantity === '' ? '' : item.quantity}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') {
                                      handleUpdateItemQty(item.item_name, '');
                                    } else {
                                      const clean = raw.replace(/\D/g, '');
                                      handleUpdateItemQty(item.item_name, clean === '' ? '' : parseInt(clean, 10));
                                    }
                                  }}
                                  onBlur={() => handleBlurItemQty(item.item_name)}
                                  onFocus={(e) => e.target.select()}
                                  placeholder="1"
                                  className="w-10 text-center text-xs font-mono font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(item.item_name, (Number(item.quantity) || 0) + 1)}
                                  title="Increase quantity"
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer active:scale-95"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* Current Stock */}
                            <td className="py-2 px-3 text-center align-middle font-mono font-bold whitespace-nowrap">
                              <span
                                className={cn(
                                  currentStock <= 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : currentStock < numericQty
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-700 dark:text-slate-200'
                                )}
                              >
                                {currentStock}
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="py-2 px-3 text-center align-middle whitespace-nowrap">
                              {isUnmatched ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                                  Unmapped
                                </span>
                              ) : isZeroStock ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80">
                                  <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                  0 Stock (Override)
                                </span>
                              ) : isSufficient ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                  In Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                                  Deficit ({currentStock - numericQty})
                                </span>
                              )}
                            </td>

                            {/* Unit Price */}
                            <td className="py-2 px-3 text-right align-middle text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                              ₹{item.price.toFixed(2)}
                            </td>

                            {/* Subtotal */}
                            <td className="py-2 px-3 text-right align-middle font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                              ₹{(item.total_price || 0).toFixed(2)}
                            </td>

                            {/* Delete Action */}
                            <td className="py-2 px-2 text-center align-middle">
                              <button
                                type="button"
                                onClick={() => handleRemoveOrderItem(item.item_name)}
                                title="Remove item from order"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Product from Catalog Toolbar */}
              <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2 shrink-0">
                  <Plus className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Add Product to Order:
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xl min-w-0">
                  {/* Searchable Autocomplete Combobox */}
                  <div ref={addProductRef} className="relative flex-1 min-w-0">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={addProductSearchQuery}
                        onChange={(e) => {
                          setAddProductSearchQuery(e.target.value);
                          setSelectedAddProductId('');
                          setIsAddProductOpen(true);
                        }}
                        onFocus={() => setIsAddProductOpen(true)}
                        placeholder={`Search ${products.length} catalog items by name or SKU...`}
                        className="w-full pl-8 pr-8 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                      />
                      {addProductSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddProductSearchQuery('');
                            setSelectedAddProductId('');
                          }}
                          className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Floating Suggestions Dropdown */}
                    {isAddProductOpen && (
                      <div className="absolute bottom-full mb-1.5 left-0 right-0 max-h-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto z-50 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
                        {filteredCatalogProducts.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No matching catalog products found
                          </div>
                        ) : (
                          filteredCatalogProducts.map((p) => {
                            const isSelected = selectedAddProductId === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectAddProduct(p)}
                                className={cn(
                                  'w-full text-left p-2.5 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 transition-colors flex items-center justify-between gap-3 cursor-pointer text-xs',
                                  isSelected ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''
                                )}
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {p.name}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                    {p.category_id && <span>{p.category_id}</span>}
                                    {p.category_id && <span>&bull;</span>}
                                    <span className="font-mono">SKU: {p.sku || 'N/A'}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={cn(
                                      'px-1.5 py-0.5 rounded text-[10px] font-bold font-mono',
                                      p.currentStock > 0
                                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                                    )}
                                  >
                                    Stock: {p.currentStock}
                                  </span>
                                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                                    ₹{(p.unit_cost || 0).toFixed(2)}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddProductToOrder}
                    disabled={!selectedAddProductId}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              {/* Warnings Summary if any */}
              {selectedOrder.hasStockExceeded && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Stock Deficit Notice:</span> One or more items in this order exceed current stock levels. Confirming will deduct stock and record the audit entry.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-4 shrink-0">
              <div>
                <div className="text-xs text-slate-500">Order Total Amount</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  ₹{selectedOrder.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleRejectOrder(selectedOrder)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                >
                  Reject Order
                </button>

                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={isConfirming}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isConfirming ? 'Processing...' : 'Confirm & Deduct Stock'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
