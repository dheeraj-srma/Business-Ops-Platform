import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Server,
  FileSpreadsheet,
  Lock,
  AlertTriangle,
  HelpCircle,
  Code,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Terminal,
  FileCode,
  Database,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type HelpSection =
  | 'overview'
  | 'connection'
  | 'export'
  | 'reservations'
  | 'troubleshooting'
  | 'diagnostics'
  | 'tdl-snippets'
  | 'faq';

export const HelpManualView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<HelpSection>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Diagnostic wizard state
  const [diagStep, setDiagStep] = useState<number>(0);
  const [diagIssue, setDiagIssue] = useState<string | null>(null);
  const [diagTallyRunning, setDiagTallyRunning] = useState<boolean | null>(null);
  const [diagPortOpen, setDiagPortOpen] = useState<boolean | null>(null);
  const [diagCompanyMatched, setDiagCompanyMatched] = useState<boolean | null>(null);

  // FAQ open states
  const [openFaqIndices, setOpenFaqIndices] = useState<number[]>([0]);

  const toggleFaq = (index: number) => {
    setOpenFaqIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const copyCode = (key: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const resetDiagnostic = () => {
    setDiagStep(0);
    setDiagIssue(null);
    setDiagTallyRunning(null);
    setDiagPortOpen(null);
    setDiagCompanyMatched(null);
  };

  // Filter sections or highlight if search is used
  const sectionsList = [
    { id: 'overview', title: 'System Overview & Architecture', icon: BookOpen, badge: 'Guide' },
    { id: 'connection', title: 'Tally & TallyPrime Connection Setup', icon: Server, badge: 'Core' },
    { id: 'export', title: 'Data Export & XML/JSON Formats', icon: FileSpreadsheet, badge: 'Masters & Vouchers' },
    { id: 'reservations', title: 'Stock Reservations & Formulas', icon: Lock, badge: 'ACID Logic' },
    { id: 'troubleshooting', title: 'Troubleshooting & Error Matrix', icon: AlertTriangle, badge: 'Error Codes' },
    { id: 'diagnostics', title: 'Interactive Diagnostic Wizard', icon: Sparkles, badge: 'Interactive' },
    { id: 'tdl-snippets', title: 'TDL Scripts & Payload Templates', icon: FileCode, badge: 'Code Snippets' },
    { id: 'faq', title: 'Frequently Asked Questions', icon: HelpCircle, badge: 'FAQ' },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6 shadow-2xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center font-bold shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                  <span>Help & Integration Documentation Center</span>
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60 rounded-full">
                    v2026 Manual
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Comprehensive manuals for TallyPrime gateway configuration, XML/JSON voucher exports, live webhooks, stock reservation rules, and error diagnosis.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help topics, error codes..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Nav Tabs */}
        <div className="lg:col-span-1 space-y-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-2xs h-fit transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1.5 block">
            Navigation Topics
          </span>
          {sectionsList.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as HelpSection)}
                className={cn(
                  'w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer group',
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-700/50 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    )}
                  />
                  <span className="truncate">{item.title}</span>
                </div>
                <ChevronRight
                  className={cn(
                    'w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity',
                    isActive && 'opacity-100 text-indigo-600 dark:text-indigo-400'
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* SECTION 1: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xs space-y-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  System Architecture & Integration Overview
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How StockMaster bridges day-to-day warehouse operations with Tally / TallyPrime accounting books.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <Database className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">1. StockMaster Engine</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Tracks real-time stock-in receipts, dispatches, audits, and maintains Available vs Reserved inventory formulas.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">2. Bi-Directional Bridge</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Operates via HTTP XML/JSON ODBC port (9000) or real-time Webhook pushes, protected with SHA-256 idempotency.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Server className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">3. TallyPrime Masters</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Acts as the financial single-source-of-truth for GST ledgers, balance sheets, profit & loss, and audit trails.
                  </p>
                </div>
              </div>

              {/* Data Flow Diagram Card */}
              <div className="p-5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                  Data Flow Matrix
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-slate-700">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400 block mb-1">
                      From StockMaster &rarr; To Tally:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <li>Stock Item Masters creation with HSN, GST, & UOM</li>
                      <li>Physical Stock Inward receipts (Purchase vouchers)</li>
                      <li>Stock Outward dispatches (Delivery / Sales)</li>
                      <li>Inventory adjustments & Stock Journal reconciliations</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-slate-700">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                      From Tally &rarr; To StockMaster:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <li>Sales Orders creating active Stock Reservations</li>
                      <li>Sales Invoices fulfilling reservations & deducting stock</li>
                      <li>Purchase Invoices updating physical stock counts</li>
                      <li>Credit Notes / Sales Returns restoring inventory</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: CONNECTION SETUP */}
          {activeSection === 'connection' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xs space-y-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Step-by-Step Tally & TallyPrime Connection Guide
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How to configure TallyPrime to accept HTTP/ODBC connections and transmit live events.
                </p>
              </div>

              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Enable ODBC / HTTP Server in TallyPrime
                  </h3>
                </div>
                <div className="pl-9 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <p>In TallyPrime on your host machine:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-2 font-medium">
                    <li>
                      Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono text-[11px]">F12 (Configure)</kbd> from Gateway of Tally.
                    </li>
                    <li>
                      Navigate to <strong>Advanced Configuration</strong> &rarr; <strong>Tally.Server / ODBC Configuration</strong>.
                    </li>
                    <li>
                      Set <strong>TallyPrime acts as:</strong> to <code className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">Both</code> or <code className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">Server</code>.
                    </li>
                    <li>
                      Set <strong>Enable ODBC Server:</strong> to <code className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">Yes</code>.
                    </li>
                    <li>
                      Set <strong>Port:</strong> to <code className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">9000</code> (or your chosen port).
                    </li>
                    <li>
                      Restart TallyPrime for changes to take effect.
                    </li>
                  </ol>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Verify Network & Firewall Accessibility
                  </h3>
                </div>
                <div className="pl-9 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <p>
                    If running StockMaster on a different device on your local network:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Add an inbound rule in Windows Firewall for TCP Port 9000.</li>
                    <li>Ensure both the Tally machine and the application machine can reach each other via ping.</li>
                    <li>Set the Server URL in StockMaster to <code className="font-mono text-indigo-600 dark:text-indigo-400">http://&lt;TALLY-IP-ADDRESS&gt;:9000</code>.</li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Test Live Connection from StockMaster
                  </h3>
                </div>
                <div className="pl-9 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <p>
                    Go to <strong>Tally Live Sync &rarr; Connection & Health</strong> and click <strong>Test Connection</strong>.
                    You should receive a green ping verification with latency response under 50ms.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: EXPORT & XML/JSON FORMATS */}
          {activeSection === 'export' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xs space-y-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Data Export & Tally XML Envelope Guidelines
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How StockMaster formats stock items, categories, and vouchers for 100% compliant Tally ingestion.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Supported Export Packages
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400 block mb-1">
                      1. Master Records Export
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                      Exports Stock Items, Stock Groups (Categories), Units of Measure (UOM), and Initial Opening Balances formatted in <code>&lt;ENVELOPE&gt;&lt;BODY&gt;&lt;IMPORTDATA&gt;&lt;REQUESTDATA&gt;&lt;TALLYMESSAGE&gt;&lt;STOCKITEM&gt;</code>.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                      2. Transaction & Voucher Export
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                      Exports Stock Inward, Outward Dispatches, and Physical Reconciliations formatted as standard <code>&lt;VOUCHER VCHTYPE="Stock Journal"&gt;</code> with Source and Destination inventory lists.
                    </p>
                  </div>
                </div>
              </div>

              {/* How to import into Tally */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <h4 className="font-bold text-slate-900 dark:text-slate-100">
                  How to Import Exported XML Files into Tally:
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>Download the XML file from <strong>Tally Export</strong> in StockMaster.</li>
                  <li>In TallyPrime, go to <strong>Gateway of Tally &rarr; Import Data &rarr; Masters / Transactions</strong>.</li>
                  <li>Specify the path of the downloaded <code>.xml</code> file.</li>
                  <li>Select <strong>Treatment of duplicate entries</strong> (e.g. <em>Modify with new data</em> or <em>Combine opening balances</em>).</li>
                  <li>Press <strong>Enter</strong> to complete the import. Tally will create all records automatically.</li>
                </ol>
              </div>
            </div>
          )}

          {/* SECTION 4: STOCK RESERVATIONS */}
          {activeSection === 'reservations' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xs space-y-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Stock Reservations & Inventory Accounting Formula
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How non-physical reservations prevent overselling between sales orders and physical dispatches.
                </p>
              </div>

              {/* Formula Callout */}
              <div className="p-5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-center space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Core Allocation Equation
                </span>
                <div className="text-lg sm:text-2xl font-mono font-bold text-indigo-950 dark:text-indigo-100">
                  Available Stock = Physical Stock &minus; Reserved Stock
                </div>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 max-w-xl mx-auto">
                  Physical stock represents what is currently resting on warehouse shelves. Reserved stock represents units committed to confirmed customer orders pending dispatch.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Lifecycle of an Order Reservation:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="text-amber-600 dark:text-amber-400 font-bold mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>1. Order Placed</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Tally Sales Order is received. StockMaster locks the required quantity in Reservations. Available stock reduces immediately.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="text-indigo-600 dark:text-indigo-400 font-bold mb-1 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>2. Invoiced / Dispatched</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Sales Invoice or Delivery Note arrives. StockMaster marks reservation as <code>FULFILLED</code> and executes <code>STOCK_OUT</code>.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>3. Complete Reconciliation</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Reserved stock drops to 0, Physical stock is decremented, and Available stock reflects the uncommitted balance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Restock & Reorder Calculation Logic */}
              <div className="p-5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <h4 className="text-xs font-bold text-amber-950 dark:text-amber-100 uppercase tracking-wider">
                    Restock & Reorder Quantity Formulation (Safety Buffers & Deficit Mitigation)
                  </h4>
                </div>
                <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                  The automated Restock Planner calculates suggested purchase orders and production lots using four key factors:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-900/40 space-y-1">
                    <span className="font-bold text-slate-900 dark:text-slate-100">1. Target Buffer Level:</span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                      Target = max(Min_Stock × Multiplier, Min_Stock + 5)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Ensures floor stock does not drop below safe operating thresholds under fluctuating lead times.
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-900/40 space-y-1">
                    <span className="font-bold text-slate-900 dark:text-slate-100">2. Deficit & Reorder Equation:</span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                      Q_reorder = Target_Stock &minus; Available_Stock
                    </p>
                    <p className="text-[11px] text-slate-500">
                      For <strong>Negative Stock</strong> (e.g. -12 on shelf, Target 30), Q = 30 &minus; (-12) = <strong>42 units</strong> (12 to neutralize deficit + 30 buffer).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: TROUBLESHOOTING & ERROR MATRIX */}
          {activeSection === 'troubleshooting' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xs space-y-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Troubleshooting Guide & Error Matrix
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Common error codes, root causes, and exact step-by-step resolution actions.
                </p>
              </div>

              <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-700">
                {/* Error 1001 */}
                <div className="pt-3 first:pt-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-bold rounded border border-rose-200 dark:border-rose-800">
                      ERR_TALLY_1001
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Connection Refused (ECONNREFUSED / Port 9000)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-1">
                    <strong>Cause:</strong> TallyPrime is either not running, ODBC/HTTP Server is disabled in F12, or the port is blocked by Windows Firewall.
                    <br />
                    <strong>Fix:</strong> Open TallyPrime &rarr; Press F12 &rarr; Advanced Configuration &rarr; Enable ODBC Server: Yes &rarr; Port 9000 &rarr; Restart Tally.
                  </p>
                </div>

                {/* Error 1002 */}
                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold rounded border border-amber-200 dark:border-amber-800">
                      ERR_TALLY_1002
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Company Name Mismatch / Company Not Loaded
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-1">
                    <strong>Cause:</strong> The company name configured in StockMaster does not match the active company open in TallyPrime.
                    <br />
                    <strong>Fix:</strong> In StockMaster, go to <strong>Tally Live Sync &rarr; Connection</strong> and edit the Company Name to match the exact title bar in TallyPrime.
                  </p>
                </div>

                {/* Error 1003 */}
                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold rounded border border-amber-200 dark:border-amber-800">
                      ERR_TALLY_1003
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Unmapped Stock Item / Unrecognized Voucher Item
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-1">
                    <strong>Cause:</strong> An incoming voucher contains a product name that has not been mapped to an internal SKU.
                    <br />
                    <strong>Fix:</strong> Go to <strong>Tally Live Sync &rarr; Product Mappings</strong> and click <strong>Auto-Map Unmapped</strong> or manually add the mapping rule, then retry the failed event from the Ledger.
                  </p>
                </div>

                {/* Error 1004 */}
                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-bold rounded border border-blue-200 dark:border-blue-800">
                      ERR_TALLY_1004
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Idempotency Duplicate Voucher Detected
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-1">
                    <strong>Cause:</strong> The exact same voucher was transmitted twice with identical SHA-256 payload hash.
                    <br />
                    <strong>Fix:</strong> This is a normal safety mechanism. StockMaster ignores duplicate transmissions to prevent double-counting stock.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: INTERACTIVE DIAGNOSTIC WIZARD */}
          {activeSection === 'diagnostics' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xs space-y-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>Interactive Troubleshooting Diagnostics Wizard</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Answer a few quick questions to diagnose connection or sync issues and get immediate fix instructions.
                  </p>
                </div>
                {diagStep > 0 && (
                  <button
                    onClick={resetDiagnostic}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restart Wizard</span>
                  </button>
                )}
              </div>

              {diagStep === 0 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    What issue are you experiencing?
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setDiagIssue('connection');
                        setDiagStep(1);
                      }}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-all cursor-pointer group"
                    >
                      <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2" />
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Cannot Connect to Tally
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Test Connection fails with Connection Refused or Timeout.
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setDiagIssue('sync');
                        setDiagStep(1);
                      }}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-all cursor-pointer group"
                    >
                      <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Vouchers Not Syncing
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Events appear in Failed state or stock counts do not update.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Wizard Step 1: Connection */}
              {diagStep === 1 && diagIssue === 'connection' && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Step 1: Is TallyPrime currently running on your host machine?
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setDiagTallyRunning(true);
                        setDiagStep(2);
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Yes, TallyPrime is open
                    </button>
                    <button
                      onClick={() => {
                        setDiagTallyRunning(false);
                        setDiagStep(99);
                      }}
                      className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      No, it is closed
                    </button>
                  </div>
                </div>
              )}

              {/* Wizard Step 2: Connection */}
              {diagStep === 2 && diagIssue === 'connection' && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Step 2: Is ODBC Server enabled on Port 9000 in Tally F12 settings?
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setDiagPortOpen(true);
                        setDiagStep(3);
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Yes, ODBC is enabled
                    </button>
                    <button
                      onClick={() => {
                        setDiagPortOpen(false);
                        setDiagStep(98);
                      }}
                      className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Not sure / Not enabled
                    </button>
                  </div>
                </div>
              )}

              {/* Wizard Step 3: Result */}
              {diagStep === 3 && diagIssue === 'connection' && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Configuration Looks Good</span>
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Check if your antivirus or Windows Firewall is blocking inbound connections on TCP Port 9000.
                    You can test with the command: <code className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded">curl http://localhost:9000</code>.
                  </p>
                </div>
              )}

              {/* Wizard Diagnosis Exit: Closed Tally */}
              {diagStep === 99 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>Action Required: Launch TallyPrime</span>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Tally acts as the live server. Launch TallyPrime, load your target company, and keep it active in the background.
                  </p>
                </div>
              )}

              {/* Wizard Diagnosis Exit: Enable ODBC */}
              {diagStep === 98 && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200 text-sm">
                    <Server className="w-5 h-5 text-indigo-600" />
                    <span>Action Required: Enable ODBC Server</span>
                  </div>
                  <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                    In TallyPrime, press F12 &rarr; Advanced Configuration &rarr; Set "Enable ODBC Server" to Yes &rarr; Set Port to 9000 &rarr; Restart Tally.
                  </p>
                </div>
              )}

              {/* Sync issue branch */}
              {diagStep === 1 && diagIssue === 'sync' && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Are the items in your vouchers mapped to StockMaster products?
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDiagStep(97)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Run 1-Click Auto-Mapper
                    </button>
                  </div>
                </div>
              )}

              {diagStep === 97 && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200 text-sm">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <span>Navigate to Product Mapping Center</span>
                  </div>
                  <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                    Go to <strong>Tally Live Sync &rarr; Product Mappings</strong> and click <strong>Auto-Map Unmapped</strong>.
                    StockMaster will match names and SKU part numbers automatically.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SECTION 7: TDL SNIPPETS */}
          {activeSection === 'tdl-snippets' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xs space-y-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Ready-to-Use TDL Scripts & Payload Envelopes
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Copy and paste into TallyPrime Developer or your local integration scripts.
                </p>
              </div>

              {/* TDL Hook Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>1. TDL Webhook Trigger Script (Save as StockMasterHook.tdl)</span>
                  </h3>
                  <button
                    onClick={() =>
                      copyCode(
                        'tdl-hook',
                        `[#Form: Voucher]
  On: Accept: Yes: Call: StockMaster_PushWebhook

[Function: StockMaster_PushWebhook]
  00 : HTTP Post: "http://localhost:3000/api/tally/sync/webhook" : $$ExportVoucherAsJSON : "application/json"
  10 : MsgBox: "StockMaster Sync" : "Voucher synchronized with real-time inventory engine."
`
                      )
                    }
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'tdl-hook' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'tdl-hook' ? 'Copied' : 'Copy TDL'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`[#Form: Voucher]
  On: Accept: Yes: Call: StockMaster_PushWebhook

[Function: StockMaster_PushWebhook]
  00 : HTTP Post: "http://localhost:3000/api/tally/sync/webhook" : $$ExportVoucherAsJSON : "application/json"
  10 : MsgBox: "StockMaster Sync" : "Voucher synchronized with real-time inventory engine."`}
                </pre>
              </div>

              {/* Sample XML Request Envelope */}
              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>2. Sample Tally XML Master Item Payload</span>
                  </h3>
                  <button
                    onClick={() =>
                      copyCode(
                        'xml-sample',
                        `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Hex Bolt SS-304 M8x40" ACTION="Create">
            <NAME>Hex Bolt SS-304 M8x40</NAME>
            <PARENT>Hardware &amp; Fasteners</PARENT>
            <BASEUNITS>Nos</BASEUNITS>
            <OPENINGBALANCE>150.00 Nos</OPENINGBALANCE>
            <OPENINGVALUE>-6750.00</OPENINGVALUE>
            <OPENINGRATE>45.00/Nos</OPENINGRATE>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
                      )
                    }
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'xml-sample' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'xml-sample' ? 'Copied' : 'Copy XML'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Hex Bolt SS-304 M8x40" ACTION="Create">
            <NAME>Hex Bolt SS-304 M8x40</NAME>
            <PARENT>Hardware &amp; Fasteners</PARENT>
            <BASEUNITS>Nos</BASEUNITS>
            <OPENINGBALANCE>150.00 Nos</OPENINGBALANCE>
            <OPENINGVALUE>-6750.00</OPENINGVALUE>
            <OPENINGRATE>45.00/Nos</OPENINGRATE>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`}
                </pre>
              </div>
            </div>
          )}

          {/* SECTION 8: FAQ */}
          {activeSection === 'faq' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xs space-y-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Frequently Asked Questions (FAQ)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Practical answers to operational questions regarding inventory and accounting workflows.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    q: 'Can StockMaster work with both Tally ERP 9 and TallyPrime?',
                    a: 'Yes. Both Tally ERP 9 and TallyPrime share the standard XML envelope schema and ODBC Port 9000 server protocol. StockMaster exports are 100% backwards compatible.',
                  },
                  {
                    q: 'What happens if internet or local LAN goes down during transactions?',
                    a: 'StockMaster stores all operational transactions locally in its persistent database. Once connection to Tally is re-established, the background sync engine pushes pending vouchers with automatic idempotency deduplication.',
                  },
                  {
                    q: 'How are stock returns and customer credit notes handled?',
                    a: 'When a Credit Note or Sales Return voucher is synced from Tally, StockMaster automatically restores the returned quantity back into physical stock inventory and logs a traceable audit transaction record.',
                  },
                  {
                    q: 'Can managers manually release or override locked stock reservations?',
                    a: 'Yes. In the Tally Live Sync dashboard under "Stock Reservations", managers have a 1-click "Release" button to unlock committed units if a customer order is cancelled or postponed.',
                  },
                  {
                    q: 'Does StockMaster alter existing financial ledgers in Tally?',
                    a: 'No. StockMaster only interacts with Inventory vouchers (Stock Journals, Inward Receipts, Outward Issues) and Stock Item Masters. It does not overwrite your chart of accounts or banking ledgers.',
                  },
                ].map((faq, index) => {
                  const isOpen = openFaqIndices.includes(index);
                  return (
                    <div
                      key={index}
                      className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFaq(index)}
                        className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform shrink-0',
                            isOpen && 'rotate-180 text-indigo-600 dark:text-indigo-400'
                          )}
                        />
                      </button>
                      {isOpen && (
                        <div className="p-4 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 leading-relaxed border-t border-slate-100 dark:border-slate-700">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
