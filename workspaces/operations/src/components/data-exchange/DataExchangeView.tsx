import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  Upload,
  Download,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Layers,
  FileText,
  Shield,
  ShieldCheck,
  RefreshCw,
  Search,
  Database,
  Info,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Eye,
  Hash,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Filter,
  CheckSquare,
  ArrowLeft,
  SlidersHorizontal,
  Code
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Product, Category } from '../../types';

const getApiUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://${window.location.hostname}:8000`;
  }
  return '';
};

interface ContractField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  nullable: boolean;
  description: string;
  example: any;
  allowed_values?: string[];
  min?: number;
  max?: number;
  format?: string;
}

interface ContractMeta {
  exchange_type: string;
  name: string;
  description: string;
  schema_version: string;
  supported_versions: string[];
  default_source: string;
  default_destination: string;
  primary_key: string;
  root_fields: ContractField[];
  record_fields: ContractField[];
  item_fields?: ContractField[];
}

interface ValidationError {
  path: string;
  code: string;
  message: string;
  field?: string;
  received?: any;
  expected?: any;
  example?: any;
}

interface ValidationWarning {
  code: string;
  message: string;
  voucher_number?: string;
  batch_id?: string;
  [key: string]: any;
}

interface ConflictRecord {
  record_id: string;
  identifier_type: string;
  existing_record: Record<string, any>;
  incoming_record: Record<string, any>;
  differences: Array<{
    field: string;
    existing: any;
    incoming: any;
  }>;
}

interface UnresolvedReference {
  record_id: string;
  line?: number;
  entity_type: string;
  external_identifier: string;
  problem: string;
}

interface AmbiguousMapping {
  record_id: string;
  line?: number;
  entity_type: string;
  external_identifier: string;
  confidence: number;
  candidates: Array<{
    internal_id: string;
    internal_name: string;
    similarity: number;
    reason: string;
  }>;
  problem: string;
}

interface ValidationPreviewResult {
  can_commit: boolean;
  status: string;
  stage: number;
  schema_version: string;
  exchange_type: string;
  source: string;
  payload_hash: string;
  summary: {
    total_records: number;
    total_line_items: number;
    new_records: number;
    already_imported_records: number;
    conflict_records: number;
    unresolved_entities_count: number;
    ambiguous_entities_count?: number;
    errors_count: number;
    warnings_count: number;
    unknown_fields_count: number;
    total_amount: number;
    total_quantity: number;
  };
  errors: ValidationError[];
  warnings: ValidationWarning[];
  unknown_fields: Array<{ path: string; code: string; message: string; field: string }>;
  conflicts: ConflictRecord[];
  unresolved_references: UnresolvedReference[];
  ambiguous_mappings?: AmbiguousMapping[];
}

interface BatchRecord {
  id: string;
  exchange_type: string;
  schema_version: string;
  source: string;
  destination: string;
  direction: string;
  status: string;
  payload_hash: string;
  record_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  conflicts_count: number;
  errors_count: number;
  warnings_count: number;
  total_amount: number;
  total_quantity: number;
  operator_email: string;
  operator_role: string;
  receipt_json?: string;
  created_at: string;
  committed_at?: string;
}

interface MappingRecord {
  id: string;
  external_system: string;
  entity_type: string;
  external_id: string;
  external_name: string;
  internal_entity_id: string;
  internal_entity_name: string;
  mapping_status: string;
  confidence: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_verified_at?: string;
}

interface DataExchangeViewProps {
  products?: Product[];
  categories?: Category[];
  initialMode?: 'import' | 'export';
  onRefreshAll?: () => void;
  onGoBack?: () => void;
}

export const DataExchangeView: React.FC<DataExchangeViewProps> = ({
  products,
  categories,
  initialMode = 'import',
  onRefreshAll,
  onGoBack,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'export' | 'mappings' | 'history'>(
    initialMode === 'export' ? 'export' : 'import'
  );

  // Contracts state
  const [contractsList, setContractsList] = useState<ContractMeta[]>([]);
  const [selectedExchangeType, setSelectedExchangeType] = useState<string>('historical_sales');
  const [activeContract, setActiveContract] = useState<ContractMeta | null>(null);
  const [accountantSpec, setAccountantSpec] = useState<any>(null);
  const [blankTemplate, setBlankTemplate] = useState<any>(null);
  const [samplePayload, setSamplePayload] = useState<any>(null);
  const [showSpecModal, setShowSpecModal] = useState<boolean>(false);

  // Import state
  const [importText, setImportText] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationPreview, setValidationPreview] = useState<ValidationPreviewResult | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, 'OVERWRITE' | 'SKIP' | 'REJECT'>>({});
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [importReceipt, setImportReceipt] = useState<any>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Export state
  const [exportStartDate, setExportStartDate] = useState<string>('2026-06-01');
  const [exportEndDate, setExportEndDate] = useState<string>('2026-09-21');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<any>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Mappings state
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  const [isLoadingMappings, setIsLoadingMappings] = useState<boolean>(false);
  const [mappingSearch, setMappingSearch] = useState<string>('');
  const [mappingFilterType, setMappingFilterType] = useState<string>('ALL');

  // History state
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(false);
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<BatchRecord | null>(null);

  // UI helpers
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  // 1. Fetch available contracts
  const fetchContracts = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/exchange/contracts`);
      if (res.ok) {
        const data = await res.json();
        setContractsList(data.contracts || []);
      }
    } catch (err) {
      console.error('Failed to load contracts:', err);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  // 2. Fetch specific contract details when selected
  useEffect(() => {
    if (!selectedExchangeType) return;
    const fetchContractDetail = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/exchange/contracts/${selectedExchangeType}`);
        if (res.ok) {
          const data = await res.json();
          setActiveContract(data.contract);
          setAccountantSpec(data.accountant_spec);
          setBlankTemplate(data.blank_template);
          setSamplePayload(data.sample_payload);
        }
      } catch (err) {
        console.error('Failed to load contract details:', err);
      }
    };
    fetchContractDetail();
  }, [selectedExchangeType]);

  // 3. Fetch batch history
  const fetchBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/exchange/batches?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch (err) {
      console.error('Failed to load exchange batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  // 4. Fetch mappings
  const fetchMappings = async () => {
    setIsLoadingMappings(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/exchange/mappings`);
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
      }
    } catch (err) {
      console.error('Failed to load mappings:', err);
    } finally {
      setIsLoadingMappings(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') fetchBatches();
    if (activeTab === 'mappings') fetchMappings();
  }, [activeTab]);

  // File upload handler (supports .json and .xml)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setImportText(content);
      setValidationPreview(null);
      setImportReceipt(null);
      setCommitError(null);
    };
    reader.readAsText(file);
  };

  // Trigger Validation Preview (Stage 1 to 7)
  const handleValidatePayload = async () => {
    if (!importText.trim()) return;
    setIsValidating(true);
    setCommitError(null);
    setImportReceipt(null);
    try {
      let payloadToSend: any = importText.trim();
      if (importText.trim().startsWith('{') || importText.trim().startsWith('[')) {
        try {
          payloadToSend = JSON.parse(importText);
        } catch (jsonErr: any) {
          setValidationPreview({
            can_commit: false,
            status: 'MALFORMED_JSON',
            stage: 1,
            schema_version: 'UNKNOWN',
            exchange_type: selectedExchangeType,
            source: 'UNKNOWN',
            payload_hash: '',
            summary: {
              total_records: 0,
              total_line_items: 0,
              new_records: 0,
              already_imported_records: 0,
              conflict_records: 0,
              unresolved_entities_count: 0,
              errors_count: 1,
              warnings_count: 0,
              unknown_fields_count: 0,
              total_amount: 0,
              total_quantity: 0
            },
            errors: [{
              path: 'root',
              code: 'INVALID_JSON_SYNTAX',
              message: `JSON syntax error: ${jsonErr.message}.`,
            }],
            warnings: [],
            unknown_fields: [],
            conflicts: [],
            unresolved_references: []
          });
          setIsValidating(false);
          return;
        }
      }

      const res = await fetch(`${getApiUrl()}/api/exchange/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: payloadToSend,
          expected_exchange_type: selectedExchangeType
        })
      });

      const data = await res.json();
      setValidationPreview(data);

      if (data.conflicts && data.conflicts.length > 0) {
        const initialRes: Record<string, 'OVERWRITE' | 'SKIP' | 'REJECT'> = {};
        data.conflicts.forEach((c: ConflictRecord) => {
          initialRes[c.record_id] = 'SKIP';
        });
        setConflictResolutions(initialRes);
      }
    } catch (err: any) {
      setCommitError(`Validation network failure: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Confirm and Commit Import (Stage 8)
  const handleCommitImport = async () => {
    if (!validationPreview || !validationPreview.can_commit) return;
    setIsCommitting(true);
    setCommitError(null);
    try {
      let parsedPayload: any = importText.trim();
      if (importText.trim().startsWith('{') || importText.trim().startsWith('[')) {
        parsedPayload = JSON.parse(importText);
      }

      const res = await fetch(`${getApiUrl()}/api/exchange/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview_result: validationPreview,
          payload: parsedPayload,
          conflict_resolutions: conflictResolutions,
          operator: { email: 'operator@nalkametals.com', role: 'stock_manager' }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportReceipt(data.receipt);
        setValidationPreview(null);
        if (onRefreshAll) onRefreshAll();
      } else {
        setCommitError(data.detail || 'Import commit failed during transactional write.');
      }
    } catch (err: any) {
      setCommitError(`Commit error: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Generate Export
  const handleGenerateExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportResult(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/exchange/export/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange_type: selectedExchangeType,
          version: '1.0',
          start_date: exportStartDate || undefined,
          end_date: exportEndDate || undefined,
          operator: { email: 'operator@nalkametals.com', role: 'stock_manager' }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setExportResult(data);
      } else {
        setExportError(data.detail || 'Export package generation failed contract validation.');
      }
    } catch (err: any) {
      setExportError(`Export network error: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered mappings
  const filteredMappings = mappings.filter((m) => {
    const matchesSearch =
      !mappingSearch ||
      m.external_name.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.external_id.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.internal_entity_name.toLowerCase().includes(mappingSearch.toLowerCase());
    const matchesType = mappingFilterType === 'ALL' || m.entity_type === mappingFilterType;
    return matchesSearch && matchesType;
  });

  return (
    <div id="data-exchange-view" className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── Top Header & Hub Navigation ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            {onGoBack && (
              <button
                onClick={onGoBack}
                className="p-2 -ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Data Exchange Hub
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 font-mono">
                  CONTRACT-DRIVEN • FAILURE-SAFE
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono">
                  TALLY XML • CANONICAL JSON
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
                Bi-directional protocol integration layer for operational catalog exchange, historical ledgers, voucher reconciliation, and TallyPrime synchronizations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSpecModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Accountant Spec & Template</span>
            </button>
          </div>
        </div>

        {/* ── Sub-navigation Tabs ───────────────────────────────────── */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {[
            { id: 'import', label: 'Import Studio', icon: Upload, count: null },
            { id: 'export', label: 'Export Engine', icon: Download, count: null },
            { id: 'mappings', label: 'Mapping Registry', icon: Layers, count: mappings.length || null },
            { id: 'history', label: 'Exchange Ledger', icon: Clock, count: batches.length || null },
            { id: 'overview', label: 'Protocol Health', icon: ShieldCheck, count: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
                  isActive
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contract Selector Bar ───────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Contract:</span>
          <select
            value={selectedExchangeType}
            onChange={(e) => {
              setSelectedExchangeType(e.target.value);
              setValidationPreview(null);
              setImportReceipt(null);
            }}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {contractsList.map((c) => (
              <option key={c.exchange_type} value={c.exchange_type}>
                {c.name} ({c.exchange_type})
              </option>
            ))}
          </select>
        </div>

        {activeContract && (
          <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
            <span>
              Schema: <strong className="text-indigo-400 font-mono">v{activeContract.schema_version}</strong>
            </span>
            <span>
              Default Source: <strong className="text-slate-200 font-mono">{activeContract.default_source}</strong>
            </span>
            <span>
              Primary Key: <strong className="text-emerald-400 font-mono">{activeContract.primary_key}</strong>
            </span>
            <span>
              Fields: <strong className="text-slate-200">{activeContract.record_fields.length} root / {activeContract.item_fields?.length || 0} line</strong>
            </span>
          </div>
        )}
      </div>

      {/* ── TAB 1: IMPORT STUDIO ────────────────────────────────────── */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* File Upload / Direct Editor Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Payload Ingestion & Dry-Run Validator</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste JSON / Tally XML payload or upload a data exchange file. Validation is 100% side-effect free.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json,.xml,.txt"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Upload File (.json / .xml)</span>
                </button>

                {samplePayload && (
                  <button
                    onClick={() => {
                      setImportText(JSON.stringify(samplePayload, null, 2));
                      setValidationPreview(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 text-xs font-semibold border border-indigo-800/60 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Valid Sample</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Paste canonical JSON or raw Tally XML for ${selectedExchangeType}...`}
                rows={12}
                className="w-full bg-slate-950 font-mono text-xs text-slate-200 p-4 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
              {importText && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => setImportText('')}
                    className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-[10px] text-slate-300 rounded font-mono cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
              <span className="text-xs text-slate-500 font-mono">
                {importText ? `${importText.length.toLocaleString()} characters` : 'No payload loaded'}
              </span>

              <button
                onClick={handleValidatePayload}
                disabled={!importText.trim() || isValidating}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-lg',
                  !importText.trim() || isValidating
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                )}
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing 7-Stage Validation...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Validate & Reconcile Preview</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Commit Error Banner */}
          {commitError && (
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-3 shadow-lg">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Transaction Blocked:</strong> {commitError}
              </div>
            </div>
          )}

          {/* Completed Import Receipt */}
          {importReceipt && (
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-300">
                      Import Transaction Committed Successfully
                    </h3>
                    <p className="text-xs text-emerald-400/80 font-mono mt-0.5">
                      Batch ID: {importReceipt.batch_id} • SHA-256: {importReceipt.payload_hash?.slice(0, 16)}...
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  COMMITTED
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Created Records</span>
                  <div className="text-lg font-black text-white">{importReceipt.created_records || 0}</div>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Total Quantity</span>
                  <div className="text-lg font-black text-white">
                    {Number(importReceipt.total_quantity || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Total Gross Value</span>
                  <div className="text-lg font-black text-emerald-400">
                    ₹{Number(importReceipt.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Reconciliation</span>
                  <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    <span>100% Balanced</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation & Reconciliation Preview Results */}
          {validationPreview && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Status Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center border',
                      validationPreview.can_commit
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    )}
                  >
                    {validationPreview.can_commit ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span>{validationPreview.can_commit ? 'Payload Validation Passed' : 'Validation Failed — Issues Detected'}</span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                          validationPreview.can_commit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        )}
                      >
                        {validationPreview.status}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      Contract: {validationPreview.exchange_type} (v{validationPreview.schema_version}) • Hash:{' '}
                      {validationPreview.payload_hash?.slice(0, 16)}...
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCommitImport}
                    disabled={!validationPreview.can_commit || isCommitting}
                    className={cn(
                      'inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-xl',
                      !validationPreview.can_commit || isCommitting
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    )}
                  >
                    {isCommitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing Transactional Commit...</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        <span>Commit to Database</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 4-Tier Financial Reconciliation Grid */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Deep Accounting Reconciliation & Quantities</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Total Vouchers</span>
                    <div className="text-base font-mono font-bold text-white mt-1">
                      {validationPreview.summary.total_records}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Total Lines</span>
                    <div className="text-base font-mono font-bold text-white mt-1">
                      {validationPreview.summary.total_line_items}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Total Quantity</span>
                    <div className="text-base font-mono font-bold text-white mt-1">
                      {validationPreview.summary.total_quantity.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Reconciled Value</span>
                    <div className="text-base font-mono font-bold text-emerald-400 mt-1">
                      ₹{validationPreview.summary.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Conflicts / Dups</span>
                    <div
                      className={cn(
                        'text-base font-mono font-bold mt-1',
                        validationPreview.summary.conflict_records > 0 ? 'text-amber-400' : 'text-slate-400'
                      )}
                    >
                      {validationPreview.summary.conflict_records}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Errors</span>
                    <div
                      className={cn(
                        'text-base font-mono font-bold mt-1',
                        validationPreview.summary.errors_count > 0 ? 'text-rose-400' : 'text-emerald-400'
                      )}
                    >
                      {validationPreview.summary.errors_count}
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors List */}
              {validationPreview.errors && validationPreview.errors.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Blocking Errors ({validationPreview.errors.length})</span>
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {validationPreview.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs flex items-start gap-3"
                      >
                        <span className="px-2 py-0.5 bg-rose-900/60 text-rose-300 font-mono text-[10px] rounded font-bold">
                          {err.code}
                        </span>
                        <div className="flex-1">
                          <p className="text-rose-200 font-medium">{err.message}</p>
                          <span className="text-[11px] text-rose-400 font-mono">Path: {err.path}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ambiguous Mappings (Zero-Silent-Fuzzy-Matching Rule) */}
              {validationPreview.ambiguous_mappings && validationPreview.ambiguous_mappings.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Ambiguous Entity Matches — Manager Selection Required</span>
                  </h4>
                  <div className="space-y-2">
                    {validationPreview.ambiguous_mappings.map((amb, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-amber-300 font-bold">
                            External {amb.entity_type}: &ldquo;{amb.external_identifier}&rdquo;
                          </strong>
                          <span className="px-2 py-0.5 bg-amber-900/40 text-amber-300 rounded font-mono text-[10px]">
                            Confidence: {Math.round(amb.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{amb.problem}</p>
                        <div className="pt-2 border-t border-amber-900/40 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Candidates:</span>
                          {amb.candidates.map((c, cIdx) => (
                            <div
                              key={cIdx}
                              className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800 text-[11px]"
                            >
                              <span className="text-white font-medium">
                                {c.internal_name} ({c.internal_id})
                              </span>
                              <span className="text-amber-400 font-mono font-bold">
                                {Math.round(c.similarity * 100)}% match
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: EXPORT ENGINE ────────────────────────────────────── */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" />
                <span>Contract-Validated Export Engine</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generates canonical exchange packages verified against the active schema before export.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleGenerateExport}
                  disabled={isExporting}
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-lg',
                    isExporting
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                  )}
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating & Validating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Generate Export Package</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {exportError && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                <strong>Export Error:</strong> {exportError}
              </div>
            )}

            {exportResult && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Export Generated & Contract-Validated</span>
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      Batch: {exportResult.batch_id} • SHA-256: {exportResult.export_payload?.payload_hash?.slice(0, 16)}...
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(exportResult.export_payload, null, 2)], {
                          type: 'application/json',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `export_${selectedExchangeType}_${exportResult.batch_id}.json`;
                        a.click();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download JSON</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Records</span>
                    <div className="text-base font-bold text-white mt-1">
                      {exportResult.export_payload?.records?.length || 0}
                    </div>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Total Gross Value</span>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      ₹{Number(exportResult.export_payload?.total_amount || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: MAPPING REGISTRY ─────────────────────────────────── */}
      {activeTab === 'mappings' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Central Entity Mapping Registry</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auditable external-to-internal entity mappings adhering strictly to the Zero Silent Fuzzy-Matching rule.
                </p>
              </div>

              <button
                onClick={fetchMappings}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoadingMappings && 'animate-spin')} />
                <span>Refresh Mappings</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  placeholder="Search by external name, ID, or internal entity..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Type:</span>
                <select
                  value={mappingFilterType}
                  onChange={(e) => setMappingFilterType(e.target.value)}
                  className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  <option value="ALL">All Entities</option>
                  <option value="CUSTOMER">Customers</option>
                  <option value="PRODUCT_SKU">Product SKUs</option>
                  <option value="SUPPLIER">Suppliers</option>
                  <option value="SALESMAN">Salesmen</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">System</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">External Identifier</th>
                    <th className="p-3">External Name</th>
                    <th className="p-3">Internal Mapping</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {filteredMappings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 font-sans">
                        No mappings found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMappings.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 text-slate-300 font-bold">{m.external_system}</td>
                        <td className="p-3 text-indigo-400">{m.entity_type}</td>
                        <td className="p-3 text-white font-bold">{m.external_id}</td>
                        <td className="p-3 text-slate-300 font-sans">{m.external_name}</td>
                        <td className="p-3 text-emerald-400 font-sans">
                          {m.internal_entity_name} ({m.internal_entity_id})
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {m.mapping_status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{Math.round(m.confidence * 100)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: EXCHANGE LEDGER / HISTORY ─────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Cryptographic Exchange Ledger</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Permanent, auditable history of all batch executions with SHA-256 receipts.
                </p>
              </div>

              <button
                onClick={fetchBatches}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoadingBatches && 'animate-spin')} />
                <span>Refresh History</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">Direction</th>
                    <th className="p-3">Contract</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Records</th>
                    <th className="p-3">Total Value</th>
                    <th className="p-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 font-sans">
                        No batch executions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 text-white font-bold">{b.id}</td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold',
                              b.direction === 'IMPORT' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-sky-500/20 text-sky-300'
                            )}
                          >
                            {b.direction}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{b.exchange_type}</td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold',
                              b.status === 'COMMITTED' || b.status === 'EXPORTED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            )}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-200">{b.record_count}</td>
                        <td className="p-3 text-emerald-400">
                          ₹{Number(b.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px] font-sans">
                          {new Date(b.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: PROTOCOL HEALTH / OVERVIEW ────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Canonical Exchange Model</h3>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">100% DECOUPLED</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Neither Supabase PostgreSQL schemas nor external Tally XML structures dictate the internal model. The canonical protocol acts as an immutable boundary.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Zero Silent Fuzzy-Matching</h3>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">STRICT ENFORCEMENT</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unresolved or ambiguous products/parties are quarantined for explicit manager review. Guesses and silent entity auto-creations are strictly blocked.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Multi-Level Idempotency</h3>
                <span className="text-[11px] text-amber-400 font-mono font-bold">CRYPTOGRAPHIC HASHS</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              SHA-256 batch payload fingerprints and document-level primary key deduplication guarantee that network timeouts and repeated uploads never duplicate data.
            </p>
          </div>
        </div>
      )}

      {/* ── Dynamic Accountant Specification Modal ──────────────────── */}
      {showSpecModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span>Accountant Specification & Blank Template</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Directly derived from active contract definition ({selectedExchangeType}).
                </p>
              </div>
              <button
                onClick={() => setShowSpecModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {blankTemplate && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <strong className="text-indigo-400 uppercase font-bold text-[11px]">
                      Blank Template (Valid by Definition)
                    </strong>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(blankTemplate, null, 2), 'template')}
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer font-bold"
                    >
                      {copiedKey === 'template' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'template' ? 'Copied!' : 'Copy Blank Template'}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(blankTemplate, null, 2)}
                  </pre>
                </div>
              )}

              {accountantSpec && (
                <div className="space-y-4">
                  <strong className="text-indigo-400 uppercase font-bold text-[11px] block">
                    Contract Field Specifications & Semantics
                  </strong>

                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Field</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Semantic Meaning</th>
                          <th className="p-2.5">Required</th>
                          <th className="p-2.5">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {accountantSpec.record_fields?.map((rf: any) => (
                          <tr key={rf.name} className="hover:bg-slate-800/40">
                            <td className="p-2.5 font-mono text-white font-bold">{rf.name}</td>
                            <td className="p-2.5 font-mono text-indigo-400">{rf.type}</td>
                            <td className="p-2.5 font-mono text-emerald-400">{rf.semantic_meaning || rf.name}</td>
                            <td className="p-2.5">
                              {rf.required ? (
                                <span className="text-rose-400 font-bold">YES</span>
                              ) : (
                                <span className="text-slate-500">OPT</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-300">{rf.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowSpecModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
