import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  ShoppingBag,
  FileCheck,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  HelpCircle,
  Radio,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface TallySimulatorPanelProps {
  onSimulationComplete: () => void;
}

interface ScenarioConfig {
  id: string;
  title: string;
  category: 'SALES' | 'PURCHASE' | 'SYSTEM' | 'RETURNS';
  icon: React.ElementType;
  color: string;
  description: string;
  expectedOutcome: string;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'SALES_ORDER_RESERVATION',
    title: '1. Sales Order (Reserve 20 Units)',
    category: 'SALES',
    icon: ShoppingBag,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'Simulates an incoming Tally Sales Order voucher for 20 units of SS-304 Hex Bolts from buyer "Tata Projects Ltd".',
    expectedOutcome: 'Locks 20 units in Stock Reservations. Physical Stock stays constant, Available Stock decreases by 20.',
  },
  {
    id: 'SALES_INVOICE_FULFILLMENT',
    title: '2. Sales Invoice (Fulfill & Deduct Physical)',
    category: 'SALES',
    icon: FileCheck,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    description: 'Simulates an invoice dispatched against an existing order, releasing 20 reserved units and reducing Physical Stock.',
    expectedOutcome: 'Fulfills reservation, executes physical STOCK_OUT (-20 units), logs immutable transaction record.',
  },
  {
    id: 'DIRECT_SALES_INVOICE',
    title: '3. Direct Counter Sales Invoice (No Order)',
    category: 'SALES',
    icon: Zap,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Simulates a direct counter sale invoice (10 units) without an existing prior reservation.',
    expectedOutcome: 'Directly decrements Physical Stock (-10 units) and logs audit movement with Tally reference.',
  },
  {
    id: 'PURCHASE_INVOICE_RECEIPT',
    title: '4. Purchase Invoice (Receive 50 Units)',
    category: 'PURCHASE',
    icon: ArrowDownLeft,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: 'Simulates incoming inventory receipt from "Jindal Steel & Power" for 50 units of Seamless Pipes.',
    expectedOutcome: 'Increments Physical Stock (+50 units), updates unit cost average, logs STOCK_IN transaction.',
  },
  {
    id: 'DELIVERY_NOTE_PARTIAL',
    title: '5. Delivery Note (Partial Shipment)',
    category: 'SALES',
    icon: Truck,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    description: 'Simulates goods dispatch via Delivery Note (15 units out of 30 reserved).',
    expectedOutcome: 'Marks reservation as PARTIALLY_FULFILLED (15 units remaining), decrements Physical Stock by 15.',
  },
  {
    id: 'SALES_RETURN_RESTORE',
    title: '6. Sales Return / Credit Note',
    category: 'RETURNS',
    icon: ArrowUpRight,
    color: 'text-teal-600 bg-teal-50 border-teal-200',
    description: 'Simulates a customer returning 5 defective or unused units with Credit Note voucher.',
    expectedOutcome: 'Restores +5 units back into physical stock inventory with audit reason "Tally Sales Return".',
  },
  {
    id: 'UNMAPPED_ITEM_TEST',
    title: '7. Unmapped Item Voucher (Error Capture)',
    category: 'SYSTEM',
    icon: AlertCircle,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    description: 'Simulates a voucher containing an unrecognized Tally Item "Custom Turbo Flange FX-999".',
    expectedOutcome: 'Safely logs FAILED sync event in ledger without corrupting database, ready for manual mapping.',
  },
  {
    id: 'DUPLICATE_IDEMPOTENCY_TEST',
    title: '8. Duplicate Payload (Idempotency Protection)',
    category: 'SYSTEM',
    icon: ShieldCheck,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    description: 'Sends the exact same voucher payload twice with identical SHA-256 hash.',
    expectedOutcome: 'System detects existing payload hash and skips duplicate processing, guaranteeing ACID safety.',
  },
  {
    id: 'BATCH_MULTI_VOUCHER',
    title: '9. Multi-Voucher High-Volume Batch',
    category: 'SYSTEM',
    icon: Layers,
    color: 'text-violet-600 bg-violet-50 border-violet-200',
    description: 'Simulates a bulk sync batch containing 4 concurrent vouchers (Orders, Receipts, Transfers).',
    expectedOutcome: 'Sequentially processes all 4 vouchers atomically and updates dashboard metrics in real-time.',
  },
];

export const TallySimulatorPanel: React.FC<TallySimulatorPanelProps> = ({
  onSimulationComplete,
}) => {
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunScenario = async (scenario: ScenarioConfig) => {
    setRunningScenario(scenario.id);
    setLastResult(null);
    setErrorMsg(null);

    try {
      const res = await api.simulateTallyScenario(scenario.id);
      setLastResult({
        scenario: scenario.title,
        ...res,
      });
      onSimulationComplete();
    } catch (err: any) {
      setErrorMsg(`Simulation failed: ${err.message}`);
    } finally {
      setRunningScenario(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Interactive Tally Sync Simulation Workbench
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Execute live transaction simulations to test inventory reservations, receipts, dispatches, idempotency protections, and error handling in real-time.
            </p>
          </div>
        </div>

        {/* Live Simulation Feedback */}
        {lastResult && (
          <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Simulation Executed: {lastResult.scenario}</span>
            </div>
            <p className="text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed">{lastResult.message}</p>
            {lastResult.voucherId && (
              <div className="font-mono text-[11px] text-emerald-900 dark:text-emerald-200 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-3">
                <span>Voucher: <strong>{lastResult.voucherId}</strong></span>
                {lastResult.eventStatus && <span>Status: <strong>{lastResult.eventStatus}</strong></span>}
                {lastResult.actionTaken && <span>Action: <strong>{lastResult.actionTaken}</strong></span>}
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Simulation Notice</span>
              <p className="text-[11px] mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const isRunning = runningScenario === scenario.id;

          return (
            <div
              key={scenario.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className={`p-2 rounded-lg border dark:border-slate-700/60 dark:bg-slate-900/60 ${scenario.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {scenario.category}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{scenario.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{scenario.description}</p>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-700 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-slate-200 block mb-0.5">Expected Outcome:</strong>
                  {scenario.expectedOutcome}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  onClick={() => handleRunScenario(scenario)}
                  disabled={Boolean(runningScenario)}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
                  <span>{isRunning ? 'Executing...' : 'Run Simulation'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
