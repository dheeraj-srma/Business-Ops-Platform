'use client';
import { useState } from 'react';
import { useDialog } from '../context/DialogContext';
import {
  Download,
  FileSpreadsheet,
  Receipt,
  Package,
  ShoppingCart,
  Building2,
  ArrowDownToLine,
  RotateCcw,
  SlidersHorizontal,
  LucideIcon
} from 'lucide-react';

interface ReportItem {
  icon: LucideIcon;
  title: string;
  desc: string;
  endpoint: string;
  badge: string;
}

const REPORTS: ReportItem[] = [
  { icon: Package,           title: 'Inventory Report', desc: 'Complete SKU list with stock levels and valuation.', endpoint: '/api/inventory',    badge: 'JSON' },
  { icon: ShoppingCart,      title: 'Sales Orders Export', desc: 'All submitted orders with order status and salesman names.',  endpoint: '/api/orders',       badge: 'JSON' },
  { icon: Building2,         title: 'Suppliers Export', desc: 'Supplier list, contact info, and categories.', endpoint: '/api/suppliers',    badge: 'JSON' },
  { icon: ArrowDownToLine,   title: 'Inwards Log', desc: 'Log of stock received into warehouse.', endpoint: '/api/inwards',      badge: 'JSON' },
  { icon: RotateCcw,         title: 'Returns Log', desc: 'Customer returns log with condition and reasons.', endpoint: '/api/returns',      badge: 'JSON' },
  { icon: SlidersHorizontal, title: 'Stock Adjustments', desc: 'Manual stock adjustments and inventory corrections.', endpoint: '/api/adjustments',  badge: 'JSON' },
  { icon: Receipt,           title: 'Transactions Export', desc: 'Complete history of all inventory stock movements.', endpoint: '/api/transactions', badge: 'JSON' },
];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const { showError } = useDialog();

  async function handleDownload(endpoint: string, title: string) {
    setDownloading(endpoint);
    try {
      const res = await fetch(`${API}${endpoint}`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showError('Failed to generate export file.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Download data exports for inventory, sales, suppliers, and transactions.</p>
        </div>
      </div>

      {/* Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {REPORTS.map((rep, idx) => {
          const Icon = rep.icon;
          const isDownloading = downloading === rep.endpoint;

          return (
            <div key={idx} className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div className="kpi-icon-wrap" style={{ width: '42px', height: '42px' }}>
                    <Icon size={22} />
                  </div>
                  <span className="badge badge-info">{rep.badge}</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                  {rep.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55 }}>
                  {rep.desc}
                </p>
              </div>

              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={isDownloading}
                  onClick={() => handleDownload(rep.endpoint, rep.title)}
                >
                  <Download size={16} className={isDownloading ? 'spin' : ''} />
                  <span>{isDownloading ? 'Exporting…' : 'Download JSON'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
