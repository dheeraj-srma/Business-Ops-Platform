'use client';

import React from 'react';

export interface InScreenLoaderProps {
  message?: string;
  minHeight?: string;
}

export default function InScreenLoader({
  message = 'Loading...',
  minHeight = 'min-h-[60vh]',
}: InScreenLoaderProps) {
  return (
    <div className={`flex items-center justify-center ${minHeight} w-full select-none py-12`}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 border-3 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto shadow-md shadow-indigo-500/20" />
        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium tracking-wide">{message}</p>
      </div>
    </div>
  );
}

export { InScreenLoader };
