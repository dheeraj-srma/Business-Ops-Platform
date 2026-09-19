'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Inbox,
  Building2,
  RotateCcw,
  SlidersHorizontal,
  Receipt,
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Bell,
  ArrowRight,
  Sparkles
} from 'lucide-react';

import { useLoading } from './LoadingContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const NAV_ITEMS = [
  { href: '/',            label: 'Overview',     icon: LayoutDashboard },
  { href: '/sales',       label: 'Sales',        icon: ShoppingCart },
  { href: '/inventory',   label: 'Inventory',    icon: Package },
  { href: '/orders',      label: 'Orders',       icon: ShoppingCart },
  { href: '/inwards',     label: 'Inwards',      icon: Inbox },
  { href: '/suppliers',   label: 'Suppliers',    icon: Building2 },
  { href: '/returns',     label: 'Returns',      icon: RotateCcw },
  { href: '/adjustments', label: 'Adjustments',  icon: SlidersHorizontal },
  { href: '/transactions',label: 'Transactions', icon: Receipt },
  { href: '/analytics',   label: 'Analytics',    icon: BarChart3 },
  { href: '/reports',     label: 'Reports',      icon: FileSpreadsheet },
  { href: '/admin',       label: 'Settings',     icon: ShieldCheck },
];

interface PendingOrder {
  'Order ID': string;
  'Salesman Name'?: string;
  'Shop Name'?: string;
  Timestamp?: string;
  Quantity?: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { triggerLoading } = useLoading();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [alertsOpen, setAlertsOpen]   = useState(false);
  const [adminOpen, setAdminOpen]     = useState(false);
  
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const alertRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);

  // Sync collapsed state with localStorage & CSS class on document element
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
      document.documentElement.classList.add('sidebar-collapsed');
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const nextState = !prev;
      localStorage.setItem('sidebar_collapsed', String(nextState));
      if (nextState) {
        document.documentElement.classList.add('sidebar-collapsed');
      } else {
        document.documentElement.classList.remove('sidebar-collapsed');
      }
      return nextState;
    });
  };

  // Fetch pending orders for alerts button at bottom of sidebar
  useEffect(() => {
    setLoadingAlerts(true);
    fetch(`${API}/api/orders/pending`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPendingOrders(Array.isArray(data) ? data : []))
      .catch(() => setPendingOrders([]))
      .finally(() => setLoadingAlerts(false));
  }, [pathname]);

  // Close popovers and mobile sidebar on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
      // Mobile sidebar close on click outside
      const sidebarEl = document.querySelector('.sidebar');
      const toggleEl = document.querySelector('.mobile-menu-toggle');
      if (
        document.documentElement.classList.contains('mobile-sidebar-open') &&
        sidebarEl && !sidebarEl.contains(e.target as Node) &&
        toggleEl && !toggleEl.contains(e.target as Node)
      ) {
        document.documentElement.classList.remove('mobile-sidebar-open');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    document.documentElement.classList.remove('mobile-sidebar-open');
  }, [pathname]);

  // Group pending orders
  const grouped: Record<string, PendingOrder[]> = {};
  for (const row of pendingOrders) {
    const id = row['Order ID'] ?? 'Unknown';
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(row);
  }
  const pendingCount = Object.keys(grouped).length;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} style={{ overflow: 'visible' }}>
      
      {/* Top Header: Brand Logo & Contract/Expand Button */}
      <div className="sidebar-top-header">
        {!isCollapsed ? (
          <>
            <div className="brand-wrap">
              <div className="brand-icon">
                <ShieldCheck size={19} />
              </div>
              <div className="brand-text">
                <span className="brand-name">Nalka <span style={{ color: '#3b82f6' }}>Metals</span></span>
                <span className="brand-sub">BI Dashboard</span>
              </div>
            </div>

            <button
              onClick={toggleSidebar}
              className="sidebar-toggle-btn"
              title="Contract Sidebar (<)"
            >
              <ChevronLeft size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={toggleSidebar}
            className="sidebar-toggle-btn collapsed-toggle"
            title="Expand Sidebar (>)"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {/* Nav Items List */}
      <nav className="sidebar-nav">
        {!isCollapsed && <p className="nav-section-title">Navigation</p>}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (pathname !== item.href) {
                  triggerLoading(`Loading ${item.label}...`);
                }
              }}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="nav-icon-box">
                <Icon size={19} />
              </div>
              {!isCollapsed && <span className="nav-label">{item.label}</span>}
              {isActive && !isCollapsed && <div className="active-dot" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section: Alerts & Admin Profile Buttons */}
      <div className="sidebar-bottom-section" style={{ position: 'relative' }}>
        
        {/* Alerts Button & Popover */}
        <div style={{ position: 'relative', width: '100%' }} ref={alertRef}>
          <button
            onClick={() => { setAlertsOpen(o => !o); setAdminOpen(false); }}
            className={`sidebar-bottom-btn ${alertsOpen ? 'active' : ''}`}
            title={isCollapsed ? `Alerts (${pendingCount})` : undefined}
          >
            <div className="bottom-icon-wrap" style={{ position: 'relative' }}>
              <Bell size={18} className={pendingCount > 0 ? 'text-warning-cl' : ''} />
              {pendingCount > 0 && (
                <span className="alert-badge-dot">{pendingCount}</span>
              )}
            </div>

            {!isCollapsed && (
              <div className="bottom-btn-text">
                <span className="bottom-btn-title">Alerts</span>
                <span className="bottom-btn-sub">{pendingCount > 0 ? `${pendingCount} pending order(s)` : 'All systems normal'}</span>
              </div>
            )}

            {!isCollapsed && pendingCount > 0 && (
              <span className="count-pill">{pendingCount}</span>
            )}
          </button>

          {/* Alerts Popover Panel */}
          {alertsOpen && (
            <div
              className="fade-in"
              style={{
                position: 'absolute',
                bottom: isCollapsed ? '0' : 'calc(100% + 8px)',
                left: isCollapsed ? 'calc(100% + 12px)' : '0',
                width: isCollapsed ? '320px' : '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '0.9rem',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
                zIndex: 9999,
                color: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid #334155', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} className="text-warning-cl" />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Pending Order Alerts</span>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>{pendingCount} Pending</span>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {loadingAlerts ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>
                    Loading notifications…
                  </p>
                ) : pendingCount === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                    <Sparkles size={24} style={{ margin: '0 auto 8px', color: '#10b981' }} />
                    <p style={{ fontSize: '0.88rem' }}>No pending orders requiring approval</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([orderId, rows]) => {
                    const first = rows[0];
                    const totalQty = rows.reduce((s, r) => s + (Number(r.Quantity) || 0), 0);
                    return (
                      <div className="popover-item-card" key={orderId} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '0.82rem' }}>{orderId}</span>
                          <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>Needs Review</span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div><strong>Seller:</strong> {first['Salesman Name'] ?? '—'}</div>
                          <div><strong>Shop:</strong> {first['Shop Name'] ?? '—'}</div>
                          <div><strong>Items:</strong> {totalQty} unit(s)</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
                onClick={() => { setAlertsOpen(false); router.push('/orders'); }}
              >
                <span>Manage Pending Orders</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Admin Profile Button & Popover */}
        <div style={{ position: 'relative', width: '100%', marginTop: '2px' }} ref={adminRef}>
          <button
            onClick={() => { setAdminOpen(o => !o); setAlertsOpen(false); }}
            className={`sidebar-bottom-btn admin-btn ${adminOpen ? 'active' : ''}`}
            title={isCollapsed ? "Admin Center Profile" : undefined}
          >
            <div className="admin-avatar">
              <span>AD</span>
            </div>

            {!isCollapsed && (
              <div className="bottom-btn-text">
                <span className="bottom-btn-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Admin User
                  <span className="status-indicator-dot" />
                </span>
                <span className="bottom-btn-sub">Super Administrator</span>
              </div>
            )}
          </button>

          {/* Admin Popover Panel */}
          {adminOpen && (
            <div
              className="fade-in"
              style={{
                position: 'absolute',
                bottom: isCollapsed ? '0' : 'calc(100% + 8px)',
                left: isCollapsed ? 'calc(100% + 12px)' : '0',
                width: isCollapsed ? '280px' : '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '0.9rem',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
                zIndex: 9999,
                color: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '0.6rem', borderBottom: '1px solid #334155', marginBottom: '0.6rem' }}>
                <div className="admin-avatar" style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}>
                  <span>AD</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>System Administrator</div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981' }}>● Logged In & Active</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                  onClick={() => { setAdminOpen(false); router.push('/analytics'); }}
                >
                  <BarChart3 size={15} />
                  <span>Analytics Overview</span>
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                  onClick={() => { setAdminOpen(false); router.push('/reports'); }}
                >
                  <FileSpreadsheet size={15} />
                  <span>Enterprise Reports</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </aside>
  );
}
