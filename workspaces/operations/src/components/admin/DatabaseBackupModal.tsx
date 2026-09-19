import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  FileText,
  FileJson,
  X,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BackupEntry {
  folder: string;
  timestamp: string;
  sqlSize: number;
  jsonSize: number;
}

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({ isOpen, onClose }) => {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [hasLatest, setHasLatest] = useState<boolean>(false);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [selectedBackupFolder, setSelectedBackupFolder] = useState<string>('latest');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
      setStatusMessage(null);
    }
  }, [isOpen]);

  const fetchBackups = async () => {
    try {
      setIsLoadingList(true);
      const res = await fetch('/api/backup/list');
      const data = await res.json();
      if (data.backups) {
        setBackups(data.backups);
        setHasLatest(data.hasLatest);
      }
    } catch (err) {
      console.error('Failed to load backups list:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      setStatusMessage(null);
      const res = await fetch('/api/backup/export', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: 'Database backup created successfully! You can download the SQL dump or JSON files below.',
        });
        await fetchBackups();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to create backup.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error triggering database backup.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!targetUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a target PostgreSQL connection string URL.' });
      return;
    }

    try {
      setIsRestoring(true);
      setStatusMessage(null);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          file: selectedBackupFolder === 'latest' ? null : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: 'Database restored successfully to target database provider!',
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to restore database.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error executing database restore.' });
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Database Backup & Provider Migration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1-click SQL/JSON exports & instant restoration to any PostgreSQL / Supabase provider
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={cn(
              'mx-6 mt-4 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border',
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
            )}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Section 1: Create Backup */}
          <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                <HardDrive className="w-4 h-4" />
                <span>Create Instant Database Backup</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Generates complete SQL schema + data dump, RLS policies, RPCs, and JSON data files.
              </p>
            </div>

            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', isExporting && 'animate-spin')} />
              <span>{isExporting ? 'Exporting Backup...' : 'Export Backup Now'}</span>
            </button>
          </div>

          {/* Section 2: Backup Files List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Available Local Backup Snapshots</span>
              </h4>

              {hasLatest && (
                <a
                  href="/api/backup/download/latest_backup.sql"
                  download="latest_backup.sql"
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Latest SQL Dump</span>
                </a>
              )}
            </div>

            {isLoadingList ? (
              <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading backup list...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No backup snapshots created yet. Click "Export Backup Now" above to generate your first backup.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {backups.map((b) => (
                  <div key={b.folder} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono truncate">
                        {b.folder}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>SQL: {(b.sqlSize / 1024).toFixed(1)} KB</span>
                        <span>JSON: {(b.jsonSize / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/api/backup/download/${b.folder}/full_schema_and_data.sql`}
                        download={`${b.folder}_schema_and_data.sql`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        <span>SQL</span>
                      </a>

                      <a
                        href={`/api/backup/download/${b.folder}/data_export.json`}
                        download={`${b.folder}_data.json`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <FileJson className="w-3.5 h-3.5 text-amber-500" />
                        <span>JSON</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Restore / Transfer to Target DB Provider */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-emerald-500" />
              <span>Restore or Transfer to Database Provider</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Enter the target PostgreSQL connection URL (from Supabase, Neon, Railway, AWS RDS, etc.) to automatically restore schema and data.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Target Connection String URL
                </label>
                <input
                  type="text"
                  placeholder="postgres://postgres:PASSWORD@db-host:5432/postgres?sslmode=require"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-400">
                  Will automatically setup <code className="text-slate-300 font-mono">auth</code> schema, roles, tables, & data.
                </div>

                <button
                  onClick={handleRestoreBackup}
                  disabled={isRestoring || !targetUrl.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Upload className={cn('w-4 h-4', isRestoring && 'animate-spin')} />
                  <span>{isRestoring ? 'Restoring DB...' : 'Restore to Target DB'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Self-Contained Automated Backup System</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
