'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, getDefaultWorkspace } from '@/shared/auth';

export default function PlatformDashboard() {
  const router = useRouter();

  useEffect(() => {
    const session = getAuthSession();
    if (!session || !session.token || !session.user) {
      router.replace('/login');
    } else {
      const destination = getDefaultWorkspace(session.user.role);
      router.replace(destination);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-400 font-medium">Redirecting to authorized workspace...</p>
      </div>
    </div>
  );
}
