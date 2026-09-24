'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { setAuthSession, getAuthSession, getDefaultWorkspace, hasWorkspaceAccess, UserProfile } from '@/shared/auth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync browser autofill on mount and when browser fills credentials
  useEffect(() => {
    if (!mounted) return;

    const checkAutofill = () => {
      if (emailRef.current && emailRef.current.value && !email) {
        setEmail(emailRef.current.value);
      }
      if (passwordRef.current && passwordRef.current.value && !password) {
        setPassword(passwordRef.current.value);
      }
    };

    // Check immediately and on short delays (browsers autofill 100-500ms after mount)
    checkAutofill();
    const t1 = setTimeout(checkAutofill, 100);
    const t2 = setTimeout(checkAutofill, 500);
    const t3 = setTimeout(checkAutofill, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [mounted, email, password]);

  // If already authenticated, redirect to user's canonical workspace automatically
  useEffect(() => {
    const session = getAuthSession();
    if (session && session.user) {
      const dest = getDefaultWorkspace(session.user.role);
      router.replace(dest);
    }
  }, [router]);

  const executeLogin = async (targetEmail: string, targetPass: string) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    // Support browser autofill: read directly from refs/DOM as fallback
    const cleanEmail = (targetEmail || emailRef.current?.value || email || '').trim().toLowerCase();
    const cleanPassword = (targetPass || passwordRef.current?.value || password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both username/email and password.');
      setLoading(false);
      return;
    }

    try {
      // STEP 0: Clear any stale cookies from prior sessions via logout
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {
        // ignore
      }
      document.cookie = 'nalka_token=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'nalka_user=; path=/; max-age=0; SameSite=Lax';

      // STEP 1: Authenticate via authoritative backend
      const apiRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          remember_me: rememberMe,
        }),
        credentials: 'include',
      });

      if (!apiRes.ok) {
        const errData = await apiRes.json().catch(() => null);
        setError(errData?.detail || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      const authData = await apiRes.json();
      if (!authData?.access_token || !authData?.user) {
        setError('Authentication failed. Server returned invalid response.');
        setLoading(false);
        return;
      }

      // STEP 2: Save credentials via Browser Credential Management API (Chrome, Edge, Safari, 1Password)
      if (typeof window !== 'undefined' && 'PasswordCredential' in window && navigator.credentials) {
        try {
          const cred = new (window as any).PasswordCredential({
            id: cleanEmail,
            password: cleanPassword,
            name: authData.user.full_name || cleanEmail
          });
          await navigator.credentials.store(cred);
        } catch (credErr) {
          console.debug('Browser credential store:', credErr);
        }
      }

      const authenticatedProfile: UserProfile = {
        id: authData.user.id,
        email: authData.user.email,
        role: authData.user.role,
        full_name: authData.user.full_name,
        salesman_id: authData.user.salesman_id,
      };

      // Set client-readable cookies
      setAuthSession(authData.access_token, authenticatedProfile, rememberMe);

      // STEP 3: Determine redirect destination
      const normalizedRole = (authenticatedProfile.role || '').toLowerCase();
      const defaultDest = getDefaultWorkspace(normalizedRole);

      const fromParam = searchParams?.get('from');
      let destination = defaultDest;
      if (fromParam && fromParam.startsWith('/')) {
        const fromWorkspace = fromParam.startsWith('/management') ? 'management'
          : fromParam.startsWith('/operations') ? 'operations'
          : fromParam.startsWith('/sales') ? 'sales'
          : null;
        if (fromWorkspace && hasWorkspaceAccess(fromWorkspace as any, normalizedRole)) {
          destination = fromParam;
        }
      }

      // Brief tick to allow browser password manager hook to process before route unmount
      setTimeout(() => {
        router.push(destination);
      }, 50);

    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submittedEmail = (formData.get('username') as string || emailRef.current?.value || email || '').trim();
    const submittedPassword = (formData.get('password') as string || passwordRef.current?.value || password || '').trim();
    executeLogin(submittedEmail, submittedPassword);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 bg-slate-950">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Business Ops Platform</h1>
          <p className="text-xs text-slate-400">Unified Single Sign-On</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form with standard browser autocomplete and credential manager compliance */}
        <form
          ref={formRef}
          id="login-form"
          name="login_form"
          method="POST"
          action="/login"
          onSubmit={handleFormSubmit}
          autoComplete="on"
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-xs font-semibold text-slate-300">
              Username or Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                id="username"
                ref={emailRef}
                type="text"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="Enter your username or email"
                defaultValue={email}
                onChange={(e) => setEmail(e.target.value)}
                onInput={(e: React.FormEvent<HTMLInputElement>) => setEmail((e.target as HTMLInputElement).value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                id="password"
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                defaultValue={password}
                onChange={(e) => setPassword(e.target.value)}
                onInput={(e: React.FormEvent<HTMLInputElement>) => setPassword((e.target as HTMLInputElement).value)}
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Keep Me Logged In */}
          <div className="flex items-center gap-2">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="remember" className="text-xs text-slate-400 cursor-pointer select-none">
              Keep me logged in
            </label>
          </div>

          <button
            id="login-submit"
            name="login_submit"
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
