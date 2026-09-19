'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrdersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sales');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center text-slate-400 text-sm">
        Redirecting to Sales...
      </div>
    </div>
  );
}
