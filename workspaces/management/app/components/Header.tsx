'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Inbox,
  RotateCcw,
  Building2,
  SlidersHorizontal,
  Receipt,
  BarChart3,
  FileSpreadsheet,
  Search,
  ArrowLeft,
  ShieldCheck,
  LucideIcon
} from 'lucide-react';
import { useLoading } from './LoadingContext';

const MODULE_TITLES: Record<string, { title: string; icon: LucideIcon }> = {
  '/':             { title: 'Overview',     icon: LayoutDashboard },
  '/sales':        { title: 'Sales',        icon: ShoppingCart },
  '/inventory':    { title: 'Inventory',    icon: Package },
  '/orders':       { title: 'Orders',       icon: ShoppingCart },
  '/inwards':      { title: 'Inwards',      icon: Inbox },
  '/returns':      { title: 'Returns',      icon: RotateCcw },
  '/suppliers':    { title: 'Suppliers',    icon: Building2 },
  '/adjustments':  { title: 'Adjustments',  icon: SlidersHorizontal },
  '/transactions': { title: 'Transactions', icon: Receipt },
  '/analytics':    { title: 'Analytics',    icon: BarChart3 },
  '/reports':      { title: 'Reports',      icon: FileSpreadsheet },
  '/admin':        { title: 'Settings',     icon: ShieldCheck },
};

export default function Header() {
  const pathname = usePathname();
  const router   = useRouter();
  const { triggerLoading } = useLoading();
  const [search, setSearch] = useState('');

  const moduleInfo = MODULE_TITLES[pathname] ?? {
    title: pathname.replace('/', '').replace('-', ' ') || 'Overview',
    icon: LayoutDashboard
  };
  const ModuleIcon = moduleInfo.icon;

  /* Global search keyboard & click routing */
  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = search.trim();
    if (!q) return;

    triggerLoading(`Executing Search for "${q}"...`);
    const upper = q.toUpperCase();
    
    // Intelligent contextual routing
    if (upper.startsWith('ORD')) {
      router.push(`/orders?q=${encodeURIComponent(q)}`);
    } else if (upper.startsWith('SUP') || upper.startsWith('VEND')) {
      router.push(`/suppliers?q=${encodeURIComponent(q)}`);
    } else if (upper.startsWith('INW') || upper.startsWith('REC')) {
      router.push(`/inwards?q=${encodeURIComponent(q)}`);
    } else if (upper.startsWith('RET')) {
      router.push(`/returns?q=${encodeURIComponent(q)}`);
    } else if (upper.startsWith('ADJ')) {
      router.push(`/adjustments?q=${encodeURIComponent(q)}`);
    } else if (upper.startsWith('TXN')) {
      router.push(`/transactions?q=${encodeURIComponent(q)}`);
    } else if (pathname === '/orders') {
      router.push(`/orders?q=${encodeURIComponent(q)}`);
    } else if (pathname === '/suppliers') {
      router.push(`/suppliers?q=${encodeURIComponent(q)}`);
    } else if (pathname === '/inwards') {
      router.push(`/inwards?q=${encodeURIComponent(q)}`);
    } else if (pathname === '/returns') {
      router.push(`/returns?q=${encodeURIComponent(q)}`);
    } else if (pathname === '/adjustments') {
      router.push(`/adjustments?q=${encodeURIComponent(q)}`);
    } else if (pathname === '/transactions') {
      router.push(`/transactions?q=${encodeURIComponent(q)}`);
    } else if (pathname === '/analytics') {
      router.push(`/analytics?tab=explorer&q=${encodeURIComponent(q)}`);
    } else {
      router.push(`/inventory?q=${encodeURIComponent(q)}`);
    }
    setSearch('');
  }

  function handleIconSearch() {
    if (!search.trim()) return;
    handleSearch({ key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>);
  }

  return (
    <header className="topbar">
      {/* Left – module title & icon */}
      <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Mobile Hamburger menu */}
        <button
          onClick={() => document.documentElement.classList.toggle('mobile-sidebar-open')}
          className="mobile-menu-toggle"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            cursor: 'pointer',
            padding: '4px',
            marginRight: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            display: 'none'
          }}
          title="Toggle Navigation Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="12" x2="20" y2="12"></line>
            <line x1="4" y1="6" x2="20" y2="6"></line>
            <line x1="4" y1="18" x2="20" y2="18"></line>
          </svg>
        </button>

        {pathname !== '/' && (
          <button
            onClick={() => {
              triggerLoading('Navigating back...');
              router.back();
            }}
            style={{
              background: 'rgba(51, 65, 85, 0.35)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(51, 65, 85, 0.35)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        <div className="module-title">
          <div className="module-icon-wrap">
            <ModuleIcon size={19} />
          </div>
          <h2>{moduleInfo.title}</h2>
        </div>
      </div>

      {/* Right – search input (old Alerts & Admin buttons removed since they live in the sidebar) */}
      <div className="topbar-right">
        <div className="search-wrap">
          <Search size={15} onClick={handleIconSearch} style={{ cursor: 'pointer' }} />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search SKU, Order ID, Supplier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>
    </header>
  );
}
