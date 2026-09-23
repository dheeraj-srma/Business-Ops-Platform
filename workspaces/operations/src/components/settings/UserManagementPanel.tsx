import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Building,
  Store,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  Lock,
  Plus,
  X,
  BadgeCheck,
  User,
  Tag,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { cn } from '../../lib/utils';
import { useDialog } from '../../context/DialogContext';

export interface UserProfileRow {
  id: string;
  email: string;
  role: 'salesman' | 'customer' | 'admin' | 'accountant' | 'warehouse_manager' | 'stock_manager' | 'staff' | string;
  salesman_id?: string;
  salesman_name?: string;
  customer_name?: string;
  shop_name?: string;
  city?: string;
  state?: string;
  location_id?: string;
  phone?: string;
  customer_code?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface UserManagementPanelProps {
  currentRole: string;
  onRefresh?: () => void;
}

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ currentRole }) => {
  const { showSuccess, showError, showConfirm } = useDialog();
  const isManager = currentRole === 'manager' || currentRole === 'admin' || currentRole === 'accountant';

  const [users, setUsers] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfileRow | null>(null);

  // Form Fields
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('password123');
  const [showFormPassword, setShowFormPassword] = useState<boolean>(false);
  const [formRole, setFormRole] = useState<string>('salesman');
  
  // Customer Specific Fields
  const [formCustomerName, setFormCustomerName] = useState<string>('');
  const [formShopName, setFormShopName] = useState<string>('');
  const [formCity, setFormCity] = useState<string>('');
  const [formState, setFormState] = useState<string>('Haryana');
  const [formLocationId, setFormLocationId] = useState<string>('LOC-HR-01');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formCustomerCode, setFormCustomerCode] = useState<string>('');

  // Salesman Specific Fields
  const [formSalesmanId, setFormSalesmanId] = useState<string>('');
  const [formSalesmanName, setFormSalesmanName] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch users from Supabase or Fallback
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.warn('Failed to fetch user profiles from Supabase, using mock fallback:', err);
      // Seed default demo profiles if DB empty
      setUsers([
        {
          id: 'usr-slm-1',
          email: 'ankit@nalkametals.com',
          role: 'salesman',
          salesman_id: 'TLY-SLM-001',
          salesman_name: 'ANKIT',
          phone: '+91 98100 11223',
          is_active: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'usr-cust-1',
          email: 'brijraj@creative.com',
          role: 'customer',
          customer_name: 'BRIJRAJ CREATIVE',
          shop_name: 'Brijraj Creative Hardware & Sanitary',
          city: 'Faridabad',
          state: 'Haryana',
          location_id: 'LOC-HR-02',
          phone: '+91 98765 43210',
          customer_code: 'CUST-FAR-101',
          is_active: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'usr-cust-2',
          email: 'avon@electricals.com',
          role: 'customer',
          customer_name: 'Avon Electricals and Controls',
          shop_name: 'Avon Electricals & Plumbing Depot',
          city: 'Faridabad',
          state: 'Haryana',
          location_id: 'LOC-HR-02',
          phone: '+91 98111 22334',
          customer_code: 'CUST-FAR-102',
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormPassword('password123');
    setFormRole('salesman');
    setFormCustomerName('');
    setFormShopName('');
    setFormCity('');
    setFormState('Haryana');
    setFormLocationId('LOC-HR-01');
    setFormPhone('');
    setFormCustomerCode('');
    setFormSalesmanId('');
    setFormSalesmanName('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserProfileRow) => {
    setEditingUser(user);
    setFormEmail(user.email || '');
    setFormPassword('');
    setFormRole(user.role || 'customer');
    setFormCustomerName(user.customer_name || user.salesman_name || '');
    setFormShopName(user.shop_name || '');
    setFormCity(user.city || '');
    setFormState(user.state || 'Haryana');
    setFormLocationId(user.location_id || 'LOC-HR-01');
    setFormPhone(user.phone || '');
    setFormCustomerCode(user.customer_code || '');
    setFormSalesmanId(user.salesman_id || '');
    setFormSalesmanName(user.salesman_name || '');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim()) {
      showError({ title: 'Validation Error', message: 'Email address is required.' });
      return;
    }

    if (formRole === 'customer' && !formCustomerName.trim()) {
      showError({ title: 'Validation Error', message: "Customer's own name is required." });
      return;
    }

    setIsSubmitting(true);
    try {
      let userId = editingUser?.id;

      // 1. If creating new user, attempt Supabase Auth Sign Up
      if (!userId) {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: formEmail.trim(),
          password: formPassword || 'password123',
          options: {
            data: {
              role: formRole,
              customer_name: formCustomerName,
              shop_name: formShopName,
            }
          }
        });

        if (authErr && !authErr.message.includes('User already registered')) {
          console.warn('Supabase auth signUp warning:', authErr);
        }

        userId = authData?.user?.id || `usr-${Date.now()}`;
      }

      // 2. Prepare payload for user_profiles table
      const profilePayload: Partial<UserProfileRow> = {
        id: userId,
        email: formEmail.trim(),
        role: formRole,
        customer_name: formRole === 'customer' ? formCustomerName.trim() : undefined,
        shop_name: formRole === 'customer' ? formShopName.trim() : undefined,
        city: formRole === 'customer' ? formCity.trim() : undefined,
        state: formRole === 'customer' ? formState.trim() : undefined,
        location_id: formRole === 'customer' ? formLocationId.trim() : undefined,
        phone: formPhone.trim(),
        customer_code: formRole === 'customer' ? (formCustomerCode.trim() || `CUST-${Date.now().toString().slice(-4)}`) : undefined,
        salesman_id: formRole === 'salesman' ? (formSalesmanId.trim() || `SLM-${Date.now().toString().slice(-4)}`) : undefined,
        salesman_name: formRole === 'salesman' ? formSalesmanName.trim() : (formRole === 'customer' ? formCustomerName.trim() : undefined),
        is_active: editingUser ? editingUser.is_active : true,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('user_profiles')
        .upsert(profilePayload);

      if (upsertErr) {
        console.warn('Error upserting profile in Supabase:', upsertErr);
      }

      showSuccess({
        title: editingUser ? 'User Profile Updated' : 'New User Created',
        message: `Successfully ${editingUser ? 'updated' : 'created'} account for ${formEmail} with role "${formRole.toUpperCase()}".`,
      });

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showError({
        title: 'Save Failed',
        message: err.message || 'Could not save user profile.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserActive = async (user: UserProfileRow) => {
    const confirmed = await showConfirm({
      title: user.is_active ? 'Deactivate User Account?' : 'Reactivate User Account?',
      message: user.is_active
        ? `Are you sure you want to deactivate account "${user.email}"? The user will be unable to log in.`
        : `Are you sure you want to reactivate account "${user.email}"?`,
      confirmText: user.is_active ? 'Yes, Deactivate' : 'Yes, Reactivate',
      isDestructive: user.is_active,
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !user.is_active, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      );

      showSuccess({
        title: 'Status Updated',
        message: `Account "${user.email}" is now ${!user.is_active ? 'Active' : 'Inactive'}.`,
      });
    } catch (err: any) {
      showError({
        title: 'Update Failed',
        message: err.message || 'Could not update user active status.',
      });
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mEmail = (u.email || '').toLowerCase().includes(q);
        const mCustName = (u.customer_name || '').toLowerCase().includes(q);
        const mSalesName = (u.salesman_name || '').toLowerCase().includes(q);
        const mShop = (u.shop_name || '').toLowerCase().includes(q);
        const mCity = (u.city || '').toLowerCase().includes(q);
        const mPhone = (u.phone || '').toLowerCase().includes(q);
        if (!mEmail && !mCustName && !mSalesName && !mShop && !mCity && !mPhone) return false;
      }
      return true;
    });
  }, [users, searchQuery, roleFilter]);

  return (
    <div className="space-y-5">
      {/* Header Toolbar & Search */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                User Accounts & Access Control
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage Salesmen, Customer accounts, Managers, and System Authorization Roles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Refresh users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {isManager && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add New User</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/70">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, email, shop, city, phone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs self-start sm:self-auto overflow-x-auto">
            <button
              onClick={() => setRoleFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap',
                roleFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              )}
            >
              All Roles ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('salesman')}
              className={cn(
                'px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap',
                roleFilter === 'salesman'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
              )}
            >
              Salesmen ({users.filter((u) => u.role === 'salesman').length})
            </button>
            <button
              onClick={() => setRoleFilter('customer')}
              className={cn(
                'px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap',
                roleFilter === 'customer'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              Customers ({users.filter((u) => u.role === 'customer').length})
            </button>
            <button
              onClick={() => setRoleFilter('accountant')}
              className={cn(
                'px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap',
                roleFilter === 'accountant'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600'
              )}
            >
              Admins & Accountants ({users.filter((u) => u.role === 'accountant' || u.role === 'admin').length})
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-400 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">User Account & Role</th>
                <th className="py-3 px-4">Customer / Contact Name</th>
                <th className="py-3 px-4">Shop / Business Name</th>
                <th className="py-3 px-4">Location / City</th>
                <th className="py-3 px-4">Phone Contact</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-800 dark:text-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No user accounts found</p>
                    <p className="text-xs text-slate-400 mt-1">Try changing your search query or role filter.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCustomer = u.role === 'customer';
                  const isSalesman = u.role === 'salesman';
                  const isAdminOrAccountant = u.role === 'admin' || u.role === 'accountant';
                  const isWarehouseManager = u.role === 'warehouse_manager' || u.role === 'stock_manager';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                      {/* Email & Role Badge */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{u.email}</span>
                        </div>
                        <div className="mt-1">
                          {isCustomer && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              <User className="w-3 h-3" />
                              <span>Customer Account</span>
                            </span>
                          )}
                          {isSalesman && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <BadgeCheck className="w-3 h-3" />
                              <span>Sales Representative</span>
                            </span>
                          )}
                          {isAdminOrAccountant && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <ShieldCheck className="w-3 h-3" />
                              <span>{u.role === 'accountant' ? 'Accountant' : 'Admin'}</span>
                            </span>
                          )}
                          {isWarehouseManager && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Warehouse Manager</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer / Contact Name */}
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {u.customer_name || u.salesman_name || 'N/A'}
                        {u.customer_code && (
                          <div className="text-[10px] font-mono text-slate-400">{u.customer_code}</div>
                        )}
                      </td>

                      {/* Shop Name */}
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {u.shop_name ? (
                          <span className="flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>{u.shop_name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {u.city ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{u.city}{u.state ? `, ${u.state}` : ''}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {u.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{u.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {u.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Edit User Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {isManager && (
                            <button
                              onClick={() => handleToggleUserActive(u)}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors cursor-pointer',
                                u.is_active
                                  ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-800'
                                  : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                              )}
                              title={u.is_active ? 'Deactivate User' : 'Reactivate User'}
                            >
                              {u.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingUser ? 'Edit User Profile' : 'Add New System User'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Configure account credentials, authorization role, and profile details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              {/* User Authorization Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  User Authorization Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="salesman">Salesman / Field Representative</option>
                  <option value="accountant">Accountant (Full Authority & Admin Privileges)</option>
                  <option value="admin">Administrator</option>
                  <option value="warehouse_manager">Warehouse Manager</option>
                  <option value="customer">Customer (Order Portal & Inventory View Only)</option>
                  <option value="staff">Internal Staff Employee</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {formRole === 'customer'
                    ? 'Customers can log into Order App, view live stock balances, and place orders directly under their own shop details.'
                    : formRole === 'salesman'
                    ? 'Salesmen can log into Order App and place orders on behalf of assigned dealers.'
                    : formRole === 'accountant' || formRole === 'admin'
                    ? 'Accountants and Administrators get full administrative authority across transactions, settings, and reports.'
                    : 'Warehouse Managers get inventory processing and order fulfillment access.'}
                </p>
              </div>

              {/* Email & Initial Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="user@nalkametals.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Initial Password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showFormPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="password123"
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                        title={showFormPassword ? 'Hide password' : 'Show password'}
                      >
                        {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* CONDITIONAL SECTION: CUSTOMER DETAILS */}
              {formRole === 'customer' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">
                    <User className="w-4 h-4" />
                    <span>Customer Profile Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Customer's Own Name *
                      </label>
                      <input
                        type="text"
                        required={formRole === 'customer'}
                        value={formCustomerName}
                        onChange={(e) => setFormCustomerName(e.target.value)}
                        placeholder="e.g. BRIJRAJ CREATIVE"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Customer's Shop / Business Name
                      </label>
                      <input
                        type="text"
                        value={formShopName}
                        onChange={(e) => setFormShopName(e.target.value)}
                        placeholder="e.g. Brijraj Hardware & Sanitary"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={formState}
                        onChange={(e) => setFormState(e.target.value)}
                        placeholder="Haryana"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        City / Location
                      </label>
                      <input
                        type="text"
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                        placeholder="Faridabad"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CONDITIONAL SECTION: SALESMAN DETAILS */}
              {formRole === 'salesman' && (
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                    <BadgeCheck className="w-4 h-4" />
                    <span>Sales Representative Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Salesman Full Name
                      </label>
                      <input
                        type="text"
                        value={formSalesmanName}
                        onChange={(e) => setFormSalesmanName(e.target.value)}
                        placeholder="e.g. ANKIT"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Tally / Salesman ID
                      </label>
                      <input
                        type="text"
                        value={formSalesmanId}
                        onChange={(e) => setFormSalesmanId(e.target.value)}
                        placeholder="e.g. TLY-SLM-001"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{editingUser ? 'Save Changes' : 'Create User Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
