'use client';
import React, { useState, useEffect } from 'react';
import { getAuthSession, clearAuthSession } from '@/shared/auth';

interface AuthWrapperProps {
  children: React.ReactNode;
  SidebarComponent: React.ReactNode;
  HeaderComponent: React.ReactNode;
}

/**
 * Management workspace auth wrapper.
 *
 * SECURITY: This component does NOT have its own login form.
 * Authentication is handled exclusively by the canonical /login page.
 * This component reads auth state from the shared cookie-based auth system.
 * If no valid session exists, it redirects to /login.
 *
 * NEVER fall back to a default user, test user, or localStorage-based identity.
 */
export default function AuthWrapper({ children, SidebarComponent, HeaderComponent }: AuthWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Clean up ALL legacy localStorage auth keys on mount — these are never authoritative
    try {
      localStorage.removeItem('app_auth');
      localStorage.removeItem('app_role');
      localStorage.removeItem('app_salesman');
    } catch {}

    // Check canonical cookie-based auth
    const session = getAuthSession();
    if (session && session.user) {
      setAuthenticated(true);
    } else {
      // No valid session → redirect to login. FAIL CLOSED.
      window.location.href = '/login';
    }
  }, []);

  // Listen for auth changes (logout from another tab, workspace switch, etc.)
  useEffect(() => {
    const handleAuthChange = () => {
      const session = getAuthSession();
      if (!session || !session.user) {
        setAuthenticated(false);
        window.location.href = '/login';
      }
    };

    window.addEventListener('nalka_auth_change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('nalka_auth_change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  if (!mounted || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Admin sees the full shell — role enforcement is done by middleware + RouteGuard
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
