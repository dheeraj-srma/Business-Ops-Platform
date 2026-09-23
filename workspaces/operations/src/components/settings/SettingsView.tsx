import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  Sliders,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Sun,
  Moon,
  Laptop,
  DollarSign,
  Package,
  AlertTriangle,
  Info,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { AppSettings, UserRole, Product, Category } from '../../types';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useTheme, Theme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { CatalogPriceManager } from './CatalogPriceManager';

import { UserManagementPanel } from './UserManagementPanel';
import { Users as UsersIcon } from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings | null;
  role: UserRole;
  products?: Product[];
  categories?: Category[];
  onRefresh: () => void;
  onGoBack?: () => void;
  onOpenProductDetail?: (productId: string) => void;
}

type SettingsTab = 'catalog' | 'users' | 'general' | 'appearance' | 'maintenance';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  role,
  products = [],
  categories = [],
  onRefresh,
  onGoBack,
  onOpenProductDetail,
}) => {
  const isManager = role === 'manager' || (role as string) === 'stock_manager' || (role as string) === 'admin';
  const { theme, setTheme } = useTheme();
  const { showWarning, showInfo, showConfirm, showSuccess, showError } = useDialog();

  const [activeTab, setActiveTab] = useState<SettingsTab>('catalog');

  const [companyName, setCompanyName] = useState<string>('');
  const [tallyCompanyName, setTallyCompanyName] = useState<string>('');
  const [defaultMinStock, setDefaultMinStock] = useState<string>('15');
  const [defaultCritStock, setDefaultCritStock] = useState<string>('5');
  const [tallyGuidPrefix, setTallyGuidPrefix] = useState<string>('STOCK-MGT-');
  const [allowNegativeOrders, setAllowNegativeOrders] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || (settings as any).company_name || '');
      setTallyCompanyName(settings.tallyCompanyName || (settings as any).tally_company_name || '');
      setDefaultMinStock((settings.defaultMinimumStock ?? (settings as any).default_minimum_stock ?? 15).toString());
      setDefaultCritStock((settings.defaultCriticalStock ?? (settings as any).default_critical_stock ?? 5).toString());
      setTallyGuidPrefix(settings.tallyXmlGuidPrefix || (settings as any).tally_xml_guid_prefix || 'STOCK-MGT-');
      setAllowNegativeOrders(Boolean(settings.allow_negative_orders ?? (settings as any).allowNegativeOrders ?? false));
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      setIsSaving(true);
      await api.updateSettings({
        companyName: companyName.trim(),
        tallyCompanyName: tallyCompanyName.trim(),
        defaultMinimumStock: parseInt(defaultMinStock) || 15,
        defaultCriticalStock: parseInt(defaultCritStock) || 5,
        tallyXmlGuidPrefix: tallyGuidPrefix.trim() || 'STOCK-MGT-',
        allow_negative_orders: allowNegativeOrders,
        allowNegativeOrders: allowNegativeOrders,
      });
      await api.setStockOverride(allowNegativeOrders);

      setSuccessMsg('Application and stock override settings updated successfully.');
      onRefresh();
      showSuccess({
        title: 'Settings Saved',
        message: 'Application and Tally integration configuration parameters have been saved successfully.',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings');
      showError({
        title: 'Settings Save Failed',
        message: err.message || 'Failed to update system settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDemoData = async () => {
    const confirmed = await showConfirm({
      title: 'Reset Demo Database',
      message:
        'Are you sure you want to reset the database to sample enterprise inventory data? All current products and logs will be replaced with clean demo records.',
      confirmText: 'Yes, Reset Data',
      cancelText: 'Cancel',
      isDestructive: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      setIsResetting(true);
      setErrorMsg(null);
      await api.resetDemoData();
      showInfo({
        title: 'Database Restored',
        message: 'Sample inventory catalog and realistic stock movements have been successfully restored.',
      });
      onRefresh();
    } catch (err: any) {
      showWarning({
        title: 'Reset Failed',
        message: err.message || 'Failed to reset demo data',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div id="settings-view" className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs transition-colors">
        <div className="flex items-center gap-3">
          {onGoBack && (
            <button
              id="btn-settings-back"
              onClick={onGoBack}
              title="Go back to previous state"
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0 group"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Control Panel & System Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage product prices, catalog thresholds, visual appearance, and Tally integration parameters
            </p>
          </div>
        </div>

        {!isManager && (
          <span className="text-xs bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg font-semibold shrink-0">
            View Only (Employee Mode)
          </span>
        )}
      </div>

      {/* Settings Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-x-auto">
        <button
          type="button"
          id="tab-settings-catalog"
          onClick={() => setActiveTab('catalog')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
            activeTab === 'catalog'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-slate-900/5 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
          )}
        >
          <DollarSign className="w-4 h-4" />
          <span>Catalog & Price Master</span>
          <span className="px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-mono font-bold">
            {products.length}
          </span>
        </button>

        <button
          type="button"
          id="tab-settings-users"
          onClick={() => setActiveTab('users')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-slate-900/5 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
          )}
        >
          <UsersIcon className="w-4 h-4" />
          <span>User Accounts & Roles</span>
        </button>

        <button
          type="button"
          id="tab-settings-general"
          onClick={() => setActiveTab('general')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
            activeTab === 'general'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-slate-900/5 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
          )}
        >
          <Building2 className="w-4 h-4" />
          <span>Company & Tally Targets</span>
        </button>

        <button
          type="button"
          id="tab-settings-appearance"
          onClick={() => setActiveTab('appearance')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
            activeTab === 'appearance'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-slate-900/5 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
          )}
        >
          <Sun className="w-4 h-4" />
          <span>Theme & Appearance</span>
        </button>

        <button
          type="button"
          id="tab-settings-maintenance"
          onClick={() => setActiveTab('maintenance')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
            activeTab === 'maintenance'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-slate-900/5 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
          )}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Database Maintenance</span>
        </button>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: CATALOG & PRICE MASTER MANAGER */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <CatalogPriceManager
            products={products}
            categories={categories}
            role={role}
            onRefresh={onRefresh}
            onOpenProductDetail={onOpenProductDetail}
          />
        </div>
      )}

      {/* TAB 2: USER ACCOUNTS & AUTHORIZATION ROLES (Centralized in Management -> Admin Settings) */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">User Management is Centralized</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              To enforce enterprise user data security and role authority, user account administration, password management, and role assignments are exclusively managed inside <strong>Management → Admin Settings</strong>.
            </p>
          </div>
          <a
            href="/management"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            Go to Management Workspace
          </a>
        </div>
      )}

      {/* TAB 2: GENERAL COMPANY & TALLY TARGETS */}
      {activeTab === 'general' && (
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-6 shadow-2xs transition-colors">
          {/* Company Profiles */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Company Profile & Tally Target</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company Display Name
                </label>
                <input
                  id="input-settings-company-name"
                  type="text"
                  disabled={!isManager}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:opacity-60"
                />
                <p className="text-[10px] text-slate-400 mt-1">Used on headers, CSV reports, and audit logs.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tally Company Target Name
                </label>
                <input
                  id="input-settings-tally-name"
                  type="text"
                  disabled={!isManager}
                  value={tallyCompanyName}
                  onChange={(e) => setTallyCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:opacity-60"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Must match the active company name in TallyPrime during XML import.
                </p>
              </div>
            </div>
          </div>

          {/* Default Thresholds */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Default Threshold Parameters</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Minimum Stock Level (Low Stock Trigger)
                </label>
                <input
                  id="input-settings-default-min"
                  type="number"
                  min="0"
                  disabled={!isManager}
                  value={defaultMinStock}
                  onChange={(e) => setDefaultMinStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Critical Stock Level (Urgent Alert Trigger)
                </label>
                <input
                  id="input-settings-default-crit"
                  type="number"
                  min="0"
                  disabled={!isManager}
                  value={defaultCritStock}
                  onChange={(e) => setDefaultCritStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-hidden font-mono disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Tally XML Prefixes */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Tally XML Structure Parameters</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tally GUID Prefix String
              </label>
              <input
                id="input-settings-guid-prefix"
                type="text"
                disabled={!isManager}
                value={tallyGuidPrefix}
                onChange={(e) => setTallyGuidPrefix(e.target.value)}
                className="w-full max-w-sm px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Used in generated GUID tags to prevent stock item duplicate collisions in Tally.
              </p>
            </div>
          </div>

          {/* Stock Override Policy */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Stock Override & Order Policy</span>
            </h3>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="space-y-0.5 max-w-lg">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Allow Sales Orders with Zero / Negative Stock
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  When enabled, salesmen are permitted to submit customer orders even when physical stock is zero or insufficient.
                </p>
              </div>

              <button
                type="button"
                id="btn-settings-stock-override-toggle"
                disabled={!isManager}
                onClick={() => setAllowNegativeOrders(!allowNegativeOrders)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-amber-400 disabled:opacity-50',
                  allowNegativeOrders ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                    allowNegativeOrders ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          </div>

          {/* Data Integrity Notice */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">Strict Data Integrity Enforced</span>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Negative stock operations are strictly audited. All inventory changes are committed atomically with a complete, immutable audit trail.
              </p>
            </div>
          </div>

          {/* Action button */}
          {isManager && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end">
              <button
                id="btn-save-settings"
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB 3: THEME & APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-2xs transition-colors">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Theme & Appearance</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select your preferred interface color scheme for reduced eye strain and consistent high-contrast legibility.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
            {[
              { id: 'light', label: 'Light Theme', icon: Sun, desc: 'Clean bright layout' },
              { id: 'dark', label: 'Dark Theme', icon: Moon, desc: 'Low-light contrast' },
              { id: 'system', label: 'System Sync', icon: Laptop, desc: 'Follow OS scheme' },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id as Theme)}
                  className={cn(
                    'p-4 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2',
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 shadow-2xs font-semibold'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400')} />
                  <div>
                    <span className="text-xs block font-bold">{item.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Message & Dialog Popups Showcase */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-700/80">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Custom Message & Dialog Popups</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Test the application's unified custom popups for warnings, information, and confirmation alerts with full background blur.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {/* Warning Popup Button */}
              <button
                type="button"
                id="btn-test-warning-popup"
                onClick={() =>
                  showWarning({
                    title: 'Low Stock Threshold Warning',
                    message:
                      'Critical stock detected in Warehouse A. Total available units for Stainless Steel Pipe 1.5" dropped below reorder buffer (4 units remaining).',
                    confirmText: 'Acknowledge Warning',
                  })
                }
                className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Warning Message</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Alerts for critical inventory levels, anomalies, or system risks.
                </p>
                <span className="inline-block mt-2.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 group-hover:underline">
                  Preview Warning Popup →
                </span>
              </button>

              {/* Info Popup Button */}
              <button
                type="button"
                id="btn-test-info-popup"
                onClick={() =>
                  showInfo({
                    title: 'Tally Synchronization Summary',
                    message:
                      'All 3,681 catalog items and ledger vouchers were successfully verified against TallyPrime server (Port 9000). Zero missing mapping errors.',
                    confirmText: 'Got It',
                  })
                }
                className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-xs">
                  <Info className="w-4 h-4" />
                  <span>Info Message</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Helpful notifications, process completions, and audit details.
                </p>
                <span className="inline-block mt-2.5 text-[10px] font-bold text-blue-700 dark:text-blue-400 group-hover:underline">
                  Preview Info Popup →
                </span>
              </button>

              {/* Confirmation Popup Button */}
              <button
                type="button"
                id="btn-test-confirm-popup"
                onClick={async () => {
                  const confirmed = await showConfirm({
                    title: 'Confirm Inventory Restock Order',
                    message:
                      'Are you sure you want to approve Purchase Order #PO-2026-089 for 150 Brass Valve units valued at ₹42,500?',
                    confirmText: 'Yes, Confirm Order',
                    cancelText: 'Discard',
                  });
                  if (confirmed) {
                    showInfo({
                      title: 'Order Confirmed',
                      message: 'Purchase Order #PO-2026-089 was approved and sent to supplier.',
                    });
                  }
                }}
                className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold text-xs">
                  <HelpCircle className="w-4 h-4" />
                  <span>Confirmation Message</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Interactive yes/no decisions with action resolutions.
                </p>
                <span className="inline-block mt-2.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 group-hover:underline">
                  Preview Confirm Popup →
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE MAINTENANCE */}
      {activeTab === 'maintenance' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-2xs transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-red-600 dark:text-red-400">
                Database Maintenance & Demo Seed Restore
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Reset system data to sample inventory catalog and realistic historical stock movements. Useful for demos, simulations, or starting fresh.
              </p>
            </div>
            {isManager && (
              <button
                id="btn-reset-demo-db"
                onClick={handleResetDemoData}
                disabled={isResetting}
                className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RotateCcw className={cn('w-3.5 h-3.5', isResetting && 'animate-spin')} />
                <span>{isResetting ? 'Resetting...' : 'Restore Sample Data'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
