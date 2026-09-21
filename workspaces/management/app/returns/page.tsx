'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useLoading } from '../components/LoadingContext';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { createReturn, getReturns } from '@/shared/api/returns';
import {
  RotateCcw,
  Plus,
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  ShieldAlert,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
  BarChart3
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface ReturnRecord {
  'Return ID'?: string;
  return_id?: string;
  id?: string;
  'Customer Name'?: string;
  customer_name?: string;
  'Salesman Name'?: string;
  'Shop Name'?: string;
  'Location'?: string;
  location?: string;
  City?: string;
  city?: string;
  'SKU'?: string;
  sku?: string;
  'Item Name'?: string;
  item_name?: string;
  'Category'?: string;
  category?: string;
  'Price'?: number;
  price?: number;
  'Quantity'?: number;
  quantity?: number;
  'Condition'?: string;
  condition?: string;
  'Reason'?: string;
  reason?: string;
  'Status'?: string;
  status?: string;
  'Timestamp'?: string;
  timestamp?: string;
}

interface InventoryItem {
  SKU?: string;
  sku?: string;
  'Item Name'?: string;
  'Item name'?: string;
  item_name?: string;
  Category?: string;
  category?: string;
  'Item Category'?: string;
  'Item category'?: string;
  Price?: number;
  unit_price?: number;
  'Unit Price'?: number;
  'Current Stock'?: number;
}

import { DealerRecord, LocationRecord, OrderRecord } from '../types';


interface SupplierRecord {
  'Supplier Name'?: string;
  City?: string;
}

const GOOD_REASONS = [
  'Customer Return / Mind Changed',
  'Wrong Item Delivered',
  'Wrong Quantity Delivered',
  'Ordered By Mistake',
  'Excess Stock Return',
  'Other Good Return Reason'
];

const BAD_REASONS = [
  'Broken / Cracked',
  'Bad / Damaged Packaging',
  'Manufacturing / Material Defect',
  'Damaged in Transit',
  'Corroded / Rusted',
  'Other Defect'
];

const DEFAULT_CATEGORIES = [
  'Copper',
  'Brass',
  'Aluminum',
  'Stainless Steel',
  'Fittings & Flanges',
  'Fasteners',
  'Pipes & Tubes',
  'Plates & Sheets',
  'Wire & Rods',
  'Other'
];

// Helpers to read flexible key names from inventory table records
function getItemName(item: InventoryItem): string {
  if (!item) return '';
  return item['Item Name'] || item['Item name'] || item.item_name || item.SKU || item.sku || '';
}

function getItemCategory(item: InventoryItem): string {
  if (!item) return '';
  return item.Category || item.category || item['Item Category'] || item['Item category'] || '';
}

function getItemPrice(item: InventoryItem): number {
  if (!item) return 0;
  return Number(item.Price ?? item['Unit Price'] ?? item.unit_price ?? 0);
}

function ReturnsContent() {
  const searchParams = useSearchParams();
  const { registerLoadingKey, resolveLoadingKey } = useLoading();
  const [mounted, setMounted]           = useState(false);
  const [returns, setReturns]           = useState<ReturnRecord[]>([]);
  const [inventory, setInventory]       = useState<InventoryItem[]>([]);
  const [dealers, setDealers]           = useState<DealerRecord[]>([]);
  const [locations, setLocations]       = useState<LocationRecord[]>([]);
  const [orders, setOrders]             = useState<OrderRecord[]>([]);
  const [suppliers, setSuppliers]       = useState<SupplierRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [filterCondition, setFilterCondition] = useState<string>('All');
  const [modalOpen, setModalOpen]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);
  const [pageSize, setPageSize]         = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [drillModal, setDrillModal] = useState<{
    type: 'total' | 'good' | 'defective' | 'value';
    title: string;
    subtitle: string;
  } | null>(null);

  // Form State - Empty by default
  const [customerName, setCustomerName] = useState('');
  const [location, setLocation]         = useState('');
  const [selectionSource, setSelectionSource] = useState<'dealer' | 'location' | null>(null);
  const [itemName, setItemName]         = useState('');
  const [category, setCategory]         = useState('');
  const [sku, setSku]                   = useState('');
  const [price, setPrice]               = useState<number | ''>('');
  const [quantity, setQuantity]         = useState<number>(1);
  const [condition, setCondition]       = useState<'Good' | 'Bad'>('Good');
  const [reason, setReason]             = useState(GOOD_REASONS[0]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchReturns = useCallback(() => {
    setLoading(true);
    getReturns()
      .then((data: any) => setReturns(Array.isArray(data) ? data : []))
      .catch((err: any) => {
        console.warn('Failed to fetch returns:', err);
        setReturns([]);
      })
      .finally(() => {
        setLoading(false);
        resolveLoadingKey('returns_dashboard');
      });
  }, [resolveLoadingKey]);

  const fetchInventory = useCallback(() => {
    fetch(`${API}/api/inventory`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
      .then(data => setInventory(Array.isArray(data) ? data : []))
      .catch(err => console.warn('Failed to fetch inventory:', err));
  }, []);

  const fetchDealersAndLocations = useCallback(() => {
    fetch(`${API}/api/dealers`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
      .then(data => setDealers(Array.isArray(data) ? data : []))
      .catch(err => console.warn('Failed to fetch dealers:', err));

    fetch(`${API}/api/locations`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
      .then(data => setLocations(Array.isArray(data) ? data : []))
      .catch(err => console.warn('Failed to fetch locations:', err));

    fetch(`${API}/api/orders`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(err => console.warn('Failed to fetch orders:', err));

    fetch(`${API}/api/suppliers`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
      .then(data => setSuppliers(Array.isArray(data) ? data : []))
      .catch(err => console.warn('Failed to fetch suppliers:', err));
  }, []);

  useEffect(() => {
    registerLoadingKey('returns_dashboard');
    fetchReturns();
    fetchInventory();
    fetchDealersAndLocations();
  }, [registerLoadingKey, fetchReturns, fetchInventory, fetchDealersAndLocations]);

  // Combine dealer records from DEALERS table (primary) and ORDERS table (fallback)
  const combinedDealersMap = new Map<string, { name: string; city: string }>();

  dealers.forEach(d => {
    const name = d['Shop Name'] || d['Salesman Name'];
    const city = d.City || d.State || '';
    if (name && !combinedDealersMap.has(name)) {
      combinedDealersMap.set(name, { name, city });
    }
  });

  orders.forEach(o => {
    const name = o['Shop Name'] || o['Salesman Name'];
    const city = o.City || o.State || '';
    if (name && !combinedDealersMap.has(name)) {
      combinedDealersMap.set(name, { name, city });
    }
  });

  const allDealerList = Array.from(combinedDealersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Unique Cities from LOCATIONS table + DEALERS table + ORDERS table + SUPPLIERS table
  const availableCities = Array.from(
    new Set([
      ...locations.map(l => l.City).filter((c): c is string => Boolean(c && c.trim())),
      ...dealers.map(d => d.City).filter((c): c is string => Boolean(c && c.trim())),
      ...orders.map(o => o.City || o.State).filter((c): c is string => Boolean(c && c.trim())),
      ...suppliers.map(s => s.City).filter((c): c is string => Boolean(c && c.trim()))
    ])
  ).sort();

  // Filter Dealers if a Location was selected FIRST
  const availableDealers = (selectionSource === 'location' && location)
    ? allDealerList.filter(d => d.city.toLowerCase() === location.toLowerCase())
    : allDealerList;

  // Helper to fallback lookup item price from inventory if record price is 0
  const lookupInventoryPrice = useCallback((skuVal?: string, nameVal?: string): number => {
    if (!inventory.length) return 0;
    if (skuVal) {
      const matchSku = inventory.find(i => (i.SKU || i.sku || '').toLowerCase() === skuVal.toLowerCase());
      if (matchSku) return getItemPrice(matchSku);
    }
    if (nameVal) {
      const matchName = inventory.find(i => getItemName(i).toLowerCase() === nameVal.toLowerCase());
      if (matchName) return getItemPrice(matchName);
    }
    return 0;
  }, [inventory]);

  // Handler A: When user selects a Dealer / Customer FIRST
  const handleDealerChange = (dealerName: string) => {
    if (!dealerName) {
      setCustomerName('');
      setLocation('');
      setSelectionSource(null);
      return;
    }

    setCustomerName(dealerName);
    const matched = combinedDealersMap.get(dealerName);
    if (matched && matched.city) {
      setLocation(matched.city);
      setSelectionSource('dealer'); // Make location unchangeable
    }
  };

  // Handler B: When user selects a Location FIRST
  const handleLocationChange = (cityName: string) => {
    if (!cityName) {
      setLocation('');
      setSelectionSource(null);
      return;
    }

    setLocation(cityName);
    setSelectionSource('location');

    // If current customer doesn't operate in this location, reset customer
    if (customerName) {
      const matched = combinedDealersMap.get(customerName);
      if (matched && matched.city.toLowerCase() !== cityName.toLowerCase()) {
        setCustomerName('');
      }
    }
  };

  // Extract categories present in inventory table records
  const rawInvCategories = Array.from(
    new Set(
      inventory
        .map(i => getItemCategory(i))
        .filter((c): c is string => Boolean(c && c.trim()))
    )
  ).sort();

  const availableCategories = rawInvCategories.length > 0
    ? rawInvCategories
    : DEFAULT_CATEGORIES;

  // Filter inventory items by currently selected Category (or show all if no category match)
  const categoryFilteredItems = category
    ? (inventory.filter(i => getItemCategory(i).toLowerCase() === category.toLowerCase()).length > 0
        ? inventory.filter(i => getItemCategory(i).toLowerCase() === category.toLowerCase())
        : inventory)
    : inventory;

  // Handler when user selects a Category from dropdown
  const handleCategorySelect = (selectedCat: string) => {
    setCategory(selectedCat);
    // If current selected item does not belong to new category, reset item & SKU
    const itemsInCat = inventory.filter(i => getItemCategory(i).toLowerCase() === selectedCat.toLowerCase());
    if (itemName && !itemsInCat.some(i => getItemName(i).toLowerCase() === itemName.toLowerCase())) {
      setItemName('');
      setSku('');
      setPrice('');
    }
  };

  // Handler when user selects an Item Name from dropdown -> Locks SKU
  const handleItemSelect = (selectedName: string) => {
    setItemName(selectedName);
    const match = inventory.find(i => getItemName(i).toLowerCase() === selectedName.toLowerCase());
    if (match) {
      const itemCat = getItemCategory(match);
      if (itemCat) setCategory(itemCat);
      setSku(match.SKU || match.sku || '');
      setPrice(getItemPrice(match));
    }
  };

  // Handler when user enters / selects a SKU FIRST -> Auto-fetches Item Name & Category & Price
  const handleSkuSelect = (selectedSku: string) => {
    setSku(selectedSku);
    if (!selectedSku) return;
    const match = inventory.find(i => (i.SKU || i.sku || '').toLowerCase() === selectedSku.toLowerCase());
    if (match) {
      const name = getItemName(match);
      const cat = getItemCategory(match);
      if (name) setItemName(name);
      if (cat) setCategory(cat);
      setPrice(getItemPrice(match));
    }
  };

  // Handler to open modal cleanly with fresh empty fields
  const handleOpenModal = () => {
    setCustomerName('');
    setLocation('');
    setSelectionSource(null);
    setCategory('');
    setItemName('');
    setSku('');
    setPrice('');
    setQuantity(1);
    setCondition('Good');
    setReason(GOOD_REASONS[0]);
    setModalOpen(true);
    fetchInventory();
    fetchDealersAndLocations();
  };

  // Update reason choices when condition toggles
  const handleConditionChange = (newCondition: 'Good' | 'Bad') => {
    setCondition(newCondition);
    if (newCondition === 'Good') {
      setReason(GOOD_REASONS[0]);
    } else {
      setReason(BAD_REASONS[0]);
    }
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !itemName.trim() || !sku.trim() || !quantity || quantity <= 0) {
      alert('Please fill out all required fields (Customer Name, Item Name, SKU, and Quantity > 0).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName.trim(),
        location: location.trim() || 'Direct',
        item_name: itemName.trim(),
        category: category || 'General',
        price: Number(price) || 0,
        quantity: Number(quantity),
        condition: condition,
        reason: reason,
        sku: sku.trim()
      };

      const result = await createReturn(payload);
      setToastMessage(
        condition === 'Good'
          ? `Return ${result.return_id} logged & restocked (+${quantity} units to inventory)!`
          : `Defective Return ${result.return_id} logged (NOT added to inventory).`
      );
      setTimeout(() => setToastMessage(null), 5000);

      // Reset form & reload
      setCustomerName('');
      setLocation('');
      setSelectionSource(null);
      setCategory('');
      setItemName('');
      setSku('');
      setPrice('');
      setModalOpen(false);
      fetchReturns();
      fetchInventory();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error processing return');
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const totalReturnsCount = returns.length;
  const goodReturnsCount = returns.filter(r => (r.Condition || r.Status || '').toLowerCase().includes('good') || (r.Status || '').toLowerCase() === 'restocked').length;
  const badReturnsCount = returns.filter(r => (r.Condition || r.Status || '').toLowerCase().includes('bad') || (r.Status || '').toLowerCase() === 'defective').length;
  const totalRefundValue = returns.reduce((acc, r) => {
    const p = Number(r.Price ?? r.price ?? 0) || lookupInventoryPrice(r.SKU || r.sku, r['Item Name'] || r.item_name);
    return acc + (p * (Number(r.Quantity ?? r.quantity) || 0));
  }, 0);

  // Filtering
  const filtered = returns.filter(r => {
    const q = search.trim().toLowerCase();
    const condStr = (r.Condition || r.Status || '').toLowerCase();
    
    let matchesCond = true;
    if (filterCondition === 'Good') {
      matchesCond = condStr.includes('good') || (r.Status || '').toLowerCase() === 'restocked';
    } else if (filterCondition === 'Bad') {
      matchesCond = condStr.includes('bad') || (r.Status || '').toLowerCase() === 'defective';
    }

    if (!matchesCond) return false;
    if (!q) return true;

    return Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q));
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated  = filtered.slice(startIndex, startIndex + pageSize);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `customer_returns_export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Check if SKU is unchangeable because Item Category and Item Name are selected
  const isSkuUnchangeable = Boolean(category && itemName && sku);

  return (
    <div className="fade-in">
      {/* Toast Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 200,
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          border: '1px solid #10b981',
          color: '#34d399',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RotateCcw className="text-accent" size={26} />
            <span>Returns</span>
          </h1>
          <p className="page-subtitle">
            Track customer returns, handle restocked items, and defective stock.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchReturns}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={16} />
            <span>Add Return</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setDrillModal({ type: 'total', title: 'Total Returns Log', subtitle: 'Historical record of all logged product returns.' })}>
          <div className="kpi-header">
            <span className="kpi-label">Total Returns</span>
            <div className="kpi-icon-wrap">
              <RotateCcw size={20} />
            </div>
          </div>
          <div className="kpi-value">{totalReturnsCount}</div>
          <div className="kpi-subtitle">
            <span>Log of all customer returns</span>
          </div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setDrillModal({ type: 'good', title: 'Good Returns (Restocked)', subtitle: 'Products returned in good condition and placed back in stock.' })}>
          <div className="kpi-header">
            <span className="kpi-label">Good Returns (Restocked)</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
              <PackageCheck size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{goodReturnsCount}</div>
          <div className="kpi-subtitle kpi-positive">
            <span>Added back to inventory stock</span>
          </div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setDrillModal({ type: 'defective', title: 'Defective (Bad Returns)', subtitle: 'Products returned with defect or transit damage.' })}>
          <div className="kpi-header">
            <span className="kpi-label">Defective (Bad Returns)</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              <ShieldAlert size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>{badReturnsCount}</div>
          <div className="kpi-subtitle kpi-negative">
            <span>Excluded from inventory stock</span>
          </div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setDrillModal({ type: 'value', title: 'Total Refund Asset Value', subtitle: 'Gross monetary refund value of processed returns.' })}>
          <div className="kpi-header">
            <span className="kpi-label">Total Return Value</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>
            ₹{totalRefundValue.toLocaleString('en-IN')}
          </div>
          <div className="kpi-subtitle kpi-warning-cl">
            <span>Gross monetary value of returns</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="search-wrap">
              <Search size={15} />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Search returns by customer, item, SKU..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                style={{ width: '300px' }}
              />
            </div>

            {/* Condition Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Condition:</span>
              <button
                className={`btn btn-sm ${filterCondition === 'All' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setFilterCondition('All'); setCurrentPage(1); }}
              >
                All
              </button>
              <button
                className={`btn btn-sm ${filterCondition === 'Good' ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => { setFilterCondition('Good'); setCurrentPage(1); }}
              >
                Good (Restocked)
              </button>
              <button
                className={`btn btn-sm ${filterCondition === 'Bad' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => { setFilterCondition('Bad'); setCurrentPage(1); }}
              >
                Bad (Defective)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn btn-sm btn-secondary" onClick={exportJson} disabled={filtered.length === 0}>
              <Download size={14} />
              <span>Export JSON</span>
            </button>
            <span className="badge badge-info" style={{ fontSize: '0.8rem', padding: '5px 12px' }}>
              {filtered.length} records
            </span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#3b82f6' }} />
            <p>Loading return records from database...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RotateCcw size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>No customer return records found.</p>
          </div>
        ) : (
          <>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '170px' }}>Customer Name</th>
                    <th style={{ minWidth: '120px' }}>Location</th>
                    <th style={{ minWidth: '130px' }}>SKU</th>
                    <th style={{ minWidth: '240px' }}>Item Name</th>
                    <th style={{ minWidth: '150px' }}>Category</th>
                    <th className="text-right" style={{ minWidth: '100px' }}>Price</th>
                    <th className="text-right" style={{ minWidth: '70px' }}>Qty</th>
                    <th style={{ minWidth: '120px' }}>Condition</th>
                    <th style={{ minWidth: '180px' }}>Reason</th>
                    <th style={{ minWidth: '110px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r, idx) => {
                    const isGood = (r.Condition || r.Status || '').toLowerCase().includes('good') || (r.Status || '').toLowerCase() === 'restocked';
                    
                    // Smart Fallbacks for older records
                    const cust = r['Customer Name'] || r.customer_name || r['Shop Name'] || r['Salesman Name'] || 'Direct Customer';
                    const loc  = r.Location || r.location || r.City || r.city || 'Standard';
                    const item = r['Item Name'] || r.item_name || '—';
                    const cat  = r.Category || r.category || 'General';
                    const skuCode = r.SKU || r.sku || '—';

                    // Fallback to inventory unit price if record price is 0
                    const rawPrice = Number(r.Price ?? r.price ?? 0);
                    const finalPrice = rawPrice > 0 ? rawPrice : lookupInventoryPrice(skuCode, item);
                    const qtyVal = Number(r.Quantity ?? r.quantity ?? 0);

                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#f8fafc' }}>{cust}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{loc}</td>
                        <td className="mono" style={{ color: '#6366f1' }}>{skuCode}</td>
                        <td style={{ fontWeight: 500 }}>{item}</td>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                            {cat}
                          </span>
                        </td>
                        <td className="text-right mono" style={{ fontWeight: 600 }}>₹{finalPrice.toLocaleString('en-IN')}</td>
                        <td className="text-right mono" style={{ fontWeight: 700 }}>{qtyVal}</td>
                        <td>
                          <span className={`badge ${isGood ? 'badge-success' : 'badge-danger'}`}>
                            {isGood ? 'Good Return' : 'Bad Return'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {r.Reason || r.reason || 'Unspecified'}
                        </td>
                        <td>
                          <span className={`badge ${isGood ? 'badge-success' : 'badge-danger'}`}>
                            {isGood ? 'Restocked' : 'Defective'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="table-pagination">
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Showing <strong style={{ color: 'var(--text)' }}>{startIndex + 1}</strong> to <strong style={{ color: 'var(--text)' }}>{Math.min(startIndex + pageSize, filtered.length)}</strong> of <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> returns
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span>Per page:</span>
                  <select
                    className="form-input form-select"
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    style={{ width: '75px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    className="btn btn-sm btn-secondary btn-icon"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary btn-icon"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, padding: '0 8px', color: 'var(--text-muted)' }}>
                    Page <strong style={{ color: 'var(--text)' }}>{safePage}</strong> of {totalPages}
                  </span>
                  <button
                    className="btn btn-sm btn-secondary btn-icon"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary btn-icon"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Process Customer Return Modal - Rendered into document.body via Portal for Pixel-Perfect Window Centering */}
      {modalOpen && mounted && createPortal(
        <div
          className="modal-overlay-portal"
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(5, 8, 15, 0.82)',
            backdropFilter: 'blur(8px)',
            padding: '1.5rem',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="modal-card-portal fade-in"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '840px',
              width: '100%',
              maxHeight: '86vh',
              overflowY: 'auto',
              borderRadius: '16px',
              background: '#0f172a',
              border: '1px solid #334155',
              padding: '2rem',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
              boxSizing: 'border-box',
              color: '#f8fafc',
              position: 'relative',
              margin: 'auto'
            }}
          >
            <div className="modal-header" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RotateCcw size={22} className="text-accent" />
                <span>Process Customer Return</span>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateReturn} style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
              
              {/* Condition Selector Tabs */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '8px', display: 'block', fontSize: '0.9rem' }}>
                  Return Condition <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <button
                    type="button"
                    onClick={() => handleConditionChange('Good')}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: condition === 'Good' ? '2px solid #10b981' : '1px solid #334155',
                      background: condition === 'Good' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(30, 41, 59, 0.5)',
                      color: condition === 'Good' ? '#34d399' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                      <PackageCheck size={20} />
                      <span>Good Return</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: condition === 'Good' ? '#a7f3d0' : 'var(--text-subtle)', fontWeight: 400 }}>
                      Item will be added back to Inventory stock
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConditionChange('Bad')}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: condition === 'Bad' ? '2px solid #ef4444' : '1px solid #334155',
                      background: condition === 'Bad' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(30, 41, 59, 0.5)',
                      color: condition === 'Bad' ? '#fca5a5' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                      <ShieldAlert size={20} />
                      <span>Bad Return (Defective)</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: condition === 'Bad' ? '#fecaca' : 'var(--text-subtle)', fontWeight: 400 }}>
                      Excluded from Inventory stock (Damaged)
                    </span>
                  </button>
                </div>
              </div>

              {/* Customer Name & Location Dropdowns */}
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                
                {/* Customer Name Dropdown */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Customer Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>

                  <select
                    className="form-input form-select"
                    value={customerName}
                    onChange={e => handleDealerChange(e.target.value)}
                    required
                    style={{
                      fontSize: '0.9rem',
                      padding: '0.65rem 0.85rem',
                      color: customerName ? '#f8fafc' : '#64748b'
                    }}
                  >
                    <option value="" disabled hidden style={{ color: '#64748b' }}>Enter customer name...</option>

                    {availableDealers.map((d, idx) => (
                      <option key={idx} value={d.name} style={{ color: '#f8fafc', background: '#0f172a' }}>
                        {d.name} {d.city ? `(${d.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Customer Location / City Dropdown */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Customer Location / City
                  </label>

                  <select
                    className="form-input form-select"
                    value={location}
                    onChange={e => handleLocationChange(e.target.value)}
                    disabled={selectionSource === 'dealer' && Boolean(location)}
                    style={{
                      fontSize: '0.9rem',
                      padding: '0.65rem 0.85rem',
                      color: location ? '#f8fafc' : '#64748b',
                      opacity: (selectionSource === 'dealer' && Boolean(location)) ? 0.7 : 1,
                      cursor: (selectionSource === 'dealer' && Boolean(location)) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="" disabled hidden style={{ color: '#64748b' }}>Enter customer location...</option>
                    {availableCities.map((c, idx) => (
                      <option key={idx} value={c} style={{ color: '#f8fafc', background: '#0f172a' }}>{c}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Item Category & Item Name Dropdowns */}
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                
                {/* Item Category Dropdown */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Item Category <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="form-input form-select"
                    value={category}
                    onChange={e => handleCategorySelect(e.target.value)}
                    required
                    style={{
                      fontSize: '0.9rem',
                      padding: '0.65rem 0.85rem',
                      color: category ? '#f8fafc' : '#64748b'
                    }}
                  >
                    <option value="" disabled hidden style={{ color: '#64748b' }}>Select Item Category...</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat} style={{ color: '#f8fafc', background: '#0f172a' }}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Item Name Dropdown */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Item Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>

                  <select
                    className="form-input form-select"
                    value={itemName}
                    onChange={e => handleItemSelect(e.target.value)}
                    required
                    style={{
                      fontSize: '0.9rem',
                      padding: '0.65rem 0.85rem',
                      color: itemName ? '#f8fafc' : '#64748b'
                    }}
                  >
                    <option value="" disabled hidden style={{ color: '#64748b' }}>Select Item Name...</option>
                    {categoryFilteredItems.map((item, idx) => {
                      const name = getItemName(item);
                      const skuVal = item.SKU || item.sku ? ` [${item.SKU || item.sku}]` : '';
                      const priceVal = getItemPrice(item) ? ` - ₹${getItemPrice(item)}` : '';
                      return (
                        <option key={idx} value={name} style={{ color: '#f8fafc', background: '#0f172a' }}>
                          {name}{skuVal}{priceVal}
                        </option>
                      );
                    })}
                  </select>
                </div>

              </div>

              {/* SKU & Unit Price & Quantity */}
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                
                {/* SKU Dropdown - Required, Bi-directional auto-fetch & Unchangeable once Item selected */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    SKU <span style={{ color: '#ef4444' }}>*</span>
                  </label>

                  <select
                    className="form-input form-select mono"
                    value={sku}
                    onChange={e => handleSkuSelect(e.target.value)}
                    disabled={isSkuUnchangeable}
                    required
                    style={{
                      fontSize: '0.9rem',
                      padding: '0.65rem 0.85rem',
                      color: sku ? '#f8fafc' : '#64748b',
                      opacity: isSkuUnchangeable ? 0.7 : 1,
                      cursor: isSkuUnchangeable ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="" disabled hidden style={{ color: '#64748b' }}>Select SKU...</option>
                    {inventory.map((item, idx) => {
                      const s = item.SKU || item.sku || '';
                      if (!s) return null;
                      return (
                        <option key={idx} value={s} style={{ color: '#f8fafc', background: '#0f172a' }}>
                          {s} — {getItemName(item)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Unit Price (₹) */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input mono"
                    placeholder="0.00"
                    value={price}
                    onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    readOnly
                    style={{ opacity: 0.8, cursor: 'not-allowed', color: price !== '' ? '#f8fafc' : '#64748b' }}
                  />
                </div>

                {/* Quantity Returned */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Quantity Returned <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-input mono"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                    required
                    style={{ color: '#f8fafc' }}
                  />
                </div>
              </div>

              {/* Dynamic Return Reasons */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Reason for Return ({condition === 'Good' ? 'Good Return Reasons' : 'Defect Reasons'}) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-input form-select"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{ fontSize: '0.9rem', padding: '0.65rem 0.85rem', color: '#f8fafc' }}
                >
                  {(condition === 'Good' ? GOOD_REASONS : BAD_REASONS).map(r => (
                    <option key={r} value={r} style={{ color: '#f8fafc', background: '#0f172a' }}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic Notice Banner */}
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: condition === 'Good' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${condition === 'Good' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: condition === 'Good' ? '#34d399' : '#fca5a5'
              }}>
                {condition === 'Good' ? <PackageCheck size={18} /> : <AlertTriangle size={18} />}
                <span>
                  {condition === 'Good'
                    ? `Good Return: ${quantity} unit(s) of "${itemName || 'Item'}" will be automatically added to INVENTORY stock.`
                    : `Bad/Defective Return: "${itemName || 'Item'}" logged for QA log but NOT added to inventory stock.`}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${condition === 'Good' ? 'btn-success' : 'btn-danger'}`}
                  disabled={submitting || !itemName || !sku}
                  style={{ padding: '0.7rem 1.4rem' }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={18} />
                      <span>Submit Return Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── DRILL DOWN MODAL ────────────────────────────────────────────────── */}
      {drillModal && mounted && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card fade-in" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={20} className="text-accent" />
                <span style={{ fontWeight: 700 }}>{drillModal.title}</span>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDrillModal(null)}>
                <X size={18} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '-0.75rem', lineHeight: '1.4' }}>
                {drillModal.subtitle}
              </p>

              {/* KPI Mini-cards row */}
              {drillModal.type === 'total' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Logged Returns Count</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6366f1', marginTop: '2px' }}>
                      {totalReturnsCount} Logs
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Restocked Goods</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      {goodReturnsCount} Items
                    </div>
                  </div>
                </div>
              )}

              {drillModal.type === 'good' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Restocked Returns</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      {goodReturnsCount}
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Restock Ratio</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6366f1', marginTop: '2px' }}>
                      {totalReturnsCount > 0 ? ((goodReturnsCount / totalReturnsCount) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              )}

              {drillModal.type === 'defective' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Defective Returns</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>
                      {badReturnsCount} Items
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Defect Ratio</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                      {totalReturnsCount > 0 ? ((badReturnsCount / totalReturnsCount) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              )}

              {drillModal.type === 'value' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Gross Return Value</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                      ₹{totalRefundValue.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Avg Value/Return</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      ₹{totalReturnsCount > 0 ? Math.round(totalRefundValue / totalReturnsCount).toLocaleString('en-IN') : 0}
                    </div>
                  </div>
                </div>
              )}

              {/* Data Table list breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {drillModal.type === 'total' && 'Recent Return Transactions Log'}
                  {drillModal.type === 'good' && 'Recent Restocked Items List'}
                  {drillModal.type === 'defective' && 'Recent Critical Defects Log'}
                  {drillModal.type === 'value' && 'Highest Value Return Invoices'}
                </div>

                {drillModal.type === 'total' && (
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '6px 4px' }}>Return ID</th>
                        <th style={{ padding: '6px 4px' }}>Customer Name</th>
                        <th style={{ padding: '6px 4px' }}>Item Name</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.slice(0, 5).map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td className="mono" style={{ padding: '6px 4px', color: '#6366f1' }}>{r['Return ID'] || r.return_id}</td>
                          <td style={{ padding: '6px 4px', fontWeight: 600 }}>{r['Customer Name'] || r.customer_name || '—'}</td>
                          <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{r['Item Name'] || r.item_name || '—'}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700 }}>{r.Quantity ?? r.quantity ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {drillModal.type === 'good' && (
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '6px 4px' }}>Item Name</th>
                        <th style={{ padding: '6px 4px' }}>Reason</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty Restocked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.filter(r => (r.Condition || r.Status || '').toLowerCase().includes('good') || (r.Status || '').toLowerCase() === 'restocked').slice(0, 5).map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '6px 4px', fontWeight: 600 }}>{r['Item Name'] || r.item_name || '—'}</td>
                          <td style={{ padding: '6px 4px', color: '#10b981' }}>{r.Reason || r.reason || 'Restocked'}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700 }}>{r.Quantity ?? r.quantity ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {drillModal.type === 'defective' && (
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '6px 4px' }}>Item Name</th>
                        <th style={{ padding: '6px 4px' }}>Defect Reason</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty Defective</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.filter(r => (r.Condition || r.Status || '').toLowerCase().includes('bad') || (r.Status || '').toLowerCase() === 'defective').slice(0, 5).map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '6px 4px', fontWeight: 600 }}>{r['Item Name'] || r.item_name || '—'}</td>
                          <td style={{ padding: '6px 4px', color: '#f43f5e' }}>{r.Reason || r.reason || 'Damaged'}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700 }}>{r.Quantity ?? r.quantity ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {drillModal.type === 'value' && (
                  (() => {
                    const sortedReturns = [...returns].map(r => {
                      const p = Number(r.Price ?? r.price ?? 0) || lookupInventoryPrice(r.SKU || r.sku, r['Item Name'] || r.item_name);
                      return {
                        customer: r['Customer Name'] || r.customer_name,
                        item: r['Item Name'] || r.item_name,
                        val: p * (Number(r.Quantity ?? r.quantity) || 0)
                      };
                    }).sort((a, b) => b.val - a.val).slice(0, 5);

                    return (
                      <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <th style={{ padding: '6px 4px' }}>Customer</th>
                            <th style={{ padding: '6px 4px' }}>Item Name</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Total Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedReturns.map((r, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '6px 4px', fontWeight: 600 }}>{r.customer || '—'}</td>
                              <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{r.item || '—'}</td>
                              <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>₹{r.val.toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setDrillModal(null)}>Close Breakdown</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading returns module...</div>}>
      <ReturnsContent />
    </Suspense>
  );
}
