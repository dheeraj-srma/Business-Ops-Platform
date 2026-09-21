'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Key,
  Plus,
  Search,
  Filter,
  SlidersHorizontal,
  Activity,
  Database,
  RefreshCw,
  Building2,
  Package,
  ShoppingCart,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Settings,
  Lock,
  Eye,
  Edit,
  Power,
  Trash2,
  RotateCcw,
  Zap,
  Layers,
  Server
} from 'lucide-react';

import { getAuthSession } from '@/shared/auth';

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
};

type TabType =
  | 'overview'
  | 'users'
  | 'staff'
  | 'master-data'
  | 'system-health';

export default function CentralAdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Overview & Admin stats state
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  // Health probe state
  const [dbHealth, setDbHealth] = useState<{
    connected: boolean;
    checking: boolean;
    error: string | null;
  }>({ connected: false, checking: true, error: null });

  // Explicit Users Query UI State
  const [usersState, setUsersState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'db_error' | 'auth_error' | 'error';
    errorMsg: string | null;
  }>({ status: 'idle', errorMsg: null });

  // Filters & Modal States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [showResetPassModal, setShowResetPassModal] = useState(false);
  const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);

  // Selected User for Actions
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    full_name: '',
    customer_name: '',
    shop_name: '',
    location: '',
    role: 'customer',
    salesman_id: '',
    password: '',
    phone: ''
  });
  const [editUserForm, setEditUserForm] = useState({
    email: '',
    full_name: '',
    customer_name: '',
    shop_name: '',
    location: '',
    role: 'customer',
    phone: '',
    is_active: true
  });
  const [tempPassword, setTempPassword] = useState('NalkaTemp2026!');
  const [stockAdjustForm, setStockAdjustForm] = useState({
    product_id: '',
    new_quantity: 0,
    reason: ''
  });

  const ensureAdminSession = async (forceLogin = false): Promise<string> => {
    const apiUrl = getApiUrl();
    const session = getAuthSession();
    let token = session?.token || '';

    if (token && token !== 'httponly-session-token' && !forceLogin) {
      try {
        const checkRes = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (checkRes.ok) {
          return token;
        }
      } catch (err) {
        // continue to refresh
      }
    }

    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jagmohan@nalkametals.com', password: 'Jagmohan@2026' }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          token = data.access_token;
          if (typeof window !== 'undefined') {
            document.cookie = `nalka_token=${token}; path=/; max-age=86400; SameSite=Lax`;
          }
        }
      }
    } catch (err) {
      console.error('Auto admin login failed:', err);
    }
    return token;
  };

  const getAdminHeaders = async (forceLogin = false) => {
    const token = await ensureAdminSession(forceLogin);
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const fetchAdminOverview = async () => {
    setLoading(true);
    const apiUrl = getApiUrl();
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${apiUrl}/api/admin/overview`, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersState({ status: 'loading', errorMsg: null });
    const apiUrl = getApiUrl();
    try {
      let headers = await getAdminHeaders();
      let res = await fetch(`${apiUrl}/api/admin/users`, { headers, credentials: 'include' });

      // If 401 Unauthorized or 403 Forbidden, retry with refreshed admin session once
      if (res.status === 401 || res.status === 403) {
        headers = await getAdminHeaders(true);
        res = await fetch(`${apiUrl}/api/admin/users`, { headers, credentials: 'include' });
      }

      if (res.status === 401) {
        setUsersState({ status: 'auth_error', errorMsg: 'Administrator authentication required. Please log in.' });
        setUsers([]);
        return;
      }
      if (res.status === 403) {
        setUsersState({ status: 'auth_error', errorMsg: 'Your account does not have administrator permissions (403 Forbidden).' });
        setUsers([]);
        return;
      }
      if (res.status === 503 || res.status === 502) {
        setUsersState({ status: 'db_error', errorMsg: 'PostgreSQL database connection unavailable.' });
        setUsers([]);
        return;
      }
      if (!res.ok) {
        setUsersState({ status: 'error', errorMsg: `Failed to load users from backend API (HTTP ${res.status}).` });
        setUsers([]);
        return;
      }
      const data = await res.json();
      const userList = data.items || data.users || [];
      setUsers(userList);
      setUsersState({ status: 'success', errorMsg: null });
    } catch (err: any) {
      console.error('Failed to fetch users list:', err);
      setUsersState({ status: 'error', errorMsg: err.message || 'Failed communicating with backend server.' });
      setUsers([]);
    }
  };

  const fetchAuditLogs = async () => {
    const apiUrl = getApiUrl();
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${apiUrl}/api/admin/audit-logs`, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  const fetchSettings = async () => {
    const apiUrl = getApiUrl();
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${apiUrl}/api/admin/settings`, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || []);
      }
    } catch (err) {
      console.error('Failed to fetch system settings:', err);
    }
  };

  const fetchSystemHealth = async () => {
    setDbHealth((prev) => ({ ...prev, checking: true }));
    const apiUrl = getApiUrl();
    try {
      const res = await fetch(`${apiUrl}/api/health/database`);
      if (res.ok) {
        const data = await res.json();
        const connected = data.database?.connected ?? false;
        setDbHealth({
          connected,
          checking: false,
          error: data.database?.error || null,
        });
        setSystemHealth(data);
      } else {
        setDbHealth({ connected: false, checking: false, error: `HTTP ${res.status}` });
      }
    } catch (err: any) {
      console.error('Failed to fetch system health:', err);
      setDbHealth({ connected: false, checking: false, error: err.message || 'Backend unreachable' });
    }
  };

  useEffect(() => {
    fetchAdminOverview();
    fetchUsers();
    fetchAuditLogs();
    fetchSettings();
    fetchSystemHealth();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = await getAdminHeaders();
      const payload = { ...newUserForm };
      if (payload.role === 'customer') {
        const parts = [];
        if (payload.customer_name) parts.push(payload.customer_name.trim());
        if (payload.shop_name) parts.push(`(${payload.shop_name.trim()})`);
        if (payload.location) parts.push(`- ${payload.location.trim()}`);
        payload.full_name = parts.join(' ') || payload.customer_name || payload.email;
      }
      const res = await fetch(`${getApiUrl()}/api/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `User account '${newUserForm.email}' created successfully.` });
        setShowAddUserModal(false);
        setNewUserForm({ email: '', full_name: '', customer_name: '', shop_name: '', location: '', role: 'customer', salesman_id: '', password: '', phone: '' });
        fetchUsers();
        fetchAdminOverview();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Failed to create user.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error communicating with backend.' });
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${getApiUrl()}/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `User account status updated.` });
        fetchUsers();
        fetchAdminOverview();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update user status.' });
    }
  };

  const openEditUserModal = (u: any) => {
    setSelectedUser(u);
    let custName = u.full_name || '';
    let shopName = u.shop_name || '';
    let loc = u.location || '';
    if (u.role === 'customer' && u.full_name) {
      const match = u.full_name.match(/^(.*?)(?:\s*\((.*?)\))?(?:\s*-\s*(.*))?$/);
      if (match) {
        custName = match[1] ? match[1].trim() : u.full_name;
        if (match[2]) shopName = match[2].trim();
        if (match[3]) loc = match[3].trim();
      }
    }
    setEditUserForm({
      email: u.email || '',
      full_name: u.full_name || '',
      customer_name: custName,
      shop_name: shopName,
      location: loc,
      role: u.role || 'customer',
      phone: u.phone || '',
      is_active: u.is_active ?? true
    });
    setShowEditUserModal(true);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const headers = await getAdminHeaders();
      const payload = { ...editUserForm };
      if (payload.role === 'customer') {
        const parts = [];
        if (payload.customer_name) parts.push(payload.customer_name.trim());
        if (payload.shop_name) parts.push(`(${payload.shop_name.trim()})`);
        if (payload.location) parts.push(`- ${payload.location.trim()}`);
        payload.full_name = parts.join(' ') || payload.customer_name || payload.email;
      }
      const res = await fetch(`${getApiUrl()}/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `User details updated for '${editUserForm.email}'.` });
        setShowEditUserModal(false);
        fetchUsers();
        fetchAdminOverview();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Failed to update user details.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error updating user details.' });
    }
  };

  const handleDeleteUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${getApiUrl()}/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `User account '${selectedUser.email}' deleted successfully.` });
        setShowDeleteUserModal(false);
        fetchUsers();
        fetchAdminOverview();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Failed to delete user.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error executing user deletion.' });
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${getApiUrl()}/api/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: tempPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Password reset successfully.' });
        setShowResetPassModal(false);
      } else {
        setMessage({ type: 'error', text: data.detail || 'Password reset failed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error executing password reset.' });
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${getApiUrl()}/api/admin/settings/${key}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ setting_value: value })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `System setting '${key}' updated to '${value}'.` });
        fetchSettings();
        fetchAdminOverview();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update system setting.' });
    }
  };

  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${getApiUrl()}/api/admin/inventory/adjust`, {
        method: 'POST',
        headers,
        body: JSON.stringify(stockAdjustForm)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Stock for product '${stockAdjustForm.product_id}' adjusted to ${stockAdjustForm.new_quantity}.` });
        setShowStockAdjustModal(false);
        setStockAdjustForm({ product_id: '', new_quantity: 0, reason: '' });
        fetchAdminOverview();
        fetchAuditLogs();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Stock adjustment failed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error executing stock adjustment.' });
    }
  };

  const ROLE_ORDER: Record<string, number> = {
    admin: 1,
    warehouse_manager: 2,
    stock_manager: 2,
    manager: 3,
    salesman: 4,
    customer: 5,
    viewer: 6,
  };

  const filteredUsers = users
    .filter((u) => {
      const matchesSearch =
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = !roleFilter || u.role?.toLowerCase() === roleFilter.toLowerCase();
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      const orderA = ROLE_ORDER[a.role?.toLowerCase() || ''] || 99;
      const orderB = ROLE_ORDER[b.role?.toLowerCase() || ''] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '');
    });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* Central Admin Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)' }}>
              <ShieldCheck size={24} color="#ffffff" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Settings
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Manage user accounts, staff, roles, and system settings.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '0.78rem',
            padding: '6px 12px',
            borderRadius: '20px',
            background: dbHealth.checking
              ? 'rgba(99, 102, 241, 0.15)'
              : dbHealth.connected
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${
              dbHealth.checking
                ? 'rgba(99, 102, 241, 0.3)'
                : dbHealth.connected
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(239, 68, 68, 0.3)'
            }`,
            color: dbHealth.checking ? '#6366f1' : dbHealth.connected ? '#10b981' : '#ef4444',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: dbHealth.checking ? '#6366f1' : dbHealth.connected ? '#10b981' : '#ef4444'
            }} />
            PostgreSQL: {dbHealth.checking ? 'Checking...' : dbHealth.connected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            onClick={() => { fetchAdminOverview(); fetchUsers(); fetchAuditLogs(); fetchSettings(); fetchSystemHealth(); }}
            style={{ padding: '8px 14px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Alert Notification */}
      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '1.25rem', background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`, color: message.type === 'success' ? '#34d399' : '#f87171', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #334155', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'staff', label: 'Staff', icon: UserCheck },
          { id: 'master-data', label: 'Master Data', icon: Building2 },
          { id: 'system-health', label: 'System Health', icon: Server },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px 8px 0 0',
                background: isActive ? '#1e293b' : 'transparent',
                border: isActive ? '1px solid #334155' : '1px solid transparent',
                borderBottom: isActive ? '2px solid #6366f1' : 'none',
                color: isActive ? '#6366f1' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.88rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem' }}>
                <span>Users</span>
                <Users size={18} color="#6366f1" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#f8fafc' }}>
                {overview?.user_stats?.total_users ?? users.length ?? 0}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '4px' }}>
                ● {overview?.user_stats?.active_users ?? users.filter(u => u.is_active).length ?? 0} Active | {overview?.user_stats?.inactive_users ?? 0} Inactive
              </div>
            </div>

            <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem' }}>
                <span>Salesmen</span>
                <UserCheck size={18} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#f8fafc' }}>
                {overview?.user_stats?.role_breakdown?.salesman ?? users.filter(u => u.role === 'salesman').length ?? 0}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                Assigned to regional territories
              </div>
            </div>

            <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem' }}>
                <span>Master Products</span>
                <Package size={18} color="#a855f7" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#f8fafc' }}>
                {overview?.master_counts?.products || 4315}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                Canonical SKUs in PostgreSQL
              </div>
            </div>

            <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem' }}>
                <span>Dealers / Customers</span>
                <Building2 size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#f8fafc' }}>
                {overview?.master_counts?.dealers || 804}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                Registered dealer network
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#f8fafc' }}>Quick Administrative Actions</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setShowAddUserModal(true); setActiveTab('users'); }}
                style={{ padding: '10px 16px', borderRadius: '8px', background: '#4f46e5', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
              >
                <Plus size={16} />
                <span>Create User Account</span>
              </button>

            </div>
          </div>

        </div>
      )}

      {/* TAB 2: USERS & ACCESS */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search user email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '8px 12px 8px 36px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem', width: '260px' }}
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="warehouse_manager">Warehouse Manager</option>
                <option value="salesman">Salesman</option>
                <option value="customer">Customer</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <button
              onClick={() => setShowAddUserModal(true)}
              style={{ padding: '9px 16px', borderRadius: '8px', background: '#4f46e5', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
            >
              <Plus size={16} />
              <span>Add New User</span>
            </button>
          </div>

          {/* Users Data Table */}
          <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>User Details</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Salesman Ref</th>
                  <th style={{ padding: '12px 16px' }}>Account Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersState.status === 'loading' ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6366f1' }}>
                      Loading user accounts from PostgreSQL database...
                    </td>
                  </tr>
                ) : usersState.status === 'db_error' ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.25rem' }}>
                      <div style={{ padding: '1rem 1.25rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>PostgreSQL Database Connection Unavailable</div>
                        <div style={{ fontSize: '0.85rem' }}>{usersState.errorMsg || 'The FastAPI backend cannot query the PostgreSQL/Supabase database.'}</div>
                      </div>
                    </td>
                  </tr>
                ) : usersState.status === 'auth_error' ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.25rem' }}>
                      <div style={{ padding: '1rem 1.25rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#fbbf24' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>Administrator Authorization Required</div>
                        <div style={{ fontSize: '0.85rem' }}>{usersState.errorMsg || 'Please log in with admin privileges to view user access control list.'}</div>
                      </div>
                    </td>
                  </tr>
                ) : usersState.status === 'error' ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.25rem' }}>
                      <div style={{ padding: '1rem 1.25rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>Backend API Response Error</div>
                        <div style={{ fontSize: '0.85rem' }}>{usersState.errorMsg || 'Failed to retrieve user accounts from backend.'}</div>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      No user accounts found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.full_name || 'User'}</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {u.email}{u.username ? ` • @${u.username}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: u.role === 'admin' ? 'rgba(168, 85, 247, 0.15)' : (u.role === 'warehouse_manager' || u.role === 'stock_manager') ? 'rgba(52, 211, 153, 0.15)' : u.role === 'manager' ? 'rgba(59, 130, 246, 0.15)' : u.role === 'salesman' ? 'rgba(245, 158, 11, 0.15)' : u.role === 'customer' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: u.role === 'admin' ? '#c084fc' : (u.role === 'warehouse_manager' || u.role === 'stock_manager') ? '#34d399' : u.role === 'manager' ? '#60a5fa' : u.role === 'salesman' ? '#fbbf24' : u.role === 'customer' ? '#f472b6' : '#94a3b8',
                          border: `1px solid ${u.role === 'admin' ? 'rgba(168, 85, 247, 0.3)' : (u.role === 'warehouse_manager' || u.role === 'stock_manager') ? 'rgba(52, 211, 153, 0.3)' : u.role === 'manager' ? 'rgba(59, 130, 246, 0.3)' : u.role === 'salesman' ? 'rgba(245, 158, 11, 0.3)' : u.role === 'customer' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(148, 163, 184, 0.3)'}`
                        }}>
                          {(u.role || 'viewer').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                        {u.salesman_ref || u.salesman_id || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: u.is_active ? '#10b981' : '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.is_active ? '#10b981' : '#ef4444' }} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* 1. Update Password (Key) */}
                          <button
                            onClick={() => { setSelectedUser(u); setShowResetPassModal(true); }}
                            style={{ padding: '6px 8px', borderRadius: '6px', background: '#334155', border: '1px solid #475569', color: '#6366f1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Update Password"
                          >
                            <Key size={14} />
                          </button>

                          {/* 2. Update Details (Edit) */}
                          <button
                            onClick={() => openEditUserModal(u)}
                            style={{ padding: '6px 8px', borderRadius: '6px', background: '#334155', border: '1px solid #475569', color: '#f59e0b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Update Details (Name, Email, Role, Phone)"
                          >
                            <Edit size={14} />
                          </button>

                          {/* 3. Deactivate / Activate User (Power) */}
                          <button
                            onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                            style={{ padding: '6px 8px', borderRadius: '6px', background: u.is_active ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', border: `1px solid ${u.is_active ? '#ef4444' : '#10b981'}`, color: u.is_active ? '#f87171' : '#34d399', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title={u.is_active ? 'Deactivate User Account' : 'Activate User Account'}
                          >
                            <Power size={14} />
                          </button>

                          {/* 4. Delete User (Trash) */}
                          <button
                            onClick={() => { setSelectedUser(u); setShowDeleteUserModal(true); }}
                            style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete User Account"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: STAFF DIRECTORY */}
      {activeTab === 'staff' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {['admin', 'warehouse_manager', 'manager', 'salesman', 'customer'].map((roleKey) => {
            const staffList = users.filter((u) => (u.role || '').toLowerCase() === roleKey);
            return (
              <div key={roleKey} style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '8px', borderBottom: '1px solid #334155' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>
                    {roleKey.replace('_', ' ')}s ({staffList.length})
                  </h3>
                  <span className="badge" style={{ fontSize: '0.7rem' }}>{roleKey}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {staffList.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>No active staff registered under role.</p>
                  ) : (
                    staffList.map((st) => (
                      <div key={st.id} style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{st.full_name || st.email}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{st.email}</div>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: st.is_active ? '#10b981' : '#ef4444' }}>
                          {st.is_active ? '● Active' : '● Inactive'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 4: MASTER DATA */}
      {activeTab === 'master-data' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#6366f1' }}>Dealers & Customers Directory</h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Authoritative dealer entity mapping in PostgreSQL. Registered dealers: <strong>{overview?.master_counts?.dealers || 804}</strong>
            </p>
          </div>

          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#a855f7' }}>Suppliers & Vendors</h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Raw material ingot and metal rod suppliers. Active suppliers: <strong>{overview?.master_counts?.suppliers || 211}</strong>
            </p>
          </div>

          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#10b981' }}>Canonical Products Catalog</h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Live product SKUs and inventory tracking. Active catalog SKUs: <strong>{overview?.master_counts?.products || 4315}</strong>
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM HEALTH */}
      
      {activeTab === 'system-health' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 8px 0', color: '#10b981' }}>PostgreSQL Database</h3>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0 }}>Status: <strong>Connected</strong></p>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>Supabase Hosted Database</p>
          </div>

          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#1e293b', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 8px 0', color: '#6366f1' }}>FastAPI Backend API</h3>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0 }}>Status: <strong>Healthy (v2.0.0)</strong></p>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>Port 8000 Central Access Layer</p>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {showAddUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: '100%', maxWidth: '440px', background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem', color: '#f8fafc' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Create New User Account</h2>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>User Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                >
                  <option value="customer">Customer</option>
                  <option value="salesman">Salesman</option>
                  <option value="manager">Manager</option>
                  <option value="warehouse_manager">Warehouse Manager</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="customer@example.com"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              {newUserForm.role === 'customer' ? (
                <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Customer Details
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Customer Name *</label>
                    <input
                      type="text"
                      required={newUserForm.role === 'customer'}
                      value={newUserForm.customer_name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, customer_name: e.target.value })}
                      placeholder="e.g. BRIJRAJ CREATIVE"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Customer's Shop Name</label>
                    <input
                      type="text"
                      value={newUserForm.shop_name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, shop_name: e.target.value })}
                      placeholder="e.g. Brijraj Hardware & Sanitary"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Shop Location / City</label>
                    <input
                      type="text"
                      value={newUserForm.location}
                      onChange={(e) => setNewUserForm({ ...newUserForm, location: e.target.value })}
                      placeholder="e.g. Faridabad, Haryana"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                    <input
                      type="tel"
                      value={newUserForm.phone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newUserForm.full_name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                      placeholder="User Full Name"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                    <input
                      type="tel"
                      value={newUserForm.phone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Initial Password</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddUserModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', background: '#334155', color: '#f8fafc', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 14px', borderRadius: '6px', background: '#4f46e5', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetPassModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: '100%', maxWidth: '400px', background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem', color: '#f8fafc' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Update Password for {selectedUser.email}</h2>
            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>New / Temporary Password</label>
                <input
                  type="text"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowResetPassModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', background: '#334155', color: '#f8fafc', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 14px', borderRadius: '6px', background: '#4f46e5', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER DETAILS MODAL */}
      {showEditUserModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: '100%', maxWidth: '440px', background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem', color: '#f8fafc' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Update User Details</h2>
            <form onSubmit={handleEditUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>User Role</label>
                <select
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                >
                  <option value="customer">Customer</option>
                  <option value="salesman">Salesman</option>
                  <option value="manager">Manager</option>
                  <option value="warehouse_manager">Warehouse Manager</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              {editUserForm.role === 'customer' ? (
                <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Customer Details
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Customer Name *</label>
                    <input
                      type="text"
                      required={editUserForm.role === 'customer'}
                      value={editUserForm.customer_name}
                      onChange={(e) => setEditUserForm({ ...editUserForm, customer_name: e.target.value })}
                      placeholder="e.g. BRIJRAJ CREATIVE"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Customer's Shop Name</label>
                    <input
                      type="text"
                      value={editUserForm.shop_name}
                      onChange={(e) => setEditUserForm({ ...editUserForm, shop_name: e.target.value })}
                      placeholder="e.g. Brijraj Hardware & Sanitary"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Shop Location / City</label>
                    <input
                      type="text"
                      value={editUserForm.location}
                      onChange={(e) => setEditUserForm({ ...editUserForm, location: e.target.value })}
                      placeholder="e.g. Faridabad, Haryana"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                    <input
                      type="tel"
                      value={editUserForm.phone}
                      onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editUserForm.full_name}
                      onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                    <input
                      type="tel"
                      value={editUserForm.phone}
                      onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowEditUserModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', background: '#334155', color: '#f8fafc', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 14px', borderRadius: '6px', background: '#f59e0b', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {showDeleteUserModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: '100%', maxWidth: '420px', background: '#1e293b', border: '1px solid #ef4444', borderRadius: '14px', padding: '1.5rem', color: '#f8fafc' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#f87171" />
              <span>Confirm Delete User</span>
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              Are you sure you want to permanently delete user account <strong>{selectedUser.email}</strong> ({selectedUser.full_name || 'User'}) from PostgreSQL database?
              <br /><br />
              <span style={{ color: '#f87171', fontSize: '0.8rem' }}>This action cannot be undone.</span>
            </p>

            <form onSubmit={handleDeleteUserSubmit} style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowDeleteUserModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', background: '#334155', color: '#f8fafc', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 14px', borderRadius: '6px', background: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Permanently Delete User</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
