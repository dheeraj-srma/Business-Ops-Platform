import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Boxes,
  FileText,
  Briefcase,
  BarChart3,
  History,
  Lock,
  Link as LinkIcon,
  Sliders,
  Play,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import {
  TallySyncStatusResponse,
  SyncEvent,
  StockReservation,
  TallyProductMapping,
  VoucherMappingRule,
  Product,
} from '../../types';
import { api } from '../../lib/api';
import { TallyConnectionPanel } from './sync/TallyConnectionPanel';
import { TallyEventLedger } from './sync/TallyEventLedger';
import { StockReservationsPanel } from './sync/StockReservationsPanel';
import { ProductMappingPanel } from './sync/ProductMappingPanel';
import { VoucherRulesPanel } from './sync/VoucherRulesPanel';
import { TallySimulatorPanel } from './sync/TallySimulatorPanel';
import { InventoryMastersPanel } from './sync/InventoryMastersPanel';
import { VouchersSyncPanel } from './sync/VouchersSyncPanel';
import { AccountingPartiesPanel } from './sync/AccountingPartiesPanel';
import { TallyReportsPanel } from './sync/TallyReportsPanel';
import { SyncHistoryLogsPanel } from './sync/SyncHistoryLogsPanel';
import { TallyImportPanel } from './sync/TallyImportPanel';

interface TallySyncDashboardProps {
  products: Product[];
  onGoBack?: () => void;
}

type SyncTab =
  | 'import'
  | 'connection'
  | 'inventory'
  | 'vouchers'
  | 'accounting'
  | 'reports'
  | 'history'
  | 'ledger'
  | 'reservations'
  | 'mappings'
  | 'rules'
  | 'simulator';

export const TallySyncDashboard: React.FC<TallySyncDashboardProps> = ({
  products,
  onGoBack,
}) => {
  const [activeTab, setActiveTab] = useState<SyncTab>('connection');

  // Core Sync Data State
  const [statusData, setStatusData] = useState<TallySyncStatusResponse | null>(null);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [mappings, setMappings] = useState<TallyProductMapping[]>([]);
  const [voucherRules, setVoucherRules] = useState<VoucherMappingRule[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, eventsRes, resvRes, mapRes, rulesRes] = await Promise.all([
        api.getTallySyncStatus(),
        api.getSyncEvents({ limit: 100 }),
        api.getStockReservations(),
        api.getProductMappings(),
        api.getVoucherRules(),
      ]);

      setStatusData(statusRes);
      setEvents(eventsRes.events);
      setReservations(resvRes.reservations);
      setMappings(mapRes.mappings);
      setVoucherRules(rulesRes.rules);
    } catch (err: any) {
      console.error('Failed to load Tally sync data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleTriggerSyncNow = async () => {
    setIsSyncing(true);
    setSyncToast(null);
    try {
      const res = await api.syncTallyFull();
      setSyncToast(res.message || 'Full synchronization completed successfully across all modules.');
      await fetchAllData();
      setTimeout(() => setSyncToast(null), 5000);
    } catch (err: any) {
      setSyncToast(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const failedEventsCount = statusData?.metrics.failedEvents || 0;
  const activeReservationsCount = statusData?.metrics.activeReservationsCount || 0;
  const unmappedCount = statusData?.metrics.unmappedMappingsCount || 0;

  const isTallyConnected = statusData?.connection?.connection_status === 'CONNECTED';
  const tallyEndpoint = `${statusData?.connection?.server_url || 'http://localhost'}:${statusData?.connection?.port || 9000}`;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onGoBack && (
            <button
              onClick={onGoBack}
              title="Go back to previous page"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Tally & TallyPrime Integration Hub
              </h1>
              {/* Real Connection Status Pill */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isTallyConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isTallyConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>{isTallyConnected ? 'Live Gateway Online' : 'Gateway Offline / Standby'}</span>
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium">({tallyEndpoint})</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Synchronization for Company, Inventory Masters, Sales, Purchases, Returns, Ledgers, and Reconciliation.
            </p>
          </div>
        </div>

        {/* Global Refresh & Sync Now */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleTriggerSyncNow}
            disabled={isSyncing}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Full Sync Now'}</span>
          </button>

          <button
            onClick={fetchAllData}
            disabled={isLoading}
            title="Refresh All Sync Data"
            className="p-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Disconnected Gateway Notice */}
      {!isTallyConnected && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">
              TallyPrime Gateway is currently Disconnected ({tallyEndpoint}).
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              Direct XML/HTTP polling is in standby. You can start TallyPrime with port 9000 enabled for live sync, or use the{' '}
              <button
                onClick={() => setActiveTab('import')}
                className="font-bold underline hover:text-amber-950 dark:hover:text-amber-100 cursor-pointer"
              >
                Import & Reconcile
              </button>{' '}
              tab to upload Stock Summary (.xml, .csv, .xls, .json) files directly from the accountant.
            </p>
          </div>
        </div>
      )}

      {/* Global Sync Toast Notification */}
      {syncToast && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'import'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Import & Reconcile</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            Accountant Sync
          </span>
        </button>

        <button
          onClick={() => setActiveTab('connection')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'connection'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Connection & Setup</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Inventory Masters Sync</span>
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'vouchers'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Sales & Purchases</span>
        </button>

        <button
          onClick={() => setActiveTab('accounting')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'accounting'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Accounting & Parties</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Reports & Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Sync History & Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'ledger'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Event Stream</span>
          {failedEventsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
              {failedEventsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reservations')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'reservations'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Stock Reservations</span>
          {activeReservationsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
              {activeReservationsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('mappings')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'mappings'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Product Mappings</span>
          {unmappedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {unmappedCount} Unmapped
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'rules'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Simulator</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'import' && (
        <TallyImportPanel
          products={products}
          onRefreshAll={fetchAllData}
        />
      )}

      {activeTab === 'connection' && (
        <TallyConnectionPanel
          statusData={statusData}
          onRefresh={fetchAllData}
          onTriggerSyncNow={handleTriggerSyncNow}
          isSyncing={isSyncing}
        />
      )}

      {activeTab === 'inventory' && (
        <InventoryMastersPanel
          products={products}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === 'vouchers' && (
        <VouchersSyncPanel
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === 'accounting' && (
        <AccountingPartiesPanel
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === 'reports' && (
        <TallyReportsPanel />
      )}

      {activeTab === 'history' && (
        <SyncHistoryLogsPanel />
      )}

      {activeTab === 'ledger' && (
        <TallyEventLedger
          events={events}
          isLoading={isLoading}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === 'reservations' && (
        <StockReservationsPanel
          reservations={reservations}
          isLoading={isLoading}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === 'mappings' && (
        <ProductMappingPanel
          mappings={mappings}
          products={products}
          isLoading={isLoading}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === 'rules' && (
        <VoucherRulesPanel
          rules={voucherRules}
          isLoading={isLoading}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === 'simulator' && (
        <TallySimulatorPanel onSimulationComplete={fetchAllData} />
      )}
    </div>
  );
};

