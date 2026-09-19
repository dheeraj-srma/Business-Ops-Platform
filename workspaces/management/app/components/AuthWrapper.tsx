'use client';
import React, { useState, useEffect } from 'react';
import { Boxes, UserCheck, Store, LogOut } from 'lucide-react';
import SalesmanPortalUI from './SalesmanPortalUI';

interface AuthWrapperProps {
  children: React.ReactNode;
  SidebarComponent: React.ReactNode;
  HeaderComponent: React.ReactNode;
}

export default function AuthWrapper({ children, SidebarComponent, HeaderComponent }: AuthWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'Admin' | 'Salesman' | 'Customer'>('Admin');
  const [loginName, setLoginName] = useState('');

  useEffect(() => {
    setMounted(true);
    const auth = localStorage.getItem('app_auth');
    const role = localStorage.getItem('app_role') as any;
    const name = localStorage.getItem('app_salesman');

    if (auth === 'true') {
      setAuthenticated(true);
      if (role) setUserRole(role);
      if (name) setLoginName(name);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName && userRole !== 'Admin') return;
    
    setAuthenticated(true);
    localStorage.setItem('app_auth', 'true');
    localStorage.setItem('app_role', userRole);
    localStorage.setItem('app_salesman', loginName || 'Admin');
  };

  const handleLogout = () => {
    setAuthenticated(false);
    localStorage.removeItem('app_auth');
    localStorage.removeItem('app_role');
    localStorage.removeItem('app_salesman');
  };

  if (!mounted) return null; // Hydration safety

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-50 dark:bg-indigo-950/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
              <Boxes className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-wider">NALKA METALS</h1>
            <p className="text-xs text-slate-400">Admin Centre & Order Terminal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setUserRole('Admin')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl border text-[11px] font-semibold transition-all ${
                    userRole === 'Admin'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => setUserRole('Salesman')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl border text-[11px] font-semibold transition-all ${
                    userRole === 'Salesman'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Salesman
                </button>
                <button
                  type="button"
                  onClick={() => setUserRole('Customer')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl border text-[11px] font-semibold transition-all ${
                    userRole === 'Customer'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Customer
                </button>
              </div>
            </div>

            {userRole !== 'Admin' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Profile Name
                </label>
                <select
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-600 dark:border-indigo-500 text-xs"
                >
                  <option value="">-- Choose Profile --</option>
                  <option value="Ajay Mishra">Ajay Mishra</option>
                  <option value="Rahul Sharma">Rahul Sharma</option>
                  <option value="Vikram Singh">Vikram Singh</option>
                  <option value="Guest Customer">Guest Customer</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 rotate-180" />
              Log In to {userRole === 'Admin' ? 'Admin Centre' : 'Portal'}
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-500">
            Nalka Metals Operational Core
          </p>
        </div>
      </div>
    );
  }

  if (userRole === 'Salesman' || userRole === 'Customer') {
    // Strictly isolate the salesman to the order portal
    return <SalesmanPortalUI userRole={userRole} loginSalesman={loginName} onLogout={handleLogout} />;
  }

  // Admin sees the full shell
  return (
    <div className="app-shell">
      {SidebarComponent}
      <div className="main-area">
        {HeaderComponent}
        <main className="page-content fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
