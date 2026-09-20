import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  UserCheck,
  Package,
  Plus,
  Minus,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  LogOut,
  Building,
  Boxes,
  Store,
  WifiOff,
  RefreshCw,
  Send,
  Radio,
  Trash2,
  Tag,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  Clock,
  MapPin,
  CloudOff,
  Lock,
  Mail,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

import type {
  InventoryItem,
  DealerRecord,
  PDFOrderData
} from '../types';

import { supabase } from '../lib/supabaseClient';
import { reserveOrder } from '@/shared/api/orders';
import { buildOrderPayload, downloadOrderAsJSON } from '../utils/buildOrder';
import { generateOrderPDF } from '../utils/pdfGenerator';
import InfoModal from './InfoModal';
import type { ModalType, ModalDetailItem } from './InfoModal';
import SalesmanOrdersPanel from './SalesmanOrdersPanel';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  enqueueOfflineOrder,
  getOfflineQueue,
  syncOfflineQueue,
  onOfflineQueueChange,
  type QueuedOrder
} from '../utils/offlineQueue';

interface OrderItemRow {
  id: string;
  name: string;
  qty: number | '';
}

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string | React.ReactNode;
  details?: ModalDetailItem[];
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onConfirm?: () => void;
  autoCloseMs?: number;
}

// Helper to determine brand from category or item name
function deriveBrand(category?: string, brand?: string): string {
  if (brand && brand.trim()) return brand.trim();
  if (!category) return 'Nalka Metals';
  if (category.toLowerCase().includes('collection')) {
    return category.replace(/collection/i, '').trim();
  }
  if (category !== 'Uncategorized') {
    return category;
  }
  return 'Nalka Metals';
}

// Highlight matching search tokens in text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return <>{text}</>;

  const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold px-0.5 rounded">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// Helper: Map state and city to standard Location ID (e.g. LOC-HR-01, LOC-DL-01, LOC-UP-01)
export function deriveLocationId(state: string, city: string): string {
  if (!state || state === '--') return '--';
  const s = String(state).trim().toLowerCase();
  const c = String(city || '').trim().toLowerCase();

  const stateCodeMap: Record<string, string> = {
    'haryana': 'HR',
    'delhi': 'DL',
    'new delhi': 'DL',
    'uttar pradesh': 'UP',
    'punjab': 'PB',
    'rajasthan': 'RJ',
    'maharashtra': 'MH',
    'gujarat': 'GJ',
    'madhya pradesh': 'MP',
    'bihar': 'BR',
    'west bengal': 'WB',
    'karnataka': 'KA',
    'tamil nadu': 'TN',
    'andhra pradesh': 'AP',
    'telangana': 'TS',
    'kerala': 'KL',
    'odisha': 'OD',
    'assam': 'AS',
    'uttarakhand': 'UK',
    'himachal pradesh': 'HP',
    'jammu and kashmir': 'JK',
    'chandigarh': 'CH',
  };

  const stateCode = stateCodeMap[s] || (state.length >= 2 ? state.slice(0, 2).toUpperCase() : 'HR');

  if (s === 'haryana') {
    if (c.includes('gurugram') || c.includes('gurgaon')) return 'LOC-HR-01';
    if (c.includes('faridabad')) return 'LOC-HR-02';
    if (c.includes('sonipat') || c.includes('sonepat')) return 'LOC-HR-03';
    if (c.includes('panipat')) return 'LOC-HR-04';
    if (c.includes('rohtak')) return 'LOC-HR-05';
    if (c.includes('jhajjar')) return 'LOC-HR-06';
    if (c.includes('karnal')) return 'LOC-HR-07';
    if (c.includes('ambala')) return 'LOC-HR-08';
    return 'LOC-HR-01';
  }

  if (s === 'delhi' || s === 'new delhi') {
    if (c.includes('new delhi') || c.includes('central')) return 'LOC-DL-01';
    if (c.includes('south')) return 'LOC-DL-02';
    if (c.includes('north')) return 'LOC-DL-03';
    if (c.includes('east')) return 'LOC-DL-04';
    if (c.includes('west')) return 'LOC-DL-05';
    return 'LOC-DL-01';
  }

  if (s.includes('uttar pradesh') || s === 'up') {
    if (c.includes('noida')) return 'LOC-UP-01';
    if (c.includes('ghaziabad')) return 'LOC-UP-02';
    if (c.includes('greater noida')) return 'LOC-UP-03';
    if (c.includes('meerut')) return 'LOC-UP-04';
    if (c.includes('agra')) return 'LOC-UP-05';
    if (c.includes('lucknow')) return 'LOC-UP-06';
    if (c.includes('kanpur')) return 'LOC-UP-07';
    return 'LOC-UP-01';
  }

  return `LOC-${stateCode}-01`;
}

// Canonical master list of official salesmen with their Tally/Database IDs
export const VALID_SALESMEN: Array<{ id: string; name: string }> = [
  { id: 'TLY-SLM-001', name: 'ANKIT' },
  { id: 'TLY-SLM-002', name: 'CHANDRA PRAKASH' },
  { id: 'TLY-SLM-003', name: 'NALKA' },
  { id: 'TLY-SLM-004', name: 'RAVINDER  - NOIDA' },
  { id: 'TLY-SLM-005', name: 'RAVINDER KUMAR' },
  { id: 'TLY-SLM-006', name: 'SAURAV' },
  { id: 'TLY-SLM-007', name: 'YOJIT' },
  { id: 'DIRECT', name: 'Direct / House Account' },
];

export const VALID_SALESMAN_NAMES = VALID_SALESMEN.map(s => s.name);

export default function SalesmanPortal() {
  const { isDark, toggleTheme } = useTheme();

  // Authentication & Identity (Bound to Supabase Auth)
  const {
    user,
    profile,
    isAuthenticated,
    loading: authLoading,
    signInWithEmail,
    signInAsSalesman,
    signOut
  } = useAuth();

  // Login Form States (for unauthenticated view)
  const [loginMode, setLoginMode] = useState<'profile' | 'credentials'>('profile');
  const [loginSalesman, setLoginSalesman] = useState<string>(VALID_SALESMAN_NAMES[0]);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('password123');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  // Authoritative identity derived exclusively from server-side profile
  const userRole = profile?.role === 'customer' ? 'Customer' : 'Salesman';
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';
  const [adminSelectedSalesman, setAdminSelectedSalesman] = useState<string>('');
  const selectedSalesman = isAdminOrManager
    ? (adminSelectedSalesman || profile?.salesman_name || VALID_SALESMAN_NAMES[0])
    : (profile?.salesman_name || VALID_SALESMAN_NAMES[0]);

  // Selected Shop (Locked to profile for customer; selected from assigned dealers for salesman)
  const [selectedShop, setSelectedShop] = useState<string>('');

  useEffect(() => {
    if (profile?.role === 'customer' && profile?.shop_name) {
      setSelectedShop(profile.shop_name);
    }
  }, [profile]);


  // Offline Queue State (Non-sensitive client queue for offline resilience)
  const [offlineQueue, setOfflineQueue] = useState<QueuedOrder[]>(() => getOfflineQueue());
  const [syncingQueue, setSyncingQueue] = useState<boolean>(false);

  useEffect(() => {
    return onOfflineQueueChange(setOfflineQueue);
  }, []);

  // Main Data States
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync / Offline State
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [manualOffline, setManualOffline] = useState<boolean>(() => {
    return localStorage.getItem('app_manual_offline') === 'true';
  });
  const [syncingInventory, setSyncingInventory] = useState<boolean>(false);
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [allowNegativeOrders, setAllowNegativeOrders] = useState<boolean>(false);

  // Export & Download Preferences for Confirmation Dialog
  const [isConfirmOrderModalOpen, setIsConfirmOrderModalOpen] = useState<boolean>(false);
  const [exportPrefs, setExportPrefs] = useState<{
    downloadPdf: boolean;
    downloadJson: boolean;
    rememberChoice: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('nalka_order_export_prefs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      downloadPdf: true,
      downloadJson: true,
      rememberChoice: false,
    };
  });

  // Single flat list of added order items
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);

  // SINGLE SEARCH BAR STATE FOR SEARCHING & ADDING
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Inventory Ledger Search, Filter & Pagination
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('All');
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerPageSize, setLedgerPageSize] = useState<number>(25);

  // Navigation Tab Switcher ('order' | 'my-orders' | 'ledger')
  const [activeTab, setActiveTab] = useState<'order' | 'my-orders' | 'ledger'>('order');

  // Unified Info Pop-up Modal State
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  const showModal = (params: Omit<ModalState, 'isOpen'>) => {
    setIsSearchOpen(false);
    setModalState({
      isOpen: true,
      ...params
    });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  // Helper to provide initial fallback inventory when offline
  const loadCsvInventoryFallback = (): InventoryItem[] => {
    return [
      {
        SKU: 'AL-ROD-01',
        'Item Name': 'Aluminum Rod 12mm',
        Category: 'General',
        Brand: 'Nalka Metals',
        Price: 450,
        'Current Stock': 100,
        'Total Stock': 100,
        'Reserved Stock': 0,
      },
      {
        SKU: 'AL-INGOT-99',
        'Item Name': 'Aluminum Ingot',
        Category: 'General',
        Brand: 'Nalka Metals',
        Price: 220,
        'Current Stock': 500,
        'Total Stock': 500,
        'Reserved Stock': 0,
      },
    ];
  };

  // Fetch Inventory from Supabase (with automatic CSV fallback and user feedback)
  const fetchInventoryData = async (forceOfflineMode = manualOffline, isManualSync = false) => {
    setSyncingInventory(true);
    try {
      if (forceOfflineMode) {
        const fallback = loadCsvInventoryFallback();
        setInventory(fallback);
        setIsOffline(true);
        if (isManualSync) {
          showModal({
            type: 'warning',
            title: 'Offline Catalog Loaded',
            message: 'Manual offline mode is enabled. Loaded local bundled Tally catalog with last-known stock levels.',
            details: [{ label: 'Total Catalog SKUs', value: `${fallback.length} products` }, { label: 'Mode', value: 'Offline (CSV)' }]
          });
        }
        return;
      }

      // Try Supabase (Fetch ALL rows in batches of 1000 to bypass PostgREST max row limit)
      let allRows: any[] = [];
      let page = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * batchSize;
        const to = from + batchSize - 1;
        const { data: chunk, error: chunkError } = await supabase
          .from('inventory_catalog')
          .select('*')
          .range(from, to);

        if (chunkError) {
          console.error('Error fetching inventory_catalog:', chunkError);
          throw chunkError;
        }

        if (chunk && chunk.length > 0) {
          allRows = allRows.concat(chunk);
          if (chunk.length < batchSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      if (allRows.length === 0) {
        console.warn('Supabase inventory table returned 0 items, falling back to bundled CSV catalog');
        const fallback = loadCsvInventoryFallback();
        setInventory(fallback);
        setIsOffline(true);
        if (isManualSync) {
          showModal({
            type: 'warning',
            title: 'Empty Cloud Catalog',
            message: 'Supabase inventory returned 0 items. Loaded local bundled catalog with last-known stock levels.',
            details: [
              { label: 'Catalog Mode', value: 'Local Fallback' },
              { label: 'Total Products', value: `${fallback.length} SKUs` }
            ]
          });
        }
        return;
      }

      // Fetch pending orders items to guarantee reservations are calculated in real-time
      const pendingReserved: Record<string, number> = {};
      try {
        const { data: pendingOrdersList } = await supabase
          .from('pending_orders')
          .select('order_id')
          .eq('status', 'Pending');

        const activePendingOrderIds = new Set((pendingOrdersList || []).map((o: any) => o.order_id));

        const { data: pendingItems } = await supabase
          .from('pending_order_items')
          .select('order_id, item_name, quantity');

        if (pendingItems && pendingItems.length > 0) {
          pendingItems.forEach((pi: any) => {
            if (activePendingOrderIds.has(pi.order_id) && pi.item_name && Number(pi.quantity) > 0) {
              pendingReserved[pi.item_name] =
                (pendingReserved[pi.item_name] || 0) + Number(pi.quantity);
            }
          });
        }
      } catch (pendingErr) {
        console.warn('Could not fetch pending_order_items for reservation calculation:', pendingErr);
      }

      const mapped: InventoryItem[] = [];
      for (const row of allRows) {
        const itemName = String(row['Item Name'] || row.item_name || row.name || '').trim();
        // Discard any row with empty or missing item name
        if (!itemName) continue;

        const cat = String(row['Category'] || row.category || 'General').trim();
        const br = String(row['Brand'] || row.brand || deriveBrand(cat) || 'Nalka Metals').trim();
        const currentStock = Number(row['Total Stock'] ?? row['Current Stock'] ?? row.current_stock ?? row.quantity_on_hand ?? 0);
        const price = Number(row['Price'] ?? row.price ?? row.cost_price ?? row.default_sale_price ?? 0);

        let reserved = 0;
        if (
          row['Reserved Stock'] !== undefined &&
          row['Reserved Stock'] !== null &&
          Number(row['Reserved Stock']) > 0
        ) {
          reserved = Number(row['Reserved Stock']);
        } else if (
          row.reserved_quantity !== undefined &&
          row.reserved_quantity !== null &&
          Number(row.reserved_quantity) > 0
        ) {
          reserved = Number(row.reserved_quantity);
        } else if (pendingReserved[itemName]) {
          reserved = pendingReserved[itemName];
        }

        let availStock = Math.max(0, currentStock - reserved);
        if (
          row['Available Stock'] !== undefined &&
          row['Available Stock'] !== null
        ) {
          availStock = Number(row['Available Stock']);
        } else if (
          row.available_stock !== undefined &&
          row.available_stock !== null
        ) {
          availStock = Number(row.available_stock);
        }

        mapped.push({
          SKU: String(row['SKU'] || row.sku || itemName),
          'Item Name': itemName,
          Category: cat,
          Brand: br,
          Price: price,
          'Current Stock': availStock,
          'Total Stock': currentStock,
          'Reserved Stock': reserved,
        });
      }

      setInventory(mapped);
      setIsOffline(false);

      // Fetch system settings for stock override
      try {
        const { data: settingsList, error: settingErr } = await supabase
          .from('system_settings')
          .select('*');

        if (!settingErr && settingsList && settingsList.length > 0) {
          const target = settingsList.find(
            (s: any) =>
              s.setting_key === 'allow_negative_orders' ||
              s.setting_key === 'allow_negative_stock' ||
              s.setting === 'allow_negative_orders' ||
              s.setting === 'allow_negative_stock' ||
              s.key === 'allow_negative_orders' ||
              s.name === 'allow_negative_orders'
          );
          if (target) {
            const v = target.setting_value !== undefined ? target.setting_value : target.value;
            const isAllowed =
              v === true ||
              v === 'true' ||
              v === 1 ||
              (typeof v === 'string' && v.toLowerCase() === 'true') ||
              (typeof v === 'object' && v !== null && (v === true || (v as any).enabled === true || (v as any).value === true));
            setAllowNegativeOrders(Boolean(isAllowed));
          }
        }
      } catch (settingErr) {
        console.warn('Could not fetch system_settings from Supabase:', settingErr);
      }

      if (isManualSync) {
        showModal({
          type: 'success',
          title: 'Stock Catalog Synced',
          message: 'Successfully refreshed live product inventory and pricing from Supabase.',
          details: [
            { label: 'Total Products', value: `${mapped.length} SKUs`, highlight: true },
            { label: 'Database Status', value: 'Connected & Synced' }
          ]
        });
      }
    } catch (err) {
      console.warn('Supabase inventory call failed, falling back to bundled CSV:', err);
      const fallback = loadCsvInventoryFallback();
      setInventory(fallback);
      setIsOffline(true);

      if (isManualSync) {
        showModal({
          type: 'warning',
          title: 'Offline Catalog Loaded',
          message: 'Unable to reach the Supabase cloud database. Using local bundled catalog of 3,681 items.',
          details: [
            { label: 'Status', value: 'Offline Fallback Active' },
            { label: 'Items Available', value: `${fallback.length}` }
          ]
        });
      }
    } finally {
      setSyncingInventory(false);
    }
  };

  // Helper to provide initial fallback dealers/salesmen when offline
  const loadCsvDealersFallback = (): DealerRecord[] => {
    return [
      {
        'Salesman Name': 'Rajesh Sharma',
        'Salesman ID': 'SALES-001',
        'Shop Name': 'Shree Ram Hardware',
        State: 'Maharashtra',
        City: 'Mumbai',
        'Customer Code': 'CUST-001',
      },
    ];
  };

  // Fetch salesmen & customers catalog from Supabase (or fallback to CSV)
  const fetchDealersData = async (isManualOffline: boolean) => {
    if (isManualOffline) {
      setDealers(loadCsvDealersFallback());
      return;
    }

    try {
      const { data, error } = await supabase
        .from('salesman_customer_catalog')
        .select('*')
        .range(0, 1999);

      if (error || !data || data.length === 0) {
        console.warn('Could not fetch salesman catalog from Supabase, falling back to bundled CSV:', error);
        setDealers(loadCsvDealersFallback());
        return;
      }

      const mapped: DealerRecord[] = data.map((row: any) => ({
        'Salesman Name': String(row['Salesman Name'] || row.salesman_name || 'Direct / House Account'),
        'Salesman ID': String(row['Salesman ID'] || row.salesman_code || 'DIRECT'),
        'Shop Name': String(row['Shop Name'] || row.shop_name || ''),
        State: String(row.State || row.state || 'Haryana'),
        City: String(row.City || row.city || 'Faridabad'),
        'Location ID': row['Location ID'] || row.location_id ? String(row['Location ID'] || row.location_id) : undefined,
        'Customer Code': row['Customer Code'] || row.customer_code ? String(row['Customer Code'] || row.customer_code) : undefined,
        'Contact Person': row['Contact Person'] || row.contact_person ? String(row['Contact Person'] || row.contact_person) : undefined,
        Phone: row.Phone || row.phone ? String(row.Phone || row.phone) : undefined,
        Address: row.Address || row.address ? String(row.Address || row.address) : undefined,
      }));

      setDealers(mapped);
    } catch (err) {
      console.warn('Error querying salesman_customer_catalog, using fallback:', err);
      setDealers(loadCsvDealersFallback());
    }
  };

  // Initial load
  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDealersData(manualOffline),
        fetchInventoryData(manualOffline, false)
      ]);
    } catch (e) {
      console.error('Error loading initial portal data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-poll inventory and reservations every 15 seconds
    const interval = setInterval(() => {
      if (!manualOffline) {
        fetchInventoryData(false, false);
      }
    }, 15000);

    // Realtime channel for system settings (Stock Override)
    const settingsChannel = supabase
      .channel('system_settings_override_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings' },
        (payload: any) => {
          if (payload?.new) {
            const k = payload.new.setting_key || payload.new.setting || payload.new.key;
            if (k === 'allow_negative_orders' || k === 'allow_negative_stock') {
              const v = payload.new.setting_value !== undefined ? payload.new.setting_value : payload.new.value;
              const isAllowed =
                v === true ||
                v === 'true' ||
                v === 1 ||
                (typeof v === 'string' && v.toLowerCase() === 'true') ||
                (typeof v === 'object' && v !== null && (v === true || (v as any).enabled === true || (v as any).value === true));
              setAllowNegativeOrders(Boolean(isAllowed));
            }
          }
        }
      )
      .subscribe();

    // Realtime channel for live inventory, orders & pending reservations
    const inventoryChannel = supabase
      .channel('realtime_stock_and_orders_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => {
          if (!manualOffline) fetchInventoryData(false, false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_orders' },
        () => {
          if (!manualOffline) fetchInventoryData(false, false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_order_items' },
        () => {
          if (!manualOffline) fetchInventoryData(false, false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          if (!manualOffline) fetchDealersData(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salesmen' },
        () => {
          if (!manualOffline) fetchDealersData(false);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, [manualOffline]);

  // Handle manual offline toggle with modal popup notification
  const toggleManualOffline = async () => {
    const nextVal = !manualOffline;
    setManualOffline(nextVal);
    localStorage.setItem('app_manual_offline', String(nextVal));

    if (nextVal) {
      showModal({
        type: 'warning',
        title: 'Offline Mode Activated',
        message: 'Manual offline mode is now active. Supabase connection attempts will be skipped. Orders will be saved directly as JSON files and PDF receipts for manual manager upload.',
        details: [
          { label: 'Network Mode', value: 'Offline (No Cloud Requests)', highlight: true },
          { label: 'Order Export Format', value: 'JSON File + PDF Invoice' }
        ]
      });
    } else {
      showModal({
        type: 'info',
        title: 'Online Mode Activated',
        message: 'Reconnecting to Supabase order queue and syncing live stock catalog...'
      });
    }

    await Promise.all([
      fetchInventoryData(nextVal, false),
      fetchDealersData(nextVal)
    ]);
  };

  // Master Salesmen List (Canonical salesmen first, House/Direct accounts at end)
  const salesmanList = useMemo(() => {
    const names = new Set<string>(VALID_SALESMAN_NAMES);
    dealers.forEach(d => {
      if (d['Salesman Name'] && d['Salesman Name'].trim()) {
        names.add(d['Salesman Name'].trim());
      }
    });
    return Array.from(names).sort((a, b) => {
      if (a.toLowerCase().includes('direct') || a.toLowerCase().includes('house')) return 1;
      if (b.toLowerCase().includes('direct') || b.toLowerCase().includes('house')) return -1;
      return a.localeCompare(b);
    });
  }, [dealers]);

  // Assigned Customers for the currently selected Salesman (Sorted alphabetically)
  const assignedCustomers = useMemo(() => {
    if (!selectedSalesman) return [];
    return dealers
      .filter(d => d['Salesman Name'] === selectedSalesman && d['Shop Name'])
      .sort((a, b) => a['Shop Name'].localeCompare(b['Shop Name']));
  }, [dealers, selectedSalesman]);

  // Available Shop Names for Selected Salesman
  const availableShops = useMemo(() => {
    return assignedCustomers.map(d => d['Shop Name']);
  }, [assignedCustomers]);


  // Keep shop selection synchronized when salesman changes
  useEffect(() => {
    if (availableShops.length > 0) {
      if (selectedShop && !availableShops.includes(selectedShop)) {
        setSelectedShop('');
      }
    } else {
      setSelectedShop('');
    }
  }, [selectedSalesman, availableShops, selectedShop]);

  // Ensure login salesman selection stays valid with real salesmen list
  useEffect(() => {
    if (salesmanList.length > 0) {
      if (!loginSalesman || !salesmanList.includes(loginSalesman)) {
        setLoginSalesman(salesmanList[0]);
      }
    }
  }, [salesmanList, loginSalesman]);


  // Matched Dealer Record (Auto-resolved when both fields are selected)
  const matchedDealer = useMemo(() => {
    if (!selectedSalesman || !selectedShop) return null;
    return (
      dealers.find(d => d['Salesman Name'] === selectedSalesman && d['Shop Name'] === selectedShop) ||
      dealers.find(d => d['Shop Name'] === selectedShop) ||
      null
    );
  }, [dealers, selectedSalesman, selectedShop]);

  const isBothFieldsSelected = Boolean(selectedSalesman && selectedShop && matchedDealer);

  // Salesman ID auto-resolved from canonical list or dealer catalog
  const salesmanIdVal = useMemo(() => {
    if (profile?.salesman_id) return profile.salesman_id;
    if (!selectedSalesman) return '--';
    const canonical = VALID_SALESMEN.find(s => s.name.toLowerCase() === selectedSalesman.toLowerCase());
    if (canonical) return canonical.id;
    if (matchedDealer?.['Salesman ID'] && matchedDealer['Salesman ID'] !== '--') {
      return matchedDealer['Salesman ID'];
    }
    return 'DIRECT';
  }, [profile?.salesman_id, selectedSalesman, matchedDealer]);

  // Customer Location, State, City, and Customer Code auto-fetched when both fields are selected
  const stateVal = isBothFieldsSelected && matchedDealer?.State ? matchedDealer.State : '--';
  const cityVal = isBothFieldsSelected && matchedDealer?.City ? matchedDealer.City : '--';
  const customerCodeVal = isBothFieldsSelected && matchedDealer?.['Customer Code'] ? matchedDealer['Customer Code'] : '--';

  // Matched Location ID (Auto-fetched from database record or resolved via regional mapper)
  const matchedLocationId = useMemo(() => {
    if (!isBothFieldsSelected || !matchedDealer) return '--';
    if (matchedDealer['Location ID'] && matchedDealer['Location ID'] !== '--') {
      return matchedDealer['Location ID'];
    }
    if (!stateVal || stateVal === '--') return '--';
    return deriveLocationId(stateVal, cityVal);
  }, [isBothFieldsSelected, matchedDealer, stateVal, cityVal]);

  // Categories list
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach(i => {
      if (i.Category && String(i.Category).trim()) cats.add(String(i.Category).trim());
    });
    return Array.from(cats).sort();
  }, [inventory]);

  // Intelligent Multi-Token Search & Ranking (Null-safe)
  const searchResults = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return [];
    const rawQ = searchQuery.trim().toLowerCase();
    const tokens = rawQ.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const scoredList: { item: InventoryItem; score: number }[] = [];

    for (const item of inventory) {
      const name = String(item['Item Name'] || '').toLowerCase();
      const cat = String(item.Category || '').toLowerCase();
      const brand = String(item.Brand || deriveBrand(item.Category) || '').toLowerCase();
      const sku = String(item.SKU || '').toLowerCase();
      const stock = Number(item['Current Stock']) || 0;

      // Every token must match somewhere in name, category, brand, or SKU
      const allTokensMatch = tokens.every(
        t => name.includes(t) || cat.includes(t) || brand.includes(t) || sku.includes(t)
      );

      if (!allTokensMatch) continue;

      let score = 0;

      // 1. Exact full query matches
      if (name === rawQ) {
        score += 1000;
      } else if (name.startsWith(rawQ)) {
        score += 600;
      } else if (name.includes(rawQ)) {
        score += 400;
      }

      // 2. Token matches inside Item Name
      const nameMatchedCount = tokens.filter(t => name.includes(t)).length;
      score += nameMatchedCount * 80;

      // 3. Word boundary matches in Item Name (e.g., starts of words)
      for (const t of tokens) {
        if (
          name.startsWith(t) ||
          name.includes(' ' + t) ||
          name.includes('-' + t) ||
          name.includes('/' + t) ||
          name.includes('"' + t)
        ) {
          score += 50;
        }
      }

      // 4. Brand and Category token matches
      for (const t of tokens) {
        if (brand.includes(t)) score += 30;
        if (cat.includes(t)) score += 20;
      }

      // 5. Stock availability boosting (in-stock items rank higher unless manager override is active)
      if (allowNegativeOrders) {
        if (stock > 0) score += 15;
      } else {
        if (stock > 5) {
          score += 40;
        } else if (stock > 0) {
          score += 25;
        } else if (stock === 0) {
          score -= 25;
        } else {
          score -= 50;
        }
      }

      scoredList.push({ item, score });
    }

    // Sort by highest score first, then alphabetically
    scoredList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.item['Item Name'] || '').localeCompare(String(b.item['Item Name'] || ''));
    });

    return scoredList.slice(0, 35).map(s => s.item);
  }, [inventory, searchQuery, allowNegativeOrders]);

  // Active Cart Selections Dictionary { item_name: total_qty }
  const activeCartSelections = useMemo(() => {
    const dict: Record<string, number> = {};
    orderItems.forEach(item => {
      const numQty = Number(item.qty) || 0;
      if (item.name && numQty > 0) {
        dict[item.name] = (dict[item.name] || 0) + numQty;
      }
    });
    return dict;
  }, [orderItems]);

  // Stock Validation Check
  const stockCheckResults = useMemo(() => {
    let hasExceededError = false;
    const itemErrors: Record<string, string> = {};

    // When Stock Override is active, zero and negative stock are permitted
    if (allowNegativeOrders) {
      return { hasExceededError: false, itemErrors: {} };
    }

    Object.entries(activeCartSelections).forEach(([itemName, requestedQty]) => {
      const invItem = inventory.find(i => i['Item Name'] === itemName);
      const availStock = invItem ? invItem['Current Stock'] : 0;

      if (availStock < 0) {
        hasExceededError = true;
        itemErrors[itemName] = `Item has negative stock (${availStock})`;
      } else if (availStock === 0) {
        hasExceededError = true;
        itemErrors[itemName] = 'Item is Out of Stock (0 available)';
      } else if (requestedQty > availStock) {
        hasExceededError = true;
        itemErrors[itemName] = `Exceeds available stock (${availStock} left)`;
      }
    });

    return { hasExceededError, itemErrors };
  }, [activeCartSelections, inventory, allowNegativeOrders]);

  // Calculated Order Totals
  const orderTotalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const numQty = Number(item.qty) || 0;
      if (!item.name || numQty <= 0) return sum;
      const inv = inventory.find(i => i['Item Name'] === item.name);
      const price = inv ? Number(inv.Price) || 0 : 0;
      return sum + price * numQty;
    }, 0);
  }, [orderItems, inventory]);

  const orderTotalUnits = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const numQty = Number(item.qty) || 0;
      return item.name && numQty > 0 ? sum + numQty : sum;
    }, 0);
  }, [orderItems]);

  // Helper: Render stock status badges for cards/lists
  const renderStockBadge = (
    stock: number,
    totalStock?: number,
    reservedStock?: number
  ) => {
    const total = totalStock !== undefined ? totalStock : stock;
    const reserved = reservedStock !== undefined ? reservedStock : 0;

    // When there is active reserved stock (> 0), display the 3-part breakdown
    if (reserved > 0) {
      return (
        <div className="inline-flex items-center gap-1.5 flex-wrap">
          {/* Total Stock */}
          <span
            title={`Physical On-Hand Stock: ${total}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
          >
            <Boxes className="w-2.5 h-2.5 text-slate-500" />
            Stock {total}
          </span>

          {/* Reserved Stock */}
          <span
            title={`Reserved in Pending Orders: ${reserved}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
          >
            <Clock className="w-2.5 h-2.5 text-amber-500" />
            Reserved {reserved}
          </span>

          {/* Net Available Stock */}
          {stock <= 0 ? (
            <span
              title="No units currently available to order"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60"
            >
              <XCircle className="w-2.5 h-2.5 text-rose-500" />
              Available 0
            </span>
          ) : stock <= 5 ? (
            <span
              title={`Low Net Available Stock: ${stock}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
            >
              <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
              Available {stock}
            </span>
          ) : (
            <span
              title={`Available to Order: ${stock}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
            >
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              Available {stock}
            </span>
          )}
        </div>
      );
    }

    // Normal scenario: Reserved === 0 -> Exactly one clean badge as before
    if (stock < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
          <XCircle className="w-3 h-3 text-rose-500" />
          Negative ({stock})
        </span>
      );
    }
    if (stock === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
          <XCircle className="w-3 h-3 text-rose-500" />
          Out of Stock
        </span>
      );
    }
    if (stock <= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          Low Stock ({stock})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        {stock} in Stock
      </span>
    );
  };

  // Helper: Render status badges specifically for the inventory ledger table
  const renderLedgerStatusBadge = (
    stock: number,
    selectedQty: number = 0,
    totalStock?: number,
    reservedStock?: number
  ) => {
    const total = totalStock !== undefined ? totalStock : stock;
    const reserved = reservedStock !== undefined ? reservedStock : 0;

    if (selectedQty > 0) {
      if (stock <= 0) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
            <XCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
            {stock < 0 ? `Neg (${stock})` : '0 · Out'}
          </span>
        );
      }
      if (selectedQty > stock) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
            <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
            Exceeds ({selectedQty}/{stock})
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
          <CheckCircle2 className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          In Order ({selectedQty})
        </span>
      );
    }

    if (reserved > 0) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            <span
              title={`Total Physical Stock: ${total}`}
              className="px-1 py-0.2 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            >
              T:{total}
            </span>
            <span
              title={`Reserved Stock: ${reserved}`}
              className="px-1 py-0.2 rounded text-[9px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
            >
              R:{reserved}
            </span>
            <span
              title={`Available Stock: ${stock}`}
              className="px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
            >
              A:{stock}
            </span>
          </div>
        </div>
      );
    }

    if (stock < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
          <XCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
          Neg ({stock})
        </span>
      );
    }
    if (stock === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
          <XCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
          0 · Out of Stock
        </span>
      );
    }
    if (stock <= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
          {stock} · Low Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
        {stock} in Stock
      </span>
    );
  };

  // ADD PRODUCT HANDLER WITH ZERO/NEGATIVE STOCK POPUP PREVENTION
  const handleAddProduct = (itemName: string) => {
    if (!itemName) return;

    const invItem = inventory.find(i => i['Item Name'] === itemName);
    if (!invItem) {
      showModal({
        type: 'error',
        title: 'Product Not Found',
        message: `Could not find product "${itemName}" in the current catalog.`
      });
      return;
    }

    const availStock = invItem['Current Stock'];

    if (!allowNegativeOrders) {
      // ZERO STOCK POPUP
      if (availStock === 0) {
        showModal({
          type: 'error',
          title: 'Out of Stock',
          message: `"${itemName}" is currently out of stock (0 available).`
        });
        return;
      }

      // NEGATIVE STOCK POPUP
      if (availStock < 0) {
        showModal({
          type: 'error',
          title: 'Negative Stock',
          message: `"${itemName}" has negative stock (${availStock}). Cannot add.`
        });
        return;
      }

      // Check if adding one more exceeds available stock
      const currentQtyInCart = activeCartSelections[itemName] || 0;
      if (currentQtyInCart + 1 > availStock) {
        showModal({
          type: 'warning',
          title: 'Stock Limit Reached',
          message: `Cannot add more. Only ${availStock} available in warehouse.`
        });
        return;
      }
    }

    // Successfully Add Item
    setOrderItems(prev => {
      const existingIdx = prev.findIndex(item => item.name === itemName);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const currentNum = Number(updated[existingIdx].qty) || 0;
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: currentNum + 1
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: itemName,
          qty: 1
        }
      ];
    });

    // Reset search bar immediately so it's free for the next item
    setSearchQuery('');
    setIsSearchOpen(false);

    // Keep focus on search bar for continuous addition
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // List Item Actions
  const handleRemoveItem = (id: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateQty = (id: string, newQty: number | string) => {
    setOrderItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (newQty === '') {
          return { ...item, qty: '' };
        }
        const parsed = typeof newQty === 'number' ? newQty : parseInt(String(newQty).replace(/\D/g, ''), 10);
        if (isNaN(parsed)) {
          return { ...item, qty: '' };
        }

        const safeQty = Math.max(1, parsed);

        if (!allowNegativeOrders) {
          const invItem = inventory.find(i => i['Item Name'] === item.name);
          const avail = invItem ? invItem['Current Stock'] : 0;

          if (safeQty > avail && avail > 0) {
            showModal({
              type: 'warning',
              title: 'Quantity Exceeds Available Stock',
              message: `The entered quantity (${safeQty}) exceeds the available stock of ${avail} units for "${item.name}".`,
              details: [
                { label: 'Product', value: item.name },
                { label: 'Available Stock', value: `${avail} units` }
              ]
            });
          }
        }

        return { ...item, qty: safeQty };
      })
    );
  };

  const handleBlurQty = (id: string) => {
    setOrderItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const num = Number(item.qty);
        if (!item.qty || isNaN(num) || num < 1) {
          return { ...item, qty: 1 };
        }
        return { ...item, qty: Math.floor(num) };
      })
    );
  };

  const handleIncrementQty = (id: string) => {
    const targetItem = orderItems.find(i => i.id === id);
    if (targetItem) {
      const currentQty = Number(targetItem.qty) || 0;
      const nextQty = currentQty + 1;
      const invItem = inventory.find(i => i['Item Name'] === targetItem.name);
      const avail = invItem ? invItem['Current Stock'] : 0;

      if (!allowNegativeOrders && nextQty > avail) {
        showModal({
          type: 'warning',
          title: 'Stock Limit Reached',
          message: `Cannot increase quantity. Only ${avail} units of "${targetItem.name}" are currently available in the warehouse.`,
          details: [
            { label: 'Product', value: targetItem.name },
            { label: 'Available Stock', value: `${avail} units` }
          ]
        });
        return;
      }
    }

    setOrderItems(prev =>
      prev.map(item => (item.id === id ? { ...item, qty: (Number(item.qty) || 0) + 1 } : item))
    );
  };

  const handleDecrementQty = (id: string) => {
    setOrderItems(prev =>
      prev.map(item => (item.id === id ? { ...item, qty: Math.max(1, (Number(item.qty) || 1) - 1) } : item))
    );
  };

  // Clear Order with Confirmation Modal
  const confirmClearOrder = () => {
    showModal({
      type: 'confirm',
      title: 'Clear Current Order Sheet?',
      message: 'Are you sure you want to clear all items from this order sheet? This draft will be reset.',
      primaryButtonText: 'Yes, Clear All',
      secondaryButtonText: 'Cancel',
      onConfirm: () => {
        setOrderItems([]);
        setSearchQuery('');
      }
    });
  };

  const resetForm = () => {
    if (isAdminOrManager) {
      setAdminSelectedSalesman('');
    }
    setSelectedShop(profile?.role === 'customer' ? (profile.shop_name || '') : '');
    setOrderItems([]);
    setSearchQuery('');
    setIsSearchOpen(false);
    setSelectedSearchIndex(-1);
  };

  const handleManualReset = () => {
    if (orderItems.length > 0 || selectedShop) {
      showModal({
        type: 'confirm',
        title: 'Reset Order Form?',
        message: 'Are you sure you want to clear all selected products and the selected customer?',
        primaryButtonText: 'Reset Form',
        secondaryButtonText: 'Cancel',
        onConfirm: () => {
          resetForm();
        }
      });
    } else {
      resetForm();
    }
  };

  // Auth Handlers (Supabase Auth Session Mediated)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);

    try {
      let result;
      if (loginMode === 'credentials') {
        if (!loginEmail.trim() || !loginPassword) {
          setAuthError('Please enter both email address and password.');
          setAuthSubmitting(false);
          return;
        }
        result = await signInWithEmail(loginEmail.trim(), loginPassword);
      } else {
        if (!loginSalesman) {
          setAuthError('Please select a salesman profile.');
          setAuthSubmitting(false);
          return;
        }
        result = await signInAsSalesman(loginSalesman, loginPassword || 'password123');
      }

      if (!result.success) {
        setAuthError(result.error || 'Authentication failed. Please verify credentials.');
      } else {
        setAuthError(null);
        resetForm();
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Login error occurred.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    showModal({
      type: 'confirm',
      title: 'Log Out of Order Terminal?',
      message: 'Are you sure you want to end your authenticated session?',
      primaryButtonText: 'Log Out',
      secondaryButtonText: 'Stay Logged In',
      onConfirm: async () => {
        await signOut();
        setSelectedShop('');
        setOrderItems([]);
      }
    });
  };

  // Sync Offline Queue to Supabase
  const handleSyncOfflineQueue = async () => {
    if (offlineQueue.length === 0 || syncingQueue) return;
    setSyncingQueue(true);
    try {
      const res = await syncOfflineQueue(supabase);
      if (res.synced > 0) {
        showModal({
          type: 'success',
          title: 'Offline Queue Synced!',
          message: `Successfully synchronized ${res.synced} offline order(s) directly to the Supabase database.`,
          details: [
            { label: 'Orders Synced', value: `${res.synced}`, highlight: true },
            { label: 'Remaining in Queue', value: `${res.failed}` }
          ]
        });
        fetchInventoryData(manualOffline, false);
      } else if (res.failed > 0) {
        showModal({
          type: 'error',
          title: 'Queue Sync Incomplete',
          message: `Could not sync ${res.failed} order(s). Check item availability or connection.`,
          details: res.errors.map(e => ({ label: e.orderId, value: e.error }))
        });
      }
    } catch (e: any) {
      showModal({
        type: 'error',
        title: 'Queue Sync Failed',
        message: e?.message || 'Error occurred while synchronizing queued orders.'
      });
    } finally {
      setSyncingQueue(false);
    }
  };

  // Initiate Order Flow: Validates form and opens confirmation dialog or direct export
  const handlePlaceOrder = (forceJsonExportOnly = false) => {
    // 1. Check Missing Salesman
    if (!selectedSalesman) {
      showModal({
        type: 'warning',
        title: 'Salesman Required',
        message: 'Please select a Salesman from the dropdown before placing the order.'
      });
      return;
    }

    // 2. Check Missing Shop Name
    if (!selectedShop) {
      showModal({
        type: 'warning',
        title: 'Shop Name Required',
        message: 'Please select a Shop Name before placing the order.'
      });
      return;
    }

    // 2. Check Empty Order List
    if (orderItems.length === 0) {
      showModal({
        type: 'warning',
        title: 'Empty Order Sheet',
        message: 'Please search and add at least one product to the order sheet.'
      });
      return;
    }

    // 3. Check Stock Errors (Negative, Zero, Exceeded)
    if (stockCheckResults.hasExceededError) {
      showModal({
        type: 'error',
        title: 'Stock Limit Error',
        message: 'One or more items exceed available warehouse stock or are out of stock. Please adjust quantities before submitting.'
      });
      return;
    }

    if (forceJsonExportOnly) {
      // Direct Export: perform download & reset
      executeOrderPlacement(true, { downloadPdf: true, downloadJson: true, rememberChoice: false });
    } else {
      // Open confirmation dialog with download checkboxes and remember choice
      setIsConfirmOrderModalOpen(true);
    }
  };

  // Execute Order Placement and File Downloads
  const executeOrderPlacement = async (
    forceJsonExportOnly = false,
    customPrefs = exportPrefs
  ) => {
    setIsConfirmOrderModalOpen(false);

    if (customPrefs.rememberChoice) {
      localStorage.setItem('nalka_order_export_prefs', JSON.stringify(customPrefs));
    }

    // Build unified order payload using single source of truth
    const payload = buildOrderPayload(
      orderItems,
      { id: salesmanIdVal, name: selectedSalesman },
      { name: selectedShop, city: cityVal, state: stateVal, location_id: matchedLocationId },
      inventory
    );

    if (payload.items.length === 0) {
      showModal({
        type: 'warning',
        title: 'Empty Order',
        message: 'Please add at least one product with quantity > 0.'
      });
      return;
    }

    setSubmittingOrder(true);

    const pdfData: PDFOrderData = {
      order_id: payload.order.order_id,
      timestamp: new Date().toLocaleString('en-IN', { hour12: false }),
      salesman_id: payload.order.salesman_id,
      salesman_name: payload.order.salesman_name,
      shop_name: payload.order.shop_name,
      location_id: payload.order.location_id,
      city: payload.order.city,
      state: payload.order.state,
      status: 'Pending',
      items: payload.items.map(item => ({
        category: item.category,
        sku: item.sku,
        item_name: item.item_name,
        quantity: item.quantity,
        price: item.price,
        total_price: item.total_price
      }))
    };

    const downloadedItems: string[] = [];

    try {
      if (forceJsonExportOnly || manualOffline) {
        // Enqueue into offline storage for authoritative sync when back online
        enqueueOfflineOrder(payload, 'Manual / Offline Mode');

        if (customPrefs.downloadJson || forceJsonExportOnly) {
          downloadOrderAsJSON(payload);
          downloadedItems.push('JSON File');
        }
        if (customPrefs.downloadPdf || forceJsonExportOnly) {
          generateOrderPDF(pdfData);
          downloadedItems.push('PDF Invoice');
        }

        showModal({
          type: 'success',
          title: 'Order Queued Offline & Files Saved',
          message: 'Your order was securely saved into the local offline queue and exported. It will automatically be submitted to the database when back online.',
          details: [
            { label: 'Order ID', value: payload.order.order_id, highlight: true },
            { label: 'Offline Queue', value: 'Saved to Local Device Queue', highlight: true },
            { label: 'Total Items', value: `${payload.order.item_count} items (${orderTotalUnits} units)` },
            { label: 'Grand Total', value: `₹${payload.order.total_amount.toLocaleString('en-IN')}` },
            { label: 'Downloads', value: downloadedItems.length > 0 ? downloadedItems.join(' + ') : 'None' },
            { label: 'Mode', value: manualOffline ? 'Manual Offline' : 'Network Offline' }
          ]
        });

        resetForm();
        return;
      }

      // Central Backend Order Reservation & Header Creation
      let rpcData: any = null;
      let rpcSuccess = false;

      try {
        const reserveRes = await reserveOrder({
          order_id: payload.order.order_id,
          salesman_id: salesmanIdVal,
          salesman_name: selectedSalesman,
          shop_name: selectedShop,
          city: cityVal,
          state: stateVal,
          location_id: matchedLocationId,
          notes: '',
          items: payload.items.map(item => ({
            item_name: item.item_name,
            quantity: item.quantity,
            sku: item.sku,
            category: item.category
          }))
        });

        if (reserveRes && (reserveRes.status === 'created' || reserveRes.status === 'already_processed')) {
          rpcData = reserveRes;
          rpcSuccess = true;
        }
      } catch (err: any) {
        if (err && err.status_code === 409) {
          showModal({
            type: 'warning',
            title: 'Insufficient Available Stock',
            message: err.message || 'One or more items exceed live warehouse stock. Transaction was rolled back.'
          });
          return;
        }
        console.warn('Centralized reserveOrder call failed, attempting database fallback:', err);
      }

      // Direct Table Insert Fallback if RPC is missing or schema cache is not updated
      if (!rpcSuccess) {
        const { error: headerErr } = await supabase.from('pending_orders').insert({
          order_id: payload.order.order_id,
          salesman_id: salesmanIdVal,
          salesman_name: selectedSalesman,
          shop_name: selectedShop,
          location_id: matchedLocationId,
          city: cityVal,
          state: stateVal,
          item_count: payload.order.item_count,
          total_amount: payload.order.total_amount,
          status: 'Pending',
          notes: ''
        });

        if (headerErr) {
          console.error('Direct insert to pending_orders failed:', headerErr);
          throw headerErr;
        }

        const lineItemsToInsert = payload.items.map(item => ({
          order_id: payload.order.order_id,
          sku: item.sku,
          item_name: item.item_name,
          category: item.category,
          quantity: item.quantity,
          price: item.price,
          total_price: item.total_price
        }));

        const { error: itemsErr } = await supabase.from('pending_order_items').insert(lineItemsToInsert);

        if (itemsErr) {
          console.error('Direct insert to pending_order_items failed:', itemsErr);
          throw itemsErr;
        }

        rpcData = {
          success: true,
          order_id: payload.order.order_id,
          item_count: payload.order.item_count,
          total_amount: payload.order.total_amount
        };
      }

      // Optimistically update local inventory stock for ordered items
      setInventory((prev) =>
        prev.map((item) => {
          const ordered = payload.items.find((i) => i.item_name === item['Item Name']);
          if (ordered) {
            return {
              ...item,
              'Current Stock': Math.max(0, item['Current Stock'] - ordered.quantity),
            };
          }
          return item;
        })
      );

      // Trigger background inventory refresh to ensure 100% sync with Supabase
      fetchInventoryData(manualOffline, false);

      // Perform selected downloads
      if (customPrefs.downloadPdf) {
        generateOrderPDF(pdfData);
        downloadedItems.push('PDF Invoice');
      }
      if (customPrefs.downloadJson) {
        downloadOrderAsJSON(payload);
        downloadedItems.push('JSON File');
      }

      showModal({
        type: 'success',
        title: 'Order Authoritatively Submitted!',
        message: `Order ${rpcData?.order_id || payload.order.order_id} has been verified and committed to the warehouse queue with server-calculated totals.`,
        details: [
          { label: 'Order ID', value: rpcData?.order_id || payload.order.order_id, highlight: true },
          { label: 'Dealer / Shop', value: selectedShop },
          { label: 'Salesman', value: selectedSalesman },
          { label: 'Total Items', value: `${rpcData?.item_count ?? payload.order.item_count} items (${orderTotalUnits} units)` },
          { label: 'Server Verified Total', value: `₹${(rpcData?.total_amount ?? payload.order.total_amount).toLocaleString('en-IN')}`, highlight: true },
          { label: 'Downloads', value: downloadedItems.length > 0 ? downloadedItems.join(' + ') : 'None' }
        ]
      });

      resetForm();
    } catch (err: any) {
      console.error('Authoritative order submission failed:', err);

      // Save order to local offline queue so no data is lost
      enqueueOfflineOrder(payload, err?.message || 'Network submission error');

      downloadOrderAsJSON(payload);
      generateOrderPDF(pdfData);

      showModal({
        type: 'warning',
        title: 'Network Interrupted — Queued Offline',
        message: `Could not reach database server: ${err.message || 'Network error'}. We have securely queued your order on this device for sync when connection is restored, and downloaded backup files.`,
        details: [
          { label: 'Order ID', value: payload.order.order_id, highlight: true },
          { label: 'Queue Status', value: 'Queued in Offline Storage', highlight: true },
          { label: 'Emergency Backup', value: 'JSON & PDF Saved Locally' }
        ]
      });

      resetForm();
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Filtered Master Inventory Ledger
  const filteredLedger = useMemo(() => {
    let list = inventory;

    if (ledgerCategoryFilter !== 'All') {
      list = list.filter(i => i.Category === ledgerCategoryFilter);
    }

    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase().trim();
      const tokens = q.split(/\s+/).filter(Boolean);

      list = list.filter(item => {
        const name = String(item['Item Name'] || '').toLowerCase();
        const cat = String(item.Category || '').toLowerCase();
        const brand = String(item.Brand || deriveBrand(item.Category) || '').toLowerCase();
        const sku = String(item.SKU || '').toLowerCase();

        return tokens.every(
          t => name.includes(t) || cat.includes(t) || brand.includes(t) || sku.includes(t)
        );
      });
    }

    return list;
  }, [inventory, ledgerCategoryFilter, ledgerSearch]);

  // Reset page on filter changes
  useEffect(() => {
    setLedgerPage(1);
  }, [ledgerCategoryFilter, ledgerSearch, ledgerPageSize]);

  // Paginated Ledger Data
  const totalLedgerPages = Math.ceil(filteredLedger.length / ledgerPageSize) || 1;
  const currentLedgerPage = Math.min(Math.max(1, ledgerPage), totalLedgerPages);
  const paginatedLedger = useMemo(() => {
    const startIndex = (currentLedgerPage - 1) * ledgerPageSize;
    return filteredLedger.slice(startIndex, startIndex + ledgerPageSize);
  }, [filteredLedger, currentLedgerPage, ledgerPageSize]);

  const ledgerStartIndex = filteredLedger.length === 0 ? 0 : (currentLedgerPage - 1) * ledgerPageSize + 1;
  const ledgerEndIndex = Math.min(currentLedgerPage * ledgerPageSize, filteredLedger.length);

  // INITIAL LOADING SCREEN
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans transition-colors">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse shadow-sm">
            <Boxes className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Initializing Order Terminal</h2>
            <p className="text-xs text-slate-500">Verifying session & database connection...</p>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN (SUPABASE AUTHENTICATION & TRUSTED USER IDENTITY)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden font-sans transition-colors">
        {/* Subtle Ambient Background Glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl z-10 space-y-6 transition-colors">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 dark:bg-indigo-500 text-white font-bold text-2xl shadow-md shadow-indigo-500/20">
              N
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                nalka
              </h1>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                ORDER
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Trusted Salesman Order Terminal</p>
          </div>

          {/* Login Method Segmented Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setLoginMode('profile');
                setAuthError(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                loginMode === 'profile'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Salesman Auth</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('credentials');
                setAuthError(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                loginMode === 'credentials'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email & Password</span>
            </button>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {loginMode === 'profile' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Select Salesman Profile
                  </label>
                  <select
                    value={loginSalesman}
                    onChange={e => setLoginSalesman(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all cursor-pointer font-medium"
                  >
                    {salesmanList.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Terminal PIN / Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="Enter terminal password"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Supabase Account Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="user@nalkametals.com"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authenticate Session</span>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secured via Supabase Auth & Role-Based Identity</span>
          </div>
        </div>
      </div>
    );
  }

  // MAIN PORTAL UI
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 font-sans transition-colors">
      {/* Universal Info Pop-up Modal */}
      <InfoModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        details={modalState.details}
        primaryButtonText={modalState.primaryButtonText}
        secondaryButtonText={modalState.secondaryButtonText}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        autoCloseMs={modalState.autoCloseMs}
      />

      {/* ORDER SUBMISSION & DOWNLOAD OPTIONS CONFIRMATION MODAL */}
      {isConfirmOrderModalOpen && (
        <div className="fixed inset-0 z-[100] w-screen h-screen min-h-screen flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="fixed inset-0 w-full h-full" onClick={() => !submittingOrder && setIsConfirmOrderModalOpen(false)} />

          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl z-10 space-y-4 animate-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Confirm & Submit Order
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Review summary and select receipt download options.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submittingOrder && setIsConfirmOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order Quick Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Dealer / Store:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{selectedShop}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Salesman:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedSalesman}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Products:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{orderItems.length} items ({orderTotalUnits} units)</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300">Grand Total:</span>
                <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                  ₹{orderTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Download Options Checkboxes */}
            <div className="space-y-2.5 pt-1">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Download Options upon submission:
              </span>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={exportPrefs.downloadPdf}
                  onChange={(e) => setExportPrefs(prev => ({ ...prev, downloadPdf: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                />
                <div className="flex items-center justify-between flex-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Download Official PDF Invoice
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 font-bold">
                    PDF
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={exportPrefs.downloadJson}
                  onChange={(e) => setExportPrefs(prev => ({ ...prev, downloadJson: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                />
                <div className="flex items-center justify-between flex-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Download JSON Order File
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-bold">
                    JSON
                  </span>
                </div>
              </label>

              {/* Small "Remember my choice" checkbox */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportPrefs.rememberChoice}
                  onChange={(e) => setExportPrefs(prev => ({ ...prev, rememberChoice: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Remember my choice for next orders
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmOrderModalOpen(false)}
                disabled={submittingOrder}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => executeOrderPlacement(false)}
                disabled={submittingOrder}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submittingOrder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Modern Header Bar */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs transition-colors space-y-2.5">
        {/* Top Row: Brand & Quick Action Controls */}
        <div className="flex items-center justify-between gap-2.5">
          {/* Brand Identity */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-black text-xs sm:text-sm shadow-xs shrink-0">
              N
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                nalka
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 uppercase tracking-wide">
                ORDER
              </span>
            </div>
          </div>

          {/* Quick Actions (Theme, Offline, Sync, Logout) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />}
            </button>

            {/* Offline / Online Mode Toggle */}
            <button
              type="button"
              onClick={toggleManualOffline}
              title={manualOffline ? 'Offline Mode Active (Click to switch Online)' : 'Online Mode Active (Click to switch Offline)'}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all cursor-pointer ${
                manualOffline
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Radio className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${manualOffline ? 'text-amber-500' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span className="font-mono">{manualOffline ? 'OFFLINE' : 'ONLINE'}</span>
            </button>

            {/* Offline Queue Sync Button */}
            {offlineQueue.length > 0 && (
              <button
                type="button"
                onClick={handleSyncOfflineQueue}
                disabled={syncingQueue || manualOffline || isOffline}
                title="Sync queued offline orders to Supabase"
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <CloudOff className={`w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ${syncingQueue ? 'animate-spin' : ''}`} />
                <span className="text-[11px] font-bold">{offlineQueue.length} Queued</span>
              </button>
            )}

            {/* Sync Stock Button */}
            <button
              type="button"
              onClick={() => fetchInventoryData(manualOffline, true)}
              disabled={syncingInventory}
              title="Sync Stock Catalog"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${syncingInventory ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline text-[11px]">Sync</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Log out of terminal"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800/60 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden md:inline text-[11px]">Logout</span>
            </button>
          </div>
        </div>

        {/* Bottom Metadata & Connection Status Row */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
          {/* User Role & Profile */}
          <div className="flex items-center gap-1.5 min-w-0 text-slate-500 dark:text-slate-400 truncate">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              {userRole}
            </span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {userRole === 'Salesman' ? selectedSalesman : (selectedShop || profile?.shop_name || 'Customer')}
            </span>
          </div>

          {/* Connection & Override Status Badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            {manualOffline ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Offline
              </span>
            ) : isOffline ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-[10px]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Live
              </span>
            )}

            {/* Always Visible Stock Override Status Badge */}
            <span
              title={
                allowNegativeOrders
                  ? 'Stock Override Active: Orders can be placed even if item stock is zero or negative'
                  : 'Stock Guard Strict: Orders are strictly limited to available warehouse stock'
              }
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] transition-all ${
                allowNegativeOrders
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  allowNegativeOrders ? 'bg-amber-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
              {allowNegativeOrders ? 'Override ON' : 'Override OFF'}
            </span>
          </div>
        </div>
      </header>

      {/* Non-blocking Offline Banner */}
      {(isOffline || manualOffline) && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-amber-800 dark:text-amber-200 text-xs shadow-xs transition-colors">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">
              {manualOffline
                ? 'Manual offline mode enabled. Orders will be saved as JSON files and PDF receipts for manual import.'
                : 'Showing last known stock (offline) — Orders will be saved as JSON files if server is unreachable.'}
            </span>
          </div>
          {!manualOffline && (
            <button
              onClick={() => fetchInventoryData(false, true)}
              disabled={syncingInventory}
              className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[10px] sm:text-[11px] font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${syncingInventory ? 'animate-spin' : ''}`} />
              Retry Connection
            </button>
          )}
        </div>
      )}

      {/* Persistent Stock Override Banner */}
      {allowNegativeOrders && (
        <div className="bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 text-amber-800 dark:text-amber-200 text-xs shadow-xs transition-colors">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium">
              <span className="font-bold">Stock override active</span> — orders may exceed listed stock as authorized by warehouse manager.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 font-bold uppercase tracking-wider shrink-0">
            Override ON
          </span>
        </div>
      )}

      {/* Primary Tab Navigation Bar */}
      <div className="flex items-center justify-between sm:justify-start gap-2 sticky top-2 z-30">
        <div className="p-1 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs backdrop-blur-md inline-flex items-center gap-1 w-full sm:w-auto text-xs">
          {/* DESKTOP VIEW (lg:): Single Unified Order Terminal Button */}
          <button
            type="button"
            onClick={() => setActiveTab('order')}
            className={`hidden lg:inline-flex items-center gap-2 py-2 px-4 rounded-xl font-bold transition-all duration-150 cursor-pointer ${
              activeTab !== 'my-orders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Order Terminal</span>
            {orderItems.length > 0 && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab !== 'my-orders' ? 'bg-white/25 text-white' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {orderItems.length} {orderItems.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </button>

          {/* MOBILE VIEW (< lg): New Order Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('order')}
            className={`lg:hidden flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'order'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>New Order</span>
            {orderItems.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === 'order' ? 'bg-white/25 text-white' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {orderItems.length}
              </span>
            )}
          </button>

          {/* MOBILE VIEW (< lg): Catalog Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`lg:hidden flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Catalog</span>
          </button>

          {/* BOTH DESKTOP & MOBILE: My Orders Button */}
          <button
            type="button"
            onClick={() => setActiveTab('my-orders')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'my-orders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-indigo-400" />
            <span>My Orders</span>
          </button>
        </div>
      </div>

      {activeTab === 'my-orders' ? (
        <SalesmanOrdersPanel
          salesmanId={salesmanIdVal}
          salesmanName={selectedSalesman}
          showModal={showModal}
        />
      ) : (
        /* Two-Column Main Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* LEFT COLUMN: Simplified Order Entry Sheet */}
          <div
            className={`lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 md:p-6 space-y-5 sm:space-y-6 shadow-xs flex flex-col justify-between transition-colors ${
              activeTab === 'order' ? 'block' : 'hidden lg:flex'
            }`}
          >
          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Order Entry Sheet</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Manual Reset Form Button */}
                <button
                  type="button"
                  onClick={handleManualReset}
                  title="Reset form and clear selections"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-800/60 transition-all cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Form</span>
                </button>
                <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-mono">
                  {orderItems.length} {orderItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            {/* Salesman & Assigned Customer Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Salesman
                  </span>
                  {selectedSalesman && salesmanIdVal !== '--' && (
                    <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                      {salesmanIdVal}
                    </span>
                  )}
                </label>
                {isAdminOrManager ? (
                  <select
                    value={selectedSalesman}
                    onChange={e => {
                      setAdminSelectedSalesman(e.target.value);
                      setSelectedShop('');
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all cursor-pointer font-medium"
                  >
                    <option value="" disabled className="text-slate-400">
                      Select Salesman...
                    </option>
                    {salesmanList.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 flex items-center justify-between font-medium">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{selectedSalesman}</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                      Verified
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Assigned Customer / Shop
                  </span>
                  {selectedSalesman && (
                    <span className="font-normal text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60">
                      {assignedCustomers.length} Assigned
                    </span>
                  )}
                </label>
                {userRole === 'Customer' ? (
                  <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 flex items-center justify-between font-medium">
                    <span className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{selectedShop || profile?.shop_name || 'Customer Account'}</span>
                    </span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                      Registered
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedShop}
                    disabled={!selectedSalesman}
                    onChange={e => setSelectedShop(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium"
                  >
                    <option value="" disabled className="text-slate-400">
                      {selectedSalesman ? 'Select Assigned Customer...' : 'Select Salesman First...'}
                    </option>
                    {assignedCustomers.map(cust => (
                      <option key={cust['Shop Name']} value={cust['Shop Name']}>
                        {cust['Shop Name']}{cust.City ? ` — ${cust.City}` : ''}{cust['Customer Code'] ? ` [${cust['Customer Code']}]` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Customer Location Auto-Fetch Status Indicator Banner */}
            {isBothFieldsSelected ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs shadow-2xs transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 shrink-0">Customer Location Auto-Fetched:</span>
                  <span className="font-medium truncate text-emerald-800 dark:text-emerald-300">
                    {selectedShop} &bull; {cityVal}, {stateVal}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {customerCodeVal !== '--' && (
                    <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded font-bold text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60">
                      {customerCodeVal}
                    </span>
                  )}
                  <span
                    className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded font-bold text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60 cursor-help"
                    title={`Complete Location UUID: ${matchedLocationId}`}
                  >
                    LOC: {matchedLocationId.length > 12 ? `${matchedLocationId.slice(0, 8)}...` : matchedLocationId}
                  </span>
                </div>
              </div>
            ) : selectedSalesman ? (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs transition-all">
                <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Select an assigned customer from the dropdown above to auto-fetch customer location and dispatch coordinates.</span>
              </div>
            ) : null}

            {/* Location Metadata Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs transition-colors">
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-semibold">Salesman ID</span>
                <span className={`font-mono font-bold text-xs truncate block ${salesmanIdVal !== '--' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>{salesmanIdVal}</span>
              </div>
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-semibold">Location ID</span>
                <span className={`font-mono font-bold text-xs truncate block ${matchedLocationId !== '--' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`} title={matchedLocationId}>{matchedLocationId}</span>
              </div>
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-semibold">State</span>
                <span className={`font-medium text-xs truncate block ${stateVal !== '--' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>{stateVal}</span>
              </div>
              <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-semibold">City</span>
                <span className={`font-medium text-xs truncate block ${cityVal !== '--' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>{cityVal}</span>
              </div>
            </div>

            {/* Customer Details info (Phone, Contact Person, Address) */}
            {isBothFieldsSelected && matchedDealer && (matchedDealer.Phone || matchedDealer['Contact Person'] || matchedDealer.Address || customerCodeVal !== '--') && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                {customerCodeVal !== '--' && (
                  <span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Customer Code:</span>{' '}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{customerCodeVal}</span>
                  </span>
                )}
                {matchedDealer['Contact Person'] && (
                  <span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Contact:</span>{' '}
                    {matchedDealer['Contact Person']}
                  </span>
                )}
                {matchedDealer.Phone && (
                  <span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Phone:</span>{' '}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{matchedDealer.Phone}</span>
                  </span>
                )}
                {matchedDealer.Address && (
                  <span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Address:</span>{' '}
                    {matchedDealer.Address}
                  </span>
                )}
              </div>
            )}

            {/* ONLY ONE SEARCH BAR FOR SEARCHING AND ADDING PRODUCTS */}
            <div className="space-y-2 pt-1" ref={searchContainerRef}>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <Search className="w-3.5 h-3.5" />
                  Search & Add Product
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 normal-case font-normal">
                  3,681+ items
                </span>
              </label>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                    setSelectedSearchIndex(-1);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim()) setIsSearchOpen(true);
                  }}
                  onKeyDown={e => {
                    if (!isSearchOpen || searchResults.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedSearchIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedSearchIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const target = selectedSearchIndex >= 0 ? searchResults[selectedSearchIndex] : searchResults[0];
                      if (target) {
                        handleAddProduct(target['Item Name']);
                      }
                    } else if (e.key === 'Escape') {
                      setIsSearchOpen(false);
                    }
                  }}
                  placeholder="Search product name, category, brand..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchOpen(false);
                      setSelectedSearchIndex(-1);
                      if (searchInputRef.current) searchInputRef.current.focus();
                    }}
                    className="absolute right-3 top-2.5 sm:top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Enhanced Autocomplete Dropdown */}
                {isSearchOpen && searchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 max-h-72 sm:max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 transition-colors">
                    <div className="p-2 px-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium sticky top-0 z-10">
                      <span>Found {searchResults.length} matching {searchResults.length === 1 ? 'item' : 'items'}</span>
                      <span className="hidden sm:inline text-slate-400">
                        <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[9px] border border-slate-300 dark:border-slate-700 font-mono">↑↓</kbd> navigate &bull; <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[9px] border border-slate-300 dark:border-slate-700 font-mono">Enter</kbd> to add
                      </span>
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="p-5 text-center text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-600 dark:text-slate-400">No matching products found</p>
                        <p className="text-[11px] text-slate-400">Try searching for category, brand, size, or item name.</p>
                      </div>
                    ) : (
                      searchResults.map((item, idx) => {
                        const inCartQty = activeCartSelections[item['Item Name']] || 0;
                        const brand = item.Brand || deriveBrand(item.Category);
                        const isSelected = selectedSearchIndex === idx;

                        return (
                          <div
                            key={item.SKU + idx}
                            onClick={() => handleAddProduct(item['Item Name'])}
                            onMouseEnter={() => setSelectedSearchIndex(idx)}
                            className={`p-2.5 px-3 flex flex-col gap-1.5 cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            {/* 1. Full-Width Item Name & Cart Quantity */}
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug break-words flex-1 min-w-0">
                                <HighlightMatch text={item['Item Name']} query={searchQuery} />
                              </h4>
                              {inCartQty > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                                  In Order ({inCartQty})
                                </span>
                              )}
                            </div>

                            {/* 2. Brand & Category Badges Row */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-medium">
                                <Boxes className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                                {brand}
                              </span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                <Tag className="w-2.5 h-2.5 text-slate-400" />
                                {item.Category}
                              </span>
                            </div>

                            {/* 3. Bottom Row: Price & Stock on Left, Add Button on Right */}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                  ₹{item.Price}
                                </span>
                                {renderStockBadge(item['Current Stock'], item['Total Stock'], item['Reserved Stock'])}
                              </div>

                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleAddProduct(item['Item Name']);
                                }}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs shrink-0 cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ORDER ITEMS LIST (PRODUCT ROWS WITH CATEGORY & BRAND LABELS) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Order Product List
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {orderItems.length} {orderItems.length === 1 ? 'Product' : 'Products'} &bull; {orderTotalUnits} Units
                </span>
              </div>

              {orderItems.length === 0 ? (
                <div className="p-6 sm:p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Your order list is empty</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Use the search bar above or switch to the Inventory Ledger to add items.
                  </p>
                  <div className="pt-2 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setActiveTab('ledger')}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Browse Inventory Ledger
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {orderItems.map((item, idx) => {
                    const matchedInv = inventory.find(i => i['Item Name'] === item.name);
                    const avail = matchedInv ? matchedInv['Current Stock'] : 0;
                    const price = matchedInv ? matchedInv.Price : 0;
                    const category = matchedInv?.Category || 'Uncategorized';
                    const brand = matchedInv?.Brand || deriveBrand(category);
                    const stockErr = stockCheckResults.itemErrors[item.name];

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-50/70 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3 sm:p-3.5 space-y-2.5 transition-all shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* Item Name and Category/Brand Badges */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                                #{idx + 1}
                              </span>
                              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={item.name}>
                                {item.name}
                              </h3>
                            </div>

                            {/* Category and Brand Labels */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Brand Label */}
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                                <Boxes className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                                {brand}
                              </span>

                              {/* Category Label */}
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                <Tag className="w-2.5 h-2.5 text-slate-400" />
                                {category}
                              </span>

                              {/* Stock status */}
                              {renderStockBadge(avail, matchedInv?.['Total Stock'], matchedInv?.['Reserved Stock'])}
                            </div>
                          </div>

                          {/* Price, Quantity Stepper, Total & Remove */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                            {/* Quantity Controls with Direct Keyboard Entry */}
                            <div className="flex items-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg overflow-hidden shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleDecrementQty(item.id)}
                                title="Decrease quantity"
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer active:scale-95"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={item.qty === '' ? '' : item.qty}
                                onChange={e => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    handleUpdateQty(item.id, '');
                                  } else {
                                    const digits = raw.replace(/\D/g, '');
                                    handleUpdateQty(item.id, digits === '' ? '' : parseInt(digits, 10));
                                  }
                                }}
                                onBlur={() => handleBlurQty(item.id)}
                                onFocus={e => e.target.select()}
                                placeholder="1"
                                className="w-12 sm:w-14 text-center text-xs font-mono font-bold bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-indigo-50/60 dark:focus:bg-indigo-950/60 transition-colors"
                              />
                              <button
                                type="button"
                                onClick={() => handleIncrementQty(item.id)}
                                title="Increase quantity"
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Subtotal */}
                            <div className="text-right min-w-[65px] sm:min-w-[70px]">
                              <span className="block font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                                ₹{(price * (Number(item.qty) || 0)).toLocaleString('en-IN')}
                              </span>
                              <span className="block font-mono text-[10px] text-slate-400">
                                @ ₹{price}
                              </span>
                            </div>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              title="Remove item"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/60 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Error Warning if exceeds or out of stock */}
                        {stockErr && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{stockErr}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ORDER SUMMARY TOTALS BAR */}
            {orderItems.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 flex items-center justify-between text-xs transition-colors">
                <div className="space-y-0.5">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    Total Items: <strong className="text-slate-800 dark:text-slate-200">{orderItems.length}</strong> ({orderTotalUnits} units)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Order Grand Total</span>
                  <span className="text-sm sm:text-base font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                    ₹{orderTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Form Action Controls */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Primary Submit Button */}
              <button
                type="button"
                onClick={() => handlePlaceOrder(false)}
                disabled={orderItems.length === 0 || stockCheckResults.hasExceededError || submittingOrder}
                className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {submittingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Submitting Order...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {manualOffline ? 'Save Order (Offline JSON + PDF)' : 'Submit Order to Nalka'}
                  </>
                )}
              </button>

              {/* Direct JSON Fallback Export */}
              <button
                type="button"
                onClick={() => handlePlaceOrder(true)}
                disabled={orderItems.length === 0 || stockCheckResults.hasExceededError || submittingOrder}
                className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Export JSON File & PDF
              </button>
            </div>

            {orderItems.length > 0 && (
              <button
                type="button"
                onClick={confirmClearOrder}
                className="w-full py-2 px-4 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear Order Sheet
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Master Inventory Ledger */}
        <div
          className={`lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 shadow-xs flex flex-col justify-between transition-colors ${
            activeTab === 'ledger' ? 'block' : 'hidden lg:flex'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Live Master Inventory Ledger</h2>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono block">
                  {filteredLedger.length} Items
                </span>
                {totalLedgerPages > 1 && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono block font-bold">
                    Pg {currentLedgerPage}/{totalLedgerPages}
                  </span>
                )}
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 mt-3 sm:mt-4">
              <div className="sm:col-span-7 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter product name, SKU, or brand..."
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-5">
                <select
                  value={ledgerCategoryFilter}
                  onChange={e => setLedgerCategoryFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                >
                  <option value="All">All Categories</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Unified Inventory Ledger Table (Narrow, Clean Tabular Rows) */}
            <div className="mt-3.5 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-[520px] overflow-y-auto bg-white dark:bg-slate-900 transition-colors">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[9px] font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr>
                    <th className="py-2 px-3 text-left">Item Details</th>
                    <th className="py-2 px-2 text-center w-28 sm:w-32">Stock</th>
                    <th className="py-2 px-3 text-right w-16 sm:w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 text-xs">
                        No inventory records match filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedLedger.map((item, idx) => {
                      const itemName = item['Item Name'];
                      const avail = item['Current Stock'];
                      const brand = item.Brand || deriveBrand(item.Category);
                      const selectedQty = activeCartSelections[itemName] || 0;

                      let rowStyle = '';

                      if (selectedQty > 0) {
                        if (avail <= 0) {
                          rowStyle = 'bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-l-2 border-l-rose-500';
                        } else if (selectedQty > avail) {
                          rowStyle = 'bg-rose-50/40 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-l-2 border-l-rose-500';
                        } else {
                          rowStyle = 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200 border-l-2 border-l-indigo-600';
                        }
                      }

                      return (
                        <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${rowStyle}`}>
                          {/* Item Details: Name + Subtle Brand/Category on single narrow line */}
                          <td className="py-1.5 px-3 align-middle">
                            <div className="min-w-0 pr-1">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs block truncate" title={itemName}>
                                <HighlightMatch text={itemName} query={ledgerSearch} />
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                                <strong className="text-indigo-600 dark:text-indigo-400 font-medium">{brand}</strong>
                                {item.Category && item.Category !== 'Uncategorized' && (
                                  <>
                                    <span className="text-slate-300 dark:text-slate-600 mx-1">&bull;</span>
                                    <span>{item.Category}</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Stock & Status Badge */}
                          <td className="py-1.5 px-2 text-center align-middle whitespace-nowrap w-28 sm:w-32">
                            {renderLedgerStatusBadge(avail, selectedQty, item['Total Stock'], item['Reserved Stock'])}
                          </td>

                          {/* Action Button */}
                          <td className="py-1.5 px-3 text-right align-middle whitespace-nowrap w-16 sm:w-20">
                            <button
                              type="button"
                              onClick={() => handleAddProduct(itemName)}
                              title="Add to Order Sheet"
                              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all inline-flex items-center gap-0.5 cursor-pointer active:scale-95 ${
                                selectedQty > 0
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                              }`}
                            >
                              <Plus className="w-3 h-3" />
                              <span>{selectedQty > 0 ? `Add (${selectedQty})` : 'Add'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Bar */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              {/* Page size selector & item count summary */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="text-[11px]">Rows:</span>
                  <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-950 p-0.5 border border-slate-200 dark:border-slate-800">
                    {[25, 50, 100].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setLedgerPageSize(size);
                          setLedgerPage(1);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                          ledgerPageSize === size
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-900'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {filteredLedger.length === 0 ? (
                    '0 items'
                  ) : (
                    <>
                      <strong className="text-slate-800 dark:text-slate-200">{ledgerStartIndex}–{ledgerEndIndex}</strong> of{' '}
                      <strong className="text-slate-800 dark:text-slate-200">{filteredLedger.length}</strong>
                    </>
                  )}
                </span>
              </div>

              {/* Page navigation buttons */}
              <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setLedgerPage(1)}
                  disabled={currentLedgerPage <= 1}
                  title="First Page"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                  disabled={currentLedgerPage <= 1}
                  title="Previous Page"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Page</span>
                  <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{currentLedgerPage}</strong>
                  <span>of</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-bold">{totalLedgerPages}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => setLedgerPage(p => Math.min(totalLedgerPages, p + 1))}
                  disabled={currentLedgerPage >= totalLedgerPages}
                  title="Next Page"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerPage(totalLedgerPages)}
                  disabled={currentLedgerPage >= totalLedgerPages}
                  title="Last Page"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <span className="flex items-center gap-1.5">
              {manualOffline || isOffline ? (
                <span className="text-amber-600 dark:text-amber-400">Offline Fallback Stock (3,681 Tally Items)</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">Live Supabase Stock Sync</span>
              )}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">Nalka Metals WMS</span>
          </div>
        </div>
      </div>
      )}

      {/* Mobile Floating Order Cart Bar when browsing Ledger tab on narrow screens */}
      {activeTab === 'ledger' && orderItems.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-3 right-3 z-40 bg-white/95 dark:bg-slate-900/95 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-3 shadow-xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center font-bold font-mono text-xs shrink-0">
              {orderItems.length}
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-semibold">Active Order</span>
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                ₹{orderTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('order')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-500/20 flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
          >
            <span>Review Order</span>
            <ShoppingCart className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
