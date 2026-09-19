import React, { useState } from 'react';
import {
  Server,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Copy,
  Check,
  Shield,
  Zap,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { TallyConnection, TallySyncStatusResponse } from '../../../types';
import { api } from '../../../lib/api';
import { useDialog } from '../../../context/DialogContext';

interface TallyConnectionPanelProps {
  statusData: TallySyncStatusResponse | null;
  onRefresh: () => void;
  onTriggerSyncNow: () => Promise<void>;
  isSyncing: boolean;
}

export const TallyConnectionPanel: React.FC<TallyConnectionPanelProps> = ({
  statusData,
  onRefresh,
  onTriggerSyncNow,
  isSyncing,
}) => {
  const { showSuccess, showError } = useDialog();
  const connection = statusData?.connection;

  // Form local state
  const [isEditing, setIsEditing] = useState(false);
  const [serverUrl, setServerUrl] = useState(connection?.server_url || 'http://localhost');
  const [port, setPort] = useState(connection?.port || 9000);
  const [companyName, setCompanyName] = useState(connection?.company_name || 'Apex Industrial Solutions (2026-27)');
  const [integrationMode, setIntegrationMode] = useState(connection?.integration_mode || 'POLLING');
  const [dataFormat, setDataFormat] = useState(connection?.data_format || 'JSON');
  const [autoSync, setAutoSync] = useState(connection?.auto_sync ?? true);
  const [syncInterval, setSyncInterval] = useState(connection?.sync_interval_seconds || 15);

  // Connection testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    status: string;
    latencyMs: number;
    message: string;
    serverInfo?: any;
  } | null>(null);

  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const webhookUrl = `${window.location.origin}/api/tally/sync/webhook`;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testTallyConnection({
        serverUrl,
        port: Number(port),
        companyName,
      });
      setTestResult(res);
      onRefresh();
    } catch (err: any) {
      setTestResult({
        connected: false,
        status: 'ERROR',
        latencyMs: 0,
        message: err.message || 'Connection timed out or refused by Tally server.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await api.updateTallyConnection({
        server_url: serverUrl,
        port: Number(port),
        company_name: companyName,
        integration_mode: integrationMode as any,
        data_format: dataFormat as any,
        auto_sync: autoSync,
        sync_interval_seconds: Number(syncInterval),
      });
      setSaveMessage('Tally configuration saved successfully!');
      setIsEditing(false);
      onRefresh();
      setTimeout(() => setSaveMessage(null), 3500);

      showSuccess({
        title: 'Tally Connection Configured',
        message: `Tally server configuration for ${serverUrl}:${port} (${companyName}) has been updated.`,
      });
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
      showError({
        title: 'Save Failed',
        message: err.message || 'Failed to update Tally connection parameters.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const isConnected = connection?.connection_status === 'CONNECTED';
  const isError = connection?.connection_status === 'ERROR';

  return (
    <div className="space-y-6">
      {/* Top Status & Live Heartbeat Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs ${
                isConnected
                  ? 'bg-emerald-600'
                  : isError
                  ? 'bg-rose-600'
                  : 'bg-amber-600'
              }`}
            >
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {connection?.name || 'TallyPrime Server Live Gateway'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isConnected
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : isError
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? 'bg-emerald-500 animate-pulse' : isError ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                  />
                  {connection?.connection_status || 'CONNECTED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Company: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{connection?.company_name || companyName}</strong></span>
                <span>&bull;</span>
                <span>Mode: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{connection?.integration_mode || 'POLLING'}</strong></span>
                <span>&bull;</span>
                <span>Format: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{connection?.data_format || 'JSON'}</strong></span>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
              {isTesting ? 'Pinging Tally...' : 'Test Connection'}
            </button>

            <button
              onClick={onTriggerSyncNow}
              disabled={isSyncing}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronizing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Live Test Feedback Banner */}
        {testResult && (
          <div
            className={`mt-4 p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
              testResult.connected
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200'
            }`}
          >
            {testResult.connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {testResult.connected ? 'Tally Server Reachable' : 'Connection Failed'}
                </span>
                {testResult.latencyMs > 0 && (
                  <span className="font-mono text-[11px] font-semibold opacity-80">
                    Latency: {testResult.latencyMs}ms
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Notification / Save Feedback */}
        {saveMessage && (
          <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{saveMessage}</span>
          </div>
        )}
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Connection Parameters */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/70 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Connection & Synchronization Settings</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
            >
              {isEditing ? 'Cancel Editing' : 'Edit Parameters'}
            </button>
          </div>

          <form onSubmit={handleSaveConnection} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tally Server Host / IP Address
                </label>
                <input
                  type="text"
                  value={serverUrl}
                  disabled={!isEditing}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost or http://192.168.1.100"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ODBC / HTTP Port
                </label>
                <input
                  type="number"
                  value={port}
                  disabled={!isEditing}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder="9000"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Company Name in Tally
              </label>
              <input
                type="text"
                value={companyName}
                disabled={!isEditing}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Exact Company Name in TallyPrime"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Must match the active company loaded in your TallyPrime instance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Integration Mechanism
                </label>
                <select
                  value={integrationMode}
                  disabled={!isEditing}
                  onChange={(e) => setIntegrationMode(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="POLLING">Scheduled Polling (Automated background fetch)</option>
                  <option value="EVENT_BASED">Event-Based Webhook (Instant push on voucher save)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payload Data Format
                </label>
                <select
                  value={dataFormat}
                  disabled={!isEditing}
                  onChange={(e) => setDataFormat(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="JSON">Standard Tally JSON API</option>
                  <option value="XML">Tally XML Envelope (ENVELOPE / TDL)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Polling Interval (Seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="3600"
                  value={syncInterval}
                  disabled={!isEditing || integrationMode === 'EVENT_BASED'}
                  onChange={(e) => setSyncInterval(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id="autoSyncToggle"
                  checked={autoSync}
                  disabled={!isEditing}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <label htmlFor="autoSyncToggle" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Enable Background Automatic Sync
                </label>
              </div>
            </div>

            {isEditing && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Col: Webhook & Integration Metadata */}
        <div className="space-y-6">
          {/* Webhook Endpoint Box */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Event-Based Webhook Endpoint</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
              Use this endpoint inside your TDL / Tally Event Hook script to stream vouchers directly into this inventory system in real-time.
            </p>

            <div className="relative">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full pr-10 pl-3 py-2 text-[11px] font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 select-all"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl)}
                title="Copy Webhook URL"
                className="absolute right-1.5 top-1.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded transition-colors cursor-pointer"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/70 space-y-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span>Webhook Secret:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {connection?.webhook_secret || 'whsec_tally_2026'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>HTTP Method:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">POST (JSON or XML)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Idempotency Guarantee:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">SHA-256 Verified</span>
              </div>
            </div>
          </div>

          {/* Sync Stats Summary */}
          <div className="bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
              Synchronization Health
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Last Successful Sync:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {statusData?.metrics.lastSyncAt ? new Date(statusData.metrics.lastSyncAt).toLocaleTimeString() : 'Recent'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Vouchers Processed:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{statusData?.metrics.totalEvents || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Active Stock Reservations:</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                  {statusData?.metrics.activeReservationsCount || 0} ({statusData?.metrics.totalReservedUnits || 0} units)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Failed / Pending Retries:</span>
                <span
                  className={`font-bold ${
                    (statusData?.metrics.failedEvents || 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {statusData?.metrics.failedEvents || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
