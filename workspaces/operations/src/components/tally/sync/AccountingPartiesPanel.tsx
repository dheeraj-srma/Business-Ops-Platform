import React, { useState } from 'react';
import {
  Users,
  Briefcase,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
  Phone,
  Mail,
} from 'lucide-react';
import { TallyLedger, TallyParty } from '../../../types';
import { api } from '../../../lib/api';

interface AccountingPartiesPanelProps {
  onRefresh: () => void;
}

export const AccountingPartiesPanel: React.FC<AccountingPartiesPanelProps> = ({ onRefresh }) => {
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'suppliers' | 'all'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Demo / local parties data
  const [parties, setParties] = useState<TallyParty[]>([
    {
      id: 'pty-1',
      tally_guid: 'led-godrej',
      ledger_id: 'led-1',
      party_type: 'CUSTOMER',
      name: 'Godrej Properties Ltd',
      opening_balance: 145000,
      closing_balance: 215000,
      outstanding_amount: 215000,
      balance_type: 'Dr',
      address: 'Godrej One, Pirojshanagar, Vikhroli East, Mumbai',
      state: 'Maharashtra',
      gstin: '27AABCG1234F1Z8',
      pan: 'AABCG1234F',
      phone: '+91 22 6168 8000',
      email: 'procurement@godrejproperties.com',
      credit_period_days: 30,
      total_orders_count: 14,
      total_invoiced_value: 840000,
      last_synced_at: new Date().toISOString(),
    },
    {
      id: 'pty-2',
      tally_guid: 'led-lnt',
      ledger_id: 'led-2',
      party_type: 'CUSTOMER',
      name: 'L&T Construction Infrastructure',
      opening_balance: 350000,
      closing_balance: 480000,
      outstanding_amount: 480000,
      balance_type: 'Dr',
      address: 'Mount Poonamallee Road, Manapakkam, Chennai',
      state: 'Tamil Nadu',
      gstin: '33AABCL2345K1Z9',
      pan: 'AABCL2345K',
      credit_period_days: 45,
      total_orders_count: 9,
      total_invoiced_value: 1250000,
      last_synced_at: new Date().toISOString(),
    },
    {
      id: 'pty-3',
      tally_guid: 'led-jaquar',
      ledger_id: 'led-3',
      party_type: 'SUPPLIER',
      name: 'Jaquar & Company Pvt Ltd',
      opening_balance: 85000,
      closing_balance: 142000,
      outstanding_amount: 142000,
      balance_type: 'Cr',
      address: 'Plot 306, Phase II, IMT Manesar, Gurugram',
      state: 'Haryana',
      gstin: '06AAACJ4492K1ZO',
      pan: 'AAACJ4492K',
      credit_period_days: 30,
      total_orders_count: 8,
      total_invoiced_value: 620000,
      last_synced_at: new Date().toISOString(),
    },
    {
      id: 'pty-4',
      tally_guid: 'led-astral',
      ledger_id: 'led-4',
      party_type: 'SUPPLIER',
      name: 'Astral Poly Technik Ltd',
      opening_balance: 120000,
      closing_balance: 95000,
      outstanding_amount: 95000,
      balance_type: 'Cr',
      address: '207/1, Astral House, B/h Rajpath Club, Ahmedabad',
      state: 'Gujarat',
      gstin: '24AAACA1294F1ZK',
      pan: 'AAACA1294F',
      credit_period_days: 30,
      total_orders_count: 11,
      total_invoiced_value: 780000,
      last_synced_at: new Date().toISOString(),
    },
  ]);

  const handleSyncAccounting = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await api.syncTallyAccounting();
      setSyncFeedback({ success: true, message: res.message || 'Accounting data synchronized successfully from Tally' });
      onRefresh();
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback({ success: false, message: err.message || 'Accounting sync failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  const customers = parties.filter((p) => p.party_type === 'CUSTOMER');
  const suppliers = parties.filter((p) => p.party_type === 'SUPPLIER');

  const totalReceivables = customers.reduce((sum, c) => sum + c.outstanding_amount, 0);
  const totalPayables = suppliers.reduce((sum, s) => sum + s.outstanding_amount, 0);

  const filteredParties = parties.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.gstin && p.gstin.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.state && p.state.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSubTab =
      activeSubTab === 'all' ||
      (activeSubTab === 'customers' && p.party_type === 'CUSTOMER') ||
      (activeSubTab === 'suppliers' && p.party_type === 'SUPPLIER');

    return matchesSearch && matchesSubTab;
  });

  return (
    <div className="space-y-6">
      {/* Header & Sync Trigger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Tally Accounting & Counterparty Management</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synchronize Sundry Debtors (Customers), Sundry Creditors (Suppliers), General Ledgers, and Credit Terms.
            </p>
          </div>

          <button
            onClick={handleSyncAccounting}
            disabled={isSyncing}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing Ledgers...' : 'Sync Accounting Masters'}</span>
          </button>
        </div>

        {/* Sync Feedback */}
        {syncFeedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              syncFeedback.success
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            {syncFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
        )}

        {/* Financial Balance Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Total Receivables (Debtors)</span>
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              ₹{totalReceivables.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">{customers.length} active customer accounts</div>
          </div>

          <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg border border-rose-200/50 dark:border-rose-800/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">Total Payables (Creditors)</span>
              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-1">
              ₹{totalPayables.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">{suppliers.length} active supplier accounts</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Net Working Capital Balance</span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              ₹{(totalReceivables - totalPayables).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Surplus Receivables over Payables</div>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveSubTab('customers')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'customers'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers / Debtors ({customers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('suppliers')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'suppliers'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Suppliers / Creditors ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('all')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'all'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>All Ledgers ({parties.length})</span>
        </button>
      </div>

      {/* Parties Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search counterparty name, GSTIN, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Party Name</th>
                <th className="py-3 px-4">Type / Group</th>
                <th className="py-3 px-4">GSTIN & PAN</th>
                <th className="py-3 px-4">State / Location</th>
                <th className="py-3 px-4 text-center">Credit Term</th>
                <th className="py-3 px-4 text-right">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredParties.map((p) => {
                const isCustomer = p.party_type === 'CUSTOMER';
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                      {p.address && <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.address}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isCustomer
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {isCustomer ? 'Sundry Debtor' : 'Sundry Creditor'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      <div>{p.gstin || '—'}</div>
                      <div className="text-slate-400">{p.pan || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{p.state || 'India'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                        {p.credit_period_days || 30} Days
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={isCustomer ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        ₹{p.outstanding_amount.toLocaleString('en-IN')} {p.balance_type}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
