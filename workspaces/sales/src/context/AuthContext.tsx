import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile } from '../types';
import { getAuthSession, clearAuthSession } from '@/shared/auth';
import type { AuthStatus } from '@/shared/auth';

/**
 * Sales workspace authentication context.
 *
 * SECURITY: This context does NOT provide login functionality.
 * Authentication is handled exclusively by the canonical /login page.
 * This context reads auth state from the shared cookie-based auth system (getAuthSession).
 *
 * CRITICAL RULES:
 * - NEVER create/invent/fallback to a default user identity.
 * - NEVER use localStorage as an auth source.
 * - NEVER use Supabase sessions as an auth source.
 * - If no valid cookie session exists, the user is UNAUTHENTICATED. Period.
 * - authStatus must be 'loading' → 'authenticated' | 'unauthenticated'. Never skip to render.
 */

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Synchronize state from canonical platform cookie session.
   * Returns true if a valid session was found, false otherwise.
   * NEVER returns a fallback user. NEVER invents identity.
   */
  const syncPlatformAuth = useCallback((): boolean => {
    try {
      const platformSession = getAuthSession();
      if (platformSession && platformSession.user && platformSession.user.role) {
        const u = platformSession.user;
        const validRoles = ['admin', 'accountant', 'stock_manager', 'salesman', 'viewer'];
        const userRole = (u.role || '').toLowerCase();
        if (!validRoles.includes(userRole)) {
          return false;
        }

        const p: UserProfile = {
          id: u.id,
          email: u.email,
          role: userRole as any,
          salesman_id: u.salesman_id,
          salesman_name: u.full_name || u.email,
          is_active: u.is_active ?? true,
        };

        const synthUser: any = {
          id: u.id,
          email: u.email,
          aud: 'authenticated',
          role: userRole,
          user_metadata: {
            salesman_id: u.salesman_id,
            salesman_name: u.full_name || u.email,
            role: userRole,
          },
        };

        setUser(synthUser);
        setProfile(p);
        setAuthStatus('authenticated');
        setLoading(false);
        return true;
      }
    } catch (e) {
      console.warn('Failed syncing platform auth session:', e);
    }
    return false;
  }, []);

  // Clean up legacy localStorage auth keys on mount — these must NEVER be used as auth sources
  useEffect(() => {
    try {
      localStorage.removeItem('app_auth');
      localStorage.removeItem('app_role');
      localStorage.removeItem('app_salesman');
      localStorage.removeItem('nalka_terminal_session');
      localStorage.removeItem('nalka_access_token');
      localStorage.removeItem('nalka_auth_token');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Auth initialization: check canonical cookie session ONLY
    const hasPlatformSession = syncPlatformAuth();
    if (!hasPlatformSession) {
      // No valid session → UNAUTHENTICATED. FAIL CLOSED.
      // Do NOT try Supabase. Do NOT try localStorage. Do NOT create a default user.
      setUser(null);
      setProfile(null);
      setAuthStatus('unauthenticated');
      setLoading(false);
    }

    // Event listeners for platform auth state changes (logout, workspace switch)
    const handleAuthChange = () => {
      const stillValid = syncPlatformAuth();
      if (!stillValid) {
        setUser(null);
        setProfile(null);
        setAuthStatus('unauthenticated');
        setLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nalka_auth_change', handleAuthChange);
      window.addEventListener('storage', handleAuthChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('nalka_auth_change', handleAuthChange);
        window.removeEventListener('storage', handleAuthChange);
      }
    };
  }, [syncPlatformAuth]);

  const refreshProfile = async () => {
    syncPlatformAuth();
  };

  const signOut = async () => {
    try {
      // 1. Clear all server + client auth state
      await clearAuthSession();
    } catch (e) {
      console.warn('Sign out error:', e);
    } finally {
      // 2. Clear React state
      setUser(null);
      setProfile(null);
      setAuthStatus('unauthenticated');
      setError(null);
      setLoading(false);

      // 3. Navigate to login — full page load to ensure clean state
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const isAuthenticated = authStatus === 'authenticated' && !!profile;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated,
        authStatus,
        loading,
        error,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
