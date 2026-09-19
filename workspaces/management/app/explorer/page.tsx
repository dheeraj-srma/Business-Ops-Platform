'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useBi } from '../context/BiDataContext';
import InteractiveChart from '../components/InteractiveChart';
import ExplorerAIInsights from '../analytics/ExplorerAIInsights';
import {
  Search,
  X,
  ChevronDown,
  Layers,
  Box,
  ShoppingCart,
  RotateCcw,
  Sparkles,
  Building2,
  User,
  MapPin,
  Package
} from 'lucide-react';

/* Custom Searchable Dropdown for 360° Explorer */
function SearchableEntitySelect({
  label,
  value,
  options,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return options.slice(0, 100);
    return options.filter(opt => opt.toLowerCase().includes(q)).slice(0, 100);
  }, [options, filterText]);

  return (
    <div className="relative w-full z-40" ref={dropdownRef}>
      {label && <label className="block text-xs font-semibold text-slate-300 mb-1">{label}</label>}

      <div className="relative flex items-center w-full">
        <input
          type="text"
          className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-500 focus:border-indigo-600 dark:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none transition-all shadow-inner"
          placeholder={value || placeholder}
          value={isOpen ? filterText : (value || '')}
          onChange={e => {
            setFilterText(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setFilterText('');
            setIsOpen(true);
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          style={{ paddingRight: value ? '58px' : '36px', cursor: 'pointer' }}
        />

        {value && (
          <button
            type="button"
            className="absolute right-8 p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setFilterText('');
            }}
            title="Clear Selection"
          >
            <X size={15} />
          </button>
        )}

        <button
          type="button"
          className="absolute right-2 p-1 text-slate-400 hover:text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
          onClick={() => {
            setFilterText('');
            setIsOpen(prev => !prev);
          }}
        >
          <ChevronDown size={17} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/98 backdrop-blur-2xl border border-indigo-300 dark:border-indigo-700/60 rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] max-h-80 overflow-y-auto z-[999] p-1.5 ring-1 ring-cyan-500/25 custom-scrollbar">
          <div
            className={`px-3 py-2 rounded-lg cursor-pointer text-xs font-bold transition-colors ${value === '' ? 'bg-indigo-600 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60' : 'text-slate-300 hover:bg-slate-800'}`}
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
          >
            -- Show All Records ({options.length} available) --
          </div>

          {options.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-400 italic text-center">
              Loading available records...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-400 italic text-center">
              No records found matching &quot;{filterText}&quot;
            </div>
          ) : (
            filteredOptions.map((item, idx) => {
              const isSelected = value.toLowerCase() === item.toLowerCase();
              return (
                <div
                  key={idx}
                  className={`px-3 py-2 rounded-lg cursor-pointer text-xs transition-all flex items-center justify-between ${isSelected ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-200 hover:bg-slate-800/90 hover:text-cyan-200'}`}
                  onClick={() => {
                    onChange(item);
                    setIsOpen(false);
                  }}
                >
                  <span className="truncate">{item}</span>
                  {isSelected && <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-200">Active</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function BusinessExplorerPage() {
  const {
    inventoryList,
    categoriesList,
    ordersList,
    returnsList,
    suppliersList,
    dealersList,
    inwardsList,
    skuMap,
    biData,
    loading
  } = useBi();

  const [explorerType, setExplorerType] = useState<'Product' | 'Category' | 'Customer' | 'Supplier' | 'Salesman' | 'Location'>('Product');
  const [searchQuery, setSearchQuery] = useState('');

  // Available options per dimension
  const availableEntities = useMemo(() => {
    if (explorerType === 'Product') {
      const set = new Set<string>();
      inventoryList.forEach(i => {
        const name = i['Item Name'] || i.item_name || i.name || i.SKU || i.sku;
        if (name) set.add(String(name).trim());
      });
      ordersList.forEach(o => {
        const name = o['Item Name'] || o.name;
        if (name) set.add(String(name).trim());
      });
      if (set.size === 0 && biData.sales_intelligence?.top_products) {
        biData.sales_intelligence.top_products.forEach(p => set.add(p.name));
      }
      return Array.from(set).sort();
    } else if (explorerType === 'Category') {
      const set = new Set<string>();
      (categoriesList || []).forEach(c => {
        const name = c.name || c.Category;
        if (name) set.add(String(name).trim());
      });
      inventoryList.forEach(i => {
        const cat = i.Category || i.categoryName || i.category;
        const brand = i.Brand || i.brand;
        if (brand) set.add(String(brand).trim());
        if (cat) set.add(String(cat).trim());
      });
      ordersList.forEach(o => {
        const cat = o.Category || o.category;
        if (cat) set.add(String(cat).trim());
      });
      if (biData.sales_intelligence?.revenue_by_category) {
        biData.sales_intelligence.revenue_by_category.forEach(c => set.add(c.category));
      }
      if (set.size === 0) {
        ['FINOLEX', 'HAHN', 'FLOTO', 'COATS - BATH FITTINGS', 'GRAVITY', 'MATRIX', 'Nalka PTMT', 'UNIK', 'SUPERFLO', 'COATS - ACCESSORIES', 'ASTRAL', 'AKG', 'Brass Hardware', 'Sanitary Fittings', 'ACRELIC', 'AR ENTERPRISES'].forEach(c => set.add(c));
      }
      return Array.from(set).sort();
    } else if (explorerType === 'Customer') {
      const set = new Set<string>();
      dealersList.forEach(d => {
        const name = d['Shop Name'] || d.shop_name || d.name || d['Customer Name'];
        if (name) set.add(String(name).trim());
      });
      ordersList.forEach(o => {
        const name = o['Shop Name'] || o.shop_name || o['Customer Name'];
        if (name) set.add(String(name).trim());
      });
      if (set.size === 0 && biData.sales_intelligence?.dealer_rankings) {
        biData.sales_intelligence.dealer_rankings.forEach(d => set.add(d.dealer));
      }
      return Array.from(set).sort();
    } else if (explorerType === 'Supplier') {
      const set = new Set<string>();
      suppliersList.forEach(s => {
        const name = s['Supplier Name'] || s.supplier_name || s.name;
        if (name) set.add(String(name).trim());
      });
      inventoryList.forEach(i => {
        const name = i.Supplier || i.supplier;
        if (name) set.add(String(name).trim());
      });
      if (set.size === 0 && biData.procurement_intelligence?.top_suppliers) {
        biData.procurement_intelligence.top_suppliers.forEach(s => set.add(s.supplier));
      }
      return Array.from(set).sort();
    } else if (explorerType === 'Salesman') {
      const set = new Set<string>();
      dealersList.forEach(d => {
        const name = d['Salesman Name'] || d.salesman;
        if (name) set.add(String(name).trim());
      });
      ordersList.forEach(o => {
        const name = o['Salesman Name'] || o.salesman;
        if (name) set.add(String(name).trim());
      });
      if (set.size === 0 && biData.sales_intelligence?.salesman_performance) {
        biData.sales_intelligence.salesman_performance.forEach(s => set.add(s.salesman));
      }
      ['RAVINDER KUMAR', 'ANKIT', 'NALKA', 'SAURAV', 'CHANDRA PRAKASH'].forEach(s => set.add(s));
      return Array.from(set).sort();
    } else {
      return ['Main Warehouse', 'Delhi Regional Hub', 'Gurugram Depot', 'Noida Yard', 'Faridabad Store'];
    }
  }, [explorerType, inventoryList, categoriesList, ordersList, suppliersList, dealersList, biData]);

  // Calculate dynamic entity-specific profile metrics
  const explorerMetrics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let matchedProducts = inventoryList;
    let matchedOrders = ordersList;
    let matchedReturns = returnsList;

    if (q) {
      if (explorerType === 'Product') {
        matchedProducts = inventoryList.filter(p => (p.SKU && String(p.SKU).toLowerCase().includes(q)) || (p['Item Name'] && String(p['Item Name']).toLowerCase().includes(q)));
        const matchedSkus = new Set(matchedProducts.map(p => String(p.SKU).toLowerCase()));
        matchedOrders = ordersList.filter(o => (o['Item Name'] && String(o['Item Name']).toLowerCase().includes(q)) || (o.SKU && matchedSkus.has(String(o.SKU).toLowerCase())));
        matchedReturns = returnsList.filter(r => (r['Item Name'] && String(r['Item Name']).toLowerCase().includes(q)) || (r.SKU && matchedSkus.has(String(r.SKU).toLowerCase())));
      } else if (explorerType === 'Category') {
        matchedProducts = inventoryList.filter(p => {
          const cat = String(p.Category || p.categoryName || p.category || '').toLowerCase();
          const brand = String(p.Brand || p.brand || '').toLowerCase();
          return cat.includes(q) || brand.includes(q);
        });
        const matchedSkus = new Set(matchedProducts.map(p => String(p.SKU).toLowerCase()));
        matchedOrders = ordersList.filter(o => {
          const cat = String(o.Category || o.category || '').toLowerCase();
          return cat.includes(q) || (o.SKU && matchedSkus.has(String(o.SKU).toLowerCase()));
        });
        matchedReturns = returnsList.filter(r => {
          const cat = String(r.Category || r.category || '').toLowerCase();
          return cat.includes(q) || (r.SKU && matchedSkus.has(String(r.SKU).toLowerCase()));
        });
      } else if (explorerType === 'Customer') {
        matchedOrders = ordersList.filter(o => (o['Shop Name'] && String(o['Shop Name']).toLowerCase().includes(q)) || (o['Customer Name'] && String(o['Customer Name']).toLowerCase().includes(q)));
        const matchedSkus = new Set(matchedOrders.map(o => String(o.SKU).toLowerCase()));
        matchedProducts = inventoryList.filter(p => p.SKU && matchedSkus.has(String(p.SKU).toLowerCase()));
        matchedReturns = returnsList.filter(r => (r['Shop Name'] && String(r['Shop Name']).toLowerCase().includes(q)) || (r['Customer Name'] && String(r['Customer Name']).toLowerCase().includes(q)));
      } else if (explorerType === 'Supplier') {
        const matchedSuppliers = suppliersList.filter(s => s['Supplier Name'] && String(s['Supplier Name']).toLowerCase().includes(q));
        const supNames = new Set(matchedSuppliers.map(s => String(s['Supplier Name']).toLowerCase()));
        matchedProducts = inventoryList.filter(p => p.Supplier && supNames.has(String(p.Supplier).toLowerCase()));
        const matchedSkus = new Set(matchedProducts.map(p => String(p.SKU).toLowerCase()));
        matchedOrders = ordersList.filter(o => o.SKU && matchedSkus.has(String(o.SKU).toLowerCase()));
        matchedReturns = returnsList.filter(r => r.SKU && matchedSkus.has(String(r.SKU).toLowerCase()));
      } else if (explorerType === 'Salesman') {
        matchedOrders = ordersList.filter(o => o['Salesman Name'] && String(o['Salesman Name']).toLowerCase().includes(q));
        const matchedSkus = new Set(matchedOrders.map(o => String(o.SKU).toLowerCase()));
        matchedProducts = inventoryList.filter(p => p.SKU && matchedSkus.has(String(p.SKU).toLowerCase()));
        matchedReturns = returnsList.filter(r => r['Salesman Name'] && String(r['Salesman Name']).toLowerCase().includes(q));
      }
    }

    const currentStock = matchedProducts.reduce((sum, p) => sum + (Number(p['Current Stock']) || 0), 0);
    const stockValuation = matchedProducts.reduce((sum, p) => sum + ((Number(p['Current Stock']) || 0) * (Number(p.Price) || 0)), 0);
    const unitsSold = matchedOrders.reduce((sum, o) => sum + (Number(o.Quantity) || 0), 0);
    const orderCount = matchedOrders.length;
    const returnCount = matchedReturns.length;
    const returnRate = orderCount > 0 ? ((returnCount / orderCount) * 100).toFixed(1) : '0.0';

    const totalRevenue = matchedOrders.reduce((sum, o) => {
      const qty = Number(o.Quantity || 0);
      const skuKey = o.SKU ? String(o.SKU).trim().toLowerCase() : '';
      const price = Number(o.Price || skuMap[skuKey]?.price || 0);
      return sum + (qty * price);
    }, 0);

    return {
      currentStock,
      stockValuation,
      unitsSold,
      orderCount,
      totalRevenue,
      returnRate,
      matchedCount: q ? (explorerType === 'Product' || explorerType === 'Category' ? matchedProducts.length : matchedOrders.length) : (explorerType === 'Product' || explorerType === 'Category' ? inventoryList.length : ordersList.length),
      matchedOrders,
      matchedProducts,
      matchedReturns
    };
  }, [searchQuery, explorerType, inventoryList, ordersList, returnsList, suppliersList, skuMap]);

  // Velocity chart for selected entity
  const explorerVelocityData = useMemo(() => {
    const orders = explorerMetrics.matchedOrders || [];
    if (orders.length === 0) {
      const products = explorerMetrics.matchedProducts || [];
      if (products.length === 0) {
        return [
          { name: 'Day 1', value: 0 },
          { name: 'Day 2', value: 0 },
          { name: 'Day 3', value: 0 },
          { name: 'Day 4', value: 0 },
          { name: 'Day 5', value: 0 }
        ];
      }
      return products.slice(0, 10).map(p => ({
        name: String(p['Item Name'] || p.SKU || 'Item').slice(0, 14),
        value: Number(p['Current Stock']) || 0
      }));
    }

    const byDate: Record<string, number> = {};
    orders.forEach(o => {
      const rawDate = o.Timestamp || o.date || o.created_at || '';
      let dateStr = 'Historical';
      if (rawDate) {
        const s = String(rawDate).split('.')[0].replace('T', ' ');
        dateStr = s.split(' ')[0];
      }
      const qty = Number(o.Quantity || o.qty || 1);
      byDate[dateStr] = (byDate[dateStr] || 0) + qty;
    });

    const sortedDates = Object.keys(byDate).sort();
    if (sortedDates.length === 0) return [{ name: 'No Activity', value: 0 }];

    return sortedDates.slice(-14).map(d => ({
      name: d.length > 5 ? d.slice(5) : d,
      value: byDate[d]
    }));
  }, [explorerMetrics]);

  // Historical distribution chart for selected entity
  const explorerDistributionData = useMemo(() => {
    const orders = explorerMetrics.matchedOrders || [];
    const products = explorerMetrics.matchedProducts || [];

    const groupMap: Record<string, number> = {};

    if (explorerType === 'Customer' || explorerType === 'Salesman') {
      orders.forEach(o => {
        const skuKey = o.SKU ? String(o.SKU).trim().toLowerCase() : '';
        const meta = skuMap[skuKey];
        const label = meta?.name || o['Item Name'] || o.SKU || 'Item';
        groupMap[label] = (groupMap[label] || 0) + (Number(o.Quantity) || 1);
      });
    } else if (explorerType === 'Product' || explorerType === 'Category') {
      orders.forEach(o => {
        const shop = o['Shop Name'] || o['Customer Name'] || o['Salesman Name'] || 'Direct Customer';
        groupMap[shop] = (groupMap[shop] || 0) + (Number(o.Quantity) || 1);
      });
      if (Object.keys(groupMap).length === 0) {
        products.forEach(p => {
          const name = p['Item Name'] || p.SKU || 'Item';
          groupMap[name] = (groupMap[name] || 0) + (Number(p['Current Stock']) || 1);
        });
      }
    } else {
      orders.forEach(o => {
        const skuKey = o.SKU ? String(o.SKU).trim().toLowerCase() : '';
        const meta = skuMap[skuKey];
        const cat = meta?.category || meta?.name || 'General';
        groupMap[cat] = (groupMap[cat] || 0) + (Number(o.Quantity) || 1);
      });
      if (Object.keys(groupMap).length === 0) {
        products.forEach(p => {
          const cat = p.Category || 'General';
          groupMap[cat] = (groupMap[cat] || 0) + (Number(p['Current Stock']) || 1);
        });
      }
    }

    const entries = Object.entries(groupMap).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return [{ name: 'No Data', value: 0 }];

    return entries.slice(0, 8).map(([name, value]) => ({
      name: name.length > 16 ? name.slice(0, 16) + '…' : name,
      value
    }));
  }, [explorerMetrics, explorerType, skuMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading 360° Business Entity Explorer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner - explicit z-40 and overflow-visible to ensure dropdown menu floats over lower panels */}
      <div className="relative z-40 overflow-visible bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-lg mb-1">
          <Search size={22} className="text-indigo-600 dark:text-indigo-400" />
          <span>360° Business Entity Explorer</span>
        </div>
        <p className="text-xs md:text-sm text-slate-400">
          Cross-examine any Product SKU, Category, Customer Account, Supplier, or Sales Representative with instant contextual metrics, historical velocity, and AI diagnostics.
        </p>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 relative z-40 overflow-visible">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Dimension</label>
            <select
              className="w-full bg-slate-900/80 border border-slate-700 hover:border-slate-600 focus:border-indigo-600 dark:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none transition-colors"
              value={explorerType}
              onChange={e => {
                setExplorerType(e.target.value as any);
                setSearchQuery('');
              }}
            >
              <option value="Product">Product / SKU ({availableEntities.length > 0 && explorerType === 'Product' ? availableEntities.length : '4,000+'})</option>
              <option value="Category">Category & Brand Lines</option>
              <option value="Customer">Customer Accounts (804 Partners)</option>
              <option value="Supplier">Supplier Vendors (211)</option>
              <option value="Salesman">Sales Representative Team</option>
              <option value="Location">Regional Warehouse Depots</option>
            </select>
          </div>

          <SearchableEntitySelect
            label={`Select / Search ${explorerType}`}
            value={searchQuery}
            options={availableEntities}
            placeholder={`Click to choose or type ${explorerType}...`}
            onChange={val => setSearchQuery(val)}
          />
        </div>
      </div>

      {/* Dynamic Profile Card - z-10 to stay safely below dropdown */}
      <div className="relative z-10 bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-indigo-600 dark:text-indigo-400">Profile:</span>
              <span>{searchQuery || `All ${explorerType}s (${explorerMetrics.matchedCount} records)`}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live commercial velocity, order volume, warehouse stock balance, and defect metrics.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-cyan-800/40 text-xs font-mono text-indigo-700 dark:text-indigo-300 self-start sm:self-auto">
            {explorerType} Spotlight
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {explorerType === 'Salesman' || explorerType === 'Customer' ? 'Orders Fulfilled' : 'Warehouse Stock'}
            </div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {explorerType === 'Salesman' || explorerType === 'Customer'
                ? `${explorerMetrics.orderCount.toLocaleString('en-IN')} orders`
                : `${explorerMetrics.currentStock.toLocaleString('en-IN')} units`}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {explorerType === 'Salesman' || explorerType === 'Customer' ? 'Sales Revenue' : 'Asset Valuation'}
            </div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              ₹{(explorerType === 'Salesman' || explorerType === 'Customer' ? explorerMetrics.totalRevenue : explorerMetrics.stockValuation).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Units Sold</div>
            <div className="text-2xl font-black text-purple-400">
              {explorerMetrics.unitsSold.toLocaleString('en-IN')} units
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Return Defect Rate</div>
            <div className="text-2xl font-black text-amber-400">
              {explorerMetrics.returnRate}%
            </div>
          </div>
        </div>
      </div>

      {/* AI Entity Diagnostic Panel */}
      <ExplorerAIInsights
        explorerType={explorerType}
        searchQuery={searchQuery}
        explorerMetrics={explorerMetrics}
        inventoryList={inventoryList}
        ordersList={ordersList}
        suppliersList={suppliersList}
        returnsList={returnsList}
        inwardsList={inwardsList}
      />

      {/* Hero Entity Velocity Chart */}
      <div className="w-full">
        <InteractiveChart
          title={`Daily Velocity & Demand Progression (${searchQuery || explorerType})`}
          subtitle="Timeline showing daily demand volume and activity progression for selected entity"
          data={explorerVelocityData}
          defaultChartType="area"
          unit="units"
        />
      </div>

      {/* 4 Supporting Multi-dimensional Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <InteractiveChart
          title={`Historical Distribution (${searchQuery || explorerType})`}
          subtitle="Category and product volume breakdown for selected entity"
          data={explorerDistributionData}
          defaultChartType="pie"
          unit="units"
        />

        <InteractiveChart
          title={`Order Trajectory Volume (${searchQuery || explorerType})`}
          subtitle="Activity velocity over recent cycles"
          data={explorerVelocityData}
          defaultChartType="bar"
          unit="units"
        />

        <InteractiveChart
          title={`Category Share Allocation (${searchQuery || explorerType})`}
          subtitle="Product mix and relative volume share"
          data={explorerDistributionData}
          defaultChartType="donut"
          unit="units"
        />

        <InteractiveChart
          title={`Entity Quality & Defect Profile (${searchQuery || explorerType})`}
          subtitle="Defect tracking distribution"
          data={explorerDistributionData}
          defaultChartType="line"
          unit="units"
        />
      </div>
    </div>
  );
}
