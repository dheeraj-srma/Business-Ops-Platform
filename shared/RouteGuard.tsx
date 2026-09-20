'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, hasWorkspaceAccess, getDefaultWorkspace } from './auth';
import { ShieldAlert } from 'lucide-react';

interface RouteGuardProps {
  workspace: 'sales' | 'operations' | 'management';
  children: React.ReactNode;
}

export default function RouteGuard({ workspace, children }: RouteGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = () => {
      const session = getAuthSession();

      if (!session || !session.user) {
        // Unauthenticated -> redirect to login
        router.push('/login');
        return;
      }

      const userRole = session.user.role || 'viewer';
      const isAllowed = hasWorkspaceAccess(workspace, userRole);

      if (!isAllowed) {
        // Unauthorized -> redirect to user's allowed default workspace
        const redirectPath = getDefaultWorkspace(userRole);
        router.push(redirectPath);
        return;
      }

      setAuthorized(true);
      setLoading(false);
    };

    checkAuth();

    if (typeof window !== 'undefined') {
      window.addEventListener('nalka_auth_change', checkAuth);
      window.addEventListener('storage', checkAuth);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('nalka_auth_change', checkAuth);
        window.removeEventListener('storage', checkAuth);
      }
    };
  }, [workspace, router]);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">Verifying Workspace Authorization...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
